-- =====================================================================
-- Brighttemp — database schema
-- Postgres 15+ / Supabase
-- Run order: 01_schema.sql  →  02_rls.sql
-- =====================================================================

create extension if not exists "pgcrypto";    -- gen_random_uuid()
create extension if not exists "btree_gist";  -- double-booking exclusion constraint
create extension if not exists "citext";      -- case-insensitive email

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------

create type user_type          as enum ('practice', 'locum', 'admin');
create type account_status     as enum ('pending', 'approved', 'rejected', 'suspended');
create type admin_role         as enum ('super_admin', 'operations', 'compliance', 'finance');
create type practice_user_role as enum ('owner', 'manager', 'staff');
create type trust_level        as enum ('new', 'trusted');          -- trusted = instant booking
create type day_type           as enum ('weekday', 'weekend', 'bank_holiday');

create type compliance_doc_type as enum (
  'gdc_registration', 'dbs', 'indemnity_insurance',
  'hepatitis_b', 'cpr_certificate', 'infection_control'
);
create type compliance_status as enum (
  'pending', 'under_review', 'approved', 'expiring_soon', 'expired', 'rejected'
);

create type rate_status    as enum ('pending', 'approved', 'rejected', 'superseded');
create type booking_status as enum ('requested', 'accepted', 'confirmed', 'completed', 'cancelled', 'disputed');
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
create type payment_method as enum ('bank_transfer', 'card', 'direct_debit', 'other');
create type fee_type       as enum ('booking', 'same_day_surcharge', 'cancellation');
create type actor_type     as enum ('practice', 'locum', 'admin', 'system');

create type notification_channel as enum ('email', 'whatsapp', 'in_app');
create type notification_status  as enum ('queued', 'sent', 'failed', 'suppressed');
create type notification_event   as enum (
  'registration_received', 'account_approved', 'account_rejected',
  'booking_requested', 'booking_accepted', 'booking_declined',
  'booking_confirmed', 'booking_cancelled', 'booking_reminder',
  'invoice_issued', 'invoice_reminder', 'invoice_overdue',
  'compliance_expiring', 'compliance_expired', 'compliance_rejected',
  'rate_change_requested', 'rate_change_approved', 'same_day_booking'
);

-- ---------------------------------------------------------------------
-- 2. SHARED TRIGGER: updated_at
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. IDENTITY
--    profiles is the join between Supabase auth.users and the domain.
-- ---------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  user_type    user_type not null,
  full_name    text not null,
  email        citext not null unique,
  phone        text,
  whatsapp_opt_in boolean not null default false,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_user_type_idx on public.profiles (user_type);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.admin_users (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  admin_role  admin_role not null default 'operations',
  permissions jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. REFERENCE DATA — roles, compliance requirements, bank holidays
-- ---------------------------------------------------------------------

create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  requires_gdc boolean not null default true,
  is_active    boolean not null default true,
  sort_order   int not null default 0
);

insert into public.roles (slug, name, requires_gdc, sort_order) values
  ('dental_nurse', 'Dental Nurse',      true,  1),
  ('hygienist',    'Dental Hygienist',  true,  2),
  ('receptionist', 'Receptionist',      false, 3);

-- Which documents each role must hold. Admin-editable.
create table public.compliance_requirements (
  id              uuid primary key default gen_random_uuid(),
  role_id         uuid not null references public.roles(id) on delete cascade,
  doc_type        compliance_doc_type not null,
  is_mandatory    boolean not null default true,
  requires_expiry boolean not null default true,
  expiry_warning_days int not null default 30,
  unique (role_id, doc_type)
);

