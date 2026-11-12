(function (root) {
  'use strict';
  const key = 'demenzcoach.webExperiment.v1';
  const signupKey = 'demenzcoach.emailSignupCompleted.v1';
  const copyKey = 'demenzcoach.signupCopyExposure.v1';
  const copyExperiment = 'web-translator-signup-copy-v1';
  const copyIndex = variant => variant === 'variant_1' ? 0 : variant === 'variant_3' ? 1 : -1;
  const campaigns = new Set(['direct', 'campaign_a', 'campaign_b']);
  const incomingCampaign = () => { try { const value = new URL(root.location.href).searchParams.get('src'); return campaigns.has(value) ? value : 'direct'; } catch { return 'direct'; } };
  const experiment = 'web-translator-introduction-v1';
  const allowed = new Set(['web_access_viewed', 'web_signup_shown', 'web_signup_verified', 'web_answer_completed', 'web_paywall_shown', 'web_checkout_clicked', 'web_supporter_shown', 'web_supporter_clicked', 'web_experiment_exposure']);
  let exposure;
  const seen = new Set();
  const consent = () => root.DemenzConsent?.statistics?.() === true;
  function forget() { try { root.localStorage.removeItem(key); root.localStorage.removeItem(copyKey); root.sessionStorage?.removeItem(signupKey); } catch {} exposure = null; seen.clear(); }
  function unit() {
    if (!consent()) { forget(); return ''; }
    try {
      const saved = JSON.parse(root.localStorage.getItem(key) || 'null');
      if (/^[a-f0-9]{32}$/u.test(saved?.id) && saved.expires > Date.now()) return saved.id;
      root.localStorage.removeItem(copyKey);
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
  function accept(value, measureSignup = true) {
    const id = unit();
    if (value?.experiment !== experiment || value?.unit !== id || !Number.isInteger(value?.variation) || value.variation < 0 || value.variation > 19) { exposure = null; return; }
    exposure = { unit: id, variation: value.variation };
    const identity = `${id}:${value.variation}`;
    if (!seen.has(identity)) { seen.add(identity); track('web_experiment_exposure'); }
    try {
      const signup = JSON.parse(root.sessionStorage?.getItem(signupKey) || 'null');
      if (measureSignup && signup) { root.sessionStorage.removeItem(signupKey); if (signup.expires > Date.now()) track('web_signup_verified'); }
    } catch { /* Optional measurement must never interrupt sign-in. */ }
  }
  function signupCopyVariant(value) {
    if (!consent()) { forget(); return 'variant_1'; }
    if (value?.exposure && value.exposure.unit !== unit()) return 'variant_1';
    return value?.variant === 'variant_3' ? 'variant_3' : 'variant_1';
  }
  function savedCopy() {
    if (!consent()) { forget(); return null; }
    try {
      const raw = root.localStorage.getItem(copyKey);
      if (!raw || raw.length > 1024) return null;
      const value = JSON.parse(raw);
      if (value.unit !== unit() || copyIndex(value.variant) < 0 || value.variation !== copyIndex(value.variant)
        || !Number.isFinite(value.expires) || value.expires <= Date.now()) return null;
      return { unit: value.unit, variation: value.variation, variant: value.variant, expires: value.expires, converted: value.converted === true };
    } catch { return null; }
  }
  function trackCopy(name, value) {
    if (!consent() || !value || value.unit !== unit()) return;
    root.DemenzConsent?.track?.(name, { experiment_id: copyExperiment, variation_id: value.variation, assignment_id: value.unit, campaign_id: campaign() });
  }
  function showSignupCopy(value) {
    if (!consent()) { forget(); return; }
    const id = unit(), current = value?.exposure;
    if (copyIndex(value?.variant) < 0 || !id || current?.experiment !== copyExperiment
      || current.unit !== id || current.variation !== copyIndex(value.variant)) return;
    try {
      const identity = `copy:${id}:${current.variation}`;
      const previous = savedCopy();
      const expires = JSON.parse(root.localStorage.getItem(key) || 'null')?.expires;
      if (!Number.isFinite(expires) || expires <= Date.now()) return;
      const record = { unit: id, variation: current.variation, variant: value.variant, expires, converted: previous?.converted === true };
      root.localStorage.setItem(copyKey, JSON.stringify(record));
      if (!seen.has(identity)) { seen.add(identity); trackCopy('web_signup_copy_shown', record); }
    } catch { /* Optional measurement cannot prevent account creation. */ }
  }
  function queueSignupCompletion() {
    const record = savedCopy();
    if (!record || record.converted === true) return;
    try { root.sessionStorage?.setItem(signupKey, JSON.stringify({ expires: Date.now() + 600000 })); } catch {}
  }
  function acceptAccess(value) {
    accept(value?.exposure, false);
    if (value?.enabled !== true || value.verified !== true || !consent()) return;
    try {
      const signup = JSON.parse(root.sessionStorage?.getItem(signupKey) || 'null');
      if (!signup) return;
      root.sessionStorage.removeItem(signupKey);
      if (!Number.isFinite(signup.expires) || signup.expires <= Date.now()) return;
      track('web_signup_verified');
      // Attribute to the copy actually shown before sign-in, not a newly fetched
      // variation that this returning visitor has never seen.
      const record = savedCopy();
      if (record && record.converted !== true) {
        trackCopy('web_signup_copy_verified', record);
        record.converted = true;
        root.localStorage.setItem(copyKey, JSON.stringify(record));
      }
    } catch { /* Optional measurement cannot interrupt verified access. */ }
  }
  root.DemenzWebExperiments = Object.freeze({ headers() { const id = unit(); return id ? { 'X-Experiment-Consent': '1', 'X-Experiment-Unit': id } : {}; }, accept, acceptAccess, signupCopyVariant, showSignupCopy, queueSignupCompletion, track, campaign, consentChanged() { if (!consent()) forget(); void root.DemenzKiFreigabe?.mount(); } });
  root.addEventListener?.('storage', () => { if (!consent()) forget(); });
})(typeof window !== 'undefined' ? window : globalThis);
