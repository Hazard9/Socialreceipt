const { json, readBody, validCode, store } = require("./_referral");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const body = readBody(event);
  const code = body.referral_code;
  if (!validCode(code)) return json(400, { ok: false, error: "invalid_referral_code" });
  try {
    const db = store();
    const key = "referral:" + code;
    const existing = await db.get(key, { type: "json" });
    if (!existing) await db.setJSON(key, { code, activations: 0, claimed: 0, createdAt: new Date().toISOString() });
    return json(200, { ok: true }, {
      "Set-Cookie": "sr_ref_owner=" + encodeURIComponent(code) + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax"
    });
  } catch (_) {
    return json(503, { ok: false, error: "referral_store_unavailable" });
  }
};
