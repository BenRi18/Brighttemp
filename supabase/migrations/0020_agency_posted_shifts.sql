-- =====================================================================
-- Brighttemp posting shifts on behalf of practices that ring up.
--
-- Plenty of practices will never log in. They phone the agency, Brighttemp
-- writes the shift down, and until now that shift never reached the board
-- at all — it was worked by whoever Brighttemp could think of and ring.
-- Putting it on the board puts it in front of every locum who could take
-- it, which is the whole point of having one.
--
-- Two things were in the way:
--
--   A shift needs a practice. bookings.practice_id is NOT NULL and an
--   invoice has to be billed to somebody, so a phoned-in shift still has
--   to point at a practice record. Practices could only come into
--   existence by registering themselves, so there was nothing to point at.
--
--   Only a practice manager could post. open_shifts_practice_insert
--   checks is_practice_manager(practice_id), which an admin is not.
--
-- Both are fixed here. Awarding and withdrawing already allowed admins —
-- 0018 wrote those as `is_practice_manager(...) or is_admin()` — so that
-- half has worked since the board shipped.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Practices Brighttemp keeps the books for.
--
--    A managed practice is a real practice with a real address and a real
--    invoice; what it does not have is a login. Nobody from it ever sees
--    the portal. Brighttemp posts its shifts, picks its locums and sends
--    it the invoice, exactly as it did before any of this existed.
--
--    Flagged rather than inferred. "No owner account yet" already means
--    something else — a practice that registered and is waiting on its
--    first user — and the roster needs to tell the two apart.
-- ---------------------------------------------------------------------
alter table public.practices
  add column if not exists is_managed boolean not null default false;

comment on column public.practices.is_managed is
  'Practice that deals with Brighttemp by phone and has no portal login. '
  'Created by an admin; bookings and invoices work exactly as for any other.';

