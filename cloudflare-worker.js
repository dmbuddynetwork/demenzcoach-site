// Statische Website wie bisher auf GitHub Pages: Adressen mit .html bleiben unverändert.
// Dateien liefert Cloudflare direkt aus (ohne diesen Code). Nur wenn keine Datei passt, läuft er:
// /ordner/ → /ordner/index.html, /ordner → 301 auf /ordner/, /seite → /seite.html, sonst 404.html.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const asset = async (pathname) => {
      const response = await env.ASSETS.fetch(new URL(pathname, url), request);
      return response.status === 200 ? response : null;
    };
    if (request.method === 'GET' || request.method === 'HEAD') {
      const path = url.pathname;
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
