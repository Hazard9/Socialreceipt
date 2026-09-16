/*
  Social Receipt — Kit (ConvertKit) email capture
  ════════════════════════════════════════════
  Keeps the Kit API key server-side. The frontend POSTs { email } here;
  this function forwards it to Kit and reports the real result back.

  Required Netlify environment variables (both must be set, or this
  function reports itself as unconfigured rather than faking success):
    KIT_API_KEY   — Kit "API Key" from https://app.kit.com/account_settings/developer_settings
    KIT_FORM_ID   — the numeric ID of the Kit form/sequence to subscribe to

  Optional:
    KIT_TAGS      — comma-separated tag names to apply, e.g. "social-receipt-user"
*/

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return json(400, { ok: false, error: "bad_request" });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: "invalid_email" });
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;
  if (!apiKey || !formId) {
    return json(501, {
      ok: false,
      error: "not_configured",
      message: "KIT_API_KEY and KIT_FORM_ID are not set in Netlify environment variables.",
    });
  }

  const tags = (process.env.KIT_TAGS || "social-receipt-user")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  let resp;
  try {
    resp = await fetch(
      "https://api.convertkit.com/v3/forms/" + encodeURIComponent(formId) + "/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          email: email,
          tags: tags,
        }),
      }
    );
  } catch (err) {
    return json(502, { ok: false, error: "kit_unreachable" });
  }

  if (!resp.ok) {
    return json(502, { ok: false, error: "kit_error" });
  }

  return json(200, { ok: true });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
