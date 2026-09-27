# Social Receipt content attribution register

This register is the source of truth for links used in videos and posts. Use one unique `content_id` per asset. Do not reuse an ID across different hooks or edits.

## Link format

```
https://socialreceipt.netlify.app/?utm_source=PLATFORM&utm_medium=social&utm_campaign=CAMPAIGN&utm_content=CONTENT_ID&content_series=SERIES&hook_variant=HOOK
```

Example:

```
https://socialreceipt.netlify.app/?utm_source=tiktok&utm_medium=social&utm_campaign=before_you_send_it&utm_content=before-send-ep01-overexplaining&content_series=before_you_send_it&hook_variant=overexplaining
```

## Required fields

| Field | Purpose |
|---|---|
| `utm_source` | Platform sending the visitor |
| `utm_medium` | Traffic type |
| `utm_campaign` | Campaign or launch |
| `utm_content` | Exact video/post ID |
| `content_series` | Content series |
| `hook_variant` | Hook or opening variation |

The app stores only anonymous attribution metadata in the visitor's browser. Never put message text, email addresses, names, or other private information in a URL.

The analytics layer preserves first-touch and latest-touch attribution and attaches these fields to anonymous funnel events.
