-- 雲端同步 schema。可在全新、完全沒有 nichi_user_data 的 Supabase 專案重複執行。
-- 程式實際讀寫（lib/supabase.js buildUserDataRow、app.js upsert）：
--   user_id uuid = auth.users.id
--   email text
--   reviews jsonb  日期字串 "YYYY-MM-DD" → 當日復盤物件（journal / gratitude / updatedAt 等）
--   tasks jsonb    行動卡陣列
--   sfm jsonb      收藏／素材陣列
--   reports jsonb  週月報物件；__insights、__manifests 也嵌在這裡
--   created_at / updated_at timestamptz
-- 一人一列，所以 unique 就是 primary key (user_id)，不必再做 (user_id, date)。

grant usage on schema public to anon, authenticated, service_role;

create table if not exists public.nichi_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nichi_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  reviews jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  sfm jsonb not null default '[]'::jsonb,
  reports jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nichi_profiles
  add column if not exists email text;
alter table public.nichi_profiles
  add column if not exists display_name text;
alter table public.nichi_profiles
  add column if not exists avatar_url text;
alter table public.nichi_profiles
  add column if not exists created_at timestamptz not null default now();
alter table public.nichi_profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.nichi_user_data
  add column if not exists email text;
alter table public.nichi_user_data
  add column if not exists reviews jsonb not null default '{}'::jsonb;
alter table public.nichi_user_data
  add column if not exists tasks jsonb not null default '[]'::jsonb;
alter table public.nichi_user_data
  add column if not exists sfm jsonb not null default '[]'::jsonb;
alter table public.nichi_user_data
  add column if not exists reports jsonb not null default '{}'::jsonb;
alter table public.nichi_user_data
  add column if not exists created_at timestamptz not null default now();
alter table public.nichi_user_data
  add column if not exists updated_at timestamptz not null default now();

create index if not exists nichi_user_data_email_idx on public.nichi_user_data (email);

comment on table public.nichi_user_data is
  'One cloud journal bundle per authenticated user. Daily records live in reviews JSON keyed by YYYY-MM-DD.';
comment on column public.nichi_user_data.user_id is
  'Supabase auth.users.id. Never use email as the primary key.';
comment on column public.nichi_user_data.reviews is
  'JSONB object: { "YYYY-MM-DD": { date, userId, updatedAt, journal, gratitude, rawText, ... } }';
comment on column public.nichi_user_data.reports is
  'JSONB object for weekly/monthly reports; also nests __insights and __manifests arrays.';

alter table public.nichi_profiles enable row level security;
alter table public.nichi_user_data enable row level security;

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

grant select, insert, update on public.nichi_profiles to authenticated;
grant all on public.nichi_profiles to service_role;

grant select, insert, update, delete on public.nichi_user_data to authenticated;
grant all on public.nichi_user_data to service_role;

notify pgrst, 'reload schema';
