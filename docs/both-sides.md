# Both Sides: "After you sent it"

Social Receipt reads your draft **before** you send. Both Sides reads
the exchange **after**: the user pastes what they sent and what the
other person replied, picks how long the reply took (Minutes /
Hours / Next day / Days), and gets a read of what the reply actually
did, in words, plus the next move.

Entry points: a card on the home screen, and a "Read both sides"
button under every fresh receipt (prefilled with that receipt's
text). Implementation: `both-sides.js` (pure deterministic logic,
UMD like `presend-analysis.js` and `deep-layers.js`) plus a thin
integration in `index.html`. No existing engine functions were
modified; the posted-video packet gate still passes 98/98.

## The honesty standard (the positioning rule)

Every line reports **facts about the texts** or **possibilities
framed as possibilities**. Nothing claims to know the other person's
inner state: not why they replied the way they did, not what they
felt, not what they meant. Word counts, question counts, detected
wording, timing the user reported. That restraint is the brand, and
it is enforced structurally: every dynamic rule's "because" is built
only from those observable facts, and the state check names the
**user's** state only.

## Free: the facts strip

Computed with the app's existing `analyzeText` over both sides, so
the signal vocabulary matches the pre-send read exactly:

- Words: "You sent 61 words. The reply was 4." plus the ratio in
  plain words ("The reply is a fraction of what you sent." /
  "The reply runs longer than what you sent." / "The two are close
  in length.")
- Questions you asked vs. questions in the reply ("The reply asks
  none back.")
- Signals detected in the reply: positive wording, one-word
  energy, an apology, conflict wording, dismissive wording.
  (Dismissal is a small phrase check in `both-sides.js` — `whatever`,
  `forget it`, `never mind`, `doesn't matter`, `if you say so` —
  because `analyzeText` has no dismissal flag of its own.)
- The wait: the reply-time chip the user picked, in words.

## Pro: the read

Gated by the existing `isPro()` and the existing paywall flow.

### 1. The dynamic read

A named pattern for the exchange from deterministic rules over the
facts, in priority order. Each carries a because tied to the facts.

| Rule | Fires when | Because (shape) | Recommended move |
| --- | --- | --- | --- |
| Repair is on the table | Reply carries an apology **and** a plan/next-step phrase | "the reply carries an apology and a next step in its own words ("Let's talk")" | Send a reply |
| Heat came back | Reply carries conflict wording | "the reply carries charged wording ("You never") across N words" | Wait |
| A closed door, for now | Reply is ≤ 6 words and carries a dismissal phrase | "the reply is 1 word and carries a conversation-ending word ("Whatever")" | One clean close |
| The imbalance is the information | Sent ≥ 40 words, reply ≤ max(5, sent/8), no question back | "you sent 61 words, the reply is 4, and none of your 3 questions gets one asked back" | Wait |
| Slow, not cold | Reply took days, warm wording, ≥ 15 words | "the reply took days but carries warm wording across 18 words; the delay and the content point in different directions" | Send a reply |
| Warm, but not moving | Warm wording, you asked ≥ 1 question, none asked back, reply shorter than sent | "the reply is warm in wording but asks none of your 2 questions back and adds nothing new to answer" | One clean close |
| They are still in it | Reply asks ≥ 1 question back and runs ≥ 20 words | "the reply asks 2 questions back and runs 22 words; the engagement is in the text itself" | Send a reply |
| No clear shape yet | Fallback | restates the counts with no strong signal either way; says plainly the exchange has not declared itself | Wait |

### 2. Your state check

Reuses the Deep Layers layer-3 naming (`SocialReceiptDeep.stateFor`)
keyed by the dynamic rule: imbalance → "Waiting in the silence",
heated → "Activated", dismissed → "Sending to undo a feeling",
repair → "Settled", slow-warm → "Running the worst case",
warm-stalled → "Reaching for certainty", engaged → "Settled",
open → "Drafting through fog". The card is labeled as the user's
state only and says so.

### 3. The next move

Three options — Wait / One clean close / Send a reply — with the
rule's recommended one marked. Wait's line is anchored to the
reported timing ("Give it at least as long as their reply took").
For Send a reply, stance chips (Calm and clear / Warm / Firm /
Short and done) drive the Deep Layers layer-7 composer
(`composeRewrite`), so the composed reply always contains a
verbatim fragment (4+ consecutive words) of the user's own sent
text — or of the reply when what they sent was too short to carry
one. It is labeled "A starting point built from your words. Edit it
freely."

## Data

Nothing leaves the device and nothing is stored. Both texts live in
page memory (`_bothSides`) for the session only; no localStorage
writes, no network calls. Saving a Both Sides read into the
saved-receipts store was considered and deliberately skipped: that
store is receipt-shaped (verdict, confidence, moves), and bending
it for an exchange read would corrupt both. If a save is ever
wanted, it gets its own store.

## Cost

Zero running cost. Deterministic client-side logic only, same as
the rest of the app.
