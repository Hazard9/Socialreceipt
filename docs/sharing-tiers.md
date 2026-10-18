# Privacy-Tiered Sharing

One all-or-nothing share card under-shares: nobody posts a screenshot
that exposes the whole personal exchange. Sharing a receipt now starts
with a choice of how much the card shows, defaults to the safest
level, and lets the user remove individual details before anything is
exported. The existing privacy confirmation still gates every render,
and it now names the tier being shared.

**Zero running cost is a hard constraint.** Everything is composed on
the device from the current receipt object. Choosing a tier writes
nothing to storage, adds no tracking, and uploads nothing. The engine
is untouched: the video packet gate stays 98/98.

## The three tiers

- **Just the takeaway** (the default, pre-selected): the lesson only.
  The card carries the line "I checked before I sent.", plus the
  verdict, the pattern line, the read strength, and the best move when
  the receipt has them. The tier's model never carries draft text or
  message text at all, so nothing private can reach the canvas.
- **Before and after**: the user's original draft (labeled BEFORE)
  and the rewrite (labeled AFTER). The "after" is the Layer 7 rewrite
  from the receipt's deep state when the user actually made one;
  otherwise it is the receipt's suggested message, labeled "AFTER
  (SUGGESTED VERSION)" so the card never passes the app's words off as
  the user's own rewrite. When the receipt has neither, the tier is
  disabled in the chooser with the line "No rewrite for this receipt
  yet."
- **Full receipt**: exactly the card as it has always been. Its model
  is field-for-field the original `buildCardModel` output and it draws
  exactly the same card (asserted in tests).

## The flow

1. `shareReceiptCard()` opens the chooser (`#shareTierOverlay`) on the
   default tier. Sample receipts are refused with the sample message,
   as with saving.
2. The remove-details step lists exactly the elements the chosen tier
   can put on the card AND that this receipt actually has
   (`SocialReceiptShare.shareElementsFor`). The takeaway line is
   listed as fixed on the takeaway tier; everything else is a toggle,
   on by default. Unchecking an element removes it from the tier
   model and therefore from the render.
3. "Make the card" hands the tier and the toggles to
   `SocialReceiptShare.shareReceipt`, whose required privacy confirm
   receives `{ tier, tierLabel, privacyNote }`; the page confirm now
   reads "You are sharing: {tier label}. {tier privacy note} Nothing
   is uploaded. The card is made on your device." Each tier has its
   own honest note: the takeaway note states that no draft text and no
   message text are on the card; the before/after note states that the
   draft and the rewrite will appear; the full tier keeps the original
   "Your draft text will appear in the image."

## Free-limit copy

Bounded extra from the same spec: the limit wall's message is now
exactly "You used your 3 free receipts this month. Pro keeps every
conversation covered." (headline and subline of `#limitWallModal`).
Buttons, links, and the email capture are unchanged.

## Files

- `share-card.js` — tier constants and labels, `normalizeTier`,
  `rewriteFor`, `tierAvailable`, `privacyNoteFor`, `shareElementsFor`,
  `buildTierModel`, `renderTierToCanvas`, and a tier-aware
  `shareReceipt`. `buildCardModel` and `renderToCanvas` keep their
  original behavior for the full card.
- `index.html` — the tier chooser overlay markup and styles, the
  share flow functions (`shareReceiptCard` now opens the chooser;
  `selectShareTier`, `toggleShareElement`, `shareTierNext`,
  `shareTierBack`, `cancelShareTier`, `confirmShareTier`), the
  tier-naming privacy note (`#shareCardNote`), and the limit wall
  copy.
- `sw.js` — cache `social-receipt-v38-sharing`; lineage comment
  carries every prior version string.
- `tests/sharing-tiers.test.js` — wired into `tests/validate.js`.
  Asserts the takeaway model and render contain no draft or message
  text, before/after renders the draft and rewrite verbatim with the
  honest suggested-version label on fallback, the full tier equals
  the pre-change card, toggles remove elements from model and card,
  the default tier is the takeaway, samples are refused in the page
  flow, the free-limit copy matches the spec string, and the whole
  flow writes nothing to storage.

## Gates

- `node tests/verify-video-packet.js tests/fixtures/posted-video-packet.json`
  stays 98/98.
- `node tests/validate.js` passes with zero failures.
