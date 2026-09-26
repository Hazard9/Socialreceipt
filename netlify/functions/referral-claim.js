const { json, cookieValue, store } = require("./_referral");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const code = cookieValue(event, "sr_ref_owner");
  if (!code) return json(403, { ok: false, error: "owner_cookie_missing" });
  try {
    const db = store();
    const key = "referral:" + code;
    const record = await db.get(key, { type: "json" });
    if (!record) return json(404, { ok: false, error: "referral_not_found" });
    const activations = Number(record.activations || 0);
    const claimed = Number(record.claimed || 0);
    if (activations <= claimed) return json(200, { ok: true, credit: false, available: 0 });
    record.claimed = claimed + 1;
    await db.setJSON(key, record);
    return json(200, { ok: true, credit: true, available: activations - record.claimed });
  } catch (_) {
    return json(503, { ok: false, error: "referral_store_unavailable" });
  }
};
