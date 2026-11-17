-- =====================================================================
-- Telling people about shifts.
--
-- Same pattern as bookings (0015/0016): triggers on the rows rather than
-- calls in the app, so every route produces the notification, and
-- SECURITY DEFINER so RLS cannot quietly refuse the insert.
--
-- Three moments matter:
--
--   posted  — every locum who could take it hears once. This is the
--             whole point of a board: a gap nobody knows about is a gap
--             nobody fills.
--   claimed — the practice hears that somebody put their hand up, with
--             the rate, because with no rate on the post that number is
--             what they are deciding on.
--   filled  — the locums who offered and did not get it hear that it has
--             gone, so they stop holding the day.
--
-- The locum who DID get it is told by the booking trigger, which fires
-- on the booking award_shift creates — booking_confirmed, as for any
-- other confirmed booking. Nothing extra here, and nobody gets two.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Notifications can hang off a shift as well as a booking.
-- ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists open_shift_id uuid references public.open_shifts(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. What a shift message is built from.
-- ---------------------------------------------------------------------
create or replace function public.shift_payload(p_shift_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           -- Deliberately 'booking_date', not 'shift_date'. It is the date
           -- of the work either way, and one name means one renderer in the
           -- app rather than a parallel set of templates that drift apart.
           'booking_date',  to_char(s.shift_date, 'FMDay FMDD FMMonth YYYY'),
           'start_time',    to_char(s.start_time, 'HH24:MI'),
           'finish_time',   to_char(s.finish_time, 'HH24:MI'),
           'hours',         s.hours,
           'practice_name', p.name,
           'practice_city', p.city,
           'role_name',     r.name
         )
    from public.open_shifts s
    join public.practices p on p.id = s.practice_id
    join public.roles r on r.id = s.role_id
   where s.id = p_shift_id;
$$;

-- ---------------------------------------------------------------------
-- 3. A shift is posted: tell everyone who could take it.
--
--    Capped. Sixteen locums today, but a board that messages two hundred
--    people every time somebody posts a Tuesday is a board people mute,
--    and on WhatsApp it is also a bill. Nearest first, so the ones most
--    likely to say yes are the ones who hear.
-- ---------------------------------------------------------------------
create or replace function public.notify_shift_posted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_subject text;
begin
  if new.status <> 'open' then
    return new;
  end if;

  v_payload := public.shift_payload(new.id);
  v_subject := (v_payload->>'role_name') || ' shift — ' || (v_payload->>'booking_date');

  insert into public.notifications
    (profile_id, event, channel, recipient, subject, payload, open_shift_id)
  select pr.id, 'shift_posted', c.channel, c.recipient, v_subject, v_payload, new.id
    from public.locums l
    join public.profiles pr on pr.id = l.profile_id
    join public.practices p on p.id = new.practice_id
    cross join lateral (values
        ('email'::notification_channel, pr.email::text),
        ('whatsapp'::notification_channel,
         case when pr.whatsapp_opt_in then public.to_e164_uk(pr.phone) end)
      ) as c(channel, recipient)
   where public.locum_may_claim(l.id, new.id)
     and c.recipient is not null
   order by case
     when p.latitude is null or l.latitude is null then 1e9
     else public.distance_miles(p.latitude, p.longitude, l.latitude, l.longitude)
   end
   limit 60;   -- 30 locums across two channels

  return new;
end $$;

drop trigger if exists open_shifts_notify on public.open_shifts;
create trigger open_shifts_notify
  after insert on public.open_shifts
  for each row execute function public.notify_shift_posted();

-- ---------------------------------------------------------------------
-- 4. A claim arrives: tell the practice, with the rate.
-- ---------------------------------------------------------------------
create or replace function public.notify_shift_claimed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_shift   public.open_shifts;
  v_name    text;
begin
  if new.status <> 'offered' then
    return new;
  end if;

  -- `update of status` fires whenever the column is in the SET list, even
  -- when the value is unchanged. Without this, a locum editing the note on
  -- an existing claim would message the practice a second time.
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.hourly_rate is not distinct from old.hourly_rate then
    return new;
  end if;

  select * into v_shift from public.open_shifts where id = new.shift_id;
  if v_shift.status <> 'open' then
    return new;
  end if;

  select pr.full_name into v_name
    from public.locums l join public.profiles pr on pr.id = l.profile_id
   where l.id = new.locum_id;

  v_payload := public.shift_payload(new.shift_id)
             || jsonb_build_object(
                  'locum_name',  v_name,
                  'hourly_rate', new.hourly_rate,
                  'locum_total', round(new.hourly_rate * v_shift.hours, 2));

  insert into public.notifications
    (profile_id, event, channel, recipient, subject, payload, open_shift_id)
  select pr.id, 'shift_claimed', c.channel, c.recipient,
         v_name || ' is available for your ' || (v_payload->>'booking_date') || ' shift',
         v_payload, new.shift_id
    from public.practice_users pu
    join public.profiles pr on pr.id = pu.profile_id
    cross join lateral (values
        ('email'::notification_channel, pr.email::text),
        ('whatsapp'::notification_channel,
         case when pr.whatsapp_opt_in then public.to_e164_uk(pr.phone) end)
      ) as c(channel, recipient)
   where pu.practice_id = v_shift.practice_id
     and pu.role in ('owner', 'manager')
     and c.recipient is not null;

  return new;
end $$;

drop trigger if exists shift_claims_notify on public.shift_claims;
create trigger shift_claims_notify
  after insert or update of status on public.shift_claims
  for each row execute function public.notify_shift_claimed();

-- ---------------------------------------------------------------------
-- 5. The shift goes: tell the locums who missed out.
--
--    Fires on the shift, not on each claim, so one statement marking
--    four claims declined produces four messages and not sixteen.
-- ---------------------------------------------------------------------
create or replace function public.notify_shift_filled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
begin
  if old.status = 'open' and new.status in ('filled', 'withdrawn') then
    v_payload := public.shift_payload(new.id);

    insert into public.notifications
      (profile_id, event, channel, recipient, subject, payload, open_shift_id)
    select pr.id, 'shift_filled', c.channel, c.recipient,
           'That shift has been filled', v_payload, new.id
      from public.shift_claims sc
      join public.locums l on l.id = sc.locum_id
      join public.profiles pr on pr.id = l.profile_id
      cross join lateral (values
          ('email'::notification_channel, pr.email::text),
          ('whatsapp'::notification_channel,
           case when pr.whatsapp_opt_in then public.to_e164_uk(pr.phone) end)
        ) as c(channel, recipient)
     where sc.shift_id = new.id
       and sc.status = 'declined'
       and c.recipient is not null;
  end if;

  return new;
end $$;

drop trigger if exists open_shifts_filled_notify on public.open_shifts;
create trigger open_shifts_filled_notify
  after update of status on public.open_shifts
  for each row execute function public.notify_shift_filled();

-- ---------------------------------------------------------------------
-- 6. A booking that is born confirmed.
--
--    notify_booking_change assumed every new booking starts life as a
--    request, so it sent booking_requested on any insert. That was true
--    while the only way to create one was a practice asking a named
--    locum. award_shift creates a booking already confirmed — the locum
--    offered, the practice accepted — and the locum was being told "a
--    practice would like to book you, accept or decline" about a shift
--    that was already theirs.
--
--    Caught in testing: awarding a shift sent booking_requested.
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
    case new.status
      -- The usual way in: a practice asking a named locum.
      when 'requested' then v_event := 'booking_requested'; v_side := 'locum';
      -- Created already settled, as award_shift does. Both sides are told
      -- it is on, and nobody is asked to accept something they already did.
      when 'confirmed' then v_event := 'booking_confirmed'; v_side := 'both';
      when 'accepted'  then v_event := 'booking_accepted';  v_side := 'practice';
      else return new;
    end case;

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
  select r.profile_id, v_event, c.channel, c.recipient, v_subject,
         v_payload || jsonb_build_object('side', s.side), new.id
    from unnest(v_sides) as s(side)
    cross join lateral public.booking_recipients(new.id, s.side) r
    cross join lateral (values
        ('email'::notification_channel,    r.email),
        ('whatsapp'::notification_channel, r.whatsapp)
      ) as c(channel, recipient)
   where c.recipient is not null;

  return new;
end $$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row execute function public.notify_booking_change();

revoke all on function public.shift_payload(uuid) from public;
revoke all on function public.notify_shift_posted() from public;
revoke all on function public.notify_shift_claimed() from public;
revoke all on function public.notify_shift_filled() from public;
revoke all on function public.notify_booking_change() from public;
