# Web-App introduction, Firebase account and GrowthBook

This change is prepared code, not a production rollout. It uses the existing
Firebase project and phone verification; it creates no provider, Stripe product,
GrowthBook account, email list or cloud answer history.

## Functional contract

- The backend grants one successful normal AI answer to an anonymous Firebase
  UID, then three additional answers when that same UID becomes verified.
  Existing verified UIDs have the same total introductory allowance. No daily
  reset; browser counters are never authority. Anonymous means per UID/browser,
  not per human. Public catalog/guides remain public; the new gate covers the
  normal dynamic AI-answer service, including DE and EN direct API requests.
- A valid phone claim or verified email claim proves an account; merely having
  an anonymous Firebase UID, newsletter address or checkout email does not.
- The server uses Firestore transactions for reservations/completion. Only a
  validated standard answer consumes credit. Errors, off-topic and safety
  responses release reservations. Abandoned reservations expire after two
  minutes. An in-progress request returns 409 without another debit. If a completed
  answer was lost in transit, one replacement attempt per UID is allowed across
  instances; an original debit is reversed or a correction slot released. The
  next attempt uses a new operation ID. Further recovery claims are terminal
  with a support link, never an endless retry. No answer body is persisted.
- One correction can reference its own completed original request, including
  after quota exhaustion. Forged parents, concurrent corrections and correction
  chains are rejected. Failed corrections release the slot. No client boolean
  grants unlimited free correction access.
- Static safety runs before login, quota, optional GrowthBook initialization,
  normal-answer rate limits and payment entitlement. No supporter/paywall is
  appended to concern or urgent output. Saved helpful answers stay local/free.
- Existing and pending Stripe customer associations prevent automatic switching
  away from a paid guest UID on phone-number collisions. New phone linking
  preserves the UID. A collision with an existing purchase requires the existing
  support path rather than guessing how to merge accounts.
- `/v1/translator-web/access` previews allowance without enrolling a new visitor.
  Assignment is pinned atomically on first use. Consent changes refresh the
  notice; they do not reset an already-used allowance. No answer or text hash is
  written into `webTranslatorUsage`. Auth deletion removes the new record too.

## Configuration and ownership

This candidate sets `translatorGate.enabled: true` for the versioned
`signup-bonus-v1` contract. Do not publish it against API39. The matching reviewed
API, contract CORS support and intended `WEB_TRANSLATOR_USAGE_ENABLED=true`
configuration must be ready first. These switches are release controls, not
GrowthBook treatment values; a browser flag cannot grant answers or paid access.

`GET /access` and normal-answer requests carry
`X-Translator-Access-Contract: signup-bonus-v1`, including when auth initialization
fails. This header negotiates a capability; it is not authentication. Missing or
unknown contracts retain the bounded legacy API behavior and return
`enabled:false` for discovery. Consequently this is not a universal API paywall.
Do not silently drop the header to bypass a failed new-mode auth check.

Status discovery reads an existing Firebase session without creating one. The
server may return `enabled:true,needsSession:true` without inventing numerical
allowances or verification. The first Care use initializes the existing guest
auth flow. Trusted account verification preserves the UID and grants the
configured additional allowance: normally one guest answer plus three additional
answers, four total less prior use/reservations. It is not three new answers per
sign-in. The server migration raises only the registered allowance floor to
three, preserving higher allowances, usage, reservations and the guest basis.

Numerical signup offers require a confirmed compatible status, an unverified,
unpaid account, and an actual additional allowance of at least three. Higher
allowances are displayed honestly; a two-answer or unready status never advertises
three. Auth changes remove a stale credit promise without deleting an email draft.

The `functions.mjs` delta is a **separate wiring proposal for the payment owner**.
It lazily injects the usage service into the existing API and reads protected
checkout entitlements over HTTPS, without adding Stripe secrets to `api`.
Existing `webCustomers` association checks use Firebase Admin. The existing
auth-deletion trigger attempts both biography and allowance deletion. No live
function configuration was changed by this work.

Validate the existing email-link and Google providers, authorized domains and
guest-identity preservation before rollout. No SMS flow is enabled by this work.
Real sign-in, paid restore and production payments are not proven by simulated
browser checks.

## Signup copy feature

The copy-only String feature is `web-translator-signup-copy-v1`. Its allowed values
are `variant_1` (default, “Was sage ich jetzt am besten?”) and `variant_3`
(“Ein Satz zum Sagen. Ein Schritt zum Ausprobieren.”). Both use the same actual
bonus, placement and permissions. Remote HTML/text and quota changes are not
accepted. Unknown configuration and visitors without statistics consent receive
variant 1. The mixed quota/placement experiment below stays disabled.

The separate backend settings are:

```text
WEB_TRANSLATOR_SIGNUP_COPY_GROWTHBOOK_ENABLED=true
WEB_TRANSLATOR_SIGNUP_COPY_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
WEB_TRANSLATOR_SIGNUP_COPY_GROWTHBOOK_CLIENT_KEY=<authorized public SDK client key>
```

Only authenticated `GET /access` adds `signupCopy:{variant,exposure?}`. The client
keeps this metadata across Care access updates within the same session and
clears it on consent/session changes. A valid exposure matches the feature key,
current consented pseudonymous unit and index: 0 for variant 1, 1 for variant 3.

