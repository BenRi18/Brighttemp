-- =====================================================================
-- First name and surname as separate fields.
--
-- full_name does not go away: it becomes a generated column, so all 28
-- places in the app that read profiles.full_name — search results, booking
-- pages, the admin lists, every portal header — keep working untouched, and
-- it can never drift out of step with the two parts.
--
-- Run after 0009_admin_review_functions.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The two new columns
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- ---------------------------------------------------------------------
-- 2. Backfill from the names already stored
--
--    "Ben Richardson"            -> Ben       | Richardson
--    "Ana Maria Lopez Garcia"    -> Ana Maria | Lopez Garcia  (last word is
--                                               rarely the whole surname, but
--                                               splitting on the final space
--                                               is wrong far more often for
--                                               Spanish and South Asian names,
--                                               so first word / rest it is)
--    "Cher"                      -> Cher      | ''            (no surname given)
--
--    Nobody is renamed by this: full_name still reads exactly as it did,
--    because it is rebuilt from the two parts in step 4.
-- ---------------------------------------------------------------------

-- A practice is a business, not a person: the whole name stays in one piece,
-- which is also what new practice signups now write. Splitting "Oakfield
-- Dental Practice" into a first name and a surname would file it under D.
update public.profiles
   set first_name = btrim(full_name),
       last_name  = ''
 where first_name is null
   and full_name is not null
   and user_type = 'practice';

update public.profiles
   set first_name = split_part(btrim(full_name), ' ', 1),
       last_name  = btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1))
 where first_name is null
   and full_name is not null;

-- Anyone whose full_name was blank keeps a usable first name.
update public.profiles
   set first_name = coalesce(nullif(btrim(first_name), ''), split_part(email, '@', 1)),
       last_name  = coalesce(last_name, '')
 where coalesce(btrim(first_name), '') = '';

alter table public.profiles
  alter column first_name set not null,
  alter column last_name  set default '';

update public.profiles set last_name = '' where last_name is null;
alter table public.profiles alter column last_name set not null;

-- ---------------------------------------------------------------------
-- 3. Drop the old grant before the column goes
--
--    A generated column cannot be updated, so leaving full_name in the
--    grant list would make every profile update fail.
-- ---------------------------------------------------------------------

revoke update on public.profiles from authenticated;

-- ---------------------------------------------------------------------
-- 4. full_name becomes derived
-- ---------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'full_name' and is_generated = 'NEVER'
  ) then
    alter table public.profiles drop column full_name;
  end if;
end $$;

alter table public.profiles
  add column if not exists full_name text
  generated always as (btrim(first_name || ' ' || last_name)) stored;

-- user_type is identity, not a preference: it cannot be self-edited, and
-- full_name is now derived so it is not in the list either.
grant update (first_name, last_name, phone, whatsapp_opt_in, last_seen_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 5. Signup writes the two parts
--
--    first_name/last_name come from the registration form. full_name is
--    still accepted as a fallback, so an older client — or a user created
--    from the Supabase dashboard — still lands a sensible name.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type  user_type;
  v_first text;
  v_last  text;
  v_full  text;
begin
  v_type := coalesce(new.raw_user_meta_data ->> 'user_type', 'practice')::user_type;

  -- Admin accounts are created by Brighttemp, never by self-signup.
  if v_type = 'admin' then
    v_type := 'practice';
  end if;

  v_first := nullif(btrim(new.raw_user_meta_data ->> 'first_name'), '');
  v_last  := nullif(btrim(new.raw_user_meta_data ->> 'last_name'), '');

  -- No separate parts? Fall back to splitting whatever single name we got.
  if v_first is null then
    v_full  := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                        split_part(new.email, '@', 1));
    v_first := split_part(v_full, ' ', 1);
    v_last  := coalesce(v_last, btrim(substr(v_full, length(split_part(v_full, ' ', 1)) + 1)));
  end if;

  insert into public.profiles (id, user_type, first_name, last_name, email, phone)
  values (new.id, v_type, v_first, coalesce(v_last, ''), new.email,
          nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;

  -- Mirror the type into app_metadata so it lands in the JWT and the
  -- Next.js middleware can route without a database round trip.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('user_type', v_type::text)
   where id = new.id;

  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. Searching and sorting by surname
-- ---------------------------------------------------------------------

create index if not exists profiles_last_name_idx on public.profiles (lower(last_name));
