import { webAuth } from './web-auth.js';
import { createEmailAccess } from './email-auth.js';
import { createGoogleAccess } from './google-auth.js';
import { createSignupOffer } from './signup-offer-view.js';
export async function mountInlineSignup(card, { bonus, en, onBegin, returnTo, purpose = 'intro', creditActive = false, signupCopy }) {
  const config = window.DEMENZ_ABO_CONFIG;
  if (config?.signIn?.emailLink !== true) return;
  const { auth } = await webAuth({ anonymous: false });
  // Authentication can change while the lazy module/session is loading.
  // The controller removes this marker as soon as its proof is superseded.
  creditActive = creditActive === true && card.dataset.signupCreditOffer === 'true';
  if (purpose === 'invitation' && auth.currentUser?.emailVerified) { card.remove(); return; }
  if (!document.querySelector('link[data-inline-signup]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/abo/signup-offer-view.css'; css.dataset.inlineSignup = '1'; document.head.append(css);
  }
  const email = createEmailAccess({ webAuth, config });
  const google = createGoogleAccess({ webAuth, config });
  let dismissed = false;
  let exposureObserver;
  const expose = () => {
    exposureObserver?.disconnect();
    if (creditActive === true && purpose === 'intro' && view.isConnected && view.dataset.signupCopy) window.DemenzWebExperiments?.showSignupCopy(signupCopy);
  };
  const view = createSignupOffer({ additionalAnswers: bonus, locale: en ? 'en' : 'de', googleAvailable: config.signIn?.google === true, purpose, creditActive,
    signupCopy: window.DemenzWebExperiments?.signupCopyVariant(signupCopy) || 'variant_1',
    onBegin() { expose(); onBegin?.(); },
    async onEmail(address) { await email.begin({ email: address, returnTo, intent: 'signin' }); return { sent: true }; },
    async onGoogle() {
      const result = await google.begin();
      if (result?.signedIn === true && creditActive === true && purpose === 'intro') {
        window.DemenzWebExperiments?.queueSignupCompletion();
        try { await window.DemenzKiFreigabe?.refresh(); } catch { /* Sign-in still completes if optional status measurement fails. */ }
      }
      if (!dismissed && view.isConnected) window.location.assign(returnTo);
      return result;
    },
    onLater() {
      dismissed = true;
      exposureObserver?.disconnect();
      if (purpose === 'account') { window.location.assign(returnTo); return; }
      view.remove();
      const answer = document.querySelector('.translator-ai-answer');
      if (answer) { answer.tabIndex = -1; answer.focus(); }
    }
  });
  card.replaceWith(view);
  if (creditActive === true && purpose === 'intro' && view.isConnected) {
    if (typeof IntersectionObserver === 'function') {
      exposureObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) expose(); });
      exposureObserver.observe(view);
    } else {
      const rect = view.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth) expose();
    }
  }
}
