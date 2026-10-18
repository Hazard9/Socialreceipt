# Shareable Receipt Card

A receipt the user can save or share as an image. Every card carries the
brand and the site address to whoever receives it, which makes the card
the product's built-in distribution: the user chooses where it goes.

## What the user sees

After any fresh receipt renders, a "Take the receipt" card appears under
the receipt with one button: **Save or share this receipt**.

Tapping it opens a privacy note first:

> **Save this receipt as an image?**
> Your draft text will appear in the image. Nothing is uploaded. The card
> is made on your device.
> [ Continue ] [ Cancel ]

Only Continue renders anything. Cancel renders nothing. Rendering never
happens silently: `SocialReceiptShare.shareReceipt()` refuses to run
without a `confirmPrivacy` callback and renders only after it approves.

## The card (1080 x 1350, 4:5)

Rendered to a canvas entirely on-device, in the app's own palette
(charcoal `#0c0b09`, warm ivory `#f2ece0`, gold `#c9a84c`) with a system
font stack only (serif / mono / sans fallbacks of the app's type
directions). Top to bottom:

1. Brand header: `SOCIAL RECEIPT`, then the line
   "Before you send it, get the receipt."
2. `YOUR DRAFT` — the user's own words in quotes, whitespace-normalized
   and truncated gracefully at ~180 characters (word boundary + ellipsis).
3. `THE VERDICT` — the receipt's verdict, large serif, auto-shrinking if
   it wraps past three lines.
4. `Pattern spotted: ...` — only when the receipt carries a pattern label.
5. `Read strength: NN` with the basis phrase "based on wording matched" —
   only when the receipt carries a confidence number.
6. `BEST MOVE` — the receipt's best move.
7. `SUGGESTED MESSAGE` — the receipt's suggested message in a bordered box.
8. Footer, pinned: `socialreceipt.netlify.app` and
   `Free: 3 receipts a month`.

The card is composed **only** from the current receipt object's real
fields. No invented lines, no stock quotes; a field the receipt does not
have produces no line on the card.

## Output

`canvas.toBlob` produces a PNG named `social-receipt.png`. When the
browser supports sharing files (`navigator.canShare` with a `File`), the
native share sheet opens with the image; a share failure falls back to a
plain download (`a[download]`), which is also the only path where file
sharing is unavailable. Nothing is uploaded anywhere; the module contains
no network calls at all.

## Files

- `share-card.js` — the module (`window.SocialReceiptShare`; also
  requirable in Node for tests). Exports `buildCardModel`,
  `truncateDraft`, `renderToCanvas`, `deliver`, `downloadBlob`,
  `shareReceipt`, and the card's fixed strings.
- `index.html` — additive wiring only: the script tag, the "Take the
  receipt" card inside `renderReceiptOutput` (fresh receipts only), the
  privacy-note overlay, and the `shareReceiptCard` / `confirmShareCard` /
  `cancelShareCard` glue. The engine, `deep-layers.js`, and
  `both-sides.js` are untouched.
- `sw.js` — `/share-card.js` precached; cache `social-receipt-v27-share-card`.
- `tests/share-card.test.js` — wired into `tests/validate.js`. Asserts the
  module loads, the render function exists, the privacy confirm gates all
  rendering, the model carries only real receipt fields with the footer
  strings, the rendered card draws every section, and the module source
  contains no network API strings.

## Gates

- `node tests/verify-video-packet.js tests/fixtures/posted-video-packet.json`
  stays 98/98.
- `node tests/validate.js` passes with zero failures.
