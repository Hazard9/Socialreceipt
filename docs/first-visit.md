# First Visit — three situation samples

Branch: `feat/first-visit` (off main 00fe272, the challenge-fixes merge). Changes in `index.html` and `sw.js`, plus tests. No engine function and no receipt value changed; the packet gate still passes 98/98 against the posted-video fixture.

## Why

The audit's first-visit finding: the single sample read helped, but one example may not match why a visitor arrived. The home sample entry is now a situation chooser, and each situation is a short interactive example on the real engine, ending in the real check flow. Videos can deep-link into the matching situation.

## What shipped

1. **Situation chooser on home.** The old `#sampleReadCard` is replaced by `#firstVisitCard`: eyebrow "Sample reads", heading "Start with a moment like yours", and three tappable rows:
   - "I'm about to over-explain." → `runSampleSituation('overexplain')`
   - "They replied, and now I'm overthinking." → `runSampleSituation('replied')`
   - "I need to say no." → `runSampleSituation('sayno')`

   The home carries only this block; the old single-sample card, its `SAMPLE_DRAFT_TEXT`, `buildSampleReceipt()`, and `runSampleRead()` are removed. The original sample draft (a reassurance draft) did not fit any of the three labels, so it was dropped rather than relabeled.

2. **Two draft samples on the real engine.** `buildSampleSituationReceipt(key)` swaps in the sample's context, runs the live `buildReceipt` on the exact preset draft at tap time (nothing is hardcoded output), restores the visitor's own picks, and tags the receipt (`receipt.sample = true`, `receipt.sampleKey`). It renders through the normal `renderReceiptOutput`, so the verdict, gauge meter, pattern and evidence presentation are the product's own. A footer is appended: the takeaway line and a primary "Check my message" button (`exitSampleToCheck()` → `openPresend()`, the normal new-check flow).
   - Over-explain: draft "I know this is a lot and I'm sorry for the long message, I just want to explain why I was quiet earlier, it's not that I don't care, work has been insane and I keep thinking about it and I didn't want you to take it the wrong way." Context Text / DM, Anxious, Keep connection warm. Live output: verdict "You're explaining. They stopped listening.", confidence 89, pattern "Long draft", best move "Wait", timing "Tomorrow morning".
   - Say no: draft "I wish I could say yes to covering Sunday, I feel bad even typing this, maybe if my family thing falls through I could, I just don't want anyone to be upset with me." Context Work, Unsure, Maintain professionalism. Live output: verdict "This needed space. You almost overplayed it.", confidence 67, no pattern, best move "Create space", timing "24 hours minimum".

3. **The replied sample demonstrates Both Sides, facts only.** `buildSampleRepliedFacts()` calls the real `SocialReceiptBothSides.factsFor` on the preset exchange (sent "Hey, are we good? I felt like things were off last night.", reply "ok", reply time "hours") and the view renders the exchange plus the genuine free facts strip (`bothSidesFactsHtml`): "You sent 12 words. The reply was 1.", "The reply is a fraction of what you sent.", "You asked 1 question. The reply asks none back.", "Signals in the reply: one-word energy.", "The reply came back within hours." Under it, the honest line: the facts are free; the full read is Pro. The sample never calls `analyzeExchange`, so no Pro dynamic read is computed or shown, and it never touches the `_bothSides` state, so nothing about it can be saved as a thread. Its footer button reads "Try it with your thread" (`exitSampleToBothSides()` → `openBothSides()`).

4. **Takeaway line per sample.** `sampleTakeawayLine(key, data)` builds one sentence quoting only fields the real output carries (best move + timing for the draft samples; ratio line + questions line for the replied sample) and returns "" — the line hides — when those fields are absent.

5. **Deep links.** `sampleSituationKey(search)` parses `?sit=`: exactly `overexplain`, `replied`, or `sayno` select a sample; anything else returns null and the app falls back to the normal home. At the end of `init()`, a valid key hides the landing and onboarding overlays for that visit (no storage is written) and runs the matching sample.

6. **Sample guarantees, unchanged and re-proven.** All three paths perform zero localStorage writes (instrumented in tests): no free-limit count, no journal entry (`saveCurrentReceipt` still refuses sample receipts), no pattern history, no free-peel offer or consumption on sample receipts.

7. **Service worker.** Cache bumped to `social-receipt-v36-first-visit`; the lineage comment now also carries `social-receipt-v35-challenge`. Precache list unchanged.

## Tests

- `tests/first-visit.test.js` (new, wired into `tests/validate.js`): chooser markup and exact spec drafts; CTA wiring; deep-link parsing (valid, unknown, empty, unrelated params); both draft samples equal live `buildReceipt` output via the repo's engine helper (verdicts and confidences also pinned: 89 and 67); replied facts equal live `factsFor` output (counts and lines pinned) and the rendered strip contains no Pro read; zero-write/free-counter/history guards across all three samples; takeaway lines quote only live fields and hide when absent; sw version and full lineage.
- `tests/first-thirty.test.js`: its sample-card assertions were replaced by equivalent chooser assertions (not loosened); its functional sample exercise now runs the over-explain situation with the new pinned output, and the sharpen-line expectation was recomputed for that draft. Gauge meter coverage unchanged.
- `tests/first-peel.test.js`: its sample fixture now builds through `buildSampleSituationReceipt('overexplain')`; all peel assertions unchanged.
