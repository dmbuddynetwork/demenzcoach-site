// Static-tip reading is a local invitation trigger, never an AI allowance or lock.
import { contentInteractionBusy, mountContentScrollSignup } from './content-scroll-signup.js';
import { contentAccessState } from './content-access.js';
import { contentInvitationPolicy as policy, scrollSignupKey, readInvitationCadence, invitationCadenceAllows } from './content-invitation-policy.js';
const key = 'demenzcoach.tipInvitation.v1', mounted = new WeakMap();
export function mountTipMembership(doc = document) {
  if (mounted.has(doc)) return mounted.get(doc);
  const host = doc.defaultView;
  if (!/^(?:de|en)(?:-|$)/i.test(doc.documentElement.lang) || !doc.querySelector('main .tips .tip,main .translator-trick,.tip-detail-art')) return null;
  const seen = new WeakMap(), counted = new WeakSet();
  let start = 0, intentAt = 0, distance = 0, previousY = host.scrollY, loading = false, suspended = false, unavailable = false, timer, sheet, pending = 0;
  const state = () => {
    try {
      const raw = host.sessionStorage.getItem(key), now = Date.now();
      if (!raw) return { version: 1, count: 0, until: now + policy.windowMS, offered: false };
      const value = JSON.parse(raw);
      if (value.version !== 1 || !Number.isInteger(value.count) || value.count < 0 || value.count > 5 || typeof value.offered !== 'boolean' || !Number.isFinite(value.until) || value.until > now + policy.windowMS) return null;
      return value.until <= now ? { version: 1, count: 0, until: now + policy.windowMS, offered: false } : value;
    } catch { return null; }
  };
  const write = value => { try { host.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const cadence = () => { try { return readInvitationCadence(host.sessionStorage.getItem(scrollSignupKey), Date.now()); } catch { return null; } };
  const writeCadence = value => { try { host.sessionStorage.setItem(scrollSignupKey, JSON.stringify(value)); return true; } catch { return false; } };
  const eligible = () => !unavailable && !suspended && !contentInteractionBusy(doc) && state()?.count === 5 && state()?.offered === false
    && start > 0 && Date.now() - start >= 5000 && distance >= 180 && invitationCadenceAllows(cadence(), Date.now(), policy, pending)
    && (!doc.querySelector('main .tips') || doc.querySelector('main .note')?.getBoundingClientRect().bottom <= host.innerHeight * .95);
  const offer = async () => {
    if (loading || !eligible()) return; loading = true;
    let anchor;
    try {
      pending = Date.now() + 15000;
      if (!writeCadence({ ...cadence(), pendingUntil: pending })) return;
      if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      const [{ webAuth }, { signupStyles }, { openSignupSheet }] = await Promise.all([import('./web-auth.js'), import('./inline-signup.js'), import('./signup-sheet.js')]);
      await signupStyles(); if (!doc.querySelector('link[data-inline-signup]')?.sheet?.cssRules.length) return;
      const { auth } = await webAuth({ anonymous: false });
      const user = auth.currentUser, identity = user ? `${user.uid}:${user.isAnonymous}:${user.emailVerified}` : null;
      if (await contentAccessState(auth, doc) !== 'free') { unavailable = true; return; }
      const current = auth.currentUser;
      if ((current ? `${current.uid}:${current.isAnonymous}:${current.emailVerified}` : null) !== identity || !eligible()) return;
      // The shared controller counts this actual dialog once and records the same close cooldown.
      if (!mountContentScrollSignup({ doc })) return;
      const en = /^en(?:-|$)/i.test(doc.documentElement.lang), view = doc.createElement('section');
      view.className = 'dc-signup dc-membership-invite';
      const body = doc.createElement('div'); body.className = 'offer-body';
      const title = doc.createElement('h3'); title.id = 'tip-membership-title'; title.textContent = en ? 'More answers for everyday care' : 'Weitere Antworten für deinen Pflegealltag';
      const lead = doc.createElement('p'); lead.className = 'lead'; lead.textContent = en ? 'Words for your situation and small next steps to try.' : 'Passende Worte für deine Situation und kleine nächste Schritte zum Ausprobieren.';
      const action = doc.createElement('a'); action.className = 'primary'; action.href = '/abo/?src=tip_membership'; action.textContent = en ? 'View membership' : 'Mitgliedschaft ansehen';
      const note = doc.createElement('p'); note.className = 'signup-guidance'; note.textContent = en ? 'Paid membership. See offers and prices in the next step.' : 'Kostenpflichtige Mitgliedschaft. Angebote und Preise siehst du im nächsten Schritt.';
      const later = doc.createElement('button'); later.type = 'button'; later.className = 'signup-change'; later.textContent = en ? 'Keep reading' : 'Weiterlesen'; later.addEventListener('click', () => sheet?.close('dismiss'));
      body.append(title, lead, action, note, later); view.append(body);
      anchor = doc.createElement('span'); anchor.hidden = true; doc.body.append(anchor);
      if (!write({ ...state(), offered: true })) return;
      sheet = openSignupSheet(view, { anchor, en, doc, returnFocus: doc.querySelector('main') });
    } catch { /* Unknown status or unavailable resources never lock public tips. */ }
    finally {
      if (!sheet) anchor?.remove();
      const value = cadence(); if (pending && value?.pendingUntil === pending) writeCadence({ ...value, pendingUntil: 0 });
      pending = 0; loading = false;
    }
  };
  const blocks = () => {
    const detail = doc.querySelector('.tip-detail-art')?.closest('.tricks-intro');
    return detail ? [detail] : [...doc.querySelectorAll('main .tips .tip,main .translator-trick')];
  };
  const read = () => {
    if (suspended || Date.now() - intentAt > 1500 || contentInteractionBusy(doc)) return;
    const value = state(); if (!value || value.offered) return;
    let count = value.count;
    for (const node of blocks()) {
      if (!node.getClientRects().length || counted.has(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top < host.innerHeight * .8 && rect.bottom > 0 && !seen.has(node)) seen.set(node, Date.now());
      if (seen.has(node) && Date.now() - seen.get(node) >= 1000 && rect.bottom <= host.innerHeight * .95) { counted.add(node); count = Math.min(5, count + 1); }
    }
    if (count !== value.count && !write({ ...value, count })) return;
    void offer();
  };
  const intent = event => {
    if (!event.isTrusted || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.type === 'wheel' && event.deltaY <= 0) return;
    if (event.type === 'keydown' && !['ArrowDown','PageDown','End',' '].includes(event.key)) return;
    intentAt = Date.now();
  };
  const scroll = () => {
    const down = host.scrollY - previousY; previousY = host.scrollY;
    if (down <= 0 || Date.now() - intentAt > 1500) return;
    start ||= Date.now(); distance += down; read(); clearTimeout(timer); timer = host.setTimeout(read, 1050);
  };
  const reset = () => { start = 0; distance = 0; intentAt = 0; previousY = host.scrollY; clearTimeout(timer); };
  host.addEventListener('wheel', intent, { passive: true }); host.addEventListener('touchmove', intent, { passive: true }); host.addEventListener('keydown', intent);
  host.addEventListener('scroll', scroll, { passive: true }); host.addEventListener('beforeprint', () => { reset(); sheet?.close('print'); });
  host.addEventListener('pagehide', () => { suspended = true; reset(); sheet?.close('pagehide'); }); host.addEventListener('pageshow', () => { suspended = false; reset(); });
  const api = { read }; mounted.set(doc, api); return api;
}
export function bootTipMembership() {
  const boot = () => mountTipMembership();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}
bootTipMembership();
