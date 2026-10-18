# Scripts page rebuild (scripts.html) — 2026-10-18

## Why
The old page put the email form above the fold and delivered three one-sentence "scripts". It read as basic and useless even for free, and the signup copy promised the scripts would arrive by email, a promise the page could not keep honestly. The rebuild makes the page itself the product sample: full value first, the email ask last, and only for what email is actually good for.

## Document order
Hero (title + one-line promise) → Script 1, 2, 3 in full → the 20-second check → app bridge → email section → footer. The signup card no longer appears above the scripts.

## Each script is a mini-toolkit
1. **The moment** — when you need it (the original "when" lines, kept).
2. **What usually gets typed** — a realistic trap draft, shown as a quote.
3. **What the receipt says** — the REAL engine output for that exact trap draft (verdict, read strength, best move), embedded as static text and labeled "A real Social Receipt read of that draft."
4. **Send this instead** — three copyable variants: Direct / Warmer / Firmer (apology: Direct / Warmer / With repair). Editorial starting points, under the page's standing "starting points, not promises" framing.
5. **Why this works** — one or two plain sentences.

## The three receipts (provenance)
Produced by running the current buildReceipt (tests/helpers/receipt-engine.js harness) on the exact trap drafts shown on the page:

| Script | Context (scenario / feeling / outcome) | Verdict | Strength | Best move |
|---|---|---|---|---|
| Say no | Work / Unsure / Maintain professionalism | "This needed space. You almost overplayed it." | 78 | Create space |
| Get clarity | Text / DM / Anxious / Get clarity | "Your read is anxious, not accurate. Wait 12 hours." | 22 | Wait |
| Apologize | Friend / Family / Anxious / Repair tension | "This is working. The risk is over-managing it." | 89 | Wait |

tests/scripts-page.test.js re-runs the engine on those drafts and asserts the embedded values match character for character, so the page can never silently drift from the real product. Receipt values are static text on purpose: the language toggle never rewrites them. In Spanish, the receipt block carries the note "(Lectura generada a partir del borrador en inglés.)" — the read shown comes from the English draft (the trap drafts themselves are translated).

## Email section (bottom)
Headline: "Take the scripts with you." The offer promises only what is true: the scripts stay free on this page with no email needed, joining means the list plus occasional Social Receipt tips, and the printable version is delivered by the page itself — a "Print this page" button with a print stylesheet (hides signup, buttons, and the language toggle; keeps the scripts and the check; prints as a clean one-page card). No string on the page promises emailed scripts. The form is unchanged: same id (gift-email-form), same data-sr-form hook, same /.netlify/functions/subscribe-email endpoint.

## App bridge
The 20-second check stays. Its CTA is now "Check your own draft, free" linking to the app, with the line "Three free receipts a month. No account." under it.

## Spanish parity
Every new string is in the es dictionary in scripts-toolkit.js, including all nine variants, the trap drafts, and every label. The test asserts the dictionary covers every data-text key used by the page.

## Tests
tests/scripts-page.test.js (wired into tests/validate.js): document order, verbatim trap drafts, engine-verified embedded receipts, nine copy buttons with existing targets, forbidden emailed-scripts phrases absent from both files, form contract unchanged, print stylesheet + button, app bridge copy, Spanish key coverage, sw cache bump (social-receipt-v33-scripts) with full lineage.
