-- =====================================================================
-- WhatsApp alongside email.
--
-- 0015 made booking notifications happen and queued them as email. This
-- adds a second row on the same queue for anyone who has opted in to
-- WhatsApp and has a mobile we can reach, so the two channels share one
-- pipeline, one retry count and one audit trail.
--
-- Email is never dropped in favour of WhatsApp. A WhatsApp message can
-- fail for reasons email cannot — the recipient is not on WhatsApp, the
-- template has not been approved, the 24-hour window has closed — and a
-- practice finding out about a cancellation eventually is much better
-- than not at all.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Phone numbers WhatsApp will accept.
--
--    WhatsApp needs E.164: +447700900123, no spaces. Numbers are typed
--    into the registration form however people write them — 07700 900
--    123, (07700) 900123, +44 7700 900123 — so they are normalised here
--    rather than hoping.
--
--    Returns null for anything that is not a mobile. A landline is
--    accepted by the API and then simply never delivers, which costs a
--    message and loses the notification silently; better to send only
--    the email in that case.
-- ---------------------------------------------------------------------
create or replace function public.to_e164_uk(p_phone text)
returns text language plpgsql immutable as $$
declare
  v text;
begin
  if p_phone is null then
    return null;
  end if;

  -- Digits and a leading plus; everything else is formatting.
  v := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  v := regexp_replace(v, '(.)\+', '\1', 'g');   -- a plus mid-number is noise
  v := regexp_replace(v, '^00', '+');           -- 00 is the same as +

  if v = '' then
    return null;
  end if;

  -- Already international and not UK: trust what was given. A locum with
  -- an Irish or Polish mobile is perfectly normal here.
  if v like '+%' and v not like '+44%' then
    return case when length(v) between 8 and 16 then v else null end;
  end if;

  v := regexp_replace(v, '^\+?44', '');   -- country code
  v := regexp_replace(v, '^0', '');       -- national trunk zero

  -- A UK mobile is 7 followed by nine digits once both are off.
  if v ~ '^7[0-9]{9}$' then
    return '+44' || v;
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. Recipients now carry a WhatsApp number as well as an address.
--
--    Dropped and recreated rather than replaced: the return type is
--    changing, and `create or replace` cannot do that.
--
--    A number alone is not enough — whatsapp_opt_in has to be true. It
--    is collected at registration, and messaging someone who did not ask
--    for it is both rude and, for a business sender, a fast route to
--    being reported and blocked.
--
--    The practice fallback (a practice with no owner or manager account
--    attached yet) stays email-only: there is a number on the practice
--    record but no person who agreed to be messaged on it.
-- ---------------------------------------------------------------------
drop function if exists public.booking_recipients(uuid, text);

create or replace function public.booking_recipients(
  p_booking_id uuid,
  p_side       text  -- 'locum', 'practice' or 'both'
)
returns table (profile_id uuid, email text, whatsapp text)
language sql stable security definer set search_path = public as $$
  with b as (
    select locum_id, practice_id from public.bookings where id = p_booking_id
  )
  select pr.id, pr.email::text,
         case when pr.whatsapp_opt_in then public.to_e164_uk(pr.phone) end
    from b
    join public.locums l on l.id = b.locum_id
    join public.profiles pr on pr.id = l.profile_id
   where p_side in ('locum', 'both')

  union

  select pr.id, pr.email::text,
         case when pr.whatsapp_opt_in then public.to_e164_uk(pr.phone) end
    from b
    join public.practice_users pu on pu.practice_id = b.practice_id
     and pu.role in ('owner', 'manager')
    join public.profiles pr on pr.id = pu.profile_id
   where p_side in ('practice', 'both')

  union

  select null::uuid, p.email::text, null::text
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
-- 3. The trigger, queuing both channels.
--
--    One insert rather than four near-identical ones. The two small
--    value lists are the whole of it: which sides this event goes to,
--    and which channels each recipient can take. A recipient with no
--    WhatsApp number produces a null there and is filtered out, so
--    somebody who has not opted in simply gets the email as before.
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
      else return new;
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
  select r.profile_id,
         v_event,
         c.channel,
         c.recipient,
         v_subject,
         v_payload || jsonb_build_object('side', s.side),
         new.id
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

-- ---------------------------------------------------------------------
-- 4. Stop two runs sending the same message.
--
--    0015 claims rows with FOR UPDATE SKIP LOCKED and leaves them
--    'queued' until the sender says otherwise. That protects against two
--    transactions grabbing a row at the same instant, but not against the
--    case that actually happens: the claim commits, the sender is still
--    waiting on Resend or Twilio, the next scheduled run starts and finds
--    the row sitting there as 'queued' — and sends it again.
--
--    Proven: two sequential calls to claim_notifications returned the
--    same five rows.
--
--    So a row that was handed over in the last few minutes is treated as
--    in flight and skipped. If the worker dies mid-run the row becomes
--    visible again once the window passes, which is the behaviour we
--    want — late is recoverable, twice is not.
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
          and (last_attempt_at is null
               or last_attempt_at < now() - interval '5 minutes')
        order by scheduled_for
         limit greatest(p_limit, 0)
       for update skip locked
     )
    returning n.*;
end $$;

-- ---------------------------------------------------------------------
-- 5. Grants, as 0015.
-- ---------------------------------------------------------------------
revoke all on function public.to_e164_uk(text) from public;
revoke all on function public.booking_recipients(uuid, text) from public;
revoke all on function public.notify_booking_change() from public;
revoke all on function public.claim_notifications(int) from public;

grant execute on function public.to_e164_uk(text) to authenticated, service_role;
grant execute on function public.claim_notifications(int) to service_role;
