-- =====================================================================
-- Let Brighttemp admins actually approve things.
--
-- 0002_rls.sql locks down who may write the sensitive columns:
--
--     revoke update on public.locums from authenticated;
--     grant  update (gdc_number, years_experience, ...) ... to authenticated;
--
-- That stops a locum setting their own status to 'approved'. But column
-- privileges belong to the ROLE, not the policy, and an admin is also
-- 'authenticated' — so admins were blocked too, and every approval failed
-- with "permission denied for table locums".
--
-- Widening the grant would hand self-approval to every locum. Instead the
-- admin writes go through SECURITY DEFINER functions that check is_admin()
-- first — the same pattern cancel_booking() already uses.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Locums
-- ---------------------------------------------------------------------
create or replace function public.admin_review_locum(
  p_locum_id uuid,
  p_approve  boolean,
  p_reason   text default null
)
returns table (locum_id uuid, is_bookable boolean, profile_id uuid, email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.locums l
     set status            = (case when p_approve then 'approved' else 'rejected' end)::account_status,
         approved_at       = case when p_approve then now() else null end,
         approved_by       = case when p_approve then auth.uid() else null end,
         suspension_reason = case when p_approve then null else nullif(p_reason, '') end
   where l.id = p_locum_id;

  if not found then
    raise exception 'Locum not found';
  end if;

  return query
    select l.id, l.is_bookable, l.profile_id, pr.email::text
    from public.locums l
    join public.profiles pr on pr.id = l.profile_id
    where l.id = p_locum_id;
end $$;

-- ---------------------------------------------------------------------
-- Practices
-- ---------------------------------------------------------------------
create or replace function public.admin_review_practice(
  p_practice_id uuid,
  p_approve     boolean,
  p_reason      text default null
)
returns table (practice_id uuid, name text, owner_profile_id uuid, owner_email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.practices p
     set status            = (case when p_approve then 'approved' else 'rejected' end)::account_status,
         approved_at       = case when p_approve then now() else null end,
         approved_by       = case when p_approve then auth.uid() else null end,
         suspension_reason = case when p_approve then null else nullif(p_reason, '') end
   where p.id = p_practice_id;

  if not found then
    raise exception 'Practice not found';
  end if;

  return query
    select p.id, p.name, pu.profile_id, pr.email::text
    from public.practices p
    left join public.practice_users pu
      on pu.practice_id = p.id and pu.is_primary
    left join public.profiles pr on pr.id = pu.profile_id
    where p.id = p_practice_id;
end $$;

-- ---------------------------------------------------------------------
-- Instant booking on or off for a practice
-- ---------------------------------------------------------------------
create or replace function public.admin_set_trust_level(
  p_practice_id uuid,
  p_trust_level trust_level
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.practices set trust_level = p_trust_level where id = p_practice_id;
  if not found then raise exception 'Practice not found'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Compliance documents
--
-- Approving the last outstanding document is what puts a locum into
-- search: the trigger on compliance_documents recomputes is_bookable.
-- ---------------------------------------------------------------------
create or replace function public.admin_review_document(
  p_document_id uuid,
  p_approve     boolean,
  p_reason      text default null
)
returns table (document_id uuid, locum_id uuid, profile_id uuid, email text, is_bookable boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role('super_admin', 'operations', 'compliance') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.compliance_documents d
     set status           = (case when p_approve then 'approved' else 'rejected' end)::compliance_status,
         reviewed_at      = now(),
         reviewed_by      = auth.uid(),
         rejection_reason = case when p_approve then null else nullif(p_reason, '') end
   where d.id = p_document_id;

  if not found then
    raise exception 'Document not found';
  end if;

  return query
    select d.id, l.id, l.profile_id, pr.email::text, l.is_bookable
    from public.compliance_documents d
    join public.locums l on l.id = d.locum_id
    join public.profiles pr on pr.id = l.profile_id
    where d.id = p_document_id;
end $$;

-- Only signed-in users may call these; each one re-checks admin rights.
revoke all on function public.admin_review_locum(uuid, boolean, text) from public;
revoke all on function public.admin_review_practice(uuid, boolean, text) from public;
revoke all on function public.admin_set_trust_level(uuid, trust_level) from public;
revoke all on function public.admin_review_document(uuid, boolean, text) from public;

grant execute on function public.admin_review_locum(uuid, boolean, text) to authenticated;
grant execute on function public.admin_review_practice(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_trust_level(uuid, trust_level) to authenticated;
grant execute on function public.admin_review_document(uuid, boolean, text) to authenticated;
