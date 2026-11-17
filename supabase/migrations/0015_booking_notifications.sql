-- =====================================================================
-- Booking notifications.
--
-- Nothing has ever been sent. Three faults had to be true at once:
--
--   1. No scheduled job drained the queue. Rows went in; nothing came
--      to collect them.
--   2. Only the initial request was enqueued at all. Accept, confirm
--      and cancel enqueued nothing.
--   3. The one enqueue that existed ran as the practice, which has no
--      insert policy on notifications, so RLS refused it every time —
--      and enqueue() swallows its own errors by design, so a booking is
--      never failed by a notification problem and nothing surfaced.
--
-- The fix for (2) and (3) is to raise notifications from a trigger on
-- the booking itself rather than from calls in the app. Every route
-- that changes a booking then produces them — the practice requesting,
-- the locum accepting, cancel_booking(), an admin changing a status by
-- hand — instead of only the ones somebody remembered to add a call to.
-- SECURITY DEFINER, so RLS cannot refuse the insert.
--
-- (1) is the worker route, which lives in the app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Retry bookkeeping.
--
--    The queue needs to know how many times a row has been tried, so a
--    dead address is given up on rather than retried for ever.
-- ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists attempts        int not null default 0,
  add column if not exists last_attempt_at timestamptz;

create index if not exists notifications_queue_idx
  on public.notifications (scheduled_for)
  where status = 'queued';

-- ---------------------------------------------------------------------
-- 2. What a booking message is built from.
--
--    One place, so the email and the WhatsApp message say the same
--    thing, and so the app never has to re-query a booking it is only
--    going to describe.
-- ---------------------------------------------------------------------
create or replace function public.booking_payload(p_booking_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'reference',     b.reference,
           'booking_date',  to_char(b.booking_date, 'FMDay FMDD FMMonth YYYY'),
           'start_time',    to_char(b.start_time, 'HH24:MI'),
           'finish_time',   to_char(b.finish_time, 'HH24:MI'),
           'hours',         b.hours,
           'locum_total',   b.locum_total,
           'practice_name', p.name,
           'practice_city', p.city,
           'locum_name',    pr.full_name,
           'role_name',     r.name
         )
    from public.bookings b
    join public.practices p on p.id = b.practice_id
    join public.roles r on r.id = b.role_id
    join public.locums l on l.id = b.locum_id
    join public.profiles pr on pr.id = l.profile_id
   where b.id = p_booking_id;
$$;

-- ---------------------------------------------------------------------
-- 3. Who hears about it.
--
--    The locum is one person. The practice may be several, or none at
--    all: a practice that registered but has not had an owner account
--    attached yet still has an email on the practice record, and a
--    cancellation has to reach somebody.
-- ---------------------------------------------------------------------
create or replace function public.booking_recipients(
  p_booking_id uuid,
  p_side       text  -- 'locum', 'practice' or 'both'
)
returns table (profile_id uuid, email text)
language sql stable security definer set search_path = public as $$
  with b as (
    select locum_id, practice_id from public.bookings where id = p_booking_id
  )
  select pr.id, pr.email::text
    from b
    join public.locums l on l.id = b.locum_id
    join public.profiles pr on pr.id = l.profile_id
   where p_side in ('locum', 'both')

  union

  select pr.id, pr.email::text
    from b
    join public.practice_users pu on pu.practice_id = b.practice_id
     and pu.role in ('owner', 'manager')
    join public.profiles pr on pr.id = pu.profile_id
   where p_side in ('practice', 'both')

  union

  select null::uuid, p.email::text
    from b
    join public.practices p on p.id = b.practice_id
   where p_side in ('practice', 'both')
     and p.email is not null
     and not exists (
       select 1 from public.practice_users pu
        where pu.practice_id = b.practice_id and pu.role in ('owner', 'manager')
     );
$$;

-- ---------------------------------------------------------------------
-- 4. The trigger.
--
--    Which side hears depends on what happened. A request concerns the
--    locum, who has to answer it. An acceptance concerns the practice,
--    who is waiting. Confirmation and cancellation concern both.
-- ---------------------------------------------------------------------
create or replace function public.notify_booking_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event   notification_event;
  v_side    text;
  v_sides   text[];
  v_subject text;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    v_event := 'booking_requested';
    v_side  := 'locum';

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    case new.status
      when 'accepted'  then v_event := 'booking_accepted';  v_side := 'practice';
      when 'confirmed' then v_event := 'booking_confirmed'; v_side := 'both';
      when 'cancelled' then v_event := 'booking_cancelled'; v_side := 'both';
      else return new;   -- completed, disputed: nothing to send today
    end case;
  else
    return new;
  end if;

  v_sides := case when v_side = 'both'
                  then array['locum', 'practice']
                  else array[v_side] end;

  v_payload := public.booking_payload(new.id);

  v_subject := case v_event
    when 'booking_requested' then
      'New shift request — ' || (v_payload->>'booking_date')
    when 'booking_accepted' then
      (v_payload->>'locum_name') || ' accepted your booking'
    when 'booking_confirmed' then
      'Booking confirmed — ' || (v_payload->>'booking_date')
    when 'booking_cancelled' then
      'Booking cancelled — ' || (v_payload->>'booking_date')
  end;

  insert into public.notifications
    (profile_id, event, channel, recipient, subject, payload, booking_id)
  select r.profile_id, v_event, 'email', r.email, v_subject,
         -- The side decides which portal the link points at: the same
         -- booking lives at /locum/bookings/x and /practice/bookings/x.
         v_payload || jsonb_build_object('side', s.side),
         new.id
    from unnest(v_sides) as s(side)
    cross join lateral public.booking_recipients(new.id, s.side) r
   where r.email is not null;

  return new;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row execute function public.notify_booking_change();

-- ---------------------------------------------------------------------
-- 5. Handing rows to the worker.
--
--    SKIP LOCKED so two runs never take the same row at the same
--    instant, and attempts < 5 so a dead address is eventually given up
--    on instead of being retried for ever.
-- ---------------------------------------------------------------------
create or replace function public.claim_notifications(p_limit int default 50)
returns setof public.notifications
language plpgsql security definer set search_path = public as $$
begin
  return query
    update public.notifications n
       set attempts        = n.attempts + 1,
           last_attempt_at = now()
     where n.id in (
       select id from public.notifications
        where status = 'queued'
          and scheduled_for <= now()
          and attempts < 5
        order by scheduled_for
         limit greatest(p_limit, 0)
       for update skip locked
     )
    returning n.*;
end $$;

-- ---------------------------------------------------------------------
-- 6. Grants. The worker runs as service_role and bypasses RLS; nothing
--    here is callable by a practice or a locum.
-- ---------------------------------------------------------------------
revoke all on function public.booking_payload(uuid) from public;
revoke all on function public.booking_recipients(uuid, text) from public;
revoke all on function public.notify_booking_change() from public;
revoke all on function public.claim_notifications(int) from public;

grant execute on function public.claim_notifications(int) to service_role;
