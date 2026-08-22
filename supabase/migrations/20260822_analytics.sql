-- ING 行為分析。可重複執行。
-- 不修改 nichi_user_data / nichi_subscriptions 既有欄位與資料列。
-- 不讀取、不複製日記、感恩、身體描述或任何私人文字。

create table if not exists public.nichi_admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.nichi_admin_users is
  '只有列在這張表的使用者能讀取 aggregate analytics。一般使用者無法寫入。第一位 admin 請用 SQL Editor 手動 insert。';

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  event_category text,
  event_metadata jsonb not null default '{}'::jsonb,
  source_key text,
  session_id text,
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  '產品行為事件。event_metadata 只允許非敏感列舉值，禁止私人文字。';
comment on column public.analytics_events.source_key is
  'backfill 穩定來源鍵，例如 review:2026-08-21、task:{id}、report:week:2026-W33。即時事件可為 null。';

alter table public.analytics_events
  add column if not exists source_key text;

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);

create unique index if not exists analytics_events_unique_once_uidx
  on public.analytics_events (user_id, event_name)
  where event_name in (
    'auth_signup_completed',
    'trial_started',
    'trial_expired',
    'subscription_started'
  );

-- 舊版以 created_at 去重，updated_at fallback 會讓重跑產生重複列。
drop index if exists analytics_events_backfill_uidx;

