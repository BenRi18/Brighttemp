-- =====================================================================
-- Brighttemp — row level security
-- Run after 01_schema.sql
--
-- Model:
--   practice user  →  their own practice, its bookings, its invoices,
--                     and the public profile of bookable locums
--   locum          →  their own record, their own documents, bookings
--                     addressed to them
--   admin          →  everything
--   service_role   →  bypasses RLS (cron jobs, notification sender)
--
-- Compliance documents are visible to the locum and to Brighttemp admins
-- only. A practice never sees a document — it sees locums.is_bookable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPERS
--    SECURITY DEFINER so they can read the membership tables without
--    re-entering the policies that call them (avoids infinite recursion).
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.profile_id = auth.uid() and a.is_active
  );
$$;

create or replace function public.has_admin_role(variadic p_roles admin_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users a
    where a.profile_id = auth.uid() and a.is_active and a.admin_role = any(p_roles)
  );
$$;

create or replace function public.my_practice_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(pu.practice_id), '{}')
  from public.practice_users pu
  where pu.profile_id = auth.uid();
$$;

create or replace function public.is_practice_member(p_practice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.practice_users pu
    where pu.profile_id = auth.uid() and pu.practice_id = p_practice_id
  );
$$;

create or replace function public.is_practice_manager(p_practice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.practice_users pu
    where pu.profile_id = auth.uid()
      and pu.practice_id = p_practice_id
      and pu.role in ('owner', 'manager')
  );
$$;

create or replace function public.my_locum_id()
returns uuid language sql stable security definer set search_path = public as $$
  select l.id from public.locums l where l.profile_id = auth.uid();
$$;

-- Has this locum ever been booked by one of my practices? (or vice versa)
create or replace function public.shares_booking_with_locum(p_locum_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.locum_id = p_locum_id
      and b.practice_id = any(public.my_practice_ids())
  );
$$;

create or replace function public.shares_booking_with_practice(p_practice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.practice_id = p_practice_id
      and b.locum_id = public.my_locum_id()
  );
$$;

revoke all on function public.is_admin, public.has_admin_role, public.my_practice_ids,
  public.is_practice_member, public.is_practice_manager, public.my_locum_id,
  public.shares_booking_with_locum, public.shares_booking_with_practice from public;
grant execute on function public.is_admin, public.has_admin_role, public.my_practice_ids,
  public.is_practice_member, public.is_practice_manager, public.my_locum_id,
  public.shares_booking_with_locum, public.shares_booking_with_practice to authenticated;

-- ---------------------------------------------------------------------
-- 2. ENABLE RLS EVERYWHERE
-- ---------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.admin_users             enable row level security;
alter table public.roles                   enable row level security;
alter table public.compliance_requirements enable row level security;
alter table public.bank_holidays           enable row level security;
alter table public.practices               enable row level security;
alter table public.practice_users          enable row level security;
alter table public.locums                  enable row level security;
alter table public.locum_rates             enable row level security;
alter table public.locum_availability      enable row level security;
alter table public.compliance_documents    enable row level security;
alter table public.favourite_locums        enable row level security;
alter table public.fees                    enable row level security;
alter table public.platform_settings       enable row level security;
alter table public.bookings                enable row level security;
alter table public.booking_status_history  enable row level security;
alter table public.cancellations           enable row level security;
alter table public.booking_messages        enable row level security;
alter table public.invoices                enable row level security;
alter table public.payments                enable row level security;
alter table public.notifications           enable row level security;
alter table public.audit_log               enable row level security;

-- Nothing is reachable without a session.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 3. PROFILES
-- ---------------------------------------------------------------------

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());

-- A practice can see the name/contact of a locum it can book or has booked.
create policy profiles_select_counterpart_locum on public.profiles
  for select to authenticated using (
    user_type = 'locum'
    and exists (
      select 1 from public.locums l
      where l.profile_id = profiles.id
        and (l.is_bookable or public.shares_booking_with_locum(l.id))
    )
    and cardinality(public.my_practice_ids()) > 0
  );

