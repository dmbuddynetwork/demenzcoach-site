# Website UI: two review rounds, 11 November 2026

Base: Site main `6e61ac76a9361dfde4e4af16dd34afcd76aa0cdb`.
Scope: Site UI and its focused test fixtures. Backend prompts, classifiers, account rules, prices, payment operations and production flags belong to their existing owners.

## Changes

- Compact sticky logo/menu; existing font control and App link, existing account route, keyboard Escape and visible focus.
- Main heading, accessible nonduplicated form label; duplicate two-link examples removed, ordinary situation cards retained.
- Main form hidden for result/goal states; prepared direct links hide it before hydration. Existing public routes/canonicals remain.
- Direct one-line follow-up composer with explicit CTA, same submission path and text limit, pre-submit acceptance/privacy/AI links, cookie and viewport handling.
- Goal loading reuses the existing animation during the actual request. Retry, 15-second timeout and reduced motion retained.
- Selected goal is compact; “Ziel ändern” retains the generated alternatives and custom goal. Per-situation pending/result cache deduplicates A→B→A and detached views cannot render stale answers.
- Normal AI communication phrases precede optional background. Existing safety notes retain priority and concern/urgent background stays expanded. No phrases are invented by the UI.
- Answer bubble tail moved to its left edge. Existing catalog phrase hearts/shares and browser-local helpful-answer history remain.
- Requested visible source/reference panels hidden; source data, clinical wording, medical/legal/privacy/cancellation links retained.
- Existing woman edited into a questioning, attentive expression using the original illustration as edit target; original asset retained.
- Debby image/name/personal introduction removed from signup cards. Gate-off invitations describe the free account and a possible later membership. Extra-answer copy requires both intro placement and a confirmed active server credit contract; no cloud/history promise.

## Review history and attribution

| Origin | Finding or requirement | Disposition |
| --- | --- | --- |
| User via coordinator | Clean menu, larger useful content area, goal-first, direct input, remove Debby/source panels, retain goal choice | Implemented within Site ownership |
| Root visual review, round 2 | Full goal card delayed the useful phrases; large composer; duplicate payment hint | Compact goal disclosure, phrase-first layout and smaller composer; duplicate hint removed |
| Worker/test harness + Root confirmation | Directly imported signup view lacked production-mounted CSS; early fullpage/resize captures repeated fixed/sticky paint | Real production signup mount and local asset graph; single DOM card; final viewport capture after stable rendering; fresh desktop context diagnostic |
| Root visual review | Earlier “footer” capture showed lazy-loaded scenario cards instead | Capture moved after stable actual footer focus; footer links, cancellation and privacy settings now visible; early capture is not footer proof |
| Worker integration + API owner triage | Paid scenario hit the seventh goal request after a tamper probe had consumed the same IP budget | Tests separated; legitimate sixth goal succeeds, tamper remains rejected, seventh same-IP goal remains limited; no production limit change |
| Legacy test failure + independent reviewer | Modal fixture had no UID, so the production UID guard correctly stopped it | Stable synthetic UID and explicit session/error checks; product guard unchanged; 32 cases pass |
| Root/API owner cross-version review | Already-open old clients reject new choice IDs | Exact shipped client parser regression added; backend owner supplies opaque legal legacy wire IDs without native semantic markers |
| Final history wait diagnostic | The existing popstate handler forces reload; Playwright forward(networkidle) was aborted | Only that explicit navigation abort is recorded; the final actual URL, completed reload, answer and selected goal are asserted. No product handler changed |
| Worker live readback | Extra-answer credit mode is not currently active in production | Public `/access` with production Origin returned HTTP 200, `enabled:false`; client gate also false. Fixture credit success is not a live bonus offer. Root-approved invitation copy now promises no extra answers; an explicit presentation guard suppresses the number unless intro placement and active server credits both hold. No flags enabled |

The unversioned early unstyled/fullpage previews were overwritten before versioned capture was introduced. Their original files are not retained and cannot be presented as passed evidence. `round1/HISTORY.json` records this; later corrected round-1 captures are preserved. Root-found requirements are not reclassified as autonomous discoveries.

## Focused evidence

Evidence root outside the repository:
`/Users/daniel/Developer/Codex-Arbeit/demenzcoach/web-goal-first-20261111/clean-navigation/`

