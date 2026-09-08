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

The GitHub Pages deployment rejects any release that still contains an incomplete legal-address placeholder.

The product homepage is available in 33 languages. Run
`node scripts/refresh-localized-pages.mjs .` to regenerate their shared Lovable
design, reciprocal language links, final Store screenshot galleries and sitemap.
Then run `node scripts/validate-seo.mjs .`. The screenshot provenance, locale
fallbacks and performance measurements are documented in
`docs/multilingual-site-refresh.md`.
