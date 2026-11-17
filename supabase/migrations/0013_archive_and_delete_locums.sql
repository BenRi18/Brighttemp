-- =====================================================================
-- Removing a locum from the books: two operations, not one.
--
--   ARCHIVE — for a locum who has actually worked. bookings.locum_id is
--             `on delete restrict`, so Postgres refuses to delete them
--             anyway, and it is right to: those bookings and the
--             invoices raised against them are financial records, and
--             HMRC expects them kept for six years. Archiving takes the
--             locum out of practice search and off the working roster
--             while leaving every row intact. Reversible.
--
--   DELETE  — for a locum who registered and never worked a shift.
--             There is nothing worth keeping, so everything goes: the
--             locum row, the profile, the uploaded certificates and the
--             login itself. Not reversible.
--
-- The delete itself runs from the server action rather than from here,
-- because removing the auth.users row needs the service role and the
-- files in the private bucket have to be cleared first — a cascade
-- deletes the compliance_documents rows but not the PDFs they point at.
-- What this migration adds is the archive, plus one function the action
-- calls to find out which of the two a given locum is eligible for.
--
-- Note the delete needs no new grant: it happens by deleting the
-- auth.users row, and profiles.id -> auth.users(id) on delete cascade
-- carries it down through profiles to locums, locum_rates,
-- locum_availability, compliance_documents and favourite_locums.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The archive marker.
--
--    Deliberately a nullable timestamp rather than a fifth value on
--    account_status. Archiving is orthogonal to where someone got to in
--    approval: a locum can be archived while 'approved' and come back
--    still approved, and nothing that filters on status (the approvals
--    queue, the roster, locum_status_changed) has to learn a new value.
-- ---------------------------------------------------------------------
alter table public.locums
  add column if not exists archived_at    timestamptz,
  add column if not exists archived_by    uuid references public.profiles(id),
  add column if not exists archive_reason text;

comment on column public.locums.archived_at is
  'Set when an admin takes the locum off the books. Excluded from search '
  'and the default roster, but every booking and invoice is kept.';

-- Partial, because the normal roster query wants the ones that are NOT
-- archived and that is almost every row.
create index if not exists locums_archived_idx
  on public.locums (archived_at) where archived_at is not null;

-- ---------------------------------------------------------------------
-- 2. An archived locum must never be bookable.
--
--    is_bookable is maintained in two places and both have to learn
--    about archiving, or the next compliance upload would quietly put an
--    archived locum back into practice search.
-- ---------------------------------------------------------------------
create or replace function public.refresh_locum_bookability(p_locum_id uuid)
returns void language plpgsql as $$
begin
  update public.locums l
     set is_bookable = (
           l.status = 'approved'
           and l.archived_at is null
           and public.locum_compliance_ok(l.id)
         )
   where l.id = p_locum_id;
end $$;

create or replace function public.locum_status_changed()
returns trigger language plpgsql as $$
begin
  new.is_bookable := (
    new.status = 'approved'
    and new.archived_at is null
    and public.locum_compliance_ok(new.id)
  );
  return new;
end $$;

-- The trigger fired on `update of status` only, so setting archived_at
-- would not have recomputed anything. Widen it to both columns.
drop trigger if exists locums_bookability on public.locums;
create trigger locums_bookability
  before update of status, archived_at on public.locums
  for each row execute function public.locum_status_changed();

-- Any locum already archived by hand before this ran.
update public.locums set is_bookable = false
 where archived_at is not null and is_bookable;

