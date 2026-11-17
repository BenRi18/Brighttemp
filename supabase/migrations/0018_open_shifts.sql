-- =====================================================================
-- The shift board: a practice posts a gap, locums put their hand up,
-- the practice picks one.
--
-- The existing flow runs the other way — the practice searches, picks a
-- named locum and requests them. That works when they know who they
-- want. It does not when they just need Tuesday covered and do not mind
-- by whom.
--
-- Two decisions shape everything here:
--
--   No rate on the post. Locums set their own rates on Brighttemp and
--   that does not change because the practice posted the gap rather
--   than picking the person. Each claim carries the claimant's rate.
--
--   The practice picks. Several locums can put their hand up; the
--   practice sees them side by side with what each costs and chooses.
--   Hence claims as rows of their own rather than first-tap-wins:
--   with no rate on the post, the moment the practice compares cost IS
--   the moment they choose, and showing them one rate to take or leave
--   would be worse than showing them three.
--
-- A booking is created only when the practice awards the shift. Up to
-- that point nothing exists that could double-book anyone, and the
-- locum is free to take other work — which is why awarding re-checks
-- everything rather than trusting what the claim said.
-- =====================================================================

create type public.open_shift_status  as enum ('open', 'filled', 'withdrawn', 'expired');
create type public.shift_claim_status as enum ('offered', 'accepted', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------
-- 1. The posted gap.
-- ---------------------------------------------------------------------
create table public.open_shifts (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references public.practices(id) on delete cascade,
  role_id      uuid not null references public.roles(id),

  shift_date   date not null,
  start_time   time not null,
  finish_time  time not null,
  hours        numeric(5,2) generated always as
                 (round((extract(epoch from (finish_time - start_time)) / 3600.0)::numeric, 2)) stored,
  notes        text,

  status       open_shift_status not null default 'open',
  -- Set when the practice awards it. The booking is the real record from
  -- then on; the shift row stays as the history of how it was filled.
  booking_id   uuid references public.bookings(id) on delete set null,

  created_by   uuid references public.profiles(id),
  filled_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check (finish_time > start_time)
);

create index open_shifts_board_idx on public.open_shifts (shift_date)
  where status = 'open';
create index open_shifts_practice_idx on public.open_shifts (practice_id, shift_date desc);

create trigger open_shifts_touch before update on public.open_shifts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2. A locum putting their hand up.
--
--    hourly_rate is snapshotted at claim time. The practice is choosing
--    partly on cost, so the number they are shown must not move between
--    looking and awarding.
-- ---------------------------------------------------------------------
create table public.shift_claims (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references public.open_shifts(id) on delete cascade,
  locum_id     uuid not null references public.locums(id) on delete cascade,

  hourly_rate  numeric(6,2) not null check (hourly_rate > 0),
  message      text,

  status       shift_claim_status not null default 'offered',
  created_at   timestamptz not null default now(),

  unique (shift_id, locum_id)
);

create index shift_claims_shift_idx on public.shift_claims (shift_id, status);
create index shift_claims_locum_idx on public.shift_claims (locum_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. Who may see a shift, and claim it.
--
--    Four things have to be true, and all four are checked again at
--    claim time and again at award time, because every one of them can
--    change while a shift sits on the board: a certificate expires, the
--    locum takes other work, an admin suspends them.
-- ---------------------------------------------------------------------
create or replace function public.locum_may_claim(p_locum_id uuid, p_shift_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.open_shifts s
      join public.practices p on p.id = s.practice_id
      join public.locums l on l.id = p_locum_id
     where s.id = p_shift_id
       and s.status = 'open'
       and s.shift_date >= current_date
       -- right job, and allowed to work at all
       and l.role_id = s.role_id
       and l.is_bookable
       and l.archived_at is null
       -- near enough, by both the practice's reach and the locum's own
       and (
         p.latitude is null or l.latitude is null
         or public.distance_miles(p.latitude, p.longitude, l.latitude, l.longitude)
              <= l.travel_radius_miles::double precision
       )
       -- not already working then
       and not exists (
         select 1 from public.bookings b
          where b.locum_id = l.id
            and b.booking_date = s.shift_date
            and b.status in ('requested', 'accepted', 'confirmed', 'completed')
            and tsrange(b.booking_date + b.start_time, b.booking_date + b.finish_time)
                && tsrange(s.shift_date + s.start_time, s.shift_date + s.finish_time)
       )
  );
$$;

-- ---------------------------------------------------------------------
-- 4. The board, as a locum sees it.
--
--    A function rather than a view so the eligibility rules live in one
--    place, and so it can be called for a specific locum by the trigger
--    that sends the "new shift posted" notifications.
-- ---------------------------------------------------------------------
create or replace function public.open_shifts_for_locum(p_locum_id uuid)
returns table (
  shift_id      uuid,
  practice_name text,
  practice_city text,
  role_name     text,
  shift_date    date,
  start_time    time,
  finish_time   time,
  hours         numeric,
  notes         text,
  distance_miles double precision,
  your_rate     numeric,
  your_total    numeric,
  already_claimed boolean
)
language sql stable security definer set search_path = public as $$
  select
    s.id, p.name, p.city, r.name,
    s.shift_date, s.start_time, s.finish_time, s.hours, s.notes,
    case when p.latitude is null or l.latitude is null then null
         else round(public.distance_miles(p.latitude, p.longitude,
                                          l.latitude, l.longitude)::numeric, 1)::double precision
    end,
    rate.hourly_rate,
    round(coalesce(rate.hourly_rate, 0) * s.hours, 2),
    exists (select 1 from public.shift_claims c
             where c.shift_id = s.id and c.locum_id = l.id
               and c.status in ('offered', 'accepted'))
  from public.open_shifts s
  join public.practices p on p.id = s.practice_id
  join public.roles r on r.id = s.role_id
  join public.locums l on l.id = p_locum_id
  left join lateral (
    select lr.hourly_rate
      from public.locum_rates lr
     where lr.locum_id = l.id
       and lr.day_type = public.day_type_for(s.shift_date)
       and lr.status = 'approved'
       and lr.effective_to is null
     limit 1
  ) rate on true
  where public.locum_may_claim(l.id, s.id)
  order by s.shift_date, s.start_time;
$$;

-- ---------------------------------------------------------------------
-- 5. Claiming.
--
--    The rate is read here, not taken from the caller, so a locum cannot
--    claim at a rate they have not had approved.
-- ---------------------------------------------------------------------
create or replace function public.claim_shift(p_shift_id uuid, p_message text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_locum uuid := public.my_locum_id();
  v_rate  numeric;
  v_claim uuid;
begin
  if v_locum is null then
    raise exception 'Not a locum account' using errcode = '42501';
  end if;

  if not public.locum_may_claim(v_locum, p_shift_id) then
    raise exception 'That shift is no longer open to you' using errcode = 'P0001';
  end if;

  select lr.hourly_rate into v_rate
    from public.open_shifts s
    join public.locum_rates lr
      on lr.locum_id = v_locum
     and lr.day_type = public.day_type_for(s.shift_date)
     and lr.status = 'approved'
     and lr.effective_to is null
   where s.id = p_shift_id;

  if v_rate is null then
    raise exception 'Set an approved rate for that day type before claiming shifts'
      using errcode = 'P0001';
  end if;

  insert into public.shift_claims (shift_id, locum_id, hourly_rate, message)
  values (p_shift_id, v_locum, v_rate, nullif(p_message, ''))
  on conflict (shift_id, locum_id) do update
    set status = 'offered', hourly_rate = excluded.hourly_rate,
        message = excluded.message, created_at = now()
  returning id into v_claim;

  return v_claim;
end $$;

create or replace function public.withdraw_claim(p_shift_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_locum uuid := public.my_locum_id();
begin
  if v_locum is null then
    raise exception 'Not a locum account' using errcode = '42501';
  end if;

  update public.shift_claims
     set status = 'withdrawn'
   where shift_id = p_shift_id and locum_id = v_locum and status = 'offered';

  if not found then
    raise exception 'Nothing to withdraw';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Awarding.
--
--    Everything is re-checked here. A claim is a statement about how
--    things were when it was made; by the time the practice gets round
--    to choosing, the locum may have taken other work, let a certificate
--    lapse, or been suspended. The booking is built from the claim's
--    snapshotted rate but the fee is worked out fresh, because fees are
--    Brighttemp's and are whatever they are on the day.
--
--    The shift row is locked first. Two managers of the same practice
--    clicking at the same moment is the realistic race here, and the
--    lock means the second one finds the shift already filled instead of
--    creating a second booking for the same gap.
-- ---------------------------------------------------------------------
create or replace function public.award_shift(p_shift_id uuid, p_claim_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_shift   public.open_shifts;
  v_claim   public.shift_claims;
  v_fee     numeric;
  v_booking uuid;
begin
  select * into v_shift from public.open_shifts
   where id = p_shift_id for update;

  if not found then
    raise exception 'That shift no longer exists';
  end if;

  if not (public.is_practice_manager(v_shift.practice_id) or public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if v_shift.status <> 'open' then
    raise exception 'That shift is already %', v_shift.status using errcode = 'P0001';
  end if;

  select * into v_claim from public.shift_claims
   where id = p_claim_id and shift_id = p_shift_id and status = 'offered';

  if not found then
    raise exception 'That locum is no longer offering for this shift' using errcode = 'P0001';
  end if;

  -- Still eligible? Re-checked rather than assumed.
  if not public.locum_may_claim(v_claim.locum_id, p_shift_id) then
    raise exception
      'That locum can no longer take this shift — they may have been booked elsewhere '
      'or have a document out of date'
      using errcode = 'P0001';
  end if;

  v_fee := coalesce(public.current_booking_fee(v_shift.role_id, v_shift.shift_date), 0);

  insert into public.bookings
    (practice_id, locum_id, role_id, booking_date, start_time, finish_time,
     locum_hourly_rate, fee_day_type, booking_fee, same_day_surcharge, is_same_day,
     status, confirmed_at, created_by, notes)
  values
    (v_shift.practice_id, v_claim.locum_id, v_shift.role_id,
     v_shift.shift_date, v_shift.start_time, v_shift.finish_time,
     v_claim.hourly_rate, public.day_type_for(v_shift.shift_date), v_fee,
     case when v_shift.shift_date = current_date
          then coalesce(public.current_same_day_surcharge(), 0) else 0 end,
     v_shift.shift_date = current_date,
     'confirmed', now(), auth.uid(), v_shift.notes)
  returning id into v_booking;

  -- Claims are settled BEFORE the shift, because the trigger that tells
  -- the unsuccessful locums fires on the shift going to 'filled' and
  -- looks for claims already marked declined. The other way round it
  -- finds none and nobody is told.
  update public.shift_claims set status = 'accepted' where id = p_claim_id;
  update public.shift_claims set status = 'declined'
   where shift_id = p_shift_id and id <> p_claim_id and status = 'offered';

  update public.open_shifts
     set status = 'filled', booking_id = v_booking, filled_at = now()
   where id = p_shift_id;

  return v_booking;
end $$;

create or replace function public.withdraw_shift(p_shift_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_practice uuid;
begin
  select practice_id into v_practice from public.open_shifts
   where id = p_shift_id and status = 'open' for update;

  if not found then
    raise exception 'That shift is not open';
  end if;

  if not (public.is_practice_manager(v_practice) or public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  -- Claims first, for the same reason as award_shift.
  update public.shift_claims set status = 'declined'
   where shift_id = p_shift_id and status = 'offered';
  update public.open_shifts set status = 'withdrawn' where id = p_shift_id;
end $$;

-- ---------------------------------------------------------------------
-- 7. Shifts nobody took.
--
--    Called by the nightly job. A gap in the past is not a gap anyone
--    can fill, and leaving them 'open' would keep them on the board and
--    in the counts for ever.
-- ---------------------------------------------------------------------
create or replace function public.expire_open_shifts()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with gone as (
    update public.open_shifts
       set status = 'expired'
     where status = 'open' and shift_date < current_date
    returning id
  )
  select count(*) into v_count from gone;

  update public.shift_claims c
     set status = 'declined'
    from public.open_shifts s
   where s.id = c.shift_id and s.status = 'expired' and c.status = 'offered';

  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- 8. RLS.
--
--    Reads are policy-driven; every write goes through the functions
--    above, so there is no insert or update policy for a locum at all.
-- ---------------------------------------------------------------------
alter table public.open_shifts  enable row level security;
alter table public.shift_claims enable row level security;

revoke all on public.open_shifts, public.shift_claims from anon, authenticated;
grant select on public.open_shifts, public.shift_claims to authenticated;
grant insert (practice_id, role_id, shift_date, start_time, finish_time, notes, created_by)
  on public.open_shifts to authenticated;

create policy open_shifts_practice_all on public.open_shifts
  for select to authenticated
  using (public.is_practice_member(practice_id) or public.is_admin());

create policy open_shifts_practice_insert on public.open_shifts
  for insert to authenticated
  with check (public.is_practice_manager(practice_id));

-- A locum sees a shift only while it is open to them. Once it is filled
-- it drops off the board; their own claim row is what they keep.
create policy open_shifts_locum_read on public.open_shifts
  for select to authenticated
  using (
    public.my_locum_id() is not null
    and public.locum_may_claim(public.my_locum_id(), id)
  );

create policy shift_claims_own on public.shift_claims
  for select to authenticated
  using (locum_id = public.my_locum_id());

create policy shift_claims_practice on public.shift_claims
  for select to authenticated
  using (
    exists (
      select 1 from public.open_shifts s
       where s.id = shift_claims.shift_id
         and (public.is_practice_member(s.practice_id) or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------
-- 9. Grants.
-- ---------------------------------------------------------------------
revoke all on function public.locum_may_claim(uuid, uuid) from public;
revoke all on function public.open_shifts_for_locum(uuid) from public;
revoke all on function public.claim_shift(uuid, text) from public;
revoke all on function public.withdraw_claim(uuid) from public;
revoke all on function public.award_shift(uuid, uuid) from public;
revoke all on function public.withdraw_shift(uuid) from public;
revoke all on function public.expire_open_shifts() from public;

grant execute on function public.locum_may_claim(uuid, uuid) to authenticated;
grant execute on function public.open_shifts_for_locum(uuid) to authenticated;
grant execute on function public.claim_shift(uuid, text) to authenticated;
grant execute on function public.withdraw_claim(uuid) to authenticated;
grant execute on function public.award_shift(uuid, uuid) to authenticated;
grant execute on function public.withdraw_shift(uuid) to authenticated;
grant execute on function public.expire_open_shifts() to service_role;
