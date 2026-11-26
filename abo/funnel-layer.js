// Variante für den A/B-Test (Daniel, 20. Nov 2026): statt des Anmelde-Layers kommt der Web-Funnel /start/ selbst als Layer von unten.
// Gleiche Seite, gleicher Ursprung; der Funnel läuft unverändert im Rahmen. Nur Darstellung, keine Daten wandern über diese Datei.
export const funnelLayerSource = '/start/?src=layer&embed=1';
export const wantsFunnelLayer = (host = window) => { try { return host.sessionStorage.getItem('demenzcoach.anmeldungVariante.v1') === 'funnel'; } catch { return false; } };
let current;
export function openFunnelLayer({ doc = document, returnFocus = null, onClose = () => {} } = {}) {
  current?.close();
  if (!doc.getElementById('dc-funnel-layer-style')) {
    const link = doc.createElement('link'); link.id = 'dc-funnel-layer-style'; link.rel = 'stylesheet'; link.href = '/abo/funnel-layer.css'; doc.head.append(link);
  }
  const previous = doc.activeElement;
  const dialog = doc.createElement('dialog'); dialog.className = 'dc-funnel-layer'; dialog.setAttribute('aria-label', 'Persönliche Hilfe einrichten');
  const bar = doc.createElement('div'); bar.className = 'dc-funnel-layer-bar';
  const grip = doc.createElement('span'); grip.className = 'dc-funnel-layer-grip'; grip.setAttribute('aria-hidden', 'true');
  const close = doc.createElement('button'); close.type = 'button'; close.className = 'dc-funnel-layer-close'; close.setAttribute('aria-label', 'Schließen'); close.textContent = '×';
  bar.append(grip, close);
  const frame = doc.createElement('iframe'); frame.className = 'dc-funnel-layer-frame'; frame.title = 'Persönliche Hilfe einrichten'; frame.src = funnelLayerSource;
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
  close.addEventListener('click', finish);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
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
