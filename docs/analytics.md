# ING 行為分析

第一版後台回答四件事：使用者有沒有持續使用、從哪個階段流失、哪些功能真的有人用、體驗結束後有多少人願意繼續。

後台**不讀日記、感恩、身體描述、關係事件、AI 對話或顯化原文**。

## 1. 架構

- 前端 `analytics.js` 的 `trackEvent()` 是唯一寫入入口（頁面不可直接寫 Supabase）。
- 登入使用者用 anon key `INSERT` 自己的 `analytics_events`。
- Admin 用 `/api/admin/analytics` + service role 聚合。前端 anon key **不能**讀事件表。
- 頁面：`/admin/analytics`（`admin/analytics.html`）。
- 時區一律 **Asia/Taipei**。

現有資料沿用：

| 來源 | 用途 |
| --- | --- |
| `nichi_profiles` | 註冊日、遮罩 Email |
| `nichi_subscriptions` | trial / 付費狀態 |
| `nichi_user_data.reviews/tasks/reports` | 一次性 backfill（只推可確定發生的行為） |

沒有新建 reviews / tasks 表，也沒有改雲端復盤 JSON。

## 2. `analytics_events` schema

```
id uuid pk
user_id uuid → auth.users
event_name text          -- CHECK allowlist，見第 3 節與第 11 節
event_category text
event_metadata jsonb     -- CHECK pg_column_size <= 2048
source_key text          -- backfill 穩定鍵；即時事件可為 null；CHECK length <= 128
session_id text          -- CHECK length <= 64
created_at timestamptz
```

禁止寫入私人文字。資料庫 CHECK 只擋大小、長度與 event_name allowlist，不讀日記內容。

## 3. Event Dictionary

| 事件 | 觸發時機 | 備註 |
| --- | --- | --- |
| `app_open` | 登入後每個 session 一次 | 不是每次 render |
| `auth_signup_completed` | 新帳號首次進站 / 既有 profiles backfill | 每人一次 |
| `login_completed` | 既有帳號登入 | |
| `review_started` | 當日復盤首次有內容自動存檔 | 每 session 每天一次 |
| `review_completed` | 按下完成復盤且寫入成功 | |
| `quick_review_completed` | 快速模式完成 | |
| `deep_review_completed` | 深度模式完成 | |
| `body_awareness_completed` | 身心小結產出，或完成復盤時已勾身體訊號 | |
| `deep_thinking_started` | 深度思考開始出題 | 無歷史 backfill |
| `deep_thinking_completed` | 三輪後產出覺察總結 | 無歷史 backfill |
| `action_card_created` | 行動卡實際建立 | |
| `action_card_completed` | 執行力標成已完成 | |
| `weekly_report_generated` | 週報寫入成功（API / cron） | |
| `weekly_report_viewed` | 打開週報頁 | 每 session 一次；無歷史 |
| `monthly_report_generated` | 月報寫入成功 | |
| `monthly_report_viewed` | 打開月報頁 | 無歷史 |
| `manifestation_created` | 顯化路徑產出，或完成復盤時已寫顯化 | 不存原文 |
| `history_viewed` | 打開歷史紀錄 | 無歷史 |
| `subscription_page_viewed` | 打開方案視窗 | 無歷史 |
| `trial_started` | `ensureTrial` / membership | 每人一次 |
| `trial_expired` | 試用到期且未付費 | 每人一次 |
| `subscription_started` | NewebPay 開通成功，或 membership 已付費 | 可靠來源才寫 |

## 4. Meaningful Active User

當天至少完成一個核心行為，同一人同一天只算 1 個 Active Day。

核心行為：`review_completed`、`quick_review_completed`、`deep_review_completed`、`body_awareness_completed`、`deep_thinking_completed`、`action_card_created`、`action_card_completed`、`weekly_report_generated`、`monthly_report_generated`。

登入、打開頁面、開始寫復盤，**不算**活躍。

## 5. D1 / D3 / D7 / D14 / D30

Day 0 = `trial_started` 日；沒有則用註冊日（Taipei 日曆日）。

**DN Retention** = 第 N 天當天有 Meaningful Active Event。

不要解讀成「N 天內曾經回來」。

另外提供 **N-day active retention**：從 D0 到 DN 之間，至少有 **3 個 Active Days** 的人數。這與 Day-N 當天回流分開計算。

## 6. Funnel

註冊 → 完成第一次復盤 → D3 → D7 → D14 → D30 → 開始訂閱。

每一層顯示人數、相對上一層 %、相對總註冊 %。沒有資料就是 0。

## 7. Cohort

表：`nichi_analytics_cohorts`、`nichi_analytics_cohort_members`。

已預建 `founder-batch-01` / Founder Batch 01。後台可再建立 Batch 02。

