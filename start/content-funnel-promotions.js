import { createInlineEntry } from './inline-entry.js';
import { publicContentPage, contentInteractionBusy } from '../abo/content-scroll-signup.js';
import { contentAccessState } from '../abo/content-access.js';
let interaction = false;
const styles = new WeakMap();
const markInteraction = event => {
  if (!event.isTrusted || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
  if (event.type === 'wheel' && event.deltaY <= 0) return;
  if (event.type === 'keydown' && !['ArrowDown','PageDown','End',' '].includes(event.key)) return;
  interaction = true;
};
if (typeof window !== 'undefined') {
  window.addEventListener('wheel', markInteraction, { passive: true });
  window.addEventListener('touchmove', markInteraction, { passive: true });
  window.addEventListener('keydown', markInteraction);
  window.addEventListener('click', event => { if (event.isTrusted && event.target?.closest?.('.content-feed-more')) interaction = true; }, { capture: true });
}
export async function mayPromoteFunnel(doc = document) {
  const host = doc.defaultView;
  if (!interaction || !/^de(?:-|$)/i.test(doc.documentElement.lang) || contentInteractionBusy(doc)) return false;
  try {
    if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
    const { webAuth } = await import('../abo/web-auth.js');
    const { auth } = await webAuth({ anonymous: false });
    return await contentAccessState(auth, doc) === 'free' && !contentInteractionBusy(doc);
  } catch { return false; } // Unknown paid status never produces another promotion.
}
export function funnelStyles(doc = document) {
  if (doc.querySelector('link[href="/start/inline-entry.css"]')?.sheet) return Promise.resolve(true);
  if (!styles.has(doc)) styles.set(doc, new Promise(resolve => {
    const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/start/inline-entry.css';
    const timer = setTimeout(() => resolve(false), 2500);
    const done = value => { clearTimeout(timer); resolve(value); };
    css.addEventListener('load', () => done(true), { once: true }); css.addEventListener('error', () => done(false), { once: true }); doc.head.append(css);
  }));
  return styles.get(doc);
}
export { createInlineEntry };
export function mountContentFunnelPromotion(doc = document) {
  const host = doc.defaultView;
  if (!/^de(?:-|$)/i.test(doc.documentElement.lang) || !publicContentPage(host.location.pathname, doc.body?.dataset.pageType)
    || doc.querySelector('.content-feed,.content-funnel')) return;
  const before = doc.querySelector('main .translator-how');
  if (!before) return;
  let loading = false, mounted = false, failedAt = -Infinity;
  const offer = async () => {
    if (loading || mounted || Date.now() - failedAt < 15000 || !interaction || contentInteractionBusy(doc)) return;
    loading = true;
    try {
      if (!await funnelStyles(doc)) { failedAt = Date.now(); return; }
      if (!await mayPromoteFunnel(doc)) { failedAt = Date.now(); return; }
      if (!before.isConnected || doc.querySelector('.content-funnel') || contentInteractionBusy(doc)) return;
      const section = doc.createElement('section'); section.className = 'section content-funnel-section';
      const inner = doc.createElement('div'); inner.className = 'container content-narrow';
      inner.append(createInlineEntry(doc, { source: 'content_inline' })); section.append(inner); before.before(section); mounted = true;
      host.removeEventListener('scroll', offer); host.removeEventListener('demenz-auth-changed', offer);
    } finally { loading = false; }
  };
  host.addEventListener('scroll', offer, { passive: true }); host.addEventListener('demenz-auth-changed', offer);
}
export function bootContentFunnelPromotions() {
  const start = () => mountContentFunnelPromotion();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