`web_signup_copy_shown` records an intersecting offer or explicit sign-in action,
not merely a status fetch. `web_signup_copy_verified` requires a completion marker
and backend-confirmed verified access. It attributes the copy previously shown,
not a new assignment returned after sign-in. It measures confirmed sign-in
completion, not proof that a globally new Firebase user was created. Both events
contain only experiment/variation/assignment/campaign metadata. The consented
local `demenzcoach.signupCopyExposure.v1` record expires with the existing
30-day browser unit and is cleared on revocation/rotation. No care text, email,
Firebase UID, proof or read token is added. Email and Google use the same measured
completion path without ordering a newsletter or purchasing membership.

GrowthBook provisioning and a draft rule do not prove a running experiment or
working analysis. Keep the published default at variant 1, with no live experiment
rules, until the reviewed release, datasource, exposure/verified-conversion metrics
and test activation have been checked separately.

## GrowthBook setup later

Pinned dependency: `@growthbook/growthbook` 1.6.3. Server SDK only, no auto-tracking
or URL-capture plugin. The API fetches feature definitions; browser identifiers
are evaluated locally by the SDK, never sent to its CDN. Optional settings:

```text
WEB_TRANSLATOR_GROWTHBOOK_ENABLED=true
WEB_TRANSLATOR_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
WEB_TRANSLATOR_GROWTHBOOK_CLIENT_KEY=sdk-<public-environment-client-key>
```

Feature: `web-translator-introduction-v1`, type JSON. Default:

```json
{
  "anonymousAnswers": 1,
  "registeredAdditional": 3,
  "signupPlacement": "after-first",
  "supporterPrompt": "off"
}
```

Allowed values: anonymous answers 1 or 2; additional registered answers 0–5;
signup placement `after-first` or `at-limit`; supporter prompt `off` or
`after-helpful`. Unknown fields are dropped. Experiments must use the same key
as the feature and hash attribute `id`. Alter one property at a time. Safety,
entitlements and functional rollout switches are outside the experiment.

Only visitors with statistics consent have a random 32-hex browser unit (30-day
maximum). Without consent, missing SDK, invalid values or failed feature fetch,
the fixed control applies. Feature definitions refresh at most once per minute.
Introductory policy stays pinned once first used, so dashboard changes cannot
reset or take away previously assigned credit. Future introduction experiments
enroll new usage records; existing records keep their policy. A later revision
must explicitly preserve consumed credit rather than reset the ledger.

No browser experiment ID is persisted in the backend ledger. It stores only
the experiment name/variation alongside functional policy. Exposures are emitted
only when the current consented assignment matches that pinned policy.

## Events and paid metrics

The existing consented statistics transport receives these allowlisted events:
`web_experiment_exposure`, `web_access_viewed`, `web_signup_shown`,
`web_signup_verified`, `web_answer_completed`, `web_paywall_shown`,
`web_checkout_clicked`, `web_supporter_shown`, `web_supporter_clicked`.
Properties are limited to the fixed experiment ID, numeric variation, random
assignment ID and generic campaign code. No entered text, answer, scenario key,
email, phone, Firebase UID or URL is added by this adapter. Exposure is
deduplicated within the current page. Answer/completion events are repeatable;
analysis must distinguish visitor conversion from event counts.

There is deliberately no `purchase` event fired from a redirect, supporter click
or browser subscription cache. Connecting GrowthBook to the correct consented
analytics datasource, joining its verified payment events and actual net
revenue/cost/refund cohorts remains later environment setup. Existing Teller
attribution remains intact and can take precedence in Stripe metadata; do not
interpret its arm as the GrowthBook variation. Do not declare LTV measured from
the event adapter alone. Compare visitors by entry cohort, with stated consent
gaps, and use backend-confirmed payment/cost data for contribution.

## Supporter and advertising entries

`/kommunikation/` and `/begleitung/` provide separate concrete-help and recurring
use entries, reusing `/de/`, `/start/`, Firebase and the existing checkout. Their
campaign codes are only `campaign_a` and `campaign_b`. First-touch source is
stored only with statistics consent; arbitrary query values are ignored.

The Debby appeal is implemented but hidden unless an actual reviewed one-time
product is configured: `supporter.enabled`, `reviewed`, `kind: "one-time"`, and
an approved same-origin `/unterstuetzen/…` URL. No such product or price was
invented or enabled. It appears only after helpful feedback on a standard AI
answer and a matching `after-helpful` experiment policy. It explicitly grants
no additional answers and never replaces the normal membership checkout.

Before enabling, complete the payment owner's reviewed function wiring, target
auth/entitlement checks, privacy review and ordinary release gate. Then connect
the correct GrowthBook environment/datasource. No advertising campaign was
launched by adding these pages.

References: [GrowthBook Node SDK](https://docs.growthbook.io/lib/node),
[Firebase phone authentication](https://firebase.google.com/docs/auth/web/phone-auth).

Access-status requests use a separate bounded 30/10-minute IP budget. Answer
requests keep the existing default 6/10-minute budget; rejected auth/quota
checks do not consume model-request or daily provider budgets. Auth-context
lookup is bounded to 1.5 seconds so a stalled Firebase SDK cannot delay the
server safety path indefinitely. Request and correction IDs survive retries of
the same operation. The pending-question timestamp limits reuse to 15 minutes,
not physical storage lifetime; it is removed on read or browser-session end.

Experiment IDs are usable for30days; physical localStorage removal is lazy on
next access or consent withdrawal, and users can delete website data. This is
explicitly distinguished from a guaranteed timed deletion in both privacy pages.
