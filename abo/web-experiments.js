(function (root) {
  'use strict';
  const key = 'demenzcoach.webExperiment.v1';
  const signupKey = 'demenzcoach.emailSignupCompleted.v1';
  const campaigns = new Set(['direct', 'campaign_a', 'campaign_b']);
  const incomingCampaign = () => { try { const value = new URL(root.location.href).searchParams.get('src'); return campaigns.has(value) ? value : 'direct'; } catch { return 'direct'; } };
  const experiment = 'web-translator-introduction-v1';
  const allowed = new Set(['web_access_viewed', 'web_signup_shown', 'web_signup_verified', 'web_answer_completed', 'web_paywall_shown', 'web_checkout_clicked', 'web_supporter_shown', 'web_supporter_clicked', 'web_experiment_exposure']);
  let exposure;
  const seen = new Set();
  const consent = () => root.DemenzConsent?.statistics?.() === true;
  function forget() { try { root.localStorage.removeItem(key); root.sessionStorage?.removeItem(signupKey); } catch {} exposure = null; seen.clear(); }
  function unit() {
    if (!consent()) { forget(); return ''; }
    try {
      const saved = JSON.parse(root.localStorage.getItem(key) || 'null');
      if (/^[a-f0-9]{32}$/u.test(saved?.id) && saved.expires > Date.now()) return saved.id;
      const id = Array.from(root.crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('');
      root.localStorage.setItem(key, JSON.stringify({ id, expires: Date.now() + 30 * 86400000, campaign: incomingCampaign() })); return id;
    } catch { return ''; }
  }
  function campaign() {
    if (!consent()) { forget(); return ""; }
    try { unit(); const value = JSON.parse(root.localStorage.getItem(key) || "null")?.campaign; return campaigns.has(value) ? value : "direct"; } catch { return ""; }
  }
  function track(name) {
    if (!consent()) { forget(); return; }
    if (!allowed.has(name) || !exposure) return;
    if (unit() !== exposure.unit) { exposure = null; return; }
    root.DemenzConsent?.track?.(name, { experiment_id: experiment, variation_id: exposure.variation, assignment_id: exposure.unit, campaign_id: campaign() });
  }
  function accept(value) {
    const id = unit();
    if (value?.experiment !== experiment || value?.unit !== id || !Number.isInteger(value?.variation) || value.variation < 0 || value.variation > 19) { exposure = null; return; }
    exposure = { unit: id, variation: value.variation };
    const identity = `${id}:${value.variation}`;
    if (!seen.has(identity)) { seen.add(identity); track('web_experiment_exposure'); }
    try {
      const signup = JSON.parse(root.sessionStorage?.getItem(signupKey) || 'null');
      if (signup) { root.sessionStorage.removeItem(signupKey); if (signup.expires > Date.now()) track('web_signup_verified'); }
    } catch { /* Optional measurement must never interrupt sign-in. */ }
  }
  root.DemenzWebExperiments = Object.freeze({ headers() { const id = unit(); return id ? { 'X-Experiment-Consent': '1', 'X-Experiment-Unit': id } : {}; }, accept, track, campaign, consentChanged() { if (!consent()) forget(); void root.DemenzKiFreigabe?.mount(); } });
  root.addEventListener?.('storage', () => { if (!consent()) forget(); });
})(typeof window !== 'undefined' ? window : globalThis);
