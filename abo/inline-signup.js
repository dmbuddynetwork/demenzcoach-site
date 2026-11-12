import { webAuth } from './web-auth.js';
import { createEmailAccess } from './email-auth.js';
import { createGoogleAccess } from './google-auth.js';
import { createSignupOffer, mayOfferSignupSetup } from './signup-offer-view.js';
import { openSignupSheet } from './signup-sheet.js';
let stylesReady;
function signupStyles() {
  if (stylesReady) return stylesReady;
  stylesReady = new Promise(resolve => {
    let css = document.querySelector('link[data-inline-signup]');
    if (css?.sheet) { resolve(); return; }
    if (!css) { css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/abo/signup-offer-view.css'; css.dataset.inlineSignup = '1'; }
    const ready = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(ready, 2500);
    css.addEventListener('load', ready, { once: true }); css.addEventListener('error', ready, { once: true });
    if (!css.isConnected) document.head.append(css);
  });
  return stylesReady;
}
export async function mountInlineSignup(card, { bonus, en, onBegin, returnTo, purpose = 'intro', creditActive = false, signupCopy, sentEmail = '' }) {
  const config = window.DEMENZ_ABO_CONFIG;
  if (config?.signIn?.emailLink !== true) return;
  const [{ auth }] = await Promise.all([webAuth({ anonymous: false }), signupStyles()]);
  if (!card.isConnected) return;
  // Recheck after lazy resources: stale status never creates a new-credit promise.
  creditActive = creditActive === true && card.dataset.signupCreditOffer === 'true';
  if (purpose === 'invitation' && auth.currentUser?.emailVerified) { card.remove(); return; }
  const entry = { uid: auth.currentUser?.uid || null, anonymous: auth.currentUser?.isAnonymous === true };
  const setupAllowed = access => mayOfferSignupSetup({ purpose, creditActive, entry, user: auth.currentUser, access });
  const email = createEmailAccess({ webAuth, config });
  const google = createGoogleAccess({ webAuth, config });
  const hasSituation = purpose !== 'account' && Boolean(card.closest('.translator-goal-answer, .translator-ai-goals'));
  let dismissed = false, exposureObserver, sheet;
  const dispose = () => { dismissed = true; exposureObserver?.disconnect(); view.disposeSignup?.(); window.removeEventListener('demenz-auth-changed', authChanged); };
  const finishInPlace = async address => {
    if (dismissed || !view.isConnected) return;
    let access;
    try { access = await window.DemenzKiFreigabe?.refresh(); } catch { /* Actual sign-in is independent of optional status refresh. */ }
    if (dismissed || !view.isConnected) return;
    if (hasSituation) window.DemenzKiFreigabe?.takePending();
    view.showSignupSuccess(address, { offerSetup: setupAllowed(access) });
  };
  const authChanged = async () => {
    const requested = view.requestedEmail?.(); if (!requested || dismissed) return;
    try {
      const latest = await webAuth({ anonymous: false });
      if (latest.auth.currentUser?.emailVerified === true && latest.auth.currentUser.email?.toLowerCase() === requested.toLowerCase()) await finishInPlace(latest.auth.currentUser.email);
    } catch { /* Keep the pending-email screen; never assert success without verified state. */ }
  };
  const expose = () => {
    exposureObserver?.disconnect();
    if (creditActive === true && purpose === 'intro' && view.isConnected && view.dataset.signupCopy) window.DemenzWebExperiments?.showSignupCopy(signupCopy);
  };
  const later = () => {
    if (purpose === 'account') { dispose(); window.location.assign(returnTo); return; }
    sheet?.close('dismiss');
  };
  const view = createSignupOffer({ additionalAnswers: bonus, locale: en ? 'en' : 'de', googleAvailable: config.signIn?.google === true, purpose, creditActive,
    signupCopy: window.DemenzWebExperiments?.signupCopyVariant(signupCopy) || 'variant_1', presentation: purpose === 'account' ? 'inline' : 'sheet', returnToSituation: hasSituation,
    getRetryAt: () => (email.attempt()?.createdAt || 0) + 60000,
    onBegin() { expose(); onBegin?.(); },
    async onEmail(address) { await email.begin({ email: address, returnTo, intent: 'signin' }); return { sent: true }; },
    async onGoogle() {
      const result = await google.begin();
      if (result?.signedIn === true) {
        if (creditActive === true && purpose === 'intro') window.DemenzWebExperiments?.queueSignupCompletion();
        let access;
        try { access = await window.DemenzKiFreigabe?.refresh(); } catch { /* No new care request on sign-in. */ }
        if (hasSituation) window.DemenzKiFreigabe?.takePending();
        return { ...result, offerSetup: setupAllowed(access) };
      }
      return result;
    },
    onContinue() { if (purpose === 'account') { dispose(); window.location.assign(returnTo); } else sheet?.close('continue'); },
    onLater: later
  });
  if (purpose === 'account') card.replaceWith(view);
  else {
    const anchor = document.createElement('span'); anchor.hidden = true; anchor.dataset.signupSheetAnchor = '';
    card.replaceWith(anchor); sheet = openSignupSheet(view, { anchor, en, onDismiss: dispose });
  }
  if (sentEmail) view.showSignupSent(sentEmail);
  window.addEventListener('demenz-auth-changed', authChanged);
  if (creditActive === true && purpose === 'intro' && view.isConnected) {
    if (typeof IntersectionObserver === 'function') { exposureObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) expose(); }); exposureObserver.observe(view); }
    else { const rect = view.getBoundingClientRect(); if (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth) expose(); }
  }
}
