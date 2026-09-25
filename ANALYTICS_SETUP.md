# Social Receipt Analytics Setup

This branch adds a privacy-safe analytics helper and attribution capture.

## What it tracks

The helper captures anonymous funnel, acquisition, feature, and quality events through the existing GA4 `gtag` or `dataLayer` integration when available.

It never sends message text, conversation text, names, email addresses, usernames, phone numbers, contact information, generated rewrites, or personal relationship details.

## Attribution

Supported URL values include:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `platform`
- `content_id`
- `content_series`
- `hook_variant`

Example:

`https://socialreceipt.netlify.app/?utm_source=tiktok&utm_medium=organic&utm_campaign=before_you_send_it&utm_content=episode_1&utm_term=hook_a`

First-touch attribution is preserved in localStorage. Latest non-direct attribution updates the current attribution. Session identifiers remain in sessionStorage. Only anonymous attribution metadata is stored.

## Events

The helper automatically emits:

- `landing_page_view`
- `return_visit`
- `cta_clicked`
- `outbound_link_clicked`
- `email_capture_started`
- `checkout_started`

The application should call `window.SRAnalytics.track(eventName, params)` at confirmed product outcomes for:

- `free_flow_started`
- `receipt_created`
- `result_viewed`
- `email_capture_completed`
- `paywall_viewed`
- `checkout_verified`
- `upgrade_completed`
- `pre_send_opened`
- `rewrite_opened`
- `rewrite_completed`
- `cold_read_opened`
- `pattern_profile_opened`
- `power_moves_opened`
- `exact_timing_opened`
- `conversation_replay_opened`
- `conversation_replay_completed`
- `analysis_error`
- `rewrite_error`
- `payment_verification_failed`
- `email_capture_failed`
- `validation_error`

## Safe parameters

The helper provides:

- `platform`
- `source`
- `medium`
- `campaign`
- `content_id`
- `content_series`
- `hook_variant`
- `landing_page`
- `page_path`
- `referrer_domain`
- `first_touch_source`
- `latest_touch_source`
- `plan_type`
- `feature_name`
- `scenario`
- `result_level`
- `session_id`
- `anonymous_user_id`
- `returning_user`
- `app_version`

The helper rejects common sensitive keys including `message`, `text`, `email`, `name`, `phone`, `rewrite`, and `conversation`.

## GA4 reports to create

Register these custom dimensions manually in GA4:

- platform
- content_id
- content_series
- hook_variant
- campaign
- plan_type
- feature_name
- scenario
- result_level
- first_touch_source
- latest_touch_source
- returning_user

Create explorations for:

1. Platform performance
2. Content and hook performance
3. Funnel conversion
4. Feature demand
5. New versus returning users

Use event counts for receipts, results, email captures, verified checkouts, and upgrades.

## Verification

Use GA4 DebugView with a test URL containing UTM parameters. Confirm that events contain only safe metadata. Test missing GA4 configuration and confirm the app still works. Do not use real private messages for analytics testing.

## Remaining integration work

The existing app should call `SRAnalytics.track` only after confirmed receipt creation, result rendering, Kit success, Stripe verification, and feature completion. Do not infer payment success from a URL or button click.
