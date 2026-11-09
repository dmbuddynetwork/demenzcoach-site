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

// No identifier or cookie is created at the edge. A consented browser can retain
// its fixed arm; without that consent each new entry is randomized again.
export const tellerTarget = (request, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) => {
  const input = new URL(request.url);
  const cookie = /(?:^|;\s*)dc_teller_v1=(website|funnel)(?:;|$)/.exec(request.headers.get('Cookie') || '');
  const arm = cookie?.[1] || (random() < 0.5 ? 'website' : 'funnel');
  const language = input.searchParams.get('lang');
  const home = language === 'de' || LEGACY_HOME_LANGUAGES.has(language) ? language : 'de';
  const target = new URL(arm === 'website' ? `/${home}/` : '/start/', input.origin);
  // Deliberately do not forward arbitrary queries, ad click IDs or input text.
  target.searchParams.set('teller', arm);
  return target.toString();
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (['/teller', '/teller/', '/teller/index.html'].includes(url.pathname)) {
      const headers = {
        'Cache-Control': 'private, no-store, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
        'Referrer-Policy': 'no-referrer'
      };
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
      }
      return new Response(null, { status: 302, headers: { ...headers, Location: tellerTarget(request) } });
    }
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
