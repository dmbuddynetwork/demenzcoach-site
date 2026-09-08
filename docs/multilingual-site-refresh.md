# Multilingual Lovable refresh

## Scope and design

All 33 product home pages share the German page's Lovable-inspired visual system:
violet and lavender colors, serif display headings, rounded cards and buttons, the
caregiver logo, consistent focus states, responsive navigation and compact mobile
image treatment. Existing localized product and safety copy remains in its own
language; the refresh does not introduce German body copy into another locale.

Each screenshot gallery now uses six final App Store images. On viewports up to
720 px, the gallery is a horizontally swipeable, scroll-snapping row. Cards are
72 vw wide and screenshots are capped at 52 svh. Localized hero screenshots are
capped at 48 svh. The next card remains partly visible as a swipe cue.

## Website-to-Store locale mapping

| Website | Store screenshots | Status |
|---|---|---|
| `de` | `de-DE` | direct |
| `en` | `en-US` | direct |
| `ar` | `ar-SA` | direct |
| `cs` | `cs` | direct |
| `da` | `da` | direct |
| `el` | `el` | direct |
| `es` | `es-ES` | direct |
| `fi` | `fi` | direct |
| `fr` | `fr-FR` | direct |
| `hr` | `hr` | direct |
| `hu` | `hu` | direct |
| `it` | `it` | direct |
| `nl` | `nl-NL` | direct |
| `pl` | `pl` | direct |
| `pt` | `pt-PT` | direct |
| `ro` | `ro` | direct |
| `ru` | `ru` | direct |
| `sk` | `sk` | direct |
| `sl` | `sl-SI` | direct |
| `sv` | `sv` | direct |
| `th` | `th` | direct |
| `tr` | `tr` | direct |
| `uk` | `uk` | direct |
| `bg`, `bs`, `et`, `fa`, `ga`, `lt`, `lv`, `mt`, `sq`, `sr` | `en-US` | explicit English fallback |

Every fallback page labels both the hero and the gallery in its own page language.
No German screenshot is used as an unlabelled fallback.

## SEO and accessibility checks

- All 33 home pages are indexable and have unique localized titles, descriptions
  and canonicals.
- Every home page contains the same reciprocal `hreflang` set for 33 languages plus
  `x-default`; all home canonicals are present in the sitemap.
- Existing truthful `MobileApplication`, `WebSite`, `Organization` and free `Offer`
  structured data remains. No rating, testimonial or medical-effect claim was added.
- Every page has one H1, a skip link, keyboard focus styling, a 44 px mobile menu
  control and native RTL document direction for Arabic and Persian.
- Final Store images include intrinsic width and height. The hero is high priority;
  all six gallery images use lazy loading and asynchronous decoding.

## Performance comparison

Conditions: static files from `origin/main` (`56fa06a`) versus this branch; local
bytes only, no compression over HTTP, cache disabled, no analytics because consent
was not granted. “Initial” counts HTML, shared CSS/JS and the high-priority hero
image. “All referenced” also counts unique lazy images referenced by the page.

| Page | Before initial | After initial | Before all referenced | After all referenced |
|---|---:|---:|---:|---:|
| German, mobile | 2,377,790 B | 120,427 B | 3,015,509 B | 833,356 B |
| German, desktop | 2,377,790 B | 171,667 B | 3,015,509 B | 833,356 B |
| English | 123,435 B | 118,344 B | 460,520 B | 446,327 B |
| Polish | 110,898 B | 117,300 B | 377,223 B | 494,089 B |
| Arabic | 95,806 B | 110,528 B | 268,109 B | 418,899 B |

The German hero drops from a 2.29 MB PNG to responsive 26 KB/76 KB WebP variants.
Polish and Arabic reference more total bytes because the complete Store gallery grew
from three to six images, but the additional images remain lazy and representative
initial local transfer stays at about 111–117 KB.

## Reproduction and release boundary

Run `node scripts/refresh-localized-pages.mjs .` after changing the locale catalog,
then `node scripts/validate-seo.mjs .`. The refresh script is idempotent and updates
all home pages plus the sitemap.

This branch is a preview. Merging it into `main` would trigger the GitHub Pages
production deployment and therefore requires a separate explicit release decision.
