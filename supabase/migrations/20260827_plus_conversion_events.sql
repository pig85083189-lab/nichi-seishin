-- PLUS 轉換事件：只在 analytics_events 已存在時擴充 CHECK allowlist。
-- 表不存在時整段略過，不建表、不刪資料、不改 nichi_user_data。
-- Internal 帳號仍由應用層排除，不在此 migration 刪除既有 event。

do $$
begin
  if to_regclass('public.analytics_events') is null then
    return;
  end if;

  alter table public.analytics_events drop constraint if exists analytics_events_event_name_chk;
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
      'execution_choices_generated',
      'execution_choice_selected',
      'execution_custom_selected',
      'execution_custom_completed',
      'weekly_report_generated',
      'weekly_report_viewed',
      'monthly_report_generated',
      'monthly_report_viewed',
      'manifestation_created',
      'history_viewed',
      'subscription_page_viewed',
      'trial_started',
      'trial_expired',
      'subscription_started',
      'plus_offer_viewed',
      'plus_plan_viewed',
      'plus_interest_clicked'
    ));
end $$;