-- ---------------------------------------------------------------------
-- 2. Creating one.
--
--    Coordinates are required, not optional. locum_may_claim treats a
--    practice with no latitude as "distance unknown" and lets the shift
--    through to everyone — so a practice saved without them would quietly
--    ignore every locum's travel radius, which is the opposite of what
--    was asked for. The app geocodes the postcode first, exactly as
--    practice registration does, and this refuses the row without it.
--
--    status is 'approved' on the way in: Brighttemp vetted this practice
--    on the phone, and leaving it 'pending' would park it in the approvals
--    queue waiting for an approval that means nothing here.
-- ---------------------------------------------------------------------
create or replace function public.admin_create_practice(
  p_name          text,
  p_address_line1 text,
  p_city          text,
  p_postcode      text,
  p_latitude      double precision,
  p_longitude     double precision,
  p_phone         text default null,
  p_email         text default null,
  p_address_line2 text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.has_admin_role('super_admin', 'operations') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'That postcode could not be placed on the map'
      using errcode = 'P0001';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'The practice needs a name' using errcode = 'P0001';
  end if;

  insert into public.practices
    (name, address_line1, address_line2, city, postcode, latitude, longitude,
     phone, email, status, is_managed, approved_at, approved_by)
  values
    (trim(p_name), trim(p_address_line1), nullif(trim(coalesce(p_address_line2, '')), ''),
     trim(p_city), upper(trim(p_postcode)), p_latitude, p_longitude,
     nullif(trim(coalesce(p_phone, '')), ''),
     nullif(trim(coalesce(p_email, '')), '')::citext,
     'approved', true, now(), auth.uid())
  returning id into v_id;

  -- The practices_claim trigger makes whoever inserted the row its owner.
  -- That is right for a practice registering itself and wrong here: it
  -- would make the admin a practice_user of a client practice, hand them a
  -- practice portal for it, list them on its team, and — the part that
  -- actually bites — send that practice's booking emails to the admin
  -- instead of to the practice, because booking_recipients prefers an
  -- owner account over the address on the practice record.
  --
  -- Caught in testing: a confirmed booking for a phoned-in practice
  -- notified the admin and never reached the practice at all.
  delete from public.practice_users
   where practice_id = v_id and profile_id = auth.uid();

  insert into public.audit_log (actor_id, actor_type, action, entity_type, entity_id, after)
  values (auth.uid(), 'admin', 'practice.created_managed', 'practice', v_id,
          jsonb_build_object('name', trim(p_name)));

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 3. Posting on their behalf.
--
--    Widened rather than given its own function: the row is identical
--    whoever posts it, and a second insert path would be a second place
--    for the two to drift apart. created_by records who actually typed
--    it, so a shift Brighttemp posted is distinguishable afterwards.
-- ---------------------------------------------------------------------
drop policy if exists open_shifts_practice_insert on public.open_shifts;
create policy open_shifts_practice_insert on public.open_shifts
  for insert to authenticated
  with check (public.is_practice_manager(practice_id) or public.is_admin());

-- An admin may also take a shift down or change its details before it is
-- claimed — the practice that rang up will ring up again to change it.
drop policy if exists open_shifts_admin_update on public.open_shifts;
create policy open_shifts_admin_update on public.open_shifts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant update (shift_date, start_time, finish_time, notes) on public.open_shifts to authenticated;

-- ---------------------------------------------------------------------
-- 4. Practices an admin can post for.
--
--    Approved, not archived, and with coordinates — a practice without
--    them cannot have its distance measured, so its shifts would reach
--    locums who would never travel that far.
-- ---------------------------------------------------------------------
create or replace function public.practices_for_posting()
returns table (
  practice_id uuid,
  name        text,
  city        text,
  postcode    text,
  is_managed  boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.city, p.postcode, p.is_managed
    from public.practices p
   where public.is_admin()
     and p.status = 'approved'
     and p.latitude is not null
     and p.longitude is not null
   order by p.is_managed, p.name;
$$;

-- ---------------------------------------------------------------------
-- 5. A booking born confirmed still has to be invoiced.
--
--    bookings_invoice fired on `after update of status` only, because the
--    only way to reach 'confirmed' used to be an update: a practice asks,
--    the locum accepts, somebody confirms. award_shift inserts a booking
--    already confirmed — the locum offered and the practice chose — so the
--    trigger never fired and no invoice was ever raised.
--
--    That means every booking made through the shift board since it
--    shipped has gone unbilled. Caught in testing: a phoned-in shift
--    worked and confirmed, with no invoice behind it.
--
--    invoices.booking_id is unique and the insert is `on conflict do
--    nothing`, so widening the trigger cannot double-bill anything.
-- ---------------------------------------------------------------------
create or replace function public.invoice_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_registered boolean;
  v_vat_rate numeric;
  v_terms int;
  v_subtotal numeric;
begin
  -- OLD is not assigned on an INSERT, so it cannot be read there.
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then

    select coalesce((value)::text::boolean, false) into v_registered
      from public.platform_settings where key = 'vat_registered';

    if coalesce(v_registered, false) then
      select (value)::text::numeric into v_vat_rate
        from public.platform_settings where key = 'vat_rate';
    end if;
    v_vat_rate := coalesce(v_vat_rate, 0);

    select coalesce(p.payment_terms_days, 7) into v_terms
      from public.practices p where p.id = new.practice_id;

    v_subtotal := new.booking_fee + new.same_day_surcharge;

    insert into public.invoices
      (practice_id, booking_id, issue_date, due_date, subtotal, vat_rate, vat_amount, status)
    values
      (new.practice_id, new.id, current_date, current_date + v_terms,
       v_subtotal, v_vat_rate, round(v_subtotal * v_vat_rate, 2), 'draft')
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists bookings_invoice on public.bookings;
create trigger bookings_invoice
  after insert or update of status on public.bookings
  for each row execute function public.invoice_on_confirm();

-- ---------------------------------------------------------------------
-- 6. Bookings already made through the board, which have no invoice.
--
--    Raised at today's date rather than back-dated to the booking: an
--    invoice's issue date is when it was issued, and these are being
--    issued now. The fee and surcharge are the ones on the booking, so
--    the amounts are what they always should have been.
-- ---------------------------------------------------------------------
insert into public.invoices
  (practice_id, booking_id, issue_date, due_date, subtotal, vat_rate, vat_amount, status)
select b.practice_id, b.id, current_date,
       current_date + coalesce(p.payment_terms_days, 7),
       b.booking_fee + b.same_day_surcharge,
       coalesce((select (value)::text::numeric from public.platform_settings
                  where key = 'vat_rate'
                    and coalesce((select (value)::text::boolean from public.platform_settings
                                   where key = 'vat_registered'), false)), 0),
       0,
       'draft'
  from public.bookings b
  join public.practices p on p.id = b.practice_id
 where b.status in ('confirmed', 'completed')
   and not exists (select 1 from public.invoices i where i.booking_id = b.id)
on conflict do nothing;

-- VAT on anything the backfill just raised, now the rate is in the row.
update public.invoices
   set vat_amount = round(subtotal * vat_rate, 2)
 where status = 'draft' and vat_rate > 0 and vat_amount = 0;

revoke all on function public.admin_create_practice(
  text, text, text, text, double precision, double precision, text, text, text) from public;
revoke all on function public.practices_for_posting() from public;

grant execute on function public.admin_create_practice(
  text, text, text, text, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.practices_for_posting() to authenticated;
