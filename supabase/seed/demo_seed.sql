-- =====================================================================
-- Brighttemp — demo data for previewing every page
--
-- DEVELOPMENT / STAGING ONLY. Never run this against the database real
-- practices and locums use.
--
-- Step 1: node --env-file=.env.local scripts/create-demo-users.mjs
-- Step 2: run this file (SQL Editor, or psql).
--
-- Safe to re-run: it deletes the previous demo data first and rebuilds it,
-- with dates recalculated from today.
-- =====================================================================

do $$
declare
  -- auth users (created by the script)
  u_practice   uuid;
  u_locum      uuid;
  u_locum2     uuid;
  u_hygienist  uuid;
  u_admin      uuid;
  u_pend_prac  uuid;
  u_pend_locum uuid;

  -- roles
  r_nurse uuid;
  r_hyg   uuid;
  r_rec   uuid;

  -- domain rows
  p_main    uuid;
  p_pending uuid;
  l_main    uuid;
  l_second  uuid;
  l_hyg     uuid;
  l_pending uuid;

  b_confirmed uuid;
  b_past      uuid;

  d        date;
  d_next   date;
  d_later  date;
  d_past   date;
  v_inv    uuid;
begin
  -- ------------------------------------------------------------------
  -- Find the demo accounts. Matched on the part before the @ so any
  -- email domain works.
  -- ------------------------------------------------------------------
  select id into u_practice   from auth.users where email like 'demo.practice@%';
  select id into u_locum      from auth.users where email like 'demo.locum@%';
  select id into u_locum2     from auth.users where email like 'demo.locum2@%';
  select id into u_hygienist  from auth.users where email like 'demo.hygienist@%';
  select id into u_admin      from auth.users where email like 'demo.admin@%';
  select id into u_pend_prac  from auth.users where email like 'demo.pending-practice@%';
  select id into u_pend_locum from auth.users where email like 'demo.pending-locum@%';

  if u_practice is null or u_locum is null or u_locum2 is null or u_hygienist is null
     or u_admin is null or u_pend_prac is null or u_pend_locum is null then
    raise exception 'Demo users are missing. Run: node --env-file=.env.local scripts/create-demo-users.mjs';
  end if;

  -- Profiles are normally created by the signup trigger; make sure they
  -- exist and have the right type even if the users pre-date the trigger.
  insert into public.profiles (id, user_type, full_name, email)
  select u.id, v.t::public.user_type, v.n, u.email
  from auth.users u
  join (values
    (u_practice,   'practice', 'Sam Patel'),
    (u_locum,      'locum',    'Amara Okafor'),
    (u_locum2,     'locum',    'Jade Harrison'),
    (u_hygienist,  'locum',    'Rowan Mitchell'),
    (u_admin,      'admin',    'Brighttemp Admin'),
    (u_pend_prac,  'practice', 'Dana Walsh'),
    (u_pend_locum, 'locum',    'Chris Bell')
  ) as v(id, t, n) on v.id = u.id
  on conflict (id) do update
    set user_type = excluded.user_type,
        full_name = excluded.full_name;

  select id into r_nurse from public.roles where slug = 'dental_nurse';
  select id into r_hyg   from public.roles where slug = 'hygienist';
  select id into r_rec   from public.roles where slug = 'receptionist';

  -- ------------------------------------------------------------------
  -- Clear the previous demo run. Order matters: bookings and invoices
  -- reference practices/locums with ON DELETE RESTRICT.
  -- ------------------------------------------------------------------
  delete from public.invoices
   where practice_id in (select practice_id from public.practice_users
                          where profile_id in (u_practice, u_pend_prac));
  delete from public.bookings
   where practice_id in (select practice_id from public.practice_users
                          where profile_id in (u_practice, u_pend_prac))
      or locum_id in (select id from public.locums
                       where profile_id in (u_locum, u_locum2, u_hygienist, u_pend_locum));
  delete from public.practices
   where id in (select practice_id from public.practice_users
                 where profile_id in (u_practice, u_pend_prac));
  delete from public.locums
   where profile_id in (u_locum, u_locum2, u_hygienist, u_pend_locum);
  delete from public.admin_users where profile_id = u_admin;

  -- ------------------------------------------------------------------
  -- Admin
  -- ------------------------------------------------------------------
  insert into public.admin_users (profile_id, admin_role) values (u_admin, 'super_admin');

  -- ------------------------------------------------------------------
  -- Practices
  -- ------------------------------------------------------------------
  insert into public.practices
    (name, address_line1, city, postcode, latitude, longitude, phone, email,
     billing_email, status, trust_level, approved_at, approved_by)
  values
    ('Bright Smile Dental (demo)', '14 Park Row', 'Leeds', 'LS1 5HD',
     53.7980, -1.5460, '0113 496 0000', 'reception@brightsmile.example',
     'accounts@brightsmile.example', 'approved', 'trusted', now(), u_admin)
  returning id into p_main;

  insert into public.practice_users (practice_id, profile_id, role, is_primary, accepted_at)
  values (p_main, u_practice, 'owner', true, now());

  insert into public.practices
    (name, address_line1, city, postcode, latitude, longitude, email, status)
  values
    ('Northside Dental (demo)', '3 Manor Row', 'Bradford', 'BD1 4PB',
     53.7960, -1.7540, 'hello@northside.example', 'pending')
  returning id into p_pending;

  insert into public.practice_users (practice_id, profile_id, role, is_primary, accepted_at)
  values (p_pending, u_pend_prac, 'owner', true, now());

  -- ------------------------------------------------------------------
  -- Locums. Inserted as pending, documents added, then approved — the
  -- same order a real locum goes through, so is_bookable is computed
  -- by the triggers rather than set by hand.
  -- ------------------------------------------------------------------
  insert into public.locums
    (profile_id, role_id, gdc_number, years_experience, bio, base_postcode,
     latitude, longitude, travel_radius_miles)
  values
    (u_locum, r_nurse, '245871', 9,
     'Nine years across NHS and private practice. Comfortable with implants and sedation lists.',
     'LS6 2AA', 53.8200, -1.5700, 25)
  returning id into l_main;

  insert into public.locums
    (profile_id, role_id, gdc_number, years_experience, bio, base_postcode,
     latitude, longitude, travel_radius_miles)
  values
    (u_locum2, r_nurse, '251190', 6,
     'Orthodontic and general practice experience. Dentally and SOE confident.',
     'LS11 5BZ', 53.7800, -1.5500, 15)
  returning id into l_second;

  insert into public.locums
    (profile_id, role_id, gdc_number, years_experience, bio, base_postcode,
     latitude, longitude, travel_radius_miles)
  values
    (u_hygienist, r_hyg, '187342', 12,
     'Hygienist and therapist. Periodontal maintenance and direct access.',
     'LS8 1AA', 53.8150, -1.5200, 30)
  returning id into l_hyg;

  insert into public.locums
    (profile_id, role_id, years_experience, base_postcode,
     latitude, longitude, travel_radius_miles)
  values
    (u_pend_locum, r_rec, 3, 'LS2 7EW', 53.8010, -1.5480, 10)
  returning id into l_pending;

  -- Every mandatory document, approved and in date, for the three live locums.
  insert into public.compliance_documents
    (locum_id, doc_type, storage_path, original_filename, mime_type,
     issue_date, expiry_date, status, reviewed_at, reviewed_by)
  select l.id, cr.doc_type,
         l.id || '/' || cr.doc_type || '/demo.pdf', 'demo.pdf', 'application/pdf',
         current_date - 200,
         case when cr.requires_expiry then current_date + 300 else null end,
         'approved', now(), u_admin
  from public.locums l
  join public.compliance_requirements cr on cr.role_id = l.role_id and cr.is_mandatory
  where l.id in (l_main, l_second, l_hyg);

  -- One certificate close to expiry, so the admin "expiring" list has something in it.
  update public.compliance_documents
     set expiry_date = current_date + 18, status = 'expiring_soon'
   where locum_id = l_second and doc_type = 'cpr_certificate';

  -- The pending locum has uploaded some documents, waiting for review.
  insert into public.compliance_documents
    (locum_id, doc_type, storage_path, original_filename, mime_type,
     issue_date, expiry_date, status)
  values
    (l_pending, 'photo_id', l_pending || '/photo_id/demo.pdf', 'demo.pdf', 'application/pdf',
     current_date - 40, null, 'pending'),
    (l_pending, 'dbs', l_pending || '/dbs/demo.pdf', 'demo.pdf', 'application/pdf',
     current_date - 40, null, 'pending'),
    (l_pending, 'infection_control', l_pending || '/infection_control/demo.pdf',
     'demo.pdf', 'application/pdf', current_date - 10, current_date + 355, 'pending');

  -- Approve the three live locums. The status trigger recomputes is_bookable.
  update public.locums
     set status = 'approved', approved_at = now(), approved_by = u_admin
   where id in (l_main, l_second, l_hyg);

  -- ------------------------------------------------------------------
  -- Rates (approved) and one pending rate change for the admin queue
  -- ------------------------------------------------------------------
  insert into public.locum_rates (locum_id, day_type, hourly_rate, status, reviewed_at, reviewed_by)
  values
    (l_main,   'weekday',      17.50, 'approved', now(), u_admin),
    (l_main,   'weekend',      21.00, 'approved', now(), u_admin),
    (l_main,   'bank_holiday', 26.00, 'approved', now(), u_admin),
    (l_second, 'weekday',      18.00, 'approved', now(), u_admin),
    (l_second, 'weekend',      22.00, 'approved', now(), u_admin),
    (l_second, 'bank_holiday', 27.00, 'approved', now(), u_admin),
    (l_hyg,    'weekday',      36.50, 'approved', now(), u_admin),
    (l_hyg,    'weekend',      42.00, 'approved', now(), u_admin),
    (l_hyg,    'bank_holiday', 48.00, 'approved', now(), u_admin);

  insert into public.locum_rates (locum_id, day_type, hourly_rate, status)
  values (l_main, 'weekday', 18.50, 'pending');

  -- ------------------------------------------------------------------
  -- Availability: every weekday for the next 45 days, 08:00–18:00
  -- ------------------------------------------------------------------
  insert into public.locum_availability (locum_id, available_on, is_available, start_time, finish_time)
  select l.id, g::date, true, '08:00', '18:00'
  from unnest(array[l_main, l_second, l_hyg]) as l(id)
  cross join generate_series(current_date, current_date + 45, interval '1 day') g
  where extract(isodow from g) < 6;

  -- ------------------------------------------------------------------
  -- Bookings between Bright Smile and Amara
  -- ------------------------------------------------------------------
  d_next := current_date + 7;
  while extract(isodow from d_next) > 5 loop d_next := d_next + 1; end loop;
  d_later := current_date + 11;
  while extract(isodow from d_later) > 5 loop d_later := d_later + 1; end loop;
  d_past := current_date - 7;
  while extract(isodow from d_past) > 5 loop d_past := d_past - 1; end loop;

  -- Confirmed shift next week → the confirm trigger raises a draft invoice.
  insert into public.bookings
    (practice_id, locum_id, role_id, booking_date, start_time, finish_time,
     locum_hourly_rate, fee_day_type, booking_fee, notes, created_by)
  values
    (p_main, l_main, r_nurse, d_next, '09:00', '17:00', 17.50, 'weekday', 0,
     'Implant list in surgery 2 in the morning. Parking at the rear.', u_practice)
  returning id into b_confirmed;
  update public.bookings set status = 'accepted'  where id = b_confirmed;
  update public.bookings set status = 'confirmed' where id = b_confirmed;

  -- A request still waiting on the locum.
  insert into public.bookings
    (practice_id, locum_id, role_id, booking_date, start_time, finish_time,
     locum_hourly_rate, fee_day_type, booking_fee, created_by)
  values
    (p_main, l_main, r_nurse, d_later, '08:30', '13:00', 17.50, 'weekday', 0, u_practice);

  -- A request to the hygienist.
  insert into public.bookings
    (practice_id, locum_id, role_id, booking_date, start_time, finish_time,
     locum_hourly_rate, fee_day_type, booking_fee, created_by)
  values
    (p_main, l_hyg, r_hyg, d_next, '13:00', '17:30', 36.50, 'weekday', 0, u_practice);

  -- A shift worked last week, completed and paid. Fees are looked up by
  -- shift date and the default fee rows only start on the day the schema
  -- was installed, so a backdated demo shift is priced at today's fee.
  insert into public.bookings
    (practice_id, locum_id, role_id, booking_date, start_time, finish_time,
     locum_hourly_rate, fee_day_type, booking_fee, created_by)
  values
    (p_main, l_main, r_nurse, d_past, '09:00', '17:00', 17.50, 'weekday',
     coalesce(public.current_booking_fee(r_nurse, current_date), 25.00), u_practice)
  returning id into b_past;
  update public.bookings set status = 'accepted'  where id = b_past;
  update public.bookings set status = 'confirmed' where id = b_past;
  update public.bookings set status = 'completed' where id = b_past;

  select id into v_inv from public.invoices where booking_id = b_past;
  update public.invoices
     set issue_date = d_past, due_date = d_past + 14,
         status = 'paid', sent_at = d_past, paid_at = now()
   where id = v_inv;
  insert into public.payments (invoice_id, amount, method, reference, recorded_by)
  select id, total, 'bank_transfer', 'DEMO-PAYMENT', u_admin from public.invoices where id = v_inv;

  -- The confirmed shift's invoice has been sent, so there is an outstanding figure.
  update public.invoices
     set status = 'sent', sent_at = now()
   where booking_id = b_confirmed;

  -- ------------------------------------------------------------------
  -- Favourites
  -- ------------------------------------------------------------------
  insert into public.favourite_locums (practice_id, locum_id, created_by)
  values (p_main, l_main, u_practice), (p_main, l_hyg, u_practice);

  raise notice 'Demo data ready: 3 bookable locums, 1 approved + 1 pending practice, 4 bookings.';
end $$;
