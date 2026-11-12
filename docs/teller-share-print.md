# Fixed five-tip list and social preview

Scope: user-approved sharing/printing design, plus the separately authorized exact legacy-mail routing exception. Based on live main `26f15ceeba0926b665aed8c85fd13825a49eb274`. No homepage layout, menu, signup, AI prompt, account, quota, funnel or general experiment change.

## Destinations and source boundaries

- New public content route: `https://dementiacoachapp.com/de/demenz-alltagstipps.html`. Five fixed topics, no account/AI/analytics scripts. Printing calls the browser's existing print dialog. The fixed WhatsApp text contains this canonical public URL only.
- Existing `/teller`, `/teller/`, `/teller/index.html` links with exactly one `q=mail_weiter` skip assignment and redirect to that clean canonical list, regardless of a previous experiment cookie. Additional query fields are discarded. Duplicate `q`, other values, ad sources and all other entry calls retain the old experiment path, headers and consent policy. The static fallback implements the same narrow exception before storage/random sampling. The previously proposed `/teller/liste.html` is an exact 301 compatibility alias to the canonical German page; it is worker-first. No false English alternate is declared.
- The screenshot shows the actual public `mail_weiter` link. The current external Brevo template ID and other current template hrefs are not verified locally. Exactly one dependency request was sent to the existing backend owner; its narrow source lookup found no local template. No provider template was edited and no mail was sent. Future print/WhatsApp template links should use the new canonical list after that separate source handoff. No guessed template IDs or additional legacy query exceptions.
- The existing `/demenz-uebersetzer/saetze-zum-ausdrucken.pdf` is a separate sentence document and is untouched.

## Five-topic parity and care-copy review

The topics match the supplied five-trick email screenshot. The new page does not repeat its study, percentage, drinking-volume-effect, fall-prevention, sleep-effect or professional-qualification claims.

1. **Roter Teller:** exact currently rendered site override from `alltagstricks/sources.json`, not the older raw red-plate text. Contrast matters; red is one option.
2. **Farbiger Becher:** existing site text from `alltagstricks/tricks.json`, unchanged. The general note retains individual eating/drinking instructions.
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
