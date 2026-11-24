// Direkt nach dem Absenden der Anmeldung (vor dem Klick auf den E-Mail-Link) geht der Nutzer in den Web-Funnel (Daniel, 20. Nov 2026).
// Der Anmeldeversuch bleibt in diesem Browser gespeichert; der Link in der E-Mail schließt die Anmeldung auch in einem neuen Tab ab.
// Nicht für Kauf und Plan (/abo/…) und nicht für die englischen Seiten, der Funnel ist deutsch.
export const funnelURL = '/start/?src=anmeldung';
export function leaveForFunnel({ target = '', host = window, delay = 450 } = {}) {
  const path = String(target).split('?')[0];
  if (host.DEMENZ_ABO_CONFIG?.signIn?.funnelAfterEmail === false) return false;
  if (!path.startsWith('/de/')) return false;
  host.setTimeout(() => host.location.assign(funnelURL), delay);
  return true;
}
