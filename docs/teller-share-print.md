# Fixed five-tip list and social preview

Scope: user-approved sharing/printing design, plus the separately authorized exact legacy-mail routing exception. Based on live main `26f15ceeba0926b665aed8c85fd13825a49eb274`. No homepage layout/global-menu redesign, signup, AI prompt, account, quota, funnel or general experiment change.

## Destinations and source boundaries

- New public content route: `https://dementiacoachapp.com/de/demenz-alltagstipps.html`. Five fixed topics, no account/AI/analytics scripts. Printing calls the browser's existing print dialog. The fixed WhatsApp text contains this canonical public URL only.
- Existing `/teller`, `/teller/`, `/teller/index.html` links with exactly one `q=mail_weiter` or `q=mail_willkommen` skip assignment and redirect to that clean canonical list, regardless of a previous experiment cookie. Additional query fields are discarded. Duplicate `q`, other values, ad sources and all other entry calls retain the old experiment path, headers and consent policy. The static fallback implements the same narrow exception before storage/random sampling. The previously proposed `/teller/liste.html` is an exact 301 compatibility alias to the canonical German page; it is worker-first. No false English alternate is declared.
- The backend owner resolved the current authenticated Brevo active template **2**, “Teller: Willkommen mit 5 Tricks”, at `https://app.brevo.com/templates/email/edit/2` (last edited 8 November, 10:44 AM). Its actual preview links “Liste ansehen und ausdrucken” to `/teller/?q=mail_willkommen`; the WhatsApp text contains `/teller/?q=mail_weiter`. Root authorized precisely these two existing values, never a broad `mail_` match. The actual current preview supersedes the different older 7 November sent-mail body; no old body was restored. No provider template was edited and no mail or WhatsApp message was sent. Safe read-only owner evidence: `/Users/daniel/Developer/Codex-Arbeit/demenzcoach-web-goals-three-answers-20261111/caregiver-v4/firebase-domain-plan/BREVO-5TRICKS-READONLY-SOURCE.json`.
- The existing `/demenz-uebersetzer/saetze-zum-ausdrucken.pdf` is a separate sentence document and is untouched.

## Five-topic parity and care-copy review

The topics match the supplied five-trick email screenshot. The new page does not repeat its study, percentage, drinking-volume-effect, fall-prevention, sleep-effect or professional-qualification claims.

1. **Roter Teller:** exact currently rendered site override from `alltagstricks/sources.json`, not the older raw red-plate text. Contrast matters; red is one option.
2. **Farbiger Becher:** existing site text from `alltagstricks/tricks.json`, with the domain-recommended clarification “zunächst halb voll und bei Bedarf nach”. The general note retains individual eating/drinking instructions.
3. **Foto an der Zimmertür:** this exact topic is in the screenshot and existing `teller/t-tuer.webp` illustration, not in the site's separate photo-album tip. New bounded proposal: permission, familiar recognisable picture, try and observe. NHS supports clear recognisable picture/sign cues; it does not establish a measured effect of this particular bedroom-photo intervention. Domain/safety review must explicitly decide this contextual extension before publication. No claimed study or guaranteed room finding.
4. **Lieblingslied beim Anziehen:** same email topic; existing site's invitation to sing familiar music, with a preference/stop condition. NIHR's primary guidance supports individual preferences and checking reactions. No claimed reduction in resistance or a dressing-specific study.
5. **Nachtlicht mit Bewegungsmelder:** same email topic and existing illustration. Wording concerns lighting the route, avoiding glare and keeping it clear. NHS supports lighting and automatic sensors. No fall/sleep guarantee.

The exact proposed texts and cited sources are in `content/teller-five-tricks.de.json`; the generated public page must match that frozen content. Safety/domain review follows source freeze. None of the 88 managed clinical records or prompts is changed.

## Preview metadata

Reuse the previously proposed winner from the ten copy alternatives, without claiming an A/B-tested lift:

> Demenz im Alltag: Was sagen, was tun? | Demenz Coach

> Beschreibe eure Situation und dein Ziel. Die KI schlägt passende Worte und kleine nächste Schritte für euren Alltag vor.

