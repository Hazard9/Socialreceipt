/* Social Receipt privacy-safe analytics
 * Sends anonymous metadata only. Never pass message text, emails, names, or rewrites.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sr_attribution_v1';
  var SESSION_KEY = 'sr_session_id_v1';
  var RETURN_KEY = 'sr_return_seen_v1';
  var allowedPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'direct', 'other'];
  var allowedPlans = ['free', 'pro', 'unknown'];
  var allowedResultLevels = ['low', 'medium', 'high', 'unknown'];

  function safeString(value, max) {
    if (typeof value !== 'string') return '';
    return value.slice(0, max || 80).replace(/[\u0000-\u001f<>"]/g, '');
  }
  function normalizePlatform(value) {
    var p = safeString(String(value || '').toLowerCase(), 30);
    if (allowedPlatforms.indexOf(p) >= 0) return p;
    if (/instagram|ig/.test(p)) return 'instagram';
    if (/tiktok|tik tok/.test(p)) return 'tiktok';
    if (/youtube|youtu/.test(p)) return 'youtube';
    if (/facebook|fb/.test(p)) return 'facebook';
    if (/threads/.test(p)) return 'threads';
    return p ? 'other' : 'direct';
  }
  function id(key) {
    try {
      var value = localStorage.getItem(key);
      if (value) return value;
      value = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem(key, value);
      return value;
    } catch (_) { return 'session_only'; }
  }
  function readJson(storage, key) {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function writeJson(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function params() {
    var p = new URLSearchParams(window.location.search);
    var current = {
      source: safeString(p.get('utm_source') || p.get('platform') || '', 40).toLowerCase(),
      medium: safeString(p.get('utm_medium') || '', 40).toLowerCase(),
      campaign: safeString(p.get('utm_campaign') || '', 80),
      content_id: safeString(p.get('utm_content') || p.get('content_id') || '', 80),
      content_series: safeString(p.get('content_series') || '', 80),
      hook_variant: safeString(p.get('utm_term') || p.get('hook_variant') || '', 40)
    };
    current.platform = normalizePlatform(current.source);
    if (!current.source) current.source = current.platform;
    return current;
  }
  function attribution() {
    var current = params();
    var stored = readJson(localStorage, STORAGE_KEY) || {};
    var first = stored.first_touch || current;
    var latest = current.source !== 'direct' || !stored.latest_touch ? current : stored.latest_touch;
    if (!stored.first_touch) writeJson(localStorage, STORAGE_KEY, { first_touch: first, latest_touch: latest });
    else if (JSON.stringify(latest) !== JSON.stringify(stored.latest_touch)) writeJson(localStorage, STORAGE_KEY, { first_touch: first, latest_touch: latest });
    return { first_touch: first, latest_touch: latest };
  }
  function sessionId() {
    try {
      var v = sessionStorage.getItem(SESSION_KEY);
      if (v) return v;
      v = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(SESSION_KEY, v);
      return v;
    } catch (_) { return 'session_only'; }
  }
  function plan() {
    try {
      if (localStorage.getItem('sr_pro') === 'true') return 'pro';
      return 'free';
    } catch (_) { return 'unknown'; }
  }
  function baseMeta() {
    var a = attribution();
    var first = a.first_touch || {};
    var latest = a.latest_touch || {};
    var returning = false;
    try {
      returning = localStorage.getItem(RETURN_KEY) === '1';
      localStorage.setItem(RETURN_KEY, '1');
    } catch (_) {}
    return {
      platform: normalizePlatform(latest.platform || latest.source),
      source: safeString(latest.source || 'direct', 40),
      medium: safeString(latest.medium || 'none', 40),
      campaign: safeString(latest.campaign || '', 80),
      content_id: safeString(latest.content_id || '', 80),
      content_series: safeString(latest.content_series || '', 80),
      hook_variant: safeString(latest.hook_variant || '', 40),
      landing_page: safeString(window.location.pathname || '/', 120),
      page_path: safeString(window.location.pathname || '/', 120),
      referrer_domain: (function () { try { return safeString((document.referrer ? new URL(document.referrer).hostname : 'direct'), 120); } catch (_) { return 'unknown'; } })(),
      first_touch_source: safeString(first.source || 'direct', 40),
      latest_touch_source: safeString(latest.source || 'direct', 40),
      plan_type: plan(),
      session_id: sessionId(),
      anonymous_user_id: id('sr_anon_user_id'),
      returning_user: returning ? 'true' : 'false',
      app_version: 'analytics-v1'
    };
  }
  function clean(extra) {
    var out = baseMeta();
    Object.keys(extra || {}).forEach(function (key) {
      if (['message','text','body','email','name','username','phone','rewrite','conversation','content'].indexOf(key) >= 0) return;
      var value = extra[key];
      if (key === 'result_level') value = String(value || '').toLowerCase();
      if (key === 'plan_type' && allowedPlans.indexOf(value) < 0) value = 'unknown';
      if (key === 'result_level' && allowedResultLevels.indexOf(value) < 0) value = 'unknown';
      if (typeof value === 'boolean') value = value ? 'true' : 'false';
      if (typeof value === 'string' || typeof value === 'number') out[key] = safeString(String(value), 100);
    });
    return out;
  }
  function track(eventName, extra) {
    if (!eventName || typeof eventName !== 'string') return;
    var payload = clean(extra || {});
    try {
      if (typeof window.gtag === 'function') window.gtag('event', eventName, payload);
      else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: eventName, ...payload });
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('sr:analytics', { detail: { event: eventName, params: payload } }));
  }

  attribution();
  window.SRAnalytics = { track: track, attribution: attribution, meta: baseMeta, normalizePlatform: normalizePlatform };
  track('landing_page_view');
  if (baseMeta().returning_user === 'true') track('return_visit');

  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-sr-event], [data-sr-cta], a[href]');
    if (!el) return;
    var explicit = el.getAttribute('data-sr-event');
    var cta = el.getAttribute('data-sr-cta');
    if (explicit) track(explicit, { feature_name: el.getAttribute('data-feature') || '' });
    if (cta) track('cta_clicked', { content_id: cta });
    if (el.tagName === 'A' && el.hostname && el.hostname !== window.location.hostname) track('outbound_link_clicked', { content_id: el.hostname });
  });
  document.addEventListener('submit', function (event) {
    var form = event.target;
    var name = safeString(form.getAttribute('data-sr-form') || form.id || '', 60).toLowerCase();
    if (/email|subscribe|capture/.test(name)) track('email_capture_started');
    if (/checkout|payment|upgrade/.test(name)) track('checkout_started');
  });
})();