insert into public.compliance_requirements (role_id, doc_type, is_mandatory, requires_expiry)
select r.id, d.doc_type, d.mandatory, d.expires
from public.roles r
cross join (values
  ('gdc_registration'::compliance_doc_type, true,  true),
  ('dbs'::compliance_doc_type,              true,  false),
  ('indemnity_insurance'::compliance_doc_type, true, true),
  ('hepatitis_b'::compliance_doc_type,      true,  false),
  ('cpr_certificate'::compliance_doc_type,  true,  true),
  ('infection_control'::compliance_doc_type, true, true)
) as d(doc_type, mandatory, expires)
where r.requires_gdc or d.doc_type in ('dbs', 'infection_control');

create table public.bank_holidays (
  holiday_date date primary key,
  name         text not null,
  region       text not null default 'england-and-wales'
);

-- ---------------------------------------------------------------------
-- 5. PRACTICES
-- ---------------------------------------------------------------------

create table public.practices (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  trading_name   text,
  address_line1  text not null,
  address_line2  text,
  city           text not null,
  postcode       text not null,
  latitude       double precision,
  longitude      double precision,
  phone          text,
  email          citext,
  cqc_provider_id text,

  status         account_status not null default 'pending',
  trust_level    trust_level not null default 'new',

  -- billing
  billing_email        citext,
  billing_address      text,
  vat_number           text,
  payment_terms_days   int not null default 14,
  purchase_order_required boolean not null default false,

  approved_at    timestamptz,
  approved_by    uuid references public.profiles(id),
  suspended_at   timestamptz,
  suspension_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index practices_status_idx on public.practices (status);
create index practices_postcode_idx on public.practices (postcode);
create trigger practices_touch before update on public.practices
  for each row execute function public.touch_updated_at();

create table public.practice_users (
  id          uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        practice_user_role not null default 'staff',
  is_primary  boolean not null default false,
  invited_at  timestamptz,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (practice_id, profile_id)
);
create index practice_users_profile_idx on public.practice_users (profile_id);
create unique index practice_users_one_primary_idx
  on public.practice_users (practice_id) where is_primary;

-- ---------------------------------------------------------------------
-- 6. LOCUMS
-- ---------------------------------------------------------------------

create table public.locums (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null unique references public.profiles(id) on delete cascade,
  role_id       uuid not null references public.roles(id),

  gdc_number    text,
  gdc_expiry    date,
  years_experience int not null default 0,
  bio           text,
  specialisms   text[] not null default '{}',

  base_postcode text not null,
  latitude      double precision,
  longitude     double precision,
  travel_radius_miles int not null default 20
                check (travel_radius_miles between 1 and 200),

  status        account_status not null default 'pending',
  -- maintained by trigger: approved AND all mandatory compliance in date
  is_bookable   boolean not null default false,

  approved_at   timestamptz,
  approved_by   uuid references public.profiles(id),
  suspended_at  timestamptz,
  suspension_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index locums_role_idx on public.locums (role_id);
create index locums_bookable_idx on public.locums (is_bookable) where is_bookable;
create index locums_geo_idx on public.locums (latitude, longitude);
create trigger locums_touch before update on public.locums
  for each row execute function public.touch_updated_at();

-- Rates: one approved row per (locum, day_type). History kept via superseded.
create table public.locum_rates (
  id           uuid primary key default gen_random_uuid(),
  locum_id     uuid not null references public.locums(id) on delete cascade,
  day_type     day_type not null,
  hourly_rate  numeric(6,2) not null check (hourly_rate > 0 and hourly_rate <= 500),
  status       rate_status not null default 'pending',
  effective_from date not null default current_date,
  effective_to   date,
  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id),
  review_note  text
);
create unique index locum_rates_active_idx
  on public.locum_rates (locum_id, day_type)
  where status = 'approved' and effective_to is null;
create index locum_rates_locum_idx on public.locum_rates (locum_id, status);

-- Availability: one row per locum per date.
create table public.locum_availability (
  id           uuid primary key default gen_random_uuid(),
  locum_id     uuid not null references public.locums(id) on delete cascade,
  available_on date not null,
  is_available boolean not null default true,
  start_time   time,
  finish_time  time,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (locum_id, available_on),
  check (not is_available or (start_time is not null and finish_time is not null)),
  check (start_time is null or finish_time > start_time)
);
create index locum_availability_date_idx on public.locum_availability (available_on)
  where is_available;
create trigger locum_availability_touch before update on public.locum_availability
  for each row execute function public.touch_updated_at();

-- Compliance documents. File itself lives in a private storage bucket.
create table public.compliance_documents (
  id            uuid primary key default gen_random_uuid(),
  locum_id      uuid not null references public.locums(id) on delete cascade,
  doc_type      compliance_doc_type not null,
  storage_path  text not null,           -- private bucket object path, never public
  original_filename text,
  mime_type     text,
  size_bytes    bigint,

  issue_date    date,
  expiry_date   date,
  reference     text,                    -- e.g. DBS certificate number

  status        compliance_status not null default 'pending',
  is_current    boolean not null default true,

  uploaded_at   timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id),
  rejection_reason text,
  updated_at    timestamptz not null default now()
);
create unique index compliance_documents_current_idx
  on public.compliance_documents (locum_id, doc_type) where is_current;
