# First Peel Free

Pro's depth is real, but a free user never tastes it: the paywall asks
for money on faith. First Peel Free gives every free user one full look
inside per month, and makes the paywall say plainly what Pro actually
contains.

**Zero running cost is a hard constraint.** The taste is one
localStorage key on the user's own device, in the same style as the
free-read counter. No accounts, no backend, no API calls, nothing
added to the network surface. `isPro()` is untouched, the free receipt
limit is untouched, and receipt computation and values are untouched:
the video packet gate stays 98/98.

## The free monthly taste

- Storage: localStorage key `sr_free_peel_used_YYYY-M` (per calendar
  month; the month suffix is the same `freeMonthKey()` the free-read
  counter uses). The value `"1"` means this month's look is spent.
- Offer: for a non-Pro user viewing a fresh (not saved/journal) receipt
  whose peel is locked, if the taste is unused this month, the locked
  peel area shows a button: "See inside once, free this month".
  (`canOfferFreePeel` in index.html is the single check.)
- Reveal: tapping it sets `peelFreeReveal` on that receipt and
  re-renders the deep section through the existing deep-layers path,
  so what opens is the exact layers 4-7 content Pro would show for
  that receipt, interactive the same way. A small line marks it:
  "This is this month's free look inside. Pro opens this on every
  receipt."
- Consumption: the taste is written only after the reveal has
  actually rendered (the handler confirms the open peel, marker
  included, is what the render path produced). One look per month;
  a second reveal attempt is a no-op.
- Used state: after consumption, later receipts show the locked peel
  with the honest line "You used this month's free look inside."
- Pro users never see the button, the marker, or the used line;
  their peel is simply open, as before.
- Sample receipts never offer the taste and never consume it (the
  existing `receipt.sample` tag is the guard).

## What Pro opens: the honest list

One source of truth, `PRO_CAPABILITY_LINES` in index.html, rendered
by `proCapabilityListHtml` in the locked peel section and by
`renderPaywallProList` into the paywall modal every time it opens.
Exactly five capabilities, and no others:

- "The question underneath your draft"
- "Your patterns, remembered on your device"
- "Three ways your message could land"
- "A calmer version built from your own words"
- "After you sent it: a read on their reply, and your next move"

No outcome claims, no prices, no urgency copy, no invented features.

## Tests

`tests/first-peel.test.js` (wired into `tests/validate.js`) runs the
real render path in a sandbox with instrumented localStorage and
asserts: the taste key format; the unused state (offer button, the
five lines, peel still locked); the reveal (full real peel content,
marker line, consumption recorded exactly once); the used state
(later receipt locked with the honest line); Pro (no button, no
marker, no used line); the sample receipt (no offer, no reveal, no
consumption); fresh-view-only offers; and that the paywall list is
exactly the five lines, each rendered once, from the one array.
