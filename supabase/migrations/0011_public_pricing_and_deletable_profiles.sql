-- =====================================================================
-- Two things the logs turned up.
--
--   1. The public pricing page cannot read the fee table.
--   2. A profile cannot be deleted once anyone has reviewed anything.
--
-- Run after 0010_split_names.sql. Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Let the public pricing page read roles and fees
--
--    0002 does "revoke all on all tables in schema public from anon",
--    and the roles_read / fees_read policies are "to authenticated". So a
--    visitor who is not signed in gets:
--
--      permission denied for table roles      (42501 → HTTP 401)
--
--    and /pricing falls back to its "fees aren't loading" message. It has
--    never worked against the real database — preview mode answers from
--    sample data, which is why it looked fine locally.
--
--    Both halves are needed: a GRANT without a policy still returns
--    nothing, and a policy without a GRANT still fails on privilege.
-- ---------------------------------------------------------------------

-- Everything on the roles table is already printed on the public site.
grant select on public.roles to anon;

-- Not so for fees: created_by is an administrator's id and has no business
-- being readable by the world, so the grant is column by column.
grant select (id, fee_type, role_id, day_type, amount, notice_hours_below,
              effective_from, effective_to, created_at)
  on public.fees to anon;

drop policy if exists roles_read_public on public.roles;
create policy roles_read_public on public.roles
  for select to anon using (is_active);

drop policy if exists fees_read_public on public.fees;
create policy fees_read_public on public.fees
  for select to anon using (effective_to is null or effective_to >= current_date);


-- ---------------------------------------------------------------------
-- 2. Make a profile deletable again
--
--    Fourteen columns record who did something — reviewed_by, approved_by,
--    created_by, cancelled_by and so on. Each is a foreign key to profiles
--    with no ON DELETE action, which means NO ACTION: deleting the person
--    is refused outright.
--
--      update or delete on table "profiles" violates foreign key
--      constraint "compliance_documents_reviewed_by_fkey"
--
--    That blocks clearing out a test account, and it would block a real
--    erasure request under UK GDPR later, which is the more serious half.
--
--    The right behaviour for an audit column is to keep the record and drop
--    the name: the document was still reviewed, we just no longer say by
--    whom. So they become ON DELETE SET NULL.
--
--    A NOT NULL column cannot be set null — booking_messages.sender_id is
--    the only one — so there the rows go with the person. That is what an
--    erasure request means anyway.
--
--    Constraint names are read from the catalogue rather than guessed, and
--    only those still on NO ACTION are touched, so re-running does nothing.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  action text;
begin
  for r in
    select con.conname,
           rel.relname as table_name,
           att.attname as column_name,
           att.attnotnull as is_required
      from pg_constraint con
      join pg_class     rel on rel.oid = con.conrelid
      join pg_namespace ns  on ns.oid  = rel.relnamespace
      join pg_attribute att on att.attrelid = con.conrelid
                           and att.attnum   = con.conkey[1]
     where con.contype   = 'f'
       and ns.nspname    = 'public'
       and con.confrelid = 'public.profiles'::regclass
       and con.confdeltype = 'a'                 -- NO ACTION, i.e. blocks
       and array_length(con.conkey, 1) = 1
  loop
    action := case when r.is_required then 'cascade' else 'set null' end;

    execute format('alter table public.%I drop constraint %I',
                   r.table_name, r.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) '
      'references public.profiles(id) on delete %s',
      r.table_name, r.conname, r.column_name, action);

    raise notice '% .% -> on delete %', r.table_name, r.column_name, action;
  end loop;
end $$;
