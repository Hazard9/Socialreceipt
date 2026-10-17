# Deep Layers

Social Receipt stays exactly what it was: same receipt, same pricing,
same paywall, same free limit. Deep Layers adds depth underneath the
receipt, in layers, so the read can go closer to the heart without
turning into a longer report. Depth by quality, not quantity.

**Zero running cost is a hard constraint.** Everything below is
client-side and deterministic: plain JavaScript rules over the
draft, the state the user picked, and history stored on the user's
own device. There are no API calls, no per-use generation, and no
external assets. Generation-based rewrites are deferred until
revenue exists to pay for them.

## The layers

- **Layer 1 · Words** and **Layer 2 · Signal** are the existing
  receipt and the pattern layer (matched wording as evidence). They
  are unchanged: `buildReceipt`'s 14 fields are byte-identical for
  every input, enforced by `tests/verify-video-packet.js` (98/98)
  and a regression block in `tests/deep-layers.test.js` that
  attaches deep data to the seven packet receipts and re-checks all
  14 fields.
- **Layer 3 · The state that wrote this** (free, every receipt). A
  card under the receipt naming the impulse behind the draft,
  derived deterministically from the picked feeling, the
  `analyzeText` flags, and the receipt's pattern label when one is
  present (for example "Waiting in the silence", "Apologising to
  stop the panic", "Activated"). It always carries the honesty
  line: "This read can only see the words and the state you picked.
  It cannot know what they are thinking."
- **Layers 4–7 · Peel a layer** (Pro, gated by the existing
  `isPro()` check and the existing paywall flow). Four sequential
  steps rendered under the receipt; each step unlocks the next.
  Non-Pro users see the four steps listed with the standard upgrade
  action.

### Layer 4 · The fear

One question: "What are you most afraid happens if this just
sits?" Four answer chips, keyed deterministically by scenario
(Date, Work, Friend / Family, Conflict, and a Text / DM default).
No free text. The chosen answer is stored on the receipt's deep
state and named back in one sentence: "So the real question under
this draft is …"

### Layer 5 · Your pattern (on-device memory)

Pattern history lives in `localStorage` under
`sr_pattern_history_v1`: an array of `{pattern, label, scenario,
draft, ts}` entries, capped at 200. The pattern key is the
receipt's pattern label when one exists, otherwise the primary
`analyzeText` flag. Recording happens when a new receipt is
generated; the same draft text recorded again within 10 minutes is
deduped. The layer shows how many drafts in the last 30 days
carried this same pattern, plus a late-night note when 3 or more
drafts in the last 7 days were written between 23:00 and 05:00.
The copy states plainly: "Counted on this device only." Nothing
about this history leaves the device, and clearing site data
clears it, the same as the rest of the app's local state.

### Layer 6 · How it could land

"Three ways this could land." Three short reads (someone tired,
someone distracted, someone already guarded), composed from the
scenario, the pattern category, and the layer-3 state. Every line
is framed as a possibility ("this could land as …"), and its
"because" is tied to wording the engine actually detected, quoting
the pattern evidence when there is any. It never states what the
other person actually thinks.

### Layer 7 · Your choice

Stance chips (Calm and clear / Warm / Firm / Short and done) and a
rewrite composed deterministically from the user's own draft: a
stance opener, the core of their draft kept verbatim (the sentence
carrying their ask or question, or their longest sentence trimmed
to a clause), and a stance closer. The output always contains a
verbatim fragment of the draft (at least 4 consecutive words)
whenever the draft has one, so it is visibly built from their
words. It is labelled "A starting point built from your words.
Edit it freely." and shown alongside the receipt's existing
suggested message, never replacing it.

## Implementation

- `deep-layers.js` — the pure logic module (state mapping, fear
  chips, pattern-history functions, possibility reads, rewrite
  composition), loaded the same way as `presend-analysis.js` and
  exported for Node tests the same way.
- `index.html` — thin integration only: `attachDeepLayers` computes
  `receipt.deep` after `buildReceipt` returns and stores it in a
  new field (no existing field is touched, and `receipt.guidance`
  is never attached); the layer cards render additively after the
  existing receipt output; chip handlers update the deep state and
  persist it with the saved receipt.
- `sw.js` — cache bumped to `social-receipt-v24-deep-layers` and
  `/deep-layers.js` added to the precache list.
- `tests/deep-layers.test.js` — wired into `tests/validate.js`
  next to the legacy-receipt module. Covers the layer-3 mapping,
  layer-4 chip sets per scenario, layer-5 counting with a fake
  clock/store (dedupe window, 30-day count, late-night rule),
  layer-7 verbatim fragments across 5 drafts × 4 stances, Pro
  gating of the rendered section, and the packet regression with
  deep data attached.
