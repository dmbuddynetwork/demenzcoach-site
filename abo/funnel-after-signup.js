// Direkt nach dem Absenden der Anmeldung (vor dem Klick auf den E-Mail-Link) geht der Nutzer in den Web-Funnel (Daniel, 20. Nov 2026).
// Der Anmeldeversuch bleibt in diesem Browser gespeichert; der Link in der E-Mail schließt die Anmeldung auch in einem neuen Tab ab.
// Nicht für Kauf und Plan (/abo/…) und nicht für die englischen Seiten, der Funnel ist deutsch.
const noteKey = 'demenzcoach.funnelWelcome.v1';
export const funnelURL = '/start/?src=anmeldung';
export function leaveForFunnel({ target = '', host = window, delay = 450 } = {}) {
  const path = String(target).split('?')[0];
  if (host.DEMENZ_ABO_CONFIG?.signIn?.funnelAfterEmail === false) return false;
  if (!path.startsWith('/de/')) return false;
  try { host.sessionStorage.setItem(noteKey, JSON.stringify({ createdAt: Date.now() })); } catch { /* Der Hinweis ist nur eine Zugabe. */ }
  host.setTimeout(() => host.location.assign(funnelURL), delay);
  return true;
}
// Der Funnel zeigt einmal den Hinweis „Link ist unterwegs“. Nur Darstellung, keine Adresse.
export function consumeFunnelWelcome(host = window) {
  try {
    const value = JSON.parse(host.sessionStorage.getItem(noteKey) || 'null');
    host.sessionStorage.removeItem(noteKey);
    return Number.isFinite(value?.createdAt) && Date.now() - value.createdAt >= 0 && Date.now() - value.createdAt < 120000;
  } catch { return false; }
}