-- A locum can see the staff contact on a practice they're booked with.
create policy profiles_select_counterpart_practice on public.profiles
  for select to authenticated using (
    user_type = 'practice'
    and public.my_locum_id() is not null
    and exists (
      select 1 from public.practice_users pu
      where pu.profile_id = profiles.id
        and public.shares_booking_with_practice(pu.practice_id)
    )
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_type is identity, not a preference: it cannot be self-edited.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, whatsapp_opt_in, last_seen_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 4. ADMIN USERS
-- ---------------------------------------------------------------------

create policy admin_users_select on public.admin_users
  for select to authenticated using (public.is_admin());

create policy admin_users_write on public.admin_users
  for all to authenticated
  using (public.has_admin_role('super_admin'))
  with check (public.has_admin_role('super_admin'));

-- ---------------------------------------------------------------------
-- 5. REFERENCE DATA — readable by all signed-in users, written by admins
-- ---------------------------------------------------------------------

create policy roles_read on public.roles
  for select to authenticated using (true);
create policy roles_write on public.roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy requirements_read on public.compliance_requirements
  for select to authenticated using (true);
create policy requirements_write on public.compliance_requirements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy holidays_read on public.bank_holidays
  for select to authenticated using (true);
create policy holidays_write on public.bank_holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Fees are public knowledge: practices need them to see the cost of a booking.
create policy fees_read on public.fees
  for select to authenticated using (true);
create policy fees_write on public.fees
  for all to authenticated
  using (public.has_admin_role('super_admin', 'finance'))
  with check (public.has_admin_role('super_admin', 'finance'));

create policy settings_read on public.platform_settings
  for select to authenticated using (true);
create policy settings_write on public.platform_settings
  for all to authenticated
  using (public.has_admin_role('super_admin'))
  with check (public.has_admin_role('super_admin'));

-- ---------------------------------------------------------------------
-- 6. PRACTICES
-- ---------------------------------------------------------------------

create policy practices_select_member on public.practices
  for select to authenticated using (public.is_practice_member(id));

create policy practices_select_admin on public.practices
  for select to authenticated using (public.is_admin());

create policy practices_select_booked_locum on public.practices
  for select to authenticated using (public.shares_booking_with_practice(id));

-- Registration: anyone signed in may create a practice, but only as pending.
create policy practices_insert on public.practices
  for insert to authenticated
  with check (status = 'pending' and trust_level = 'new' and approved_at is null);

create policy practices_update_manager on public.practices
  for update to authenticated
  using (public.is_practice_manager(id))
  with check (public.is_practice_manager(id));

create policy practices_admin_write on public.practices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- A practice cannot approve, trust or un-suspend itself.
revoke update on public.practices from authenticated;
grant update (name, trading_name, address_line1, address_line2, city, postcode,
              phone, email, cqc_provider_id, billing_email, billing_address,
              vat_number, purchase_order_required)
  on public.practices to authenticated;

-- Whoever registers the practice becomes its owner.
create or replace function public.claim_new_practice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into public.practice_users (practice_id, profile_id, role, is_primary, accepted_at)
    values (new.id, auth.uid(), 'owner', true, now())
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger practices_claim after insert on public.practices
  for each row execute function public.claim_new_practice();

-- ---------------------------------------------------------------------
-- 7. PRACTICE USERS
-- ---------------------------------------------------------------------

create policy practice_users_select on public.practice_users
  for select to authenticated
  using (profile_id = auth.uid() or public.is_practice_member(practice_id) or public.is_admin());

create policy practice_users_write_manager on public.practice_users
  for all to authenticated
  using (public.is_practice_manager(practice_id))
  with check (public.is_practice_manager(practice_id));

create policy practice_users_admin on public.practice_users
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. LOCUMS
-- ---------------------------------------------------------------------

create policy locums_select_self on public.locums
  for select to authenticated using (profile_id = auth.uid());

create policy locums_select_admin on public.locums
  for select to authenticated using (public.is_admin());

-- Practices see bookable locums, plus any locum they have history with.
create policy locums_select_practice on public.locums
  for select to authenticated using (
    cardinality(public.my_practice_ids()) > 0
    and (is_bookable or public.shares_booking_with_locum(id))
  );

create policy locums_insert_self on public.locums
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending' and not is_bookable);

create policy locums_update_self on public.locums
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy locums_admin_write on public.locums
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- A locum cannot approve themselves or force themselves into search results.
revoke update on public.locums from authenticated;
grant update (gdc_number, gdc_expiry, years_experience, bio, specialisms,
              base_postcode, latitude, longitude, travel_radius_miles)
  on public.locums to authenticated;

-- ---------------------------------------------------------------------
-- 9. RATES
-- ---------------------------------------------------------------------

create policy rates_select_self on public.locum_rates
  for select to authenticated
  using (locum_id = public.my_locum_id() or public.is_admin());

-- Practices only ever see the live, approved rate — not pending requests.
create policy rates_select_practice on public.locum_rates
  for select to authenticated using (
    cardinality(public.my_practice_ids()) > 0
    and status = 'approved' and effective_to is null
    and exists (select 1 from public.locums l where l.id = locum_id and l.is_bookable)
  );

-- Locums propose rates; Brighttemp approves them.
create policy rates_insert_self on public.locum_rates
  for insert to authenticated
  with check (locum_id = public.my_locum_id() and status = 'pending');

create policy rates_delete_pending on public.locum_rates
  for delete to authenticated
  using (locum_id = public.my_locum_id() and status = 'pending');

create policy rates_admin on public.locum_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. AVAILABILITY
-- ---------------------------------------------------------------------

create policy availability_own on public.locum_availability
  for all to authenticated
  using (locum_id = public.my_locum_id()) with check (locum_id = public.my_locum_id());

create policy availability_select_practice on public.locum_availability
  for select to authenticated using (
    cardinality(public.my_practice_ids()) > 0
    and is_available
    and exists (select 1 from public.locums l where l.id = locum_id and l.is_bookable)
  );

create policy availability_admin on public.locum_availability
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 11. COMPLIANCE DOCUMENTS — locum and Brighttemp only. Never a practice.
-- ---------------------------------------------------------------------

create policy documents_select_own on public.compliance_documents
  for select to authenticated using (locum_id = public.my_locum_id());

create policy documents_select_admin on public.compliance_documents
  for select to authenticated
  using (public.has_admin_role('super_admin', 'operations', 'compliance'));

create policy documents_insert_own on public.compliance_documents
  for insert to authenticated
  with check (locum_id = public.my_locum_id() and status = 'pending');

-- A locum may correct a document only while it is unreviewed or rejected.
create policy documents_update_own on public.compliance_documents
  for update to authenticated
  using (locum_id = public.my_locum_id() and status in ('pending', 'rejected'))
  with check (locum_id = public.my_locum_id() and status in ('pending', 'rejected'));

create policy documents_admin_write on public.compliance_documents
  for all to authenticated
  using (public.has_admin_role('super_admin', 'operations', 'compliance'))
  with check (public.has_admin_role('super_admin', 'operations', 'compliance'));

-- Locums cannot mark their own documents approved.
revoke update on public.compliance_documents from authenticated;
grant update (storage_path, original_filename, mime_type, size_bytes,
              issue_date, expiry_date, reference)
  on public.compliance_documents to authenticated;

-- ---------------------------------------------------------------------
-- 12. FAVOURITES
-- ---------------------------------------------------------------------

create policy favourites_practice on public.favourite_locums
  for all to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy favourites_admin on public.favourite_locums
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 13. BOOKINGS
-- ---------------------------------------------------------------------

create policy bookings_select_practice on public.bookings
  for select to authenticated using (public.is_practice_member(practice_id));

create policy bookings_select_locum on public.bookings
  for select to authenticated using (locum_id = public.my_locum_id());

create policy bookings_select_admin on public.bookings
  for select to authenticated using (public.is_admin());

-- Only an approved practice can raise a booking, and only as 'requested'.
create policy bookings_insert_practice on public.bookings
  for insert to authenticated with check (
    public.is_practice_member(practice_id)
    and status = 'requested'
    and exists (select 1 from public.practices p
                where p.id = practice_id and p.status = 'approved')
    and exists (select 1 from public.locums l
                where l.id = locum_id and l.is_bookable)
  );

create policy bookings_update_practice on public.bookings
  for update to authenticated
  using (public.is_practice_member(practice_id))
  with check (public.is_practice_member(practice_id));

create policy bookings_update_locum on public.bookings
  for update to authenticated
  using (locum_id = public.my_locum_id())
  with check (locum_id = public.my_locum_id());

create policy bookings_admin on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Money is set by the pricing trigger, never by a client.
revoke update on public.bookings from authenticated;
grant update (status, notes, start_time, finish_time, booking_date) on public.bookings to authenticated;

-- Who is allowed to move a booking from one status to another.
create or replace function public.enforce_booking_transition()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_locum    boolean := (new.locum_id = public.my_locum_id());
  v_is_practice boolean := public.is_practice_member(new.practice_id);
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if public.is_admin() or auth.uid() is null then
    return new;   -- admins and server-side jobs may set any status
  end if;

  -- terminal states
  if old.status in ('cancelled', 'completed') then
    raise exception 'Booking % is % and can no longer be changed', old.reference, old.status;
  end if;

  if v_is_locum then
    if not (old.status = 'requested' and new.status in ('accepted', 'cancelled'))
       and not (old.status in ('accepted', 'confirmed') and new.status = 'cancelled')
       and not (old.status = 'confirmed' and new.status = 'disputed') then
      raise exception 'A locum cannot move a booking from % to %', old.status, new.status;
    end if;

  elsif v_is_practice then
    if new.status not in ('cancelled', 'disputed') then
      raise exception 'A practice can only cancel or dispute a booking, not set it to %', new.status;
    end if;

  else
    raise exception 'Not a party to this booking';
  end if;

  -- amendments are only possible before the shift is locked in
  if (new.booking_date, new.start_time, new.finish_time)
     is distinct from (old.booking_date, old.start_time, old.finish_time)
     and old.status not in ('requested', 'accepted') then
    raise exception 'Confirmed bookings cannot be amended — cancel and rebook';
  end if;

  new.accepted_at  := case when new.status = 'accepted'  then now() else new.accepted_at end;
  new.confirmed_at := case when new.status = 'confirmed' then now() else new.confirmed_at end;
  new.completed_at := case when new.status = 'completed' then now() else new.completed_at end;
  return new;
end $$;

create trigger bookings_transition before update on public.bookings
  for each row execute function public.enforce_booking_transition();

-- ---------------------------------------------------------------------
-- 14. BOOKING HISTORY, CANCELLATIONS, MESSAGES
-- ---------------------------------------------------------------------

create or replace function public.can_see_booking(p_booking_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (b.practice_id = any(public.my_practice_ids())
           or b.locum_id = public.my_locum_id())
  );
$$;
grant execute on function public.can_see_booking to authenticated;

create policy history_select on public.booking_status_history
  for select to authenticated
  using (public.can_see_booking(booking_id) or public.is_admin());
-- inserts happen only through the SECURITY DEFINER logging trigger

create policy cancellations_select on public.cancellations
  for select to authenticated
  using (public.can_see_booking(booking_id) or public.is_admin());

create policy cancellations_admin on public.cancellations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- inserts happen only through public.cancel_booking()

create policy messages_select on public.booking_messages
  for select to authenticated
  using (public.can_see_booking(booking_id) or public.is_admin());

create policy messages_insert on public.booking_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_see_booking(booking_id));

