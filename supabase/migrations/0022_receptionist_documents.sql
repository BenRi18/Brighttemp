-- =====================================================================
-- Receptionists: photo ID, and nothing else compulsory.
--
-- A receptionist is not clinical staff. They are not on the GDC register,
-- they do not work in surgery, and there is no reason a dental indemnity
-- policy or an infection control certificate should stand between them
-- and a day's work on a front desk.
--
-- They were being asked for three documents, not one. 0001 seeded the
-- requirements as:
--
--   where r.requires_gdc or d.doc_type in ('dbs', 'infection_control')
--
-- so a role with requires_gdc = false still picked up DBS and infection
-- control, and 0006 then made photo ID mandatory for every role. A
-- receptionist therefore had to clear all three before
-- locum_compliance_ok would pass, and until it passed they never appeared
-- in a practice's search.
--
-- No new section to register through is needed for this: requirements are
-- already per role, and the registration form is the same either way.
-- What was wrong is the data in one table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Made optional rather than deleted.
--
--    Keeping the rows means the documents still appear on a
--    receptionist's compliance page and can still be uploaded. A
--    receptionist who does hold a DBS can show it, the practice can see
--    it, and it counts in their favour — it simply no longer stops them
--    working while they do not.
--
--    locum_compliance_ok joins `on cr.role_id = l.role_id and
--    cr.is_mandatory`, so an optional requirement is invisible to the
--    bookability check.
-- ---------------------------------------------------------------------
update public.compliance_requirements cr
   set is_mandatory = false
  from public.roles r
 where r.id = cr.role_id
   and r.slug = 'receptionist'
   and cr.doc_type in ('dbs', 'infection_control')
   and cr.is_mandatory;

-- Photo ID stays compulsory. It is the one thing a practice genuinely
-- needs before letting somebody behind the desk with patient records.

-- ---------------------------------------------------------------------
-- 2. Recompute bookability for receptionists already on the books.
--
--    Nothing fires on a change to compliance_requirements — is_bookable
--    is recomputed when a document changes or a locum's status changes,
--    neither of which has happened here. Without this, a receptionist who
--    is now compliant stays out of search until they next touch a
--    document, and nobody would know why.
--
--    Calls the function rather than repeating its expression, so the two
--    cannot drift apart.
-- ---------------------------------------------------------------------
select public.refresh_locum_bookability(l.id)
  from public.locums l
  join public.roles r on r.id = l.role_id
 where r.slug = 'receptionist';

-- ---------------------------------------------------------------------
-- 3. Say what changed, rather than leaving it silent.
-- ---------------------------------------------------------------------
do $$
declare
  v_total int;
  v_bookable int;
begin
  select count(*), count(*) filter (where l.is_bookable)
    into v_total, v_bookable
    from public.locums l
    join public.roles r on r.id = l.role_id
   where r.slug = 'receptionist';

  raise notice 'Receptionists: % on the books, % now appearing in search.',
    v_total, v_bookable;

  if v_total > 0 and v_bookable < v_total then
    raise notice 'The rest are either unapproved, archived, or still without photo ID.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Doing the same for another non-clinical role later
--
-- Add the role, then make everything but photo ID optional for it:
--
--   update public.compliance_requirements cr
--      set is_mandatory = false
--     from public.roles r
--    where r.id = cr.role_id
--      and r.slug = 'the-new-role'
--      and cr.doc_type <> 'photo_id';
--
--   select public.refresh_locum_bookability(l.id)
--     from public.locums l join public.roles r on r.id = l.role_id
--    where r.slug = 'the-new-role';
--
-- The second statement is the one that is easy to forget and the one
-- that makes the change visible.
-- ---------------------------------------------------------------------
