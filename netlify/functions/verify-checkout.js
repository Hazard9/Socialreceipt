/*
  Social Receipt — Stripe checkout verification
  ════════════════════════════════════════════
  This function is the ONLY thing allowed to grant Pro access after a
  Stripe redirect. It never trusts a URL parameter from the browser.
  It calls Stripe's API with the secret key (server-side only) and only
  reports success if Stripe itself confirms the session was paid.

  Required Netlify environment variable:
    STRIPE_SECRET_KEY        — Stripe secret key (sk_live_... or sk_test_...)

  Optional environment variables (recommended — lets the function trust
  Stripe's own price IDs instead of a client-supplied plan name):
    STRIPE_PRICE_MONTHLY     — price ID for the $9/mo Payment Link
    STRIPE_PRICE_YEARLY      — price ID for the $69/yr Payment Link
    STRIPE_PRICE_LIFETIME    — price ID for the $39 one-time Payment Link

  If STRIPE_SECRET_KEY is not set, this function fails closed: it never
  grants access, it just reports that verification is not configured.
*/

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions/";

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return json(405, { valid: false, error: "method_not_allowed" });
  }

  const sessionId = (event.queryStringParameters || {}).session_id;
  if (!sessionId || !/^cs_/.test(sessionId)) {
    return json(400, { valid: false, error: "missing_session_id" });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json(500, {
      valid: false,
      error: "not_configured",
      message: "STRIPE_SECRET_KEY is not set in Netlify environment variables.",
    });
  }

  let resp;
  try {
    resp = await fetch(
      STRIPE_API + encodeURIComponent(sessionId) + "?expand[]=line_items&expand[]=customer_details",
      { headers: { Authorization: "Bearer " + secretKey } }
    );
  } catch (err) {
    return json(502, { valid: false, error: "stripe_unreachable" });
  }

  if (!resp.ok) {
    return json(resp.status === 404 ? 404 : 502, {
      valid: false,
      error: resp.status === 404 ? "session_not_found" : "stripe_error",
    });
  }

  let session;
  try {
    session = await resp.json();
  } catch (err) {
    return json(502, { valid: false, error: "stripe_bad_response" });
  }

  const paid = session.payment_status === "paid" && session.status === "complete";
  if (!paid) {
    return json(200, { valid: false, error: "not_paid" });
  }

  const priceId =
    session.line_items && session.line_items.data && session.line_items.data[0]
      ? session.line_items.data[0].price && session.line_items.data[0].price.id
      : null;

  const priceMap = {
    [process.env.STRIPE_PRICE_MONTHLY]: "monthly",
    [process.env.STRIPE_PRICE_YEARLY]: "yearly",
    [process.env.STRIPE_PRICE_LIFETIME]: "lifetime",
  };

  let plan = (priceId && priceMap[priceId]) || null;

  if (!plan) {
    // Fall back to the hint we attached to the Payment Link URL as
    // client_reference_id. Less authoritative than the price ID, but
    // still requires a real completed Stripe session to reach this code.
    const ref = session.client_reference_id;
    if (ref === "monthly" || ref === "yearly" || ref === "lifetime") plan = ref;
  }

  if (!plan) plan = "pro";

  return json(200, {
    valid: true,
    plan: plan,
    email: (session.customer_details && session.customer_details.email) || null,
    sessionId: session.id,
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
