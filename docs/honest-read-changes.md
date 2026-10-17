# Honest Read: real confidence gauge + no mind-reading copy

Branch: `fix/honest-read`, based on main `86fe021` (Deep Layers in).
**Do not merge: independent verification required.**
Spec: honest-read-spec-2026-10-17.md (Matthew's confidence ruling:
no fake anything, a gauge that estimates from the read; copy call
delegated to the overseer: soften).

Zero running cost: all changes are deterministic, client-side,
wording-only. No network calls added.

## Part 1: the confidence gauge

### Before
`computeConfidence` counted matched checks (13, plus length tiers),
added a bonus for the feeling the user picked (Anxious +8, Rejected
+7, ...), then clamped the result to a **38 minimum**. Typical
drafts score about 15 to 25 raw, so the floor lifted nearly every
receipt to exactly 38. All seven posted-video receipts read 38.

### After
A wording-only weighted gauge. Inputs: the `analyzeText` result
only. The self-picked feeling is the user's own state report, not
evidence in the draft, and never moves the score.

- Strong signals = 3: conflict, silence, overExplain, highIntent.
- Mid signals = 2: delay, apology, oneWord, positive.
- Light signals = 1: professional, romantic, sales, question
  marks present, exclaims present.
- Length tiers = 1 each: over 20, over 40, over 80 words.
- Score = round(100 x weightedMatched / weightedPossible),
  clamped to [3, 95]. No other floor.
- weightedPossible = 9, the weight of a complete read (three
  strong signals). Past that point the wording has given a
  wording-only read everything it can use, so the gauge saturates
  instead of pretending to more precision.

Two tuning disclosures against the spec's weight list:
1. **Silence is weighted as a strong signal (3).** The spec's band
   list did not name it, but silence is this app's primary signal
   (the first check in buildReceipt and getVerdict), and a gauge
   of matched wording that ignored the silence wording would
   itself be dishonest. All spec-listed weights are exactly as
   specified.
2. **weightedPossible is a saturating reference (9), not the sum
   of all weights (28).** With the full sum, the richest draft in
   the corpus tops out near 20 and the spec's own corpus targets
   (a multi-signal draft at 55 or more, at least 6 distinct values)
   are unreachable. The saturating reference meets every target
   with margin.

### Corpus results (17 drafts: 7 packet + 10 concepts)
Distinct confidence values: **7** (3, 11, 22, 33, 44, 56, 67).
Zero-signal drafts (5 in the corpus) score 3, at or under the
spec's 20 ceiling. The multi-signal packet draft (left-on-read:
delay + professional + silence) scores 67, over the spec's 55
floor.

### The seven posted-video drafts: confidence before and after
| Case | Before | After |
|---|---:|---:|
| Draft 6. Still rewriting. (v01) | 38 | 56 |
| 4 hours. No reply. (v02) | 38 | 22 |
| You sent 3 paragraphs. (v03) | 38 | 33 |
| POV: it's 1am (v04) | 38 | 3 |
| Left on read. (v05) | 38 | 67 |
| Feel rejected. (v08) | 38 | 3 |
| Intro: This is Matthew | 38 | 22 |

Matthew accepted confidence differing from the posted videos: a
viewer's own draft genuinely reads differently from the one in the
video. The gate now pins the other 13 fields byte-exact and pins
confidence to the new gauge's deterministic values.

### Display
The confidence row stays. Its note now states the basis in plain
words at every band (function `getConfidenceNote`):
- Before: "Strong signal. This read is likely accurate." /
  "Moderate confidence… but one wrong move flips this." /
  "Low confidence. Acting without clarity increases risk here." /
  "Very low signal. More context would sharpen this read
  significantly."
- After: "Strong wording match." / "Moderate wording match." /
  "Thin wording match." / "Very thin wording match." — each
  followed by "Based on how much of your wording this read could
  match." (the lowest band adds "More detail in the draft would
  sharpen it.")

## Part 2: softened copy (every changed line, before and after)
Scope per spec: only `hidden` lines that asserted the OTHER
person's thoughts, feelings, motives, or choices as fact.
Verdicts, bestMove, timing, and message are untouched. Lines about
the user's own state are untouched. All six changes are in
buildReceipt:

1. **Silence branch (this line appears in the posted left-on-read
   video; the packet fixture is updated):**
   - Before: "They read the message and chose not to respond yet.
     More from you does not change that."
   - After: "The thread shows your message with no reply yet.
     Nothing in the words explains the silence, and more messages
     rarely change that."
2. **Sales / Client branch:**
   - Before: "Silence from a client usually means they are
     deciding, not decided against."
   - After: "Nothing in the thread says the decision has gone
     against you. An unanswered proposal is still an open one,
     not a no."
3. **Conflict branch:**
   - Before: "In conflict, they need to feel heard before they
     can respond calmly."
   - After: "These words read as a case against them. A reply is
     more likely to stay calm when the draft shows their point
     was heard."
4. **Positive branch:**
   - Before: "When energy is mutual, the only risk is
     over-managing it."
   - After: "The wording is warm on its face. The only risk here
     is over-managing a message that already works."
5. **Delay branch:**
   - Before: "Delayed responses usually mean distraction or
     decision. Give it time."
   - After: "The gap is real, but the reason for it is not in the
     words. A delay on its own does not carry a verdict."
6. **Apology branch:**
   - Before: "An apology not followed by changed behaviour often
     reopens the wound."
   - After: "An apology lands on its follow-through. The words
     alone rarely settle the original issue."

Audited and deliberately left unchanged: the default hidden line
(about the user's own read), the Work branch line, the Date branch
line (about the user's own uncertainty), the one-word branch line
(a thread fact), the Anxious and Rejected branch lines (the user's
state), all `dont` and `next` lines (advice to the user), all
whySignals (wording observations, and a gated field), the pattern
layer's detail text (about the user's draft; pinned by the merge's
concept fixtures), and Deep Layers copy (possibility-framed by
design).

## Fixture changes
- `tests/fixtures/posted-video-packet.json`: confidence updated
  for all 7 cases to the new gauge values; `hidden` updated for
  the left-on-read case (change 1 above). Every other field
  byte-identical, verified field-by-field against the new engine.
- `tests/fixtures/legacy-spine-controls.json`: 27 expectation
  updates across the 21 synthetic controls, every one of them a
  `confidence` value under the new gauge or a `hidden` line
  softened in Part 2. Verified field-by-field: no other field
  moved. These are synthetic controls, not posted videos.

## Tests
- `node tests/verify-video-packet.js` against the updated
  fixture: **98/98 fields passed** (13 fields byte-exact;
  confidence = new gauge values).
- `node tests/validate.js`: **352 checks passed, 0 failed**,
  including the new module below.
- New `tests/honest-read.test.js` (wired into validate.js):
  gauge spread and bounds on the 17-draft corpus (7 distinct
  values; zero-signal at or under 20; multi-signal at or over
  55); the picked feeling provably does not move the score; a
  banned-phrase scan ("chose not to respond", "they read the
  message") over the app sources and over every corpus receipt;
  the confidence note states its wording basis at every band.
- sw.js cache bumped to `social-receipt-v25-honest-read`
  (repo convention for app changes).
