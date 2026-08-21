-- Google 帳號雲端同步：profiles + 既有 nichi_user_data RLS 補強。
-- 每日復盤仍存在 public.nichi_user_data.reviews（依日期為 key），不強制拆表。

create table if not exists public.nichi_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nichi_profiles enable row level security;

drop policy if exists "nichi_profiles_select_own" on public.nichi_profiles;
create policy "nichi_profiles_select_own"
  on public.nichi_profiles for select
  using (auth.uid() = id);

drop policy if exists "nichi_profiles_insert_own" on public.nichi_profiles;
create policy "nichi_profiles_insert_own"
  on public.nichi_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "nichi_profiles_update_own" on public.nichi_profiles;
create policy "nichi_profiles_update_own"
  on public.nichi_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, insert, update on public.nichi_profiles to authenticated;
grant all on public.nichi_profiles to service_role;

alter table public.nichi_user_data
  add column if not exists created_at timestamptz not null default now();

alter table public.nichi_user_data enable row level security;

drop policy if exists "nichi_user_data_select_own" on public.nichi_user_data;
create policy "nichi_user_data_select_own"
  on public.nichi_user_data for select
  using (auth.uid() = user_id);

drop policy if exists "nichi_user_data_insert_own" on public.nichi_user_data;
create policy "nichi_user_data_insert_own"
  on public.nichi_user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "nichi_user_data_update_own" on public.nichi_user_data;
create policy "nichi_user_data_update_own"
  on public.nichi_user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "nichi_user_data_delete_own" on public.nichi_user_data;
create policy "nichi_user_data_delete_own"
  on public.nichi_user_data for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.nichi_user_data to authenticated;
grant all on public.nichi_user_data to service_role;

notify pgrst, 'reload schema';
