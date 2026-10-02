-- =====================================================================
-- Orthodontic Therapist, Photo ID, and the September 2026 booking fees.
--
-- Run after 0005_photo_id_doc_type.sql.
-- Safe to re-run: every step checks for what it is about to add.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New role: Orthodontic Therapist
-- ---------------------------------------------------------------------

insert into public.roles (slug, name, requires_gdc, sort_order)
values ('ortho_therapist', 'Orthodontic Therapist', true, 3)
on conflict (slug) do update set name = excluded.name;

-- Keep Receptionist last in the list.
update public.roles set sort_order = 4 where slug = 'receptionist';

-- ---------------------------------------------------------------------
-- 2. Compliance requirements
--    Photo ID is mandatory for every role and never expires.
--    The new role needs the same six documents as a hygienist.
-- ---------------------------------------------------------------------

insert into public.compliance_requirements (role_id, doc_type, is_mandatory, requires_expiry)
select r.id, 'photo_id', true, false
from public.roles r
on conflict (role_id, doc_type) do nothing;

insert into public.compliance_requirements (role_id, doc_type, is_mandatory, requires_expiry)
select
  (select id from public.roles where slug = 'ortho_therapist'),
  cr.doc_type, cr.is_mandatory, cr.requires_expiry
from public.compliance_requirements cr
where cr.role_id = (select id from public.roles where slug = 'hygienist')
on conflict (role_id, doc_type) do nothing;

-- ---------------------------------------------------------------------
-- 3. Booking fees
--    Fees are never edited in place: the current row is closed off today
--    and a new one opens, so past bookings keep the fee they were
--    charged and the invoices already raised still reconcile.
-- ---------------------------------------------------------------------

with wanted (slug, day_type, amount) as (
  values
    ('dental_nurse',    'weekday'::day_type,      30.00),
    ('dental_nurse',    'weekend'::day_type,      35.00),
    ('dental_nurse',    'bank_holiday'::day_type, 45.00),
    ('hygienist',       'weekday'::day_type,      40.00),
    ('hygienist',       'weekend'::day_type,      45.00),
    ('hygienist',       'bank_holiday'::day_type, 50.00),
    ('ortho_therapist', 'weekday'::day_type,      40.00),
    ('ortho_therapist', 'weekend'::day_type,      45.00),
    ('ortho_therapist', 'bank_holiday'::day_type, 50.00),
    ('receptionist',    'weekday'::day_type,      30.00),
    ('receptionist',    'weekend'::day_type,      35.00),
    ('receptionist',    'bank_holiday'::day_type, 40.00)
),
target as (
  select r.id as role_id, w.day_type, w.amount
  from wanted w
  join public.roles r on r.slug = w.slug
),
-- Only touch rates that are actually changing.
changing as (
  select t.*
  from target t
  left join public.fees f
    on f.fee_type = 'booking'
   and f.role_id = t.role_id
   and f.day_type = t.day_type
   and f.effective_to is null
  where f.id is null or f.amount is distinct from t.amount
),
closed as (
  update public.fees f
     set effective_to = current_date
    from changing c
   where f.fee_type = 'booking'
     and f.role_id = c.role_id
     and f.day_type = c.day_type
     and f.effective_to is null
  returning f.id
)
insert into public.fees (fee_type, role_id, day_type, amount, effective_from)
select 'booking', c.role_id, c.day_type, c.amount, current_date
from changing c;

-- =====================================================================
-- What this changed, for reference:
--   Dental Nurse         weekday  £25 → £30   (weekend/bank holiday unchanged)
--   Hygienist            weekday  £30 → £40
--                        weekend  £40 → £45
--                        bank hol £50 → £50   (unchanged)
--   Receptionist         weekday  £20 → £30
--                        weekend  £28 → £35
--                        bank hol £38 → £40
--   Orthodontic Therapist        new, priced as Hygienist
-- Same-day surcharge and cancellation fee are unchanged and can now be
-- edited in the admin dashboard alongside the booking fees.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4. Fee lookup: break ties by when the row was created
--
--    Closing one rate and opening another on the SAME day left two rows
--    with the same effective_from, and "order by effective_from desc"
--    could return either — so a fee change could appear not to apply
--    until the next day. Ordering by created_at as well makes the newest
--    row win. Same fix for the surcharge and cancellation lookups.
-- ---------------------------------------------------------------------

create or replace function public.current_booking_fee(p_role_id uuid, p_date date)
returns numeric language sql stable as $$
  select f.amount
  from public.fees f
  where f.fee_type = 'booking'
    and f.role_id = p_role_id
    and f.day_type = public.day_type_for(p_date)
    and f.effective_from <= p_date
    and (f.effective_to is null or f.effective_to >= p_date)
  order by f.effective_from desc, f.created_at desc
  limit 1;
$$;

create or replace function public.current_same_day_surcharge()
returns numeric language sql stable as $$
  select coalesce((
    select amount from public.fees
    where fee_type = 'same_day_surcharge'
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by effective_from desc, created_at desc limit 1
  ), 0);
$$;

create or replace function public.cancellation_fee_for(p_notice_hours numeric)
returns numeric language sql stable as $$
  select coalesce((
    select amount from public.fees
    where fee_type = 'cancellation'
      and notice_hours_below > p_notice_hours
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by notice_hours_below asc, effective_from desc, created_at desc limit 1
  ), 0);
$$;