| Check | Result and limits |
| --- | --- |
| `test-web-clean-navigation.cjs` | DE/EN, mobile/desktop; real local assets and production signup mount; mocked AI/auth only; goal loading, choice/cache/race, complete phrase arrays, composer, signup, prepared direct URL/reload/back/forward, catalog save/share; no provider calls |
| `test-web-journey-edges.cjs` | DE/EN 320px and 200% text, stored font choice, empty-input no-request, own goal/focus, new input, offline/retry, 429 without purchase prompt, actual unshortened 15-second timeout |
| `test-web-ui-no-prompt.cjs` | DE/EN; negation vs acute danger, fixed concern/urgent in both phases, retry/focus, request-owned warning retention; 34 mocked requests; no model calls |
| `test-web-goal-flow.cjs` | DE/EN typed goal-first flow, explicit chosen/custom goal, missing and failed illustration fallback, helpful-answer preservation |
| `test-web-access.cjs` | 40 checks across 390/1280; actual API37 request/usage code with synthetic Firebase/model/payment; separate legitimate, tamper and abuse-budget cases |
| Email and Google adapter tests | 19 email + 14 Google unit cases; no actual signup/email |
| `test-email-expired-browser.cjs` | DE/EN real account UI/email adapter with synthetic expired Firebase error; clean callback URL, new-link form, no phone input; no real email/account |
| `test-web-goal-compat.cjs` | Exact shipped `6e61ac` and current parsers, four wire-fixture cases; selected label preserved; backend adapter integration is separate |
| Hosted checkout | 9 browser contract cases + 12 redirect unit cases; 32 legacy Elements disclosure cases, including standalone/modal, failure/races, 320px/225% text; external operations mocked |
| Prepared catalog | 88 views from 176 fresh contexts, identical DOM and zero provider requests; 88 prepared pages regenerated offline |
| Routing/SEO | 10 Worker routing + 13 source-bound generator guard cases |
| Source hygiene | JavaScript syntax and `git diff --check` |

## Actual external readback

Chrome profile Daniel: opened the existing production `/abo/` flow and its actual Stripe hosted preview, using the existing signed-in account. Trial, recurring annual price, subscription/mandate text and cancellation links were visible. No card/name was entered and the purchase/subscription confirmation was never clicked. Stripe automatically displayed a Link-code prompt; actual code delivery was not verified and no send/resend/code action was performed. “Ohne Link zahlen” showed ordinary payment fields; the Germany preview showed Apple Pay/PayPal/Link. This does not establish every payment method in every country. Both task-owned tabs were closed and inventory readback confirmed closure.

## Open boundaries

- This source handoff is not a deployment. Only the existing Site Publisher may integrate/publish after independent review.
- New model goals and three-sentence quality belong to the backend owner and its full 50-case before/after gate. UI fixtures are not model-quality evidence.
- Private reusable situation URLs await the user’s device-only vs account decision. No new persistence, public sharing, database endpoint or care text in URLs was introduced.
- Saved answers are currently browser-local, not account cloud storage. Older saved answers may contain one phrase; opening them does not invent or regenerate more.
- No new real Firebase/OAuth account or email link was created. Actual mobile OS keyboard, VoiceOver and physical-device behavior remain unverified; browser reduced-motion, text size, keyboard focus and visualViewport behavior were checked to the stated extent.

## Safety review delta — 12 November 2026

Independent Safety found P2 on reviewed candidate `b54a669`: changing a goal replaced the entire answer slot, removing the only warning before the next answer arrived. Publication was not approved. The coordinator authorized only this UI correction and its relevant regressions/bindings.

The fix keeps actual warning nodes and their call links in an ephemeral region belonging to the same original situation. Each retained warning lists the actual preceding goal label(s), keyed by the full goal ID/label and address mode. This is previous-answer information, not a new clinical classification of the currently selected goal. Custom labels use text content. A new original creates a new empty region.

Deduplication compares exact normalized warning text and link destinations only with warnings actually present in this panel's current answer slot. Identical current warnings temporarily suppress the historical duplicate; genuinely different warnings coexist. The fixed urgent renderer cannot reuse a historical node as if it belonged to a new request. No severity latch, relevance classifier, prompt, medical text, stylesheet, account or production flag changed.

Evidence: `/Users/daniel/Developer/Codex-Arbeit/demenzcoach/web-goal-first-20261111/goal-warning-fix/`.

- `RED.log`: the exact original failure, zero visible warnings while B is pending.
- `green/RESULT.json`: 26 green targeted cases — DE/EN fixed/model concern/urgent, B pending/error/standard/identical warning, A→B→A cache, focus/call links/new original and custom-label contexts.
- `extended/RESULT.json`: 10 further green cases — eight genuinely different B-warning combinations plus two same-ID/different-label custom goals containing HTML-looking text. No inserted image nodes.
- `screens/`: versioned B-pending/B-standard/A-return screenshots for concern and urgent. These are mocked UI evidence, not live advice.
- `SAFETY34.log`: all existing 34 DE/EN safety mock requests pass unchanged.
- `export/`: 88 unchanged rendered catalog views rebound from 176 fresh contexts, zero providers; source-bound SEO guard 13 cases passes.

Two extended-fixture mistakes were corrected only in tests: a different historical B warning correctly remains alongside current A (two distinct warnings), and a fixed B concern must be awaited as a warning rather than as a model answer. The first 26 green cases remain valid because the product source did not change between the green runs. The normal full regression combines the cases; the extended run isolates only the newly added combinations.

The previous b54 technical/visual/auth/payment results remain historical evidence; unrelated suites were not repeated. This delta still requires independent Safety and technical after-review, then the existing sole Publisher. No merge or production deployment is authorized by this source handoff.