create index compliance_documents_status_idx on public.compliance_documents (status);
create index compliance_documents_expiry_idx on public.compliance_documents (expiry_date)
  where is_current;
create trigger compliance_documents_touch before update on public.compliance_documents
  for each row execute function public.touch_updated_at();

-- Practices can favourite locums.
create table public.favourite_locums (
  practice_id uuid not null references public.practices(id) on delete cascade,
  locum_id    uuid not null references public.locums(id) on delete cascade,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (practice_id, locum_id)
);

-- ---------------------------------------------------------------------
-- 7. FEES  (admin-editable, no developer involvement)
-- ---------------------------------------------------------------------

create table public.fees (
  id             uuid primary key default gen_random_uuid(),
  fee_type       fee_type not null,
  role_id        uuid references public.roles(id) on delete cascade,
  day_type       day_type,
  amount         numeric(8,2) not null check (amount >= 0),
  -- cancellation fees only: applies when notice is below this many hours
  notice_hours_below int,
  effective_from date not null default current_date,
  effective_to   date,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  check (fee_type <> 'booking' or (role_id is not null and day_type is not null)),
  check (fee_type <> 'cancellation' or notice_hours_below is not null)
);
create index fees_lookup_idx on public.fees (fee_type, role_id, day_type, effective_from desc);

insert into public.fees (fee_type, role_id, day_type, amount)
select 'booking', r.id, d.day_type, d.amount
from public.roles r
join (values
  ('dental_nurse','weekday'::day_type,25.00),('dental_nurse','weekend',35.00),('dental_nurse','bank_holiday',45.00),
  ('hygienist','weekday',30.00),('hygienist','weekend',40.00),('hygienist','bank_holiday',50.00),
  ('receptionist','weekday',20.00),('receptionist','weekend',28.00),('receptionist','bank_holiday',38.00)
) as d(slug, day_type, amount) on d.slug = r.slug;

insert into public.fees (fee_type, amount) values ('same_day_surcharge', 10.00);
insert into public.fees (fee_type, amount, notice_hours_below) values ('cancellation', 30.00, 24);

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

insert into public.platform_settings (key, value, description) values
  ('vat_rate',                    '0.20',  'VAT applied to Brighttemp booking fees'),
  ('vat_registered',              'true',  'Whether Brighttemp charges VAT'),
  ('invoice_payment_terms_days',  '14',    'Default days from issue to due date'),
  ('same_day_requires_approval',  'true',  'Same-day bookings need Brighttemp approval'),
  ('new_practice_requires_approval','true','New practices cannot instant-book'),
  ('booking_reminder_hours_before','24',   'When to send the shift reminder'),
  ('compliance_warning_days',     '30',    'Days before expiry to flag Expiring Soon');

-- ---------------------------------------------------------------------
-- 8. BOOKINGS
-- ---------------------------------------------------------------------

