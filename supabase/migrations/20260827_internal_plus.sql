-- 內部永久 PLUS。可安全重複執行。
-- 只建立 nichi_internal_users 與 service_role 可讀政策／函式，不依賴 analytics_events。
-- 不修改 nichi_user_data，不寫 is_paid，不建立假付款紀錄，不重算 trial 日期。
-- 一般使用者無法讀寫此表；只有 service_role / SQL Editor 可指定內部帳號。

begin;

create table if not exists public.nichi_internal_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_type text not null default 'internal',
  note text,
  created_at timestamptz not null default now(),
  constraint nichi_internal_users_access_type_chk
    check (access_type = 'internal')
);

comment on table public.nichi_internal_users is
  '內部永久 PLUS。effective_plan = plus，不是付費訂閱，不受 trial / is_paid 影響。指定帳號請用 SQL insert，不要改 nichi_user_data。';

alter table public.nichi_internal_users enable row level security;

revoke all on public.nichi_internal_users from public, anon, authenticated;
grant all on public.nichi_internal_users to service_role;

drop policy if exists "nichi_internal_users_service_all" on public.nichi_internal_users;
create policy "nichi_internal_users_service_all"
  on public.nichi_internal_users
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.nichi_is_internal_user(p_user_id uuid, p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if p_user_id is not null and exists (
    select 1
    from public.nichi_internal_users
    where user_id = p_user_id
      and access_type = 'internal'
  ) then
    return true;
  end if;
  if p_email is not null and btrim(p_email) <> '' and exists (
    select 1
    from public.nichi_internal_users i
    join auth.users u on u.id = i.user_id
    where lower(u.email) = lower(btrim(p_email))
      and i.access_type = 'internal'
  ) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.nichi_is_internal_user(uuid, text) from public, anon, authenticated;
grant execute on function public.nichi_is_internal_user(uuid, text) to service_role;

notify pgrst, 'reload schema';

commit;

-- 驗證：應看到 table_name = nichi_internal_users、rls_enabled = true
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'nichi_internal_users';

-- 把既有帳號設為內部 PLUS（只新增角色列，不刪除、不重設日記）。
-- 建表成功後另執行，把 Email 換成實際帳號：
-- insert into public.nichi_internal_users (user_id, access_type, note)
-- select id, 'internal', 'internal plus'
-- from auth.users
-- where lower(email) in ('you@example.com', 'teammate@example.com')
-- on conflict (user_id) do update
--   set access_type = excluded.access_type,
--       note = excluded.note;
