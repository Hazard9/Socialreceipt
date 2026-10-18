# The Return Loop

Three honest reasons to come back to Social Receipt: an unresolved
conversation the user chose to keep open, a weekly picture of their
own patterns, and a daily prompt. Everything is computed from data
already on the user's device.

**Zero running cost is a hard constraint.** The Return Loop is plain
client-side JavaScript over the journal and pattern history the app
already stores locally. No accounts, no notifications, no permission
requests, no backend, no API calls. `return-loop.js` contains no
network surface at all, and a test enforces that. Free for everyone;
retention infrastructure is not a Pro gate.

## What it does

- **Open Threads.** After any completed Both Sides read (free facts
  or Pro), the result area offers one button: "Keep this thread
  open". Saving stores `{ts, sent, dynamicLabel}` in localStorage
  key `sr_open_threads_v1`: the sent text truncated to 500 chars,
  and the Pro dynamic read's name when a Pro read produced one
  (otherwise `null`). The list is capped at 5, newest first, and
  saving the same sent text again updates nothing. The home screen
  shows an "Open threads" card only while at least one thread
  exists. Each row shows the first line of the sent text, an honest
  age label computed from the stored timestamp ("Saved today",
  "Waiting 1 day", "Waiting N days", by calendar day), and two
  actions: "Heard back" opens the Both Sides screen with the
  "What you sent" field prefilled from the stored text, and
  "Close thread" removes the entry after a confirm.
- **Your Week in Receipts.** Rendered inside the journal screen,
  computed live at render from `sr_receipt_journal_v1` and
  `sr_pattern_history_v1`. It shows "Receipts this week" (journal
  entries from the last 7 days), "Receipts kept on this device: N"
  (the journal total; the journal is the count), the most frequent
  pattern (reusing the journal's `topPattern` over the pattern
  history, hidden when there is none), "Late-night receipts this
  week" (entries in the last 7 days written at local hour 23 or
  0 to 4, hidden at zero), and a draft-length trend that appears
  only with at least 3 entries this week and at least 3 the week
  before: "Your drafts averaged X words this week. Last week: Y."
  Numbers only, no adjectives, no judgment. If the journal is
  empty, the whole block hides.
- **Today's Pause.** A home card showing one prompt per local day,
  chosen deterministically as `PROMPTS[dayOfYear(local) % 14]` from
  a fixed list of 14, so the same day always shows the same prompt.
  The "Check a draft" button opens the pre-send composer and
  focuses the draft field. The prompt is an invitation only: it
  makes no claims and stores nothing.

## Honesty rules

- Every number shown is counted or averaged from the user's real
  stored entries at render time. Nothing is estimated, sampled, or
  invented; a metric with no data hides instead of showing a guess.
- Threads exist only when the user explicitly keeps one. Reading
  both sides never saves anything by itself, and the Both Sides
  screen copy still says so.
- Age labels are computed from the stored timestamp, and the trend
  stays silent until both weeks have a real base (3 + 3).

## Verification

- `tests/return-loop.test.js` covers thread save/dedupe/cap and
  age labels, every week metric against fabricated journal and
  history fixtures with asserted numbers, trend gating below
  3 + 3, the pause rotation (14 prompts, same day same prompt),
  the no-network assertion on `return-loop.js`, and the static
  wiring (script tag, card containers, precache, cache version,
  and the cache-lineage strings the earlier feature tests assert).
- The video packet gate (`tests/verify-video-packet.js`) stays at
  98/98 and `tests/validate.js` passes with zero failures: the
  engine and the posted receipts are untouched.
