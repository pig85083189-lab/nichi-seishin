-- 在 Supabase SQL Editor 執行一次。
-- 日精進把每位使用者的復盤、下一步、素材庫、週月報存在同一列，並用 RLS 隔離。

create table if not exists public.nichi_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  reviews jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  sfm jsonb not null default '[]'::jsonb,
  reports jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists nichi_user_data_email_idx on public.nichi_user_data (email);

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

-- 訂閱與試用。計費欄位只由 service role 寫入，使用者不可自行改試用截止日。
create table if not exists public.nichi_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  status text not null default 'trialing',
  plan text not null default 'monthly',
  amount integer not null default 100,
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  merchant_order_no text unique,
  period_no text,
  period_type text not null default 'M',
  period_point text,
  period_times integer not null default 99,
  period_start_type smallint,
  next_charge_at date,
  last_charge_at timestamptz,
  last_trade_no text,
  last_message text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nichi_subscriptions_period_no_idx
  on public.nichi_subscriptions (period_no);

create table if not exists public.nichi_billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  merchant_order_no text,
  period_no text,
  trade_no text,
  event_type text not null,
  status text,
  amount integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists nichi_billing_events_trade_no_uidx
  on public.nichi_billing_events (trade_no)
  where trade_no is not null;

create index if not exists nichi_billing_events_user_idx
  on public.nichi_billing_events (user_id, created_at desc);

alter table public.nichi_subscriptions enable row level security;
alter table public.nichi_billing_events enable row level security;

revoke all on public.nichi_subscriptions from anon, authenticated;
revoke all on public.nichi_billing_events from anon, authenticated;
grant select on public.nichi_subscriptions to authenticated;
grant all on public.nichi_subscriptions to service_role;
grant all on public.nichi_billing_events to service_role;

drop policy if exists "nichi_subscriptions_select_own" on public.nichi_subscriptions;
create policy "nichi_subscriptions_select_own"
  on public.nichi_subscriptions for select
  using (auth.uid() = user_id);
