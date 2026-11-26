// Variante für den A/B-Test (Daniel, 20. Nov 2026): statt des Anmelde-Layers kommt der Web-Funnel /start/ selbst als Layer von unten.
// Gleiche Seite, gleicher Ursprung; der Funnel läuft unverändert im Rahmen. Nur Darstellung, keine Daten wandern über diese Datei.
export const funnelLayerSource = '/start/?src=layer&embed=1';
// Angemeldet und Fragebogen schon fertig oder weggeklickt: der Layer zeigt die Paywall (Angebotsseite).
const quizSkippedKey = 'demenzcoach.quizLayerSkipped.v1';
export function funnelLayerWantsPaywall(host = window) {
  try {
    const done = JSON.parse(host.localStorage.getItem('demenzCoachQuizDone.v1') || 'null');
    if (done && Number.isFinite(done.at) && Date.now() - done.at < 30 * 86400000) return true;
    const skipped = Number(host.localStorage.getItem(quizSkippedKey));
    return Number.isFinite(skipped) && skipped > 0 && Date.now() - skipped < 30 * 86400000;
  } catch { return false; }
}
export const wantsFunnelLayer = (host = window) => { try { return host.sessionStorage.getItem('demenzcoach.anmeldungVariante.v1') === 'funnel'; } catch { return false; } };
// Layer von unten: bis 1100 px breit, 94 % hoch, Seite dahinter abgedunkelt (Daniel, 26. Nov 2026). Vollbild erst nach der ersten Antwort.
const funnelLayerCSS = `
.dc-funnel-layer { position: fixed; inset: auto 0 0 0; margin: 0 auto; box-sizing: border-box; width: 100%; max-width: 1100px; height: 94dvh; max-height: 94dvh; padding: 0; border: 0; border-radius: 20px 20px 0 0; background: var(--bg, #f6f5f2); color: inherit; overflow: hidden; box-shadow: 0 -8px 32px rgba(28, 27, 31, .28); animation: dc-funnel-up .28s ease-out; }
.dc-funnel-layer:focus { outline: none; }
.dc-funnel-layer::backdrop { background: rgba(28, 27, 31, .55); }
.dc-funnel-layer-bar { position: relative; display: flex; align-items: center; justify-content: center; height: 44px; }
.dc-funnel-layer-grip { width: 44px; height: 5px; border-radius: 3px; background: #c9c5d8; }
.dc-funnel-layer-close { position: absolute; top: 2px; right: 8px; width: 40px; height: 40px; border: 0; border-radius: 50%; background: #ece9f7; color: #47408c; font-size: 1.5rem; line-height: 1; cursor: pointer; }
.dc-funnel-layer-frame { display: block; width: 100%; height: calc(100% - 44px); border: 0; background: #f6f5f2; }
@keyframes dc-funnel-up { from { transform: translateY(40px); opacity: .6; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dc-funnel-layer { animation: none; } }
`;
let current;
export function openFunnelLayer({ doc = document, returnFocus = null, onClose = () => {}, paywall = false } = {}) {
  // Nie ein Layer im Layer (Daniel, 26. Nov 2026: „weiße Zeile oben“). In einem Rahmen öffnet die äußere Seite.
  const view = doc.defaultView || window;
  if (view.top !== view) {
    try { const outer = view.top.document; if (!outer.querySelector('dialog.dc-funnel-layer[open]')) return openFunnelLayer({ doc: outer, returnFocus, onClose, paywall }); } catch { /* anderer Ursprung */ }
    onClose(); return null;
  }
  current?.close();
  if (!doc.getElementById('dc-funnel-layer-style')) {
    // Stil direkt im Skript: der Layer erscheint nie ungestylt, auch nicht bei langsamer Verbindung (Daniel, 26. Nov 2026: „komisches Fenster“).
    const style = doc.createElement('style'); style.id = 'dc-funnel-layer-style'; style.textContent = funnelLayerCSS; doc.head.append(style);
  }
  const previous = doc.activeElement;
  const dialog = doc.createElement('dialog'); dialog.className = 'dc-funnel-layer'; dialog.setAttribute('aria-label', 'Persönliche Hilfe einrichten');
  const bar = doc.createElement('div'); bar.className = 'dc-funnel-layer-bar';
  const grip = doc.createElement('span'); grip.className = 'dc-funnel-layer-grip'; grip.setAttribute('aria-hidden', 'true');
  const close = doc.createElement('button'); close.type = 'button'; close.className = 'dc-funnel-layer-close'; close.setAttribute('aria-label', 'Schließen'); close.textContent = '×';
  bar.append(grip, close);
  const frame = doc.createElement('iframe'); frame.className = 'dc-funnel-layer-frame'; frame.title = 'Persönliche Hilfe einrichten'; frame.src = paywall ? `${funnelLayerSource}&angebot=1` : funnelLayerSource;
  dialog.append(bar, frame);
  const root = doc.documentElement, body = doc.body, overflow = [root.style.overflow, body.style.overflow];
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    if (banner?.parentNode === dialog) doc.body.append(banner);
    if (dialog.open) dialog.close(); dialog.remove();
    root.style.overflow = overflow[0]; body.style.overflow = overflow[1];
    if (current?.dialog === dialog) current = undefined;
    const focus = returnFocus?.isConnected ? returnFocus : previous?.isConnected ? previous : null; focus?.focus?.({ preventScroll: true });
    onClose();
  };
  // Fragebogen weggeklickt = will ihn gerade nicht: beim nächsten Mal die Paywall (Daniel, 26. Nov 2026).
  const skip = () => { if (paywall) return; try { const screen = frame.contentDocument?.body?.dataset.screen; if (!screen || screen === 'relation') (doc.defaultView || window).localStorage.setItem(quizSkippedKey, String(Date.now())); } catch { /* */ } };
  close.addEventListener('click', () => { skip(); finish(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); skip(); finish(); });
  // Daniel, 26. Nov 2026: ein Klick neben den Layer schließt ihn nicht mehr (versehentlich weggeklickt). Schließen nur über das ×.
  // Noch keine Entscheidung zu Cookies: derselbe Banner der Seite bleibt über dem Layer sichtbar (kein zweiter Banner im Rahmen).
  const banner = doc.querySelector('body > .consent-banner:not([hidden])');
  doc.body.append(dialog); root.style.overflow = 'hidden'; body.style.overflow = 'hidden';
  if (banner) dialog.append(banner);
  // Fokus auf den Layer selbst, nicht auf „Schließen“: so erscheint beim Öffnen kein Rahmen um das ×.
  dialog.tabIndex = -1; dialog.showModal(); dialog.focus({ preventScroll: true });
  current = { dialog, close: finish };
  return current;
}
