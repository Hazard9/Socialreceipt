# Legacy receipt spine with additive patterns

Branch: `fix/legacy-receipt-spine-patterns`. Based on main `271cab5`. **Do not merge: independent verification required.**

## Contract

`buildReceipt` retains the branch ordering from `3a363f5`, including its early silence return, real `computeConfidence`, and original `makeReceipt` fields. The requested phrase additions are limited to `analyzeText` lists and the existing eight-word limit for dismissive `whatever`.

Pattern metadata is attached as `receipt.pattern`. Only the generic fallback verdict may become its label; only in that fallback path may a clarification question set `bestMove` to `Clarify the goal`. Explicit goal wording lives in `receipt.goalSuggestion` and never replaces `message`. No `receipt.guidance` is attached.

To satisfy the exact-14-field invariant, `whySignals` is preserved unchanged. Additional evidence is stored in `patternWhySignals`; the existing why-signal rendering concatenates that evidence only for display. This one expression is necessary to meet both the exact stored-field requirement and the displayed-evidence requirement. The only new result card is **Suggested wording for your goal**. No existing confidence, message, paywall or result card is replaced.

All analysis remains local. This branch does not change main or production.

## Required video gate

Packet: `tests/fixtures/posted-video-packet.json`. Matthew supplied the seven drafts, scenario/feeling settings, expected verdicts/confidence, and the full intro receipt. All remaining expected fields were captured from the original main `271cab5` code, without the phrase additions. Cases 1–6 use the app defaults `desiredOutcome: Get clarity` and `format: Text / DM`; intro uses the supplied `Maintain professionalism` outcome. The fixture records this provenance.

Command:

```sh
node tests/verify-video-packet.js tests/fixtures/posted-video-packet.json
```

The same gate runs as part of `node tests/validate.js`. It reports all 98 comparisons and fails for any mismatch. Fourteen fields: `verdict`, `confidence`, `interest`, `energy`, `risk`, `momentum`, `bestMove`, `hidden`, `dont`, `next`, `message`, `timing`, `whySignals`, `summary`.

Local results: **98/98 fields pass**.

| Case | Exact legacy fields | Confidence | Verdict |
|---|---:|---:|---|
| Draft 6. Still rewriting. | 14/14 | 38 | You're explaining. They stopped listening. |
| 4 hours. No reply. | 14/14 | 38 | The delay feels like rejection. It likely is not. Yet. |
| You sent 3 paragraphs. | 14/14 | 38 | You're over-investing. They're not matching you. |
| POV: it's 1am | 14/14 | 38 | Your read is anxious, not accurate. Wait 12 hours. |
| Left on read. | 14/14 | 38 | Silence is the signal. Don't overwrite it. |
| Feel rejected. | 14/14 | 38 | Acting from rejection makes the read self-fulfilling. |
| Intro: This is Matthew | 14/14 | 38 | Keep this professional. Emotion doesn't live here. |

## Ten concept-pattern checks

Exact drafts, goals, labels, details and evidence are stored in `tests/fixtures/concept-patterns.json`, captured from the retained PR #93 pattern engine. Tests run actual `buildReceipt`, compare all pattern metadata, check displayed evidence, and ensure goal wording does not replace `message` or attach `guidance`.

| Concept | Pattern label | Matched wording |
|---|---|---|
| 1 | An explanation is being assumed | are you ignoring me |
| 2 | A refusal followed by a defense | i can't cover saturday. i know that makes things harder, b |
| 3 | Help may be requested indirectly | i'll do everything myself like always |
| 4 | Absolute or blaming wording | you never |
| 5 | Repeated apology seeking reassurance | sorry again |
| 6 | Reluctant agreement | whatever you want |
| 7 | Defending compliance | i did exactly what you asked |
| 8 | Care framed as a test | if you actually cared |
| 9 | The ending is ambiguous | i'm done. i can't do this anymore |
| 10 | Agreement beside a stated difficulty | sure, whatever works for you. i'll figure it out somehow |

All ten pass locally. Concept 2's partial evidence span is retained exactly from PR #93, rather than silently changing its pattern output in this merge layer.

## Other checks

- `node tests/validate.js`: **350 checks passed, zero failed**, plus the integrated video/pattern/legacy modules.
- `node tests/legacy-receipt.test.js`: **21 synthetic controls × 14 historical fields**, all ten concepts, requested phrase additions, generic-fallback constraints and message separation pass.
- Inline JavaScript syntax and `git diff --check`: pass.
- Full browser suite: run in GitHub Actions on this branch's exact commit; see the PR checks for the final result.

The synthetic controls are additional coverage, not substitutes for the seven real video cases.

## Tests changed and why

- `tests/validate.js`: invokes the new compatibility modules. No existing assertion removed.
- Existing browser quota test #4: corrects its outdated expectation to the already-shipped limit-wall-then-paywall flow. Users without an email first see `limitWallModal`, then Continue opens the paywall. No quota/email/payment behavior changed.
- Two browser tests added: one optional goal card while preserving the legacy message/confidence; and a no-goal legacy silence receipt without a new card or UNCLEAR replacement.
- New JSON fixtures/helper/gate test the actual main-page functions, not a reimplementation of the engine.
