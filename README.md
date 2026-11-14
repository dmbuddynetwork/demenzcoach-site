# Demenz Coach Website

Public product, support and legal pages for the Demenz Coach iOS app.

- [Website](https://dementiacoachapp.com/)
- [Privacy policy](https://dementiacoachapp.com/datenschutz.html)
- [Privacy choices](https://dementiacoachapp.com/datenschutzoptionen.html)
- [Terms of use](https://dementiacoachapp.com/nutzungsbedingungen.html)
- [Support](https://dementiacoachapp.com/support.html)
- [Imprint](https://dementiacoachapp.com/impressum.html)
- [English privacy policy](https://dementiacoachapp.com/privacy-en.html)
- [English privacy choices](https://dementiacoachapp.com/privacy-choices-en.html)
- [English terms of use](https://dementiacoachapp.com/terms-en.html)
- [English support](https://dementiacoachapp.com/support-en.html)
- [English imprint](https://dementiacoachapp.com/imprint-en.html)

Cloudflare is the only website publisher. GitHub Actions runs the legal-address
and SEO/link checks on pull requests and pushes to `main`, without deploying a
GitHub Pages site.

The homepage has 33 stable language URLs: `/de/`, `/en/`, `/fr/`, etc.
`/` and `/index.html` permanently redirect to `/de/`; the former
`/index-xx.html` addresses redirect to `/xx/`. Cloudflare's Worker preserves
query parameters and does not select a language from IP or browser settings.
Language links, self-canonicals, reciprocal hreflang and the sitemap use these
language URLs; `x-default` is `/de/`. The previous, distinct German app landing
is preserved at `/de/app/`, with its own assets and canonical. Other existing
editorial, tool and legal addresses remain valid.

Cloudflare runs the Worker before assets for the legacy homepage addresses
listed in `wrangler.jsonc`. The root HTML files remain static redirect
fallbacks. Do not run the
historical `scripts/refresh-localized-pages.mjs`: it targets the former paths
and would overwrite newer layouts. Edit the existing language pages directly.

Checks (Node.js; browser checks also need Playwright and a local HTTP server):

```sh
node --test scripts/test-worker-routing.mjs
node scripts/validate-seo.mjs .
git diff --check
# Start the actual Cloudflare routing locally:
npx wrangler dev --local --port 8897
# In another terminal:
SITE_URL=http://127.0.0.1:8897/ node scripts/validate-language-routing.cjs
SITE_URL=http://127.0.0.1:8897/ node scripts/validate-mobile.cjs de/index.html en/index.html fr/index.html ar/index.html de/app/index.html
SITE_URL=http://127.0.0.1:8897/ node scripts/validate-site-layout.cjs de/index.html en/index.html fr/index.html ar/index.html de/app/index.html index.html index-en.html
```

`PLAYWRIGHT_MODULE` and `CHROME_PATH` can point to an existing Playwright
installation and browser. Mobile/layout validators accept optional file
arguments for focused checks; without them they inspect their full page sets.
The URL approach follows [Google's multilingual-site guidance](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
and [hreflang guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).
Screenshot provenance and locale fallbacks in `docs/multilingual-site-refresh.md`
are historical background, not current build instructions.
