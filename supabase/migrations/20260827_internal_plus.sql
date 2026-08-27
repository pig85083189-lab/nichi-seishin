-- 內部永久 PLUS。可重複執行。
-- 不修改 nichi_user_data，不寫 is_paid，不建立假付款紀錄，不重算 trial 日期。
-- 一般使用者無法讀寫此表；只有 service_role / SQL Editor 可指定內部帳號。

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

drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and event_name is not null
    and char_length(event_name) <= 64
    and not exists (
      select 1
      from public.nichi_internal_users i
      where i.user_id = auth.uid()
        and i.access_type = 'internal'
    )
  );

notify pgrst, 'reload schema';

-- 把既有帳號設為內部 PLUS（只新增角色列，不刪除、不重設日記）：
-- insert into public.nichi_internal_users (user_id, access_type, note)
-- select id, 'internal', 'internal plus'
-- from auth.users
-- where lower(email) in ('you@example.com', 'teammate@example.com')
-- on conflict (user_id) do update
--   set access_type = excluded.access_type,
--       note = excluded.note;
