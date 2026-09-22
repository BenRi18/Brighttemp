-- =====================================================================
-- Brighttemp — auth wiring
-- Run after 01_schema.sql and 02_rls.sql
-- =====================================================================

-- Every auth user gets a profile in the same transaction as the signup,
-- so there is never a window where a session exists without a profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type user_type;
begin
  v_type := coalesce(new.raw_user_meta_data ->> 'user_type', 'practice')::user_type;

  -- Admin accounts are created by Brighttemp, never by self-signup.
  if v_type = 'admin' then
    v_type := 'practice';
  end if;

  insert into public.profiles (id, user_type, full_name, email, phone)
  values (
    new.id,
    v_type,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  -- Mirror the type into app_metadata so it lands in the JWT and the
  -- Next.js middleware can route without a database round trip.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('user_type', v_type::text)
   where id = new.id;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile email in step with the auth email.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Promote an existing user to admin. Run from the SQL editor / service role.
create or replace function public.grant_admin(p_email text, p_role admin_role default 'operations')
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then raise exception 'No user with email %', p_email; end if;

  update public.profiles set user_type = 'admin' where id = v_id;
  insert into public.admin_users (profile_id, admin_role) values (v_id, p_role)
    on conflict (profile_id) do update set admin_role = excluded.admin_role, is_active = true;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('user_type', 'admin')
   where id = v_id;
end $$;

revoke all on function public.grant_admin from public, authenticated;
