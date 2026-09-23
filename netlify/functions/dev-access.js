/*
  Owner-only developer access recovery.
  Requires DEV_EMAIL and DEV_ACCESS_KEY in Netlify environment variables.
*/
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return json(400, { ok: false, error: "invalid_json" }); }

  const email = String(body.email || "").trim().toLowerCase();
  const key = String(body.key || "");

  const expectedEmail = String(process.env.DEV_EMAIL || "").trim().toLowerCase();
  const expectedKey = String(process.env.DEV_ACCESS_KEY || "");

  if (!expectedEmail || !expectedKey) {
    return json(500, { ok: false, error: "developer_recovery_not_configured" });
  }

  if (email !== expectedEmail || key !== expectedKey) {
    return json(403, { ok: false, error: "invalid_developer_credentials" });
  }

  return json(200, {
    ok: true,
    plan: "developer",
    message: "Developer access verified."
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
