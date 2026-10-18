# What This Read Matched (evidence panel + pattern-frequency chip)

## What it is
The honest gauge says how much of a draft's wording the read could match. The evidence panel shows WHAT matched, so the user can audit the read instead of trusting a bare number. A pattern-frequency chip surfaces the on-device pattern memory on the receipt itself, not only in the journal.

## Where it renders
In `renderReceiptOutput`, directly under the verdict card (and the sharpen line) for fresh receipts only (`savedView` false). Sample receipts are excluded from both parts inside the helpers themselves (`receipt.sample`), so a sample never displays the visitor's own pattern data.

## Evidence panel
A collapsed-by-default `<details>` block headed "What this read matched". Items are derived at render time by recomputing the engine's own `analyzeText(receipt.rawText)` (the same technique `sharpenReadHints` uses) and mapping the returned fields to plain labels:

| analyzeText field | Condition | Panel label |
|---|---|---|
| conflict | true | Conflict or blaming wording |
| silence | true | References to silence or no reply |
| apology | true | Apology wording |
| overExplain | true | Over-explaining cues |
| delay | true | A wait or delay mentioned |
| positive | true | Warm or positive wording |
| qMarks | > 0 | A direct question |
| highIntent | true | A stated need or high-intent wording |
| length | > 100 | A long draft (over 100 words) |
| length | <= 3 | A very short draft |

Context fields analyzeText also returns (professional, romantic, sales, oneWord, exclaims) carry no panel label and are never listed. The two length items are shape notes: the over-100 item can only appear alongside a wording item (over 100 words always trips overExplain), and the very-short item only on drafts of three words or fewer.

When the receipt carries a pattern, one more line is added from the pattern layer's own data on the receipt object (`receipt.pattern.label` + `receipt.pattern.evidence`, escaped at render):

`Pattern evidence: <label>: <matched wording joined with " + ">`

When nothing matched (no listed field true, no pattern), the panel shows one honest line instead of a list:

"No wording patterns matched in this draft. This read rests on the draft's shape and the situation you picked."

## Pattern-frequency chip
One small line under the verdict: "This pattern appears in N of your drafts from the last 30 days." It appears only when all of these hold:
- fresh, non-sample receipt;
- the receipt has a deep-layers branch (`receipt.deep.patternKey`);
- the branch is not the branchless `flag:general` key, which names no pattern;
- `SocialReceiptDeep.patternSummary` over `sr_pattern_history_v1` returns count30 >= 2 for that branch. count30 includes the current draft, per the established pattern-memory behavior.

## Guarantees
- Presentation only: receipt computation and values are untouched; the video packet gate stays 98/98.
- No network calls added; everything derives from the receipt object and the on-device pattern history.
- Tests: tests/evidence-panel.test.js (wired into tests/validate.js) pins both worked examples (left-on-read; a zero-signal draft), the pattern evidence line, sample exclusion, and the chip gating at count30 >= 2.