create unique index if not exists analytics_events_backfill_source_uidx
  on public.analytics_events (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill';

create table if not exists public.nichi_analytics_cohorts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.nichi_analytics_cohort_members (
  cohort_id uuid not null references public.nichi_analytics_cohorts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

-- 只給 migration / 後端用。SECURITY INVOKER，不提升權限。
-- 非法時間回傳 null，不拋錯，避免單筆壞資料中斷整批 backfill。
-- STABLE：無時區的時間字串轉 timestamptz 會吃 session TimeZone，不是 IMMUTABLE。
create or replace function public.analytics_safe_timestamptz(raw text)
returns timestamptz
language plpgsql
stable
set search_path = pg_catalog
as $$
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;
  if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then
    return null;
  end if;
  return raw::timestamptz;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.analytics_safe_timestamptz(text) from public, anon, authenticated;
grant execute on function public.analytics_safe_timestamptz(text) to postgres, service_role;

alter table public.nichi_admin_users enable row level security;
alter table public.analytics_events enable row level security;
alter table public.nichi_analytics_cohorts enable row level security;
alter table public.nichi_analytics_cohort_members enable row level security;

revoke all on public.nichi_admin_users from anon, authenticated;
revoke all on public.nichi_analytics_cohorts from anon, authenticated;
revoke all on public.nichi_analytics_cohort_members from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant insert on public.analytics_events to authenticated;
grant all on public.nichi_admin_users to service_role;
grant all on public.analytics_events to service_role;
grant all on public.nichi_analytics_cohorts to service_role;
grant all on public.nichi_analytics_cohort_members to service_role;

alter table public.analytics_events drop constraint if exists analytics_events_event_name_chk;
alter table public.analytics_events drop constraint if exists analytics_events_metadata_size_chk;
alter table public.analytics_events drop constraint if exists analytics_events_session_id_chk;
alter table public.analytics_events drop constraint if exists analytics_events_source_key_chk;

alter table public.analytics_events
  add constraint analytics_events_event_name_chk
  check (event_name in (
    'app_open',
    'auth_signup_completed',
    'login_completed',
    'review_started',
    'review_completed',
    'quick_review_completed',
    'deep_review_completed',
    'body_awareness_completed',
    'deep_thinking_started',
    'deep_thinking_completed',
    'action_card_created',
    'action_card_completed',
    'weekly_report_generated',
    'weekly_report_viewed',
    'monthly_report_generated',
    'monthly_report_viewed',
    'manifestation_created',
    'history_viewed',
    'subscription_page_viewed',
    'trial_started',
    'trial_expired',
    'subscription_started'
  ));

alter table public.analytics_events
  add constraint analytics_events_metadata_size_chk
  check (pg_column_size(coalesce(event_metadata, '{}'::jsonb)) <= 2048);

alter table public.analytics_events
  add constraint analytics_events_session_id_chk
  check (session_id is null or char_length(session_id) <= 64);

alter table public.analytics_events
  add constraint analytics_events_source_key_chk
  check (source_key is null or char_length(source_key) <= 128);

drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and event_name is not null
    and char_length(event_name) <= 64
  );

-- 一般使用者不可 SELECT / UPDATE / DELETE。Admin 走 service_role API。

insert into public.nichi_analytics_cohorts (slug, name)
values ('founder-batch-01', 'Founder Batch 01')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill：只寫「可以確定發生」的行為。來源已註解。
-- 不猜測 deep_thinking_* / *_report_viewed / history_viewed / app_open / login。
-- 只處理 auth.users 存在的帳號；非法時間／非 array flags 跳過該筆。
-- ---------------------------------------------------------------------------

-- 來源：nichi_profiles 的 created_at → auth_signup_completed
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  p.id,
  'auth_signup_completed',
  'auth',
  jsonb_build_object('source', 'backfill'),
  'signup:' || p.id::text,
  p.created_at
from public.nichi_profiles p
inner join auth.users u on u.id = p.id
on conflict (user_id, event_name) where event_name in ('auth_signup_completed', 'trial_started', 'trial_expired', 'subscription_started')
do nothing;

-- 來源：nichi_subscriptions.trial_started_at
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  s.user_id,
  'trial_started',
  'billing',
  jsonb_build_object('source', 'backfill'),
  'trial:' || s.user_id::text,
  s.trial_started_at
from public.nichi_subscriptions s
inner join auth.users u on u.id = s.user_id
where s.trial_started_at is not null
on conflict (user_id, event_name) where event_name in ('auth_signup_completed', 'trial_started', 'trial_expired', 'subscription_started')
do nothing;

-- 正式 nichi_subscriptions 只有 status / trial_* / updated_at 等 15 欄，沒有 is_paid、last_charge_at、created_at。
-- 來源：試用截止已過，且目前不是付費狀態（active / past_due）
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  s.user_id,
  'trial_expired',
  'billing',
  jsonb_build_object('source', 'backfill'),
  'trial-expired:' || s.user_id::text,
  s.trial_ends_at
from public.nichi_subscriptions s
inner join auth.users u on u.id = s.user_id
where s.trial_ends_at is not null
  and s.trial_ends_at < now()
  and coalesce(s.status, '') not in ('active', 'past_due')
on conflict (user_id, event_name) where event_name in ('auth_signup_completed', 'trial_started', 'trial_expired', 'subscription_started')
do nothing;

-- 來源：status 能證明已進入付費（active / past_due）。沒有首次付款時間，只用 updated_at 並標明近似。
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  s.user_id,
  'subscription_started',
  'billing',
  jsonb_build_object('source', 'backfill', 'time_source', 'subscription_updated_at'),
  'subscription:' || s.user_id::text,
  s.updated_at
from public.nichi_subscriptions s
inner join auth.users u on u.id = s.user_id
where s.status in ('active', 'past_due')
  and s.updated_at is not null
on conflict (user_id, event_name) where event_name in ('auth_signup_completed', 'trial_started', 'trial_expired', 'subscription_started')
do nothing;

-- 來源：nichi_user_data.reviews[*].completedAt → review_completed + quick/deep
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  'review_completed',
  'review',
  jsonb_build_object(
    'source', 'backfill',
    'mode', case when coalesce(r.value->'journal'->>'mode', '') = 'quick' then 'quick' else 'deep' end
  ),
  'review:' || r.key,
  public.analytics_safe_timestamptz(r.value->>'completedAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_each(coalesce(d.reviews, '{}'::jsonb)) as r(key, value)
where jsonb_typeof(d.reviews) = 'object'
  and coalesce(r.key, '') <> ''
  and public.analytics_safe_timestamptz(r.value->>'completedAt') is not null
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  case when coalesce(r.value->'journal'->>'mode', '') = 'quick'
    then 'quick_review_completed'
    else 'deep_review_completed'
  end,
  'review',
  jsonb_build_object(
    'source', 'backfill',
    'mode', case when coalesce(r.value->'journal'->>'mode', '') = 'quick' then 'quick' else 'deep' end
  ),
  'review:' || r.key,
  public.analytics_safe_timestamptz(r.value->>'completedAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_each(coalesce(d.reviews, '{}'::jsonb)) as r(key, value)
where jsonb_typeof(d.reviews) = 'object'
  and coalesce(r.key, '') <> ''
  and public.analytics_safe_timestamptz(r.value->>'completedAt') is not null
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

-- 來源：已完成復盤且 bodyCheck 有勾選（不複製文字）
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  'body_awareness_completed',
  'body',
  jsonb_build_object('source', 'backfill'),
  'review:' || r.key,
  public.analytics_safe_timestamptz(r.value->>'completedAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_each(coalesce(d.reviews, '{}'::jsonb)) as r(key, value)
where jsonb_typeof(d.reviews) = 'object'
  and coalesce(r.key, '') <> ''
  and public.analytics_safe_timestamptz(r.value->>'completedAt') is not null
  and jsonb_typeof(r.value->'journal'->'bodyCheck') = 'object'
  and (
    (
      case
        when jsonb_typeof(r.value->'journal'->'bodyCheck'->'mood'->'flags') = 'array'
        then jsonb_array_length(r.value->'journal'->'bodyCheck'->'mood'->'flags')
        else 0
      end
    ) > 0
    or (
      case
        when jsonb_typeof(r.value->'journal'->'bodyCheck'->'body'->'flags') = 'array'
        then jsonb_array_length(r.value->'journal'->'bodyCheck'->'body'->'flags')
        else 0
      end
    ) > 0
    or coalesce(r.value->'journal'->'bodyCheck'->'sleep'->>'duration', '') <> ''
  )
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

-- 來源：已完成復盤且有顯化欄位（只記「有內容」，不複製內容）
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  'manifestation_created',
  'manifest',
  jsonb_build_object('source', 'backfill'),
  'review:' || r.key,
  public.analytics_safe_timestamptz(r.value->>'completedAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_each(coalesce(d.reviews, '{}'::jsonb)) as r(key, value)
where jsonb_typeof(d.reviews) = 'object'
  and coalesce(r.key, '') <> ''
  and public.analytics_safe_timestamptz(r.value->>'completedAt') is not null
  and length(trim(coalesce(r.value->'journal'->>'manifest', ''))) >= 4
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

-- 來源：nichi_user_data.tasks[*] 建立
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  'action_card_created',
  'execution',
  jsonb_build_object('source', 'backfill'),
  'task:' || (t.value->>'id'),
  public.analytics_safe_timestamptz(t.value->>'createdAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(d.tasks) = 'array' then d.tasks else '[]'::jsonb end
) as t(value)
where coalesce(nullif(t.value->>'id', ''), '') <> ''
  and coalesce(t.value->>'title', '') <> ''
  and public.analytics_safe_timestamptz(t.value->>'createdAt') is not null
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

-- 來源：tasks status = done
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  'action_card_completed',
  'execution',
  jsonb_build_object('source', 'backfill'),
  'task:' || (t.value->>'id'),
  coalesce(
    public.analytics_safe_timestamptz(t.value->>'updatedAt'),
    public.analytics_safe_timestamptz(t.value->>'createdAt')
  )
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(d.tasks) = 'array' then d.tasks else '[]'::jsonb end
) as t(value)
where coalesce(nullif(t.value->>'id', ''), '') <> ''
  and t.value->>'status' = 'done'
  and coalesce(
    public.analytics_safe_timestamptz(t.value->>'updatedAt'),
    public.analytics_safe_timestamptz(t.value->>'createdAt')
  ) is not null
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

-- 來源：nichi_user_data.reports week:/month: 的 generatedAt
insert into public.analytics_events (user_id, event_name, event_category, event_metadata, source_key, created_at)
select
  d.user_id,
  case when split_part(r.key, ':', 1) = 'week' then 'weekly_report_generated' else 'monthly_report_generated' end,
  'report',
  jsonb_build_object('source', 'backfill', 'type', split_part(r.key, ':', 1)),
  'report:' || r.key,
  public.analytics_safe_timestamptz(r.value->>'generatedAt')
from public.nichi_user_data d
inner join auth.users u on u.id = d.user_id
cross join lateral jsonb_each(coalesce(d.reports, '{}'::jsonb)) as r(key, value)
where (r.key like 'week:%' or r.key like 'month:%')
  and public.analytics_safe_timestamptz(r.value->>'generatedAt') is not null
on conflict (user_id, event_name, source_key)
  where coalesce(event_metadata->>'source', '') = 'backfill'
do nothing;

notify pgrst, 'reload schema';

-- 第一位管理員（請改成你的 auth.users id 後取消註解）：
-- insert into public.nichi_admin_users (user_id, note)
-- values ('00000000-0000-0000-0000-000000000000', 'founder')
-- on conflict do nothing;