create sequence public.booking_reference_seq;

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique
                  default 'BT-' || to_char(now(), 'YYYY') || '-' ||
                          lpad(nextval('public.booking_reference_seq')::text, 6, '0'),
  practice_id   uuid not null references public.practices(id) on delete restrict,
  locum_id      uuid not null references public.locums(id) on delete restrict,
  role_id       uuid not null references public.roles(id),

  booking_date  date not null,
  start_time    time not null,
  finish_time   time not null,
  hours         numeric(5,2) generated always as
                  (round((extract(epoch from (finish_time - start_time)) / 3600.0)::numeric, 2)) stored,

  -- money, snapshotted at booking time so later rate changes don't rewrite history
  locum_hourly_rate numeric(6,2) not null check (locum_hourly_rate > 0),
  locum_total   numeric(10,2) generated always as
                  (round(locum_hourly_rate *
                    (extract(epoch from (finish_time - start_time)) / 3600.0)::numeric, 2)) stored,
  fee_day_type  day_type not null,
  booking_fee   numeric(8,2) not null check (booking_fee >= 0),
  same_day_surcharge numeric(8,2) not null default 0,
  is_same_day   boolean not null default false,

  status        booking_status not null default 'requested',
  requires_admin_approval boolean not null default false,
  notes         text,

  created_by    uuid references public.profiles(id),
  requested_at  timestamptz not null default now(),
  accepted_at   timestamptz,
  confirmed_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  check (finish_time > start_time)
);

create index bookings_practice_idx on public.bookings (practice_id, booking_date desc);
create index bookings_locum_idx    on public.bookings (locum_id, booking_date desc);
create index bookings_status_idx   on public.bookings (status);
create index bookings_date_idx     on public.bookings (booking_date);
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Total the practice pays out, in two clearly separate parts.
create view public.booking_costs as
select
  b.id as booking_id,
  b.reference,
  b.locum_total                                as paid_to_locum,
  b.booking_fee + b.same_day_surcharge         as paid_to_brighttemp,
  b.locum_total + b.booking_fee + b.same_day_surcharge as total_practice_cost
from public.bookings b;

-- Hard guarantee against double booking the same locum.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    locum_id with =,
    tsrange(booking_date + start_time, booking_date + finish_time) with &&
  )
  where (status in ('requested', 'accepted', 'confirmed', 'completed'));

create table public.booking_status_history (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  from_status booking_status,
  to_status   booking_status not null,
  changed_by  uuid references public.profiles(id),
  actor       actor_type not null default 'system',
  reason      text,
  changed_at  timestamptz not null default now()
);
create index booking_status_history_booking_idx
  on public.booking_status_history (booking_id, changed_at desc);

create table public.cancellations (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null unique references public.bookings(id) on delete cascade,
  cancelled_by   uuid references public.profiles(id),
  cancelled_by_type actor_type not null,
  cancelled_at   timestamptz not null default now(),
  notice_hours   numeric(8,2) not null,
  reason         text,
  cancellation_fee numeric(8,2) not null default 0,
  fee_waived     boolean not null default false,
  waived_by      uuid references public.profiles(id),
  notifications_sent_at timestamptz
);

create table public.booking_messages (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id),
  body       text not null check (length(body) between 1 and 4000),
  sent_at    timestamptz not null default now(),
  read_at    timestamptz
);
create index booking_messages_booking_idx on public.booking_messages (booking_id, sent_at);

-- ---------------------------------------------------------------------
-- 9. INVOICES & PAYMENTS  (Brighttemp fee only — never the locum's pay)
-- ---------------------------------------------------------------------

create sequence public.invoice_number_seq;

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
                   default 'INV-' || to_char(now(), 'YYYY') || '-' ||
                           lpad(nextval('public.invoice_number_seq')::text, 6, '0'),
  practice_id    uuid not null references public.practices(id) on delete restrict,
  booking_id     uuid references public.bookings(id) on delete set null,

  issue_date     date not null default current_date,
  due_date       date not null,
  subtotal       numeric(10,2) not null check (subtotal >= 0),
  vat_rate       numeric(4,3) not null default 0.200,
  vat_amount     numeric(10,2) not null default 0,
  total          numeric(10,2) generated always as (subtotal + vat_amount) stored,

  status         invoice_status not null default 'draft',
  sent_at        timestamptz,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (due_date >= issue_date)
);
create unique index invoices_one_per_booking_idx
  on public.invoices (booking_id) where booking_id is not null;
