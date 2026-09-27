/*
  Social Receipt — Kit email capture
  ==================================
  Keeps the Kit API key server-side. The frontend POSTs { email } here;
  this function creates/updates the subscriber in Kit, then adds that
  subscriber to the configured Social Receipt form.

  Required Netlify environment variables:
    KIT_API_KEY   — Kit API key from the developer settings page
    KIT_FORM_ID   — numeric ID of the Social Receipt Kit form

  Kit API v4 is used intentionally. The older v3 form-subscribe endpoint
  is deprecated and accepted tag names inconsistently. Tags can be added
  later with a configured Kit tag ID without weakening this signup path.
*/

const KIT_API_BASE = "https://api.kit.com/v4";
const APP_REFERRER = "https://socialreceipt.netlify.app/";

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

  let subscriberResponse;
  try {
    subscriberResponse = await kitRequest("/subscribers", apiKey, {
      method: "POST",
      body: { email_address: email },
    });
  } catch (err) {
    console.error("subscribe-email_subscriber_request_failed", {
      name: err && err.name ? err.name : "Error",
    });
    return json(502, { ok: false, error: "kit_unreachable" });
  }

  if (!subscriberResponse.ok) {
    console.error("subscribe-email_subscriber_error", {
      status: subscriberResponse.status,
    });
    return json(502, { ok: false, error: "kit_error" });
  }

  const subscriberId =
    subscriberResponse.body &&
    subscriberResponse.body.subscriber &&
    subscriberResponse.body.subscriber.id;

  if (!subscriberId) {
    console.error("subscribe-email_missing_subscriber_id");
    return json(502, { ok: false, error: "kit_error" });
  }

  let formResponse;
  try {
    formResponse = await kitRequest(
      "/forms/" + encodeURIComponent(formId) + "/subscribers/" + encodeURIComponent(subscriberId),
      apiKey,
      {
        method: "POST",
        body: { referrer: APP_REFERRER },
      }
    );
  } catch (err) {
    console.error("subscribe-email_form_request_failed", {
      name: err && err.name ? err.name : "Error",
    });
    return json(502, { ok: false, error: "kit_unreachable" });
  }

  if (!formResponse.ok) {
    console.error("subscribe-email_form_error", {
      status: formResponse.status,
    });
    return json(502, { ok: false, error: "kit_form_error" });
  }

  return json(200, { ok: true });
};

async function kitRequest(path, apiKey, options) {
  const response = await fetch(KIT_API_BASE + path, {
    method: options.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
    },
    body: JSON.stringify(options.body || {}),
  });

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    body = null;
  }

  return { ok: response.ok, status: response.status, body };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
