# First Thirty Seconds — sample read + gauge meter

Branch: `feat/first-thirty` (off main 785b2a5). Additive `index.html` changes only, plus tests and this doc. No engine function and no receipt value changed; the packet gate still passes 98/98 against the honest-gauge fixture.

## What shipped

1. **Sample read.** A card on the home screen (under the "After you sent it" entry card): eyebrow "Sample read", heading "New here? See a sample read", label copy "A sample draft, read by the same engine that reads yours. It does not use one of your free reads.", and a "Run the sample read" button wired to `runSampleRead()`.
   - `buildSampleReceipt()` runs the app's real `buildReceipt` pipeline on the exact sample draft ("Sorry to bother you again, I know you are busy and it is probably nothing, but are we okay? I keep thinking I said something wrong.") with scenario Text / DM, feeling Anxious, desired outcome Get clarity, and an empty pattern context (what a fresh visitor's form holds). The visitor's own scenario/feeling/outcome picks are saved before the build and restored after.
   - The receipt is tagged (`receipt.sample = true`) and renders exactly like a normal receipt through `renderReceiptOutput`, plus a visible "Sample" tag row at the top.
   - It is kept out of every record by construction:
     - No free-limit count: the path never calls `bumpFreeUsed` and never consults `canCreate()` / the limit wall.
     - No pattern history: deep layers attach at render with `record = false`, the same read-only attach used for any receipt view; `savePatternHistory` is never reached.
     - No paywall trigger on this path.
     - No journal entry: `saveCurrentReceipt()` refuses sample receipts with a toast ("That was a sample. Paste your own draft to save a real read.").
   - `tests/first-thirty.test.js` proves the zero-storage claim with an instrumented localStorage: the full sample path (build + read-only deep attach) performs **zero** `setItem`/`removeItem` calls, the free counter does not move, and no `sr_pattern_history_v1` key is created.
   - Actual engine output for the sample draft: verdict "Your read is anxious, not accurate. Wait 12 hours.", confidence **44**, pattern "Reassurance-seeking cue" (evidence: "are we okay").

2. **Gauge meter.** Where the receipt already showed confidence (verdict card), the thin track is now a segmented meter: the existing fill (`#confFill`, same width animation) inside a bordered track with nine tick marks dividing it into ten segments, `role="meter"` with `aria-valuenow`/`aria-valuetext`, alongside the unchanged number and the unchanged basis note from `getConfidenceNote`. Pure presentation; the value and its computation are untouched.

3. **"What would sharpen this read" line.** Implemented, because an honest derivation exists. At render time, `sharpenReadHints(receipt)` recomputes the engine's own `analyzeText(receipt.rawText)` (the receipt carries `rawText`; the deep-layers attach already recomputes this exact analysis at render) and reports which inputs `computeConfidence` actually scores are **absent**:
   - `a.qMarks === 0` → "No questions in this draft" (question mark is a light gauge input, +1)
   - `!a.delay` → "No timing words in this draft" (timing/delay wording is a mid gauge input, +2)
   - `!a.highIntent` → "No direct ask or stated need in this draft" (a stated need is a strong gauge input, +3)
   - `a.length <= 20` → "Only N words in this draft" (crossing the 20-word tier is a gauge input, +1)
   
   The line only ever states absences of scored inputs, never invents a signal, and hides entirely (returns `""`) when none of the four is absent. Example outputs:
   - Sample draft: "No timing words in this draft. No direct ask or stated need in this draft."
   - Left-on-read packet draft (confidence 67): "No questions in this draft. No direct ask or stated need in this draft. Only 13 words in this draft."

4. **Service worker.** Cache bumped to `social-receipt-v27-first-thirty`. No new files; precache list unchanged.

## Gates

- `node tests/verify-video-packet.js tests/fixtures/posted-video-packet.json` — 98/98.
- `node tests/validate.js` — zero failures (includes `tests/first-thirty.test.js`).
- Sample path localStorage writes: zero, proven in the test with an instrumented store.