create index invoices_practice_idx on public.invoices (practice_id, issue_date desc);
create index invoices_status_idx on public.invoices (status);
create index invoices_overdue_idx on public.invoices (due_date) where status in ('sent','overdue');
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0),
  paid_at     timestamptz not null default now(),
  method      payment_method not null default 'bank_transfer',
  reference   text,
  recorded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index payments_invoice_idx on public.payments (invoice_id);

-- ---------------------------------------------------------------------
-- 10. NOTIFICATIONS
-- ---------------------------------------------------------------------

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references public.profiles(id) on delete cascade,
  event         notification_event not null,
  channel       notification_channel not null default 'email',
  recipient     text not null,                -- email address or E.164 number
  subject       text,
  body          text,
  payload       jsonb not null default '{}'::jsonb,

  booking_id    uuid references public.bookings(id) on delete set null,
  invoice_id    uuid references public.invoices(id) on delete set null,
  document_id   uuid references public.compliance_documents(id) on delete set null,

  status        notification_status not null default 'queued',
  provider_message_id text,
  error         text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_queue_idx on public.notifications (scheduled_for)
  where status = 'queued';

-- ---------------------------------------------------------------------
-- 11. AUDIT LOG
-- ---------------------------------------------------------------------

create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id),
  actor_type  actor_type not null default 'system',
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- =====================================================================
-- 12. DOMAIN LOGIC
-- =====================================================================

-- Day type for a date, taking bank holidays into account.
create or replace function public.day_type_for(p_date date)
returns day_type language sql stable as $$
  select case
    when exists (select 1 from public.bank_holidays where holiday_date = p_date)
      then 'bank_holiday'::day_type
    when extract(isodow from p_date) >= 6 then 'weekend'::day_type
    else 'weekday'::day_type
  end;
$$;

-- Current Brighttemp booking fee for a role on a date.
create or replace function public.current_booking_fee(p_role_id uuid, p_date date)
returns numeric language sql stable as $$
  select f.amount
  from public.fees f
  where f.fee_type = 'booking'
    and f.role_id = p_role_id
    and f.day_type = public.day_type_for(p_date)
    and f.effective_from <= p_date
    and (f.effective_to is null or f.effective_to >= p_date)
  order by f.effective_from desc
  limit 1;
$$;

create or replace function public.current_same_day_surcharge()
returns numeric language sql stable as $$
  select coalesce((
    select amount from public.fees
    where fee_type = 'same_day_surcharge'
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by effective_from desc limit 1
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
    order by notice_hours_below asc, effective_from desc limit 1
  ), 0);
$$;

-- Does this locum hold every mandatory document for their role, approved and in date?
create or replace function public.locum_compliance_ok(p_locum_id uuid)
returns boolean language sql stable as $$
  select not exists (
    select 1
    from public.locums l
    join public.compliance_requirements cr
      on cr.role_id = l.role_id and cr.is_mandatory
    left join public.compliance_documents cd
      on cd.locum_id = l.id
     and cd.doc_type = cr.doc_type
     and cd.is_current
     and cd.status in ('approved', 'expiring_soon')
     and (cd.expiry_date is null or cd.expiry_date >= current_date)
    where l.id = p_locum_id
      and cd.id is null
  );
$$;

-- Keep locums.is_bookable in step with approval + compliance.
create or replace function public.refresh_locum_bookability(p_locum_id uuid)
returns void language plpgsql as $$
begin
  update public.locums l
     set is_bookable = (l.status = 'approved' and public.locum_compliance_ok(l.id))
   where l.id = p_locum_id;