create policy messages_update_read on public.booking_messages
  for update to authenticated
  using (public.can_see_booking(booking_id)) with check (public.can_see_booking(booking_id));

create policy messages_admin on public.booking_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 15. INVOICES & PAYMENTS
--     Practices read their own. Only Brighttemp writes them.
-- ---------------------------------------------------------------------

create policy invoices_select_practice on public.invoices
  for select to authenticated using (public.is_practice_member(practice_id));

create policy invoices_admin on public.invoices
  for all to authenticated
  using (public.has_admin_role('super_admin', 'finance', 'operations'))
  with check (public.has_admin_role('super_admin', 'finance', 'operations'));

create policy payments_select_practice on public.payments
  for select to authenticated using (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and public.is_practice_member(i.practice_id))
  );

create policy payments_admin on public.payments
  for all to authenticated
  using (public.has_admin_role('super_admin', 'finance'))
  with check (public.has_admin_role('super_admin', 'finance'));

-- ---------------------------------------------------------------------
-- 16. NOTIFICATIONS & AUDIT
-- ---------------------------------------------------------------------

create policy notifications_select_own on public.notifications
  for select to authenticated using (profile_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy notifications_admin on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- the sender runs as service_role and bypasses RLS

create policy audit_select_admin on public.audit_log
  for select to authenticated
  using (public.has_admin_role('super_admin'));
-- writes come from SECURITY DEFINER triggers / service_role only

-- ---------------------------------------------------------------------
-- 17. FUNCTION HARDENING
--     Triggers that write on a user's behalf must run as definer,
--     otherwise the user's own policies block the write.
-- ---------------------------------------------------------------------

alter function public.log_booking_status()      security definer set search_path = public;
alter function public.invoice_on_confirm()      security definer set search_path = public;
alter function public.compliance_changed()      security definer set search_path = public;
alter function public.refresh_locum_bookability(uuid) security definer set search_path = public;
alter function public.refresh_compliance_statuses()   security definer set search_path = public;
alter function public.price_booking()           security definer set search_path = public;

-- Search encodes the booking rules, so it runs as definer and is gated
-- to practice users and admins.
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
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and cardinality(public.my_practice_ids()) = 0
     and not public.is_admin() then
    raise exception 'Only practices can search for locums';
  end if;

  return query
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
    and public.distance_miles(p_latitude, p_longitude, l.latitude, l.longitude)
          <= least(p_max_miles::double precision, l.travel_radius_miles::double precision)
    and not exists (
      select 1 from public.bookings b
      where b.locum_id = l.id
        and b.booking_date = p_date
        and b.status in ('requested', 'accepted', 'confirmed', 'completed')
        and tsrange(b.booking_date + b.start_time, b.booking_date + b.finish_time)
            && tsrange(p_date + p_start, p_date + p_finish)
    )
  order by 4 asc, 5 asc;
end $$;

revoke all on function public.search_locums from public;
grant execute on function public.search_locums to authenticated;

revoke all on function public.cancel_booking from public;
grant execute on function public.cancel_booking to authenticated;

-- Only a party to the booking may cancel it.
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

  if auth.uid() is not null
     and not public.is_admin()
     and not public.can_see_booking(p_booking_id) then
    raise exception 'Not a party to this booking';
  end if;

  v_notice := extract(epoch from
    ((v_booking.booking_date + v_booking.start_time) - now())) / 3600.0;

  v_fee := case when p_actor_type = 'practice'
                then public.cancellation_fee_for(greatest(v_notice, 0))
                else 0 end;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  insert into public.cancellations
    (booking_id, cancelled_by, cancelled_by_type, notice_hours, reason, cancellation_fee)
  values
    (p_booking_id, coalesce(p_actor, auth.uid()), p_actor_type,
     round(greatest(v_notice, 0), 2), p_reason, v_fee)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 18. STORAGE — private bucket for compliance documents
--     Path convention: compliance/{locum_id}/{doc_type}/{filename}
-- ---------------------------------------------------------------------

-- insert into storage.buckets (id, name, public) values ('compliance', 'compliance', false);
--
-- create policy compliance_read_own on storage.objects for select to authenticated
--   using (bucket_id = 'compliance'
--          and (storage.foldername(name))[1] = public.my_locum_id()::text);
--
-- create policy compliance_write_own on storage.objects for insert to authenticated
--   with check (bucket_id = 'compliance'
--               and (storage.foldername(name))[1] = public.my_locum_id()::text);
--
-- create policy compliance_read_admin on storage.objects for all to authenticated
--   using (bucket_id = 'compliance'
--          and public.has_admin_role('super_admin','operations','compliance'));

-- ---------------------------------------------------------------------
-- 19. GRANTS
-- ---------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, delete on public.profiles, public.practices, public.practice_users,
  public.locums, public.locum_rates, public.locum_availability,
  public.compliance_documents, public.favourite_locums, public.bookings,
  public.booking_messages, public.roles, public.compliance_requirements,
  public.bank_holidays, public.fees, public.platform_settings,
  public.invoices, public.payments, public.cancellations, public.admin_users,
  public.notifications
  to authenticated;
grant update on public.locum_rates, public.locum_availability, public.favourite_locums,
  public.booking_messages, public.practice_users, public.roles,
  public.compliance_requirements, public.bank_holidays, public.fees,
  public.platform_settings, public.invoices, public.payments,
  public.cancellations, public.admin_users, public.notifications
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
