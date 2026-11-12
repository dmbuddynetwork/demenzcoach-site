import { webAuth } from './web-auth.js';
import { safeEmailReturn } from './email-auth.js';

const noticeKey = 'demenzcoach.signinNotice.v1';
const maxAge = 60000;
const verified = user => Boolean(user?.uid && user.emailVerified === true && user.isAnonymous === false && typeof user.email === 'string' && user.email);

// Presentation state only: no address, account identifier, action code or draft.
export function showSignInNotice({ en = false, offerSetup = false, doc = document } = {}) {
  doc.querySelector('.dc-signin-notice')?.remove();
  if (!doc.getElementById('dc-signin-notice-style')) {
    const style = doc.createElement('style'); style.id = 'dc-signin-notice-style';
    style.textContent = '.dc-signin-notice{position:fixed;z-index:10020;top:calc(env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:calc(100% - 24px);padding:14px 46px 14px 18px;border:1px solid #b5d6bf;border-radius:14px;background:#eef8f0;color:#195b35;box-shadow:0 3px 18px #0002;font:600 16px/1.5 system-ui,sans-serif}.dc-signin-notice a{display:block;color:inherit;font-size:14px}.dc-signin-notice button{position:absolute;right:4px;top:4px;width:40px;height:40px;border:0;border-radius:8px;background:transparent;color:inherit;font-size:24px;cursor:pointer}.dc-signin-notice button:focus-visible{outline:3px solid #4c438b;outline-offset:1px}';
    doc.head.append(style);
  }
  const note = doc.createElement('aside'); note.className = 'dc-signin-notice';
  const status = doc.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  note.append(status);
  if (offerSetup) {
    const setup = doc.createElement('a'); setup.href = '/start/';
    setup.textContent = en ? 'Set up personal everyday support' : 'Persönliche Alltagshilfe einrichten'; note.append(setup);
  }
  const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', en ? 'Dismiss sign-in notice' : 'Anmeldehinweis schließen');
  const previousFocus = doc.activeElement;
  dismiss.addEventListener('click', () => {
    const restoreFocus = note.contains(doc.activeElement); note.remove();
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  });
  note.append(dismiss); doc.body.append(note);
  status.textContent = en ? 'You are signed in.' : 'Du bist angemeldet.';
  return note;
}

export function redirectAfterSignIn({ target, user, offerSetup = false, host = window } = {}) {
  if (!verified(user)) return false;
  const destination = safeEmailReturn(target, host.location.origin);
  try {
    if (['/de/', '/en/dementia-translator/'].includes(destination)) {
      const pending = JSON.parse(host.sessionStorage.getItem('demenzCoachKiOffen') || 'null');
      if (typeof pending?.text === 'string' && pending.text.trim() && pending.until > Date.now()) host.sessionStorage.setItem('demenzcoach.signupDraftReturn.v1', '1');
    }
    host.sessionStorage.setItem(noticeKey, JSON.stringify({ createdAt: Date.now(), path: new URL(destination, host.location.origin).pathname, offerSetup: offerSetup === true }));
  } catch { /* A blocked hint store must not trap an already signed-in user. */ }
  host.location.replace(destination);
  return true;
}

export async function consumeSignInNotice({ host = window, loadAuth = webAuth } = {}) {
  let pending;
  try {
    pending = JSON.parse(host.sessionStorage.getItem(noticeKey) || 'null');
    host.sessionStorage.removeItem(noticeKey);
  } catch { return; }
  if (!pending || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt < 0 || Date.now() - pending.createdAt > maxAge || pending.path !== host.location.pathname) return;
  try {
    const { auth } = await loadAuth({ anonymous: false });
    if (!verified(auth.currentUser)) return;
    showSignInNotice({ en: /^en(?:-|$)/i.test(host.document.documentElement.lang), offerSetup: pending.offerSetup === true, doc: host.document });
  } catch { /* No success claim without current verified sign-in. */ }
}
