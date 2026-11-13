// Reuse the published #e-tiles catalog and its six-item sentinel pagination.
import { enhanceInlineEntry } from './start/inline-entry.js';
import { createInlineEntry, mayPromoteFunnel } from './start/content-funnel-promotions.js';
import { contentInvitationPolicy } from './abo/content-invitation-policy.js';
const mounted = new WeakMap();
export function mountContentFeed(section) {
  if (!section || mounted.has(section)) return mounted.get(section);
  const doc = section.ownerDocument, host = doc.defaultView;
  const list = section.querySelector('#e-tiles'), end = section.querySelector('#e-tiles-end');
  const status = section.querySelector('.content-feed-status'), more = section.querySelector('.content-feed-more');
  if (!list || !end || !status || !more) return null;
  const interlude = list.querySelector('[data-feed-interlude]');
  enhanceInlineEntry(interlude?.querySelector('.content-funnel'));
  const items = [...list.children].filter(node => node !== interlude);
  const seen = new Set(), unique = [];
  for (const node of items) {
    const href = node.querySelector('a[href]')?.getAttribute('href');
    if (!href || seen.has(href)) continue;
    seen.add(href); unique.push(node);
    for (const image of node.querySelectorAll('img')) {
      image.addEventListener('error', () => {
        if (image.dataset.contentFallback || image.getAttribute('src') === '/assets/zeichnungen/chat-helferin-fragend-lossless.png') { image.hidden = true; return; }
        image.dataset.contentFallback = 'true'; image.src = '/assets/zeichnungen/chat-helferin-fragend-lossless.png';
      });
    }
  }
  list.replaceChildren(); let cursor = 0, observer, funnelCount = interlude ? 1 : 0, pendingFunnels = 0;
  const offerAgain = async (item, position) => {
    if (funnelCount + pendingFunnels >= contentInvitationPolicy.maxFeedFunnels) return;
    pendingFunnels++;
    try {
      if (!await mayPromoteFunnel(doc)) return;
      // Never insert a large card behind the reader and move their current content.
      if (funnelCount >= contentInvitationPolicy.maxFeedFunnels || !item.isConnected || item.getBoundingClientRect().bottom <= 0 || doc.querySelector('dialog[open]')) return;
      const promotion = doc.createElement('li'); promotion.className = 'content-feed-interlude';
      promotion.dataset.feedPromotionAt = String(position); promotion.append(createInlineEntry(doc)); item.after(promotion); funnelCount++;
    } finally { pendingFunnels--; }
  };
  function showNext() {
    if (doc.querySelector('dialog[open]') || cursor >= unique.length) return;
    const stop = Math.min(cursor + 6, unique.length);
    for (; cursor < stop; cursor++) {
      const item = unique[cursor]; item.dataset.contentItem = String(cursor + 1);
      if ((cursor + 1) % 6 === 0 || cursor + 1 === unique.length) item.dataset.contentBatchEnd = '';
      list.append(item);
      if (cursor === 5 && interlude) list.append(interlude);
      else if (cursor + 1 > contentInvitationPolicy.firstFunnelAt
        && (cursor + 1 - contentInvitationPolicy.firstFunnelAt) % contentInvitationPolicy.funnelEvery === 0) void offerAgain(item, cursor + 1);
    }
    section.dataset.contentLoaded = String(cursor); section.dataset.contentTotal = String(unique.length);
    const finished = cursor === unique.length;
    status.textContent = finished ? 'Du hast alle Tipps und Beispiele gesehen.' : '';
    more.hidden = finished; end.hidden = finished;
    if (finished) observer?.disconnect();
    else if (observer) { observer.unobserve(end); observer.observe(end); }
    section.dispatchEvent(new CustomEvent('dc-content-batch', { bubbles: true }));
  }
  more.addEventListener('click', showNext);
  showNext();
  if ('IntersectionObserver' in host) {
    observer = new host.IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) showNext(); }, { rootMargin: '400px 0px' });
    if (!end.hidden) observer.observe(end);
  }
  const resume = () => { if (!end.hidden && end.getBoundingClientRect().top < host.innerHeight + 400) showNext(); };
  host.addEventListener('scroll', resume, { passive: true });
  const api = { showNext, count: () => cursor, total: unique.length };
  mounted.set(section, api); return api;
}
if (typeof document !== 'undefined') {
  const mount = () => document.querySelectorAll('.content-feed').forEach(mountContentFeed);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
}