Only head metadata/descriptions in the two German entry files change. The false local-only statement is removed, including the identical structured-data descriptions. Body markup and translator data are unchanged except one proven false local-only privacy bullet on the older German tool page, corrected to say that own inputs are sent for AI processing. Two 1200×630 preview compositions reuse the existing logo, illustration and local fonts; no new artwork or qualifications. Already sent messaging previews may remain cached; no cache-refresh promise.

## Verification

- `node scripts/build-teller-list.mjs`
- `node --test scripts/test-teller-list-routing.mjs scripts/test-teller.mjs`
- Browser list checks at 390/1280: direct 200, five source topics, canonical-only sharing URL, print action, no auth/analytics/remote provider requests, all tips on one A4 page, no overflow/broken images.
- Preview-image rendering uses local existing assets only. Screens/PDF and source-bound evidence remain in the task output directory.
- No real WhatsApp send, email, account, AI request, purchase or publication in these checks.

Publication remains with the sole existing publisher after Root's source-bound QA and care/safety gate.

## Review closure (Root-directed, 12 November)

- Remove the visible sources disclosure in accordance with the previous user instruction. Internal JSON source mappings, generator validation, structured citations and this review documentation remain.
- Restore the approved logo/menu shell on this list only: sticky header, native keyboard-accessible disclosure with links back to the existing everyday-help homepage and App Store, and the existing functional text-size preference. No shared homepage code, auth, analytics, account or signup implementation is loaded or changed. Escape closes the menu and returns focus; navigation/outside clicks close it.
- Hide the full menu in print, unstick the header and use stable print type sizes even after the large-text setting. The domain-approved cup clarification is the only care-copy delta.
- Reuse the 16 routing/metadata/experiment source checks and original source-bound domain/safety findings. Closure checks cover visible source removal, unchanged internal sources, menu keyboard/focus, sticky navigation, large-text preference and blocked storage, direct list and fixed share URL, all five exact texts, and one A4 page with the menu open/large text enabled. No repeated provider or full audit runs.

- Final same-closure style correction: list-local footer links use regular weight without underlines, retaining visible keyboard focus; global/footer styles on other pages remain untouched.

## Final verified direct-mail alias closure

Root authorized the one additional, now directly verified `mail_willkommen` value on the same three entry paths, with exactly one `q`, identical 302/no-store headers and a clean fixed canonical destination before AB assignment. The static Pages fallback uses the same two exact values. Targeted routing tests cover both mail values, methods, prior arms, all entry paths, duplicate/malformed/other queries and both original fallback arms. UI/care/menu/metadata/OG blobs remain byte-identical to `b6a047c960e4d1b8cbe8a4e91067f4e09027b14c`; reuse all prior screenshots, browser, domain/safety and source checks. No UI rendering, provider actions or domain retest is needed for this alias-only delta.

## Pages SEO release closure

PR66 reached Cloudflare production, but Pages run `43247810218` stopped before deployment on four concrete checks: shared-layout detection for the approved local print page, duplicate German entry titles/descriptions and a missing canonical sitemap entry. This repair preserves the approved list UI, care copy, menu, print CSS, routing and OG images byte-for-byte.

- Keep the shared-layout requirement for every other page. The exact fixed-list route gets a positive local-layout contract validating its stylesheet, brand/home link, native accessible menu, font control, print action/script, sticky header and A4/static-header/hidden-menu print rules. Missing requirements fail; this is not a general bypass or noindex workaround. Negative contract tests cover those requirements and unrelated routes.
- Add the existing canonical fixed-list URL to the sitemap once.
- Give the older German translator page a specific Demenz-Übersetzer title and description, consistently in its head previews, while keeping homepage metadata and every body byte unchanged. No benefit/medical claim or prompt change.
- Run the precise layout-guard tests and the actual failing `node scripts/validate-seo.mjs .` release gate, plus diff verification. Prior UI/domain/safety/routing/browser evidence is reused. No provider run, pipeline retry or deployment by the Site writer; Root gates the new source for the sole publisher.