end $$;

create or replace function public.compliance_changed()
returns trigger language plpgsql as $$
begin
  perform public.refresh_locum_bookability(coalesce(new.locum_id, old.locum_id));
  return coalesce(new, old);
end $$;

create trigger compliance_documents_bookability
  after insert or update or delete on public.compliance_documents
  for each row execute function public.compliance_changed();

create or replace function public.locum_status_changed()
returns trigger language plpgsql as $$
begin
  new.is_bookable := (new.status = 'approved' and public.locum_compliance_ok(new.id));
  return new;
end $$;

create trigger locums_bookability before update of status on public.locums
  for each row execute function public.locum_status_changed();

-- Nightly job: roll documents into Expiring Soon / Expired, then re-check bookability.
create or replace function public.refresh_compliance_statuses()
returns int language plpgsql as $$
declare v_changed int;
begin
  with updated as (
    update public.compliance_documents cd
       set status = case
             when cd.expiry_date < current_date then 'expired'::compliance_status
             else 'expiring_soon'::compliance_status
           end
      from public.compliance_requirements cr
     where cd.is_current
       and cd.status in ('approved', 'expiring_soon')
       and cd.expiry_date is not null
       and cr.doc_type = cd.doc_type
       and cr.role_id = (select role_id from public.locums where id = cd.locum_id)
       and cd.expiry_date <= current_date + (cr.expiry_warning_days || ' days')::interval
       and cd.status is distinct from (case
             when cd.expiry_date < current_date then 'expired'::compliance_status
             else 'expiring_soon'::compliance_status end)
    returning cd.locum_id
  )
  select count(*) into v_changed from updated;

  update public.locums l
     set is_bookable = (l.status = 'approved' and public.locum_compliance_ok(l.id));

  return v_changed;
end $$;

-- Price a booking on insert from the fee table, and flag same-day.
create or replace function public.price_booking()
returns trigger language plpgsql as $$
declare v_same_day boolean;
begin
  v_same_day := (new.booking_date = current_date);

  new.fee_day_type := public.day_type_for(new.booking_date);
  new.is_same_day  := v_same_day;

  if new.booking_fee is null or new.booking_fee = 0 then
    new.booking_fee := coalesce(public.current_booking_fee(new.role_id, new.booking_date), 0);
  end if;

  if v_same_day then
    new.same_day_surcharge := public.current_same_day_surcharge();
    if (select (value)::text::boolean from public.platform_settings
         where key = 'same_day_requires_approval') then
      new.requires_admin_approval := true;
    end if;
  end if;

  if (select trust_level from public.practices where id = new.practice_id) = 'new' then
    new.requires_admin_approval := true;
  end if;

  return new;
end $$;

create trigger bookings_pricing before insert on public.bookings
  for each row execute function public.price_booking();

