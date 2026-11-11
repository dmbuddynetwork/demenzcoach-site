import { webAuth } from './web-auth.js';
import { createEmailAccess } from './email-auth.js';
import { createGoogleAccess } from './google-auth.js';
import { createSignupOffer } from './signup-offer-view.js';
export async function mountInlineSignup(card, { bonus, en, onBegin, returnTo, purpose = 'intro', creditActive = false }) {
  const config = window.DEMENZ_ABO_CONFIG;
  if (config?.signIn?.emailLink !== true) return;
  const { auth } = await webAuth({ anonymous: false });
  if (purpose === 'invitation' && auth.currentUser?.emailVerified) { card.remove(); return; }
  if (!document.querySelector('link[data-inline-signup]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/abo/signup-offer-view.css'; css.dataset.inlineSignup = '1'; document.head.append(css);
  }
  const email = createEmailAccess({ webAuth, config });
  const google = createGoogleAccess({ webAuth, config });
  let dismissed = false;
  const view = createSignupOffer({ additionalAnswers: bonus, locale: en ? 'en' : 'de', googleAvailable: config.signIn?.google === true, purpose, creditActive,
    onBegin,
    async onEmail(address) { await email.begin({ email: address, returnTo, intent: 'signin' }); return { sent: true }; },
    async onGoogle() { const result = await google.begin(); if (!dismissed && view.isConnected) window.location.assign(returnTo); return result; },
    onLater() {
      dismissed = true;
      if (purpose === 'account') { window.location.assign(returnTo); return; }
      view.remove();
      const answer = document.querySelector('.translator-ai-answer');
      if (answer) { answer.tabIndex = -1; answer.focus(); }
    }
  });
  card.replaceWith(view);
}