切換「全部使用者」或指定 Batch 後，KPI / funnel / 功能使用率 / 使用者列表都會跟著過濾。

## 8. Admin 權限

不能只靠藏網址。

1. 使用者必須已登入。
2. `nichi_admin_users` 必須有該 `user_id`，**或**伺服器環境變數 `ANALYTICS_ADMIN_EMAILS`（逗號分隔，只在 API 檢查）。
3. `/api/admin/analytics` 回 403 時，前端不顯示數據。
4. 主站側邊欄「使用分析」只在 probe 成功後出現。

第一位管理員請在 SQL Editor 執行：

```sql
insert into public.nichi_admin_users (user_id, note)
values ('你的-auth-user-uuid', 'founder')
on conflict do nothing;
```

## 9. RLS

| 對象 | `analytics_events` |
| --- | --- |
| authenticated | 只能 INSERT 自己的 `user_id` |
| authenticated | 不能 SELECT / UPDATE / DELETE |
| anon | 無权限 |
| service_role | 全權，只給 Admin API 用 |

`nichi_admin_users` 與 cohort 表對 `anon` / `authenticated` 全部 revoke。

沒有使用會暴露 `auth.users` 的 SECURITY DEFINER view。

## 10. 隱私原則

只記行為。說明已放在「使用說明」頁：

> 為了改善 ING 使用體驗，我們會記錄功能使用情況，例如是否完成復盤、使用日期與功能使用次數；不會將你的日記、感恩、身體覺察或私人文字內容用於後台行為分析。

沒有做 Cookie Consent Banner。

## 11. 如何新增 event

1. 在 `lib/analytics.js` 的 `EVENT_NAMES` 加上名稱。
2. 在 `analytics.js` 的 `EVENT_NAMES` 加上同一名稱。
3. 同步更新 `supabase/migrations/20260822_analytics.sql` 的 `analytics_events_event_name_chk` allowlist（或另開 migration 改 CHECK）。沒有加入 allowlist 的名稱，資料庫會拒絕 INSERT。
4. 只在「真正完成」的地方呼叫 `trackEvent(name, { mode, source })`。
5. metadata 只能是短列舉，不要塞使用者輸入。
6. 更新本文件 Event Dictionary。

## 12. 如何建立 Founder Batch

後台表單填名稱、slug、日期、每行一個 user UUID。

或 SQL：

```sql
insert into public.nichi_analytics_cohorts (slug, name, start_date, end_date)
values ('founder-batch-01', 'Founder Batch 01', '2026-08-22', '2026-09-21')
on conflict (slug) do update set name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.nichi_analytics_cohort_members (cohort_id, user_id)
select id, '使用者-uuid'
from public.nichi_analytics_cohorts
where slug = 'founder-batch-01'
on conflict do nothing;
```

## 13. 如何查看第一批 30 人

1. 把 30 人的 user id 加入 `founder-batch-01`。
2. 打開 `/admin/analytics`。
3. 右上角選 Founder Batch 01。

空 cohort 會顯示 0，不會壞掉。

## 14. 如何判斷 30 天試用是否足夠

產品試用是 30 天。D7 / D30 Retention、近 7 日／近 30 日活躍仍是分析指標，不要和試用天數混在一起。

不要只看「有沒有登入」。看：

- D1 / D3 / D7 當天回流（仍是第 N 天當天活躍，不是試用長度）
- D30 當天回流
- 7 日內 Active Days ≥ 3 的人數
- 第一次復盤轉換
- 試用到期後 `subscription_started`

若很多人 D1 就消失，問題在首次體驗，不是方案天數。若 D3–D7 還在、到期才掉，才比較像試用天數或付費摩擦。

## 15. 內部帳號預設排除

`nichi_internal_users` 裡的帳號是內部永久 PLUS，不是付費轉換。後台 KPI、漏斗、Founder Cohort、PLUS conversion **預設排除**這些 user_id。

排除發生在三層：前端 `trackEvent` 不送、後端 `insertAnalyticsEvent` 直接略過、RLS 禁止 internal 帳號 INSERT。舊事件若已在表裡，dashboard 讀取時仍會依 `internalUserIds` 過濾，不計入留存與付費人數。

指定內部帳號請用 SQL insert `nichi_internal_users`，不要改 `nichi_user_data`，也不要把 `is_paid` 設成 true。

## 16. 哪些數據不能過度解讀

- 舊使用者在 migration 之前的「深度思考完成 / 週月報被打開」**沒有歷史**，會偏低。
- `app_open` 不是活躍。
- 同一天多次復盤仍只算 1 個 Active Day。
- 付費人數只在 NewebPay 成功或 `nichi_subscriptions.is_paid` 為真時才算。沒有就顯示 0，不要自行腦補。
- backfill 只還原「當時確定發生過」的完成行為，不是完整漏斗史。
