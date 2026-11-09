// Statische Website wie bisher auf GitHub Pages: Adressen mit .html bleiben unverändert.
// Dateien liefert Cloudflare direkt aus (ohne diesen Code). Nur wenn keine Datei passt, läuft er:
// /ordner/ → /ordner/index.html, /ordner → 301 auf /ordner/, /seite → /seite.html, sonst 404.html.
// Ausnahme (run_worker_first in wrangler.jsonc): die alten Startseiten-Adressen / , /index.html
// und /index-xx.html leiten dauerhaft auf die Sprach-Adressen /de/ bzw. /xx/ um (Suchanfrage bleibt
// erhalten). Keine Sprachwahl per Accept-Language oder IP: jede alte Adresse hat genau ein Ziel.
// Nur Sprachen, deren alte Datei /index-xx.html wirklich existierte (Deutsch lag auf /index.html).
const LEGACY_HOME_LANGUAGES = new Set([
  'en', 'pl', 'ro', 'bg', 'hr', 'sk', 'hu', 'cs', 'uk', 'bs',
  'sr', 'lt', 'sl', 'lv', 'et', 'ru', 'tr', 'ar', 'fr', 'it', 'es',
  'pt', 'nl', 'el', 'sq', 'fa', 'th', 'da', 'fi', 'ga', 'mt', 'sv'
]);

export const legacyHomeTarget = (pathname) => {
  if (pathname === '/' || pathname === '/index.html') return '/de/';
  const match = /^\/index-([a-z]{2})\.html$/.exec(pathname);
  if (match && LEGACY_HOME_LANGUAGES.has(match[1])) return `/${match[1]}/`;
  return null;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = async (pathname) => {
      // Pfad direkt setzen statt neu auflösen: "//host/…" darf nie als fremde Adresse enden.
      const assetURL = new URL(url);
      assetURL.pathname = pathname;
      const response = await env.ASSETS.fetch(assetURL, request);
      // Auch ein bedingter Browser-Abruf (304) hat die Datei gefunden. Sonst würde ein
      // erneuter Besuch derselben Ordner-Seite fälschlich auf 404 fallen.
      return response.ok || response.status === 304 ? response : null;
    };
    if (request.method === 'GET' || request.method === 'HEAD') {
      const path = url.pathname;
      const homeTarget = legacyHomeTarget(path);
      if (homeTarget) {
        url.pathname = homeTarget;
        return Response.redirect(url.toString(), 301);
      }
      if (path.endsWith('/')) {
        const index = await asset(`${path}index.html`);
        if (index) return index;
      } else if (!/\.[a-z0-9]+$/i.test(path)) {
        if (await asset(`${path}/index.html`)) {
          url.pathname = `${path}/`;
          return Response.redirect(url.toString(), 301);
        }
        const page = await asset(`${path}.html`);
        if (page) return page;
      }
    }
    const notFound = await env.ASSETS.fetch(new URL('/404.html', url), request);
    return new Response(notFound.body, { status: 404, headers: notFound.headers });
  }
};
