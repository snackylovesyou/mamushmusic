-- Run this in Supabase SQL Editor before deploying the Auth-based login.
-- Existing passwords must be reset; this migration never reads or migrates them.

alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists profiles_user_id_key
  on public.profiles (user_id)
  where user_id is not null;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, favorites, playlists, profile_img)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[]'::jsonb,
    '[]'::jsonb,
    null
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- After all users have migrated, remove the exposed legacy column:
-- alter table public.profiles drop column if exists password;
