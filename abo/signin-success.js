import { webAuth } from './web-auth.js';
import { safeEmailReturn } from './email-auth.js';

const noticeKey = 'demenzcoach.signinNotice.v1';
const maxAge = 60000;
const verified = user => Boolean(user?.uid && user.emailVerified === true && user.isAnonymous === false && typeof user.email === 'string' && user.email);

// Presentation state only: no address, account identifier, action code or draft.
export function showSignInNotice({ en = false, offerSetup = false, doc = document } = {}) {
  const previousNotice = doc.querySelector('.dc-signin-notice');
  if (previousNotice?.removeSignInNotice) previousNotice.removeSignInNotice(); else previousNotice?.remove();
  if (!doc.getElementById('dc-signin-notice-style')) {
    const style = doc.createElement('style'); style.id = 'dc-signin-notice-style';
    style.textContent = '.dc-signin-notice{position:fixed;z-index:19;top:12px;left:50%;transform:translateX(-50%);box-sizing:border-box;width:max-content;max-width:calc(100% - 24px);padding:10px 48px 10px 14px;min-height:48px;border:1px solid #b5d6bf;border-radius:12px;background:#eef8f0;color:#195b35;box-shadow:0 3px 12px #0001;font:500 .9375rem/1.4 system-ui,sans-serif}.dc-signin-notice[hidden]{display:none}.dc-signin-notice a{margin-inline-start:10px;color:inherit;font-size:.8125rem;font-weight:400;text-decoration:underline}.dc-signin-notice button{position:absolute;right:2px;top:2px;width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:inherit;font-size:22px;cursor:pointer}.dc-signin-notice button:focus-visible{outline:3px solid #4c438b;outline-offset:1px}body.einfach .dc-signin-notice,body.einfach .dc-signin-notice *{font-size:.9375rem!important;line-height:1.4!important}body.einfach .dc-signin-notice a{font-size:.8125rem!important}body.einfach .dc-signin-notice button{font-size:1.375rem!important}';
    doc.head.append(style);
  }
  const note = doc.createElement('aside'); note.className = 'dc-signin-notice';
  const status = doc.createElement('span'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  note.append(status);
  if (offerSetup) {
    const setup = doc.createElement('a'); setup.href = '/start/';
    setup.textContent = en ? 'Set up support' : 'Alltagshilfe einrichten';
    setup.setAttribute('aria-label', en ? 'Set up personal everyday support' : 'Persönliche Alltagshilfe einrichten'); note.append(setup);
  }
  const dismiss = doc.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', en ? 'Dismiss sign-in notice' : 'Anmeldehinweis schließen');
  const previousFocus = doc.activeElement;
  const host = doc.defaultView;
  const header = doc.querySelector('.e-header, .site-header, body > header, [role="banner"]');
  let frame, disposed = false;
  // Follow the actual navigation height, including text zoom and wrapping.
  // While its menu is open, leave the full navigation unobstructed.
  const position = () => {
    frame = undefined;
    if (disposed) return;
    const bounds = header?.getBoundingClientRect();
    const visible = bounds && bounds.bottom > 0 && bounds.top < host.innerHeight;
    note.hidden = Boolean(visible && header.querySelector('details[open], [aria-expanded="true"]'));
    note.style.top = `${Math.max(12, visible ? bounds.bottom + 8 : 0)}px`;
  };
  const schedulePosition = () => { if (!disposed && frame === undefined) frame = host.requestAnimationFrame(position); };
  const observer = header && typeof host.ResizeObserver === 'function' ? new host.ResizeObserver(schedulePosition) : null;
  const changes = header ? new host.MutationObserver(schedulePosition) : null;
  const remove = () => {
    if (disposed) return; disposed = true;
    if (frame !== undefined) host.cancelAnimationFrame(frame);
    observer?.disconnect(); changes?.disconnect();
    host.removeEventListener('resize', schedulePosition); host.removeEventListener('scroll', schedulePosition, true);
    host.visualViewport?.removeEventListener('resize', schedulePosition); header?.removeEventListener('toggle', schedulePosition, true);
    note.remove();
  };
  note.removeSignInNotice = remove;
  dismiss.addEventListener('click', () => {
    const restoreFocus = note.contains(doc.activeElement); remove();
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  });
  note.append(dismiss); doc.body.append(note);
  if (header) { observer?.observe(header); changes?.observe(header, { attributes: true, childList: true, subtree: true }); header.addEventListener('toggle', schedulePosition, true); }
  host.addEventListener('resize', schedulePosition); host.addEventListener('scroll', schedulePosition, { passive: true, capture: true });
  host.visualViewport?.addEventListener('resize', schedulePosition);
  position();
  status.textContent = en ? 'You are signed in.' : 'Du bist angemeldet.';
  return note;
}

export function redirectAfterSignIn({ target, user, offerSetup = false, host = window } = {}) {
  if (!verified(user)) return false;
  const destination = safeEmailReturn(target, host.location.origin);
  if (['/de/', '/en/dementia-translator/'].includes(destination)) {
    try {
      const pending = JSON.parse(host.sessionStorage.getItem('demenzCoachKiOffen') || 'null');
      if (typeof pending?.text === 'string' && pending.text.trim() && pending.until > Date.now()) host.sessionStorage.setItem('demenzcoach.signupDraftReturn.v1', '1');
    } catch { return false; } // Without the no-submit flag, the destination could request another answer.
  }
  try {
    host.sessionStorage.setItem(noticeKey, JSON.stringify({ createdAt: Date.now(), path: new URL(destination, host.location.origin).pathname, offerSetup: offerSetup === true }));
  } catch { /* The optional notice alone does not govern safe draft restoration. */ }
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