-- ---------------------------------------------------------------------
-- 3. Which of the two is this locum eligible for?
--
--    Called before anything is removed, so the admin screen can offer
--    the right action and say why. SECURITY DEFINER because counting a
--    locum's bookings is not something an admin's own policies grant in
--    a single query, and because it has to see cancelled bookings too —
--    a cancellation that charged a fee is still a financial record.
-- ---------------------------------------------------------------------
create or replace function public.locum_delete_check(p_locum_id uuid)
returns table (
  locum_id          uuid,
  profile_id        uuid,
  email             text,
  full_name         text,
  archived_at       timestamptz,
  bookings_total    int,
  bookings_upcoming int,
  documents         int,
  can_delete        boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('super_admin', 'operations') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
    select
      l.id,
      l.profile_id,
      pr.email::text,
      pr.full_name,
      l.archived_at,
      (select count(*)::int from public.bookings b where b.locum_id = l.id),
      (select count(*)::int from public.bookings b
        where b.locum_id = l.id
          and b.booking_date >= current_date
          and b.status in ('requested', 'accepted', 'confirmed')),
      (select count(*)::int from public.compliance_documents d where d.locum_id = l.id),
      not exists (select 1 from public.bookings b where b.locum_id = l.id)
    from public.locums l
    join public.profiles pr on pr.id = l.profile_id
    where l.id = p_locum_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Archive and restore.
--
--    Archiving is refused while the locum has shifts still to work.
--    Taking them out of search is harmless; taking them off the books
--    while a practice is expecting them on Thursday is not. Cancel
--    those first, so the practice gets told and the cancellation rules
--    apply properly.
-- ---------------------------------------------------------------------
create or replace function public.admin_archive_locum(
  p_locum_id uuid,
  p_reason   text default null
)
returns table (locum_id uuid, profile_id uuid, email text, full_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_upcoming int;
begin
  if not public.has_admin_role('super_admin', 'operations') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select count(*) into v_upcoming
    from public.bookings b
   where b.locum_id = p_locum_id
     and b.booking_date >= current_date
     and b.status in ('requested', 'accepted', 'confirmed');

  if v_upcoming > 0 then
    raise exception
      'Locum has % booking(s) still to work — cancel those first', v_upcoming
      using errcode = 'P0001';
  end if;

  update public.locums l
     set archived_at    = now(),
         archived_by    = auth.uid(),
         archive_reason = nullif(p_reason, ''),
         is_bookable    = false
   where l.id = p_locum_id
     and l.archived_at is null;

  if not found then
    -- Either it does not exist or it was already archived; tell them apart.
    if exists (select 1 from public.locums where id = p_locum_id) then
      raise exception 'That locum is already archived';
    end if;
    raise exception 'Locum not found';
  end if;

  insert into public.audit_log (actor_id, actor_type, action, entity_type, entity_id, after)
  values (auth.uid(), 'admin', 'locum.archived', 'locum', p_locum_id,
          jsonb_build_object('reason', nullif(p_reason, '')));

  return query
    select l.id, l.profile_id, pr.email::text, pr.full_name
      from public.locums l
      join public.profiles pr on pr.id = l.profile_id
     where l.id = p_locum_id;
end $$;

create or replace function public.admin_unarchive_locum(p_locum_id uuid)
returns table (locum_id uuid, is_bookable boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('super_admin', 'operations') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.locums l
     set archived_at    = null,
         archived_by    = null,
         archive_reason = null
   where l.id = p_locum_id
     and l.archived_at is not null;

  if not found then
    raise exception 'That locum is not archived';
  end if;

  -- The trigger recomputes is_bookable on the way through, so whether
  -- they go straight back into search depends on their documents being
  -- in date — which, after a spell off the books, they may well not be.
  insert into public.audit_log (actor_id, actor_type, action, entity_type, entity_id)
  values (auth.uid(), 'admin', 'locum.unarchived', 'locum', p_locum_id);

  return query
    select l.id, l.is_bookable from public.locums l where l.id = p_locum_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. Who is actually dormant.
--
--    Two facts the roster needs and cannot get on its own:
--
--    Last sign-in. profiles.last_seen_at exists but nothing ever writes
--    to it, so it is null for every locum on the books — reading it
--    would label the whole roster "never signed in". Supabase has been
--    recording this all along in auth.users.last_sign_in_at, which is
--    both correct and retrospective, but the authenticated role cannot
--    read the auth schema. Hence this function.
--
--    Booking count. Cheap here, a second round trip from the app, and
--    it has to count bookings an admin's own policies may not let them
--    select row by row.
-- ---------------------------------------------------------------------
create or replace function public.admin_locum_activity()
returns table (
  locum_id        uuid,
  last_sign_in_at timestamptz,
  bookings_total  int
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return query
    select l.id,
           u.last_sign_in_at,
           (select count(*)::int from public.bookings b where b.locum_id = l.id)
      from public.locums l
      join auth.users u on u.id = l.profile_id;
end $$;

-- ---------------------------------------------------------------------
-- 6. Grants. Signed-in only, and every function re-checks admin rights.
-- ---------------------------------------------------------------------
revoke all on function public.locum_delete_check(uuid) from public;
revoke all on function public.admin_archive_locum(uuid, text) from public;
revoke all on function public.admin_unarchive_locum(uuid) from public;
revoke all on function public.admin_locum_activity() from public;

grant execute on function public.locum_delete_check(uuid) to authenticated;
grant execute on function public.admin_archive_locum(uuid, text) to authenticated;
grant execute on function public.admin_unarchive_locum(uuid) to authenticated;
grant execute on function public.admin_locum_activity() to authenticated;

-- The archive columns are written only through the functions above, so
-- the authenticated role gets no column grant on them. A locum cannot
-- un-archive themselves.
