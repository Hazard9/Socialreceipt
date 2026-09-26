const { getStore } = require("@netlify/blobs");

const STORE_NAME = "social-receipt-referrals";
const CODE_RE = /^sr_[a-z0-9]{6,32}$/;

function json(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "https://socialreceipt.netlify.app",
      "Access-Control-Allow-Credentials": "true"
    }, extraHeaders || {}),
    body: JSON.stringify(body)
  };
}
function readBody(event) {
  try { return JSON.parse(event.body || "{}"); } catch (_) { return {}; }
}
function validCode(value) {
  return typeof value === "string" && CODE_RE.test(value);
}
function cookieValue(event, name) {
  var raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || "";
  var match = raw.split(";").map(function(part){ return part.trim(); }).find(function(part){ return part.indexOf(name + "=") === 0; });
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}
function store() { return getStore({ name: STORE_NAME, consistency: "strong" }); }
module.exports = { json, readBody, validCode, cookieValue, store };
