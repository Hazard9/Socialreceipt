# Your Decision Card

Seven layers describe depth, but depth alone does not tell the user
what to do with it. The peel now ends with a "Your decision" card: the
choices the user actually made during the peel, assembled in one
place, so a receipt leaves the person knowing their next move. It also
makes the free monthly peel a stronger demonstration of paid value:
the taste now ends in a finished decision, not just open layers.

**Zero running cost is a hard constraint.** The card is assembled at
render time from state that already exists on the receipt (the picked
outcome, `receipt.deep.fear`, `receipt.deep.stance`,
`receipt.deep.rewrite`) and the receipt's own best move and timing.
No new localStorage keys, nothing journaled, nothing sent. Receipt
computation and values are untouched: the video packet gate stays
98/98.

## The card

- Placement: appended at the end of `deepSectionInner`, after Layer 7,
  so it renders wherever layers 4-7 render (Pro, or the free monthly
  peel) and re-renders with every peel interaction through
  `refreshDeepSection`.
- Heading: "Your decision". Subline: "Built from the choices you just
  made. Nothing here was guessed."
- Rows, each shown only when the underlying choice exists:
  - "What I want": the desired outcome picked for this check,
    verbatim from the receipt.
  - "What I'm afraid of": the Layer 4 fear chip label the user
    selected. If no chip was ever picked, the row is absent entirely.
    There is no placeholder and no invented fear.
  - "My choice": the Layer 7 stance chip selected.
  - "My draft": the Layer 7 rewrite in an editable textarea with a
    Copy button (`deepCopyDecisionDraft`). Copy takes the field's
    current contents, edits included; edited text is never sent back
    through the engine.
- Footer: "Best move: {receipt.bestMove} · {receipt.timing}",
  verbatim from the receipt.
- Samples never render the card: `decisionCardHtml` returns "" for
  `receipt.sample`, whatever peel state is forced onto the sample.

## The paywall lead line

The paywall's lead line (`#paywallLead`, rendered by
`renderPaywallLead` on every `openPaywall`) is the generic line by
default. When the receipt in view has a completed peel behind it, the
lead becomes "Open these layers on every receipt." The
five-capability list below it is unchanged in both states.

A peel counts as completed (`deepPeelCompleted`) when
`receipt.deep.step >= 4` and a stance and rewrite exist. Reaching
Layer 7 in the real flow already required naming the fear on the way,
so a completed peel means the user walked the whole depth once.
Samples never count.

## Tests

`tests/decision-card.test.js` (wired into `tests/validate.js`) drives
the real render path in a sandbox: a scripted Pro peel grows the card
row by row with the exact picked values; a fear-skipped state renders
no fear row and no placeholder; a sample with forced peel state
renders nothing; the locked peel shows no card while the revealed
free monthly peel assembles the full one; editing the draft field and
copying returns the edited text; and the paywall lead switches to the
layers line only while a completed peel is in view, with the
capability list byte-identical throughout.
