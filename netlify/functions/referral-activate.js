const { json, readBody, validCode, store } = require("./_referral");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const body = readBody(event);
  const code = body.referral_code;
  const recipient = typeof body.recipient_id === "string" ? body.recipient_id.slice(0, 80) : "";
  if (!validCode(code) || !/^anon_[a-z0-9_-]{8,80}$/.test(recipient)) return json(400, { ok: false, error: "invalid_activation" });
  try {
    const db = store();
    const key = "referral:" + code;
    const record = await db.get(key, { type: "json" });
    if (!record) return json(404, { ok: false, error: "referral_not_found" });
    const activationKey = "activation:" + code + ":" + recipient;
    const existing = await db.get(activationKey, { type: "json" });
    if (existing) return json(200, { ok: true, awarded: false, reason: "already_recorded" });
    await db.setJSON(activationKey, { code, recipient, createdAt: new Date().toISOString() });
    record.activations = Number(record.activations || 0) + 1;
    await db.setJSON(key, record);
    return json(200, { ok: true, awarded: true });
  } catch (_) {
    return json(503, { ok: false, error: "referral_store_unavailable" });
  }
};