-- Record every status transition.
create or replace function public.log_booking_status()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (booking_id, from_status, to_status, actor)
    values (new.id, null, new.status, 'system');
  elsif new.status is distinct from old.status then
    insert into public.booking_status_history (booking_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end $$;

create trigger bookings_status_log after insert or update of status on public.bookings
  for each row execute function public.log_booking_status();

-- Raise the Brighttemp invoice when a booking is confirmed.
create or replace function public.invoice_on_confirm()
returns trigger language plpgsql as $$
declare
  v_vat_rate numeric;
  v_terms int;
  v_subtotal numeric;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    select (value)::text::numeric into v_vat_rate
      from public.platform_settings where key = 'vat_rate';
    select coalesce(p.payment_terms_days, 14) into v_terms
      from public.practices p where p.id = new.practice_id;

    v_subtotal := new.booking_fee + new.same_day_surcharge;

    insert into public.invoices
      (practice_id, booking_id, issue_date, due_date, subtotal, vat_rate, vat_amount, status)
    values
      (new.practice_id, new.id, current_date, current_date + v_terms,
       v_subtotal, coalesce(v_vat_rate, 0),
       round(v_subtotal * coalesce(v_vat_rate, 0), 2), 'draft')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger bookings_invoice after update of status on public.bookings
  for each row execute function public.invoice_on_confirm();

-- =====================================================================
-- 13. SEARCH — only compliant, approved, available, in-range locums
-- =====================================================================

-- Great-circle distance in miles.
create or replace function public.distance_miles(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision language sql immutable as $$
  select 3958.8 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

create or replace function public.search_locums(
  p_role_id     uuid,
  p_date        date,
  p_start       time,
  p_finish      time,
  p_latitude    double precision,
  p_longitude   double precision,
  p_max_miles   numeric default 20,
  p_min_years   int default 0
)
returns table (
  locum_id uuid,
  full_name text,
  years_experience int,
  distance_miles numeric,
  hourly_rate numeric,
  locum_total numeric,
  booking_fee numeric,
  total_practice_cost numeric
)
language sql stable as $$
  with params as (
    select public.day_type_for(p_date) as dt,
           round((extract(epoch from (p_finish - p_start)) / 3600.0)::numeric, 2) as hrs
  )
  select
    l.id,
    pr.full_name,
    l.years_experience,
    round(public.distance_miles(p_latitude, p_longitude, l.latitude, l.longitude)::numeric, 1),
    r.hourly_rate,
    round(r.hourly_rate * p.hrs, 2),
    fee.amount,
    round(r.hourly_rate * p.hrs, 2) + fee.amount
  from public.locums l
  join params p on true
  join public.profiles pr on pr.id = l.profile_id
  join public.locum_availability a
    on a.locum_id = l.id
   and a.available_on = p_date
   and a.is_available
   and a.start_time <= p_start
   and a.finish_time >= p_finish
  join public.locum_rates r
    on r.locum_id = l.id
   and r.day_type = p.dt
   and r.status = 'approved'
   and r.effective_to is null
  cross join lateral (
    select coalesce(public.current_booking_fee(l.role_id, p_date), 0)
         + case when p_date = current_date then public.current_same_day_surcharge() else 0 end
      as amount
  ) fee
  where l.role_id = p_role_id
    and l.is_bookable
    and l.years_experience >= p_min_years
    and l.latitude is not null
    -- inside the practice's radius AND inside the locum's own travel radius
    and public.distance_miles(p_latitude, p_longitude, l.latitude, l.longitude)
          <= least(p_max_miles::double precision, l.travel_radius_miles::double precision)
    -- no clashing booking
    and not exists (
      select 1 from public.bookings b
      where b.locum_id = l.id
        and b.booking_date = p_date
        and b.status in ('requested', 'accepted', 'confirmed', 'completed')
        and tsrange(b.booking_date + b.start_time, b.booking_date + b.finish_time)
            && tsrange(p_date + p_start, p_date + p_finish)
    )
  order by 4 asc, 5 asc;
$$;

-- Cancellation: work out notice and fee automatically.
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_actor      uuid,
  p_actor_type actor_type,
  p_reason     text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings;
  v_notice numeric;
  v_fee numeric;
  v_id uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_booking.status = 'cancelled' then raise exception 'Booking is already cancelled'; end if;

  v_notice := extract(epoch from
    ((v_booking.booking_date + v_booking.start_time) - now())) / 3600.0;

  -- only the practice cancelling inside the notice window is charged
  v_fee := case when p_actor_type = 'practice'
                then public.cancellation_fee_for(greatest(v_notice, 0))
                else 0 end;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  insert into public.cancellations
    (booking_id, cancelled_by, cancelled_by_type, notice_hours, reason, cancellation_fee)
  values
    (p_booking_id, p_actor, p_actor_type, round(greatest(v_notice, 0), 2), p_reason, v_fee)
  returning id into v_id;

  return v_id;
end $$;
