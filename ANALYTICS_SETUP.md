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
- `experiment_id`

Example:

`https://socialreceipt.netlify.app/?utm_source=tiktok&utm_medium=organic&utm_campaign=before_you_send_it&utm_content=episode_1&utm_term=hook_a`

First-touch attribution is preserved in localStorage. Latest non-direct attribution updates the current attribution. Session identifiers remain in sessionStorage. Only anonymous attribution metadata is stored.

## Events

The helper automatically emits:

- `landing_page_view`
- `content_attributed_visit`
- `return_visit`
- `cta_clicked`
- `outbound_link_clicked`
- `email_capture_started`
- `checkout_started`

The existing application event wrapper now routes its confirmed product outcomes through `window.SRAnalytics.track(eventName, params)`. It maps the legacy event names safely as follows:\n\n- `free_started` -> `free_flow_started`\n- `email_capture_succeeded` -> `email_capture_completed`\n- `checkout_clicked` -> `checkout_started`\n- verified `checkout_returned` -> `checkout_verified` and `upgrade_completed`\n- failed `checkout_returned` -> `payment_verification_failed`\n\nExisting receipt creation, result viewing, paywall, email, checkout, and screenshot events are preserved. The application should call `window.SRAnalytics.track(eventName, params)` directly only for new confirmed product outcomes such as:

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

## Conversion lifecycle

Current beta pricing is intentionally limited to:

- Free: 3 receipts per month
- Pro Monthly: $9/month
- Lifetime Beta: $39 one time

The yearly offer remains configured for the post-beta pricing stage but is not shown in the current beta buying path. When beta ends, remove Lifetime Beta from the UI and restore the yearly offer.

The funnel distinguishes:

- `email_capture_viewed`: the email prompt was shown
- `email_capture_started`: the user submitted a valid email to the capture flow
- `email_submitted`: the email was sent to the backend
- `email_capture_completed`: Kit accepted the subscriber
- `email_capture_failed`: the email was only saved locally or Kit rejected/unavailable
- `outcome_recorded`: the user logged what happened after the interaction
- `share_card_viewed` and `share_card_copied`: privacy-safe sharing actions
- `repeat_check_started`: the user began another message analysis
- `lifetime_offer_viewed`: the beta offer was shown after value was delivered

A local-only email save must never be treated as a Kit subscriber.

## Content experiment links

Use one unique link per video or hook. The app preserves first-touch attribution and updates latest non-direct attribution.

Example:

`https://socialreceipt.netlify.app/?utm_source=tiktok&utm_medium=organic&utm_campaign=chasing_series&utm_content=exact_moment&utm_term=hook_a&utm_experiment=chasing_v1`

The content layer records which platform, campaign, series, video, hook, and experiment produced the visit. It does not change the user experience or collect message content.

Recommended naming:

- `utm_campaign`: campaign or problem series
- `utm_content`: specific video or post
- `utm_term`: hook variation
- `utm_experiment`: controlled experiment name

## Verification

Use GA4 DebugView with a test URL containing UTM parameters. Confirm that events contain only safe metadata. Test missing GA4 configuration and confirm the app still works. Do not use real private messages for analytics testing.

## Remaining integration work

The existing app should call `SRAnalytics.track` only after confirmed receipt creation, result rendering, Kit success, Stripe verification, and feature completion. Do not infer payment success from a URL or button click.
