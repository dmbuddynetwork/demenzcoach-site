# Web email authentication (SMS removal follow-up)

Prepared locally; not deployed. This delta follows the frozen SMS/LTV packet without modifying it. Web signup, existing-account entry and post-purchase account protection use Firebase passwordless email links. Native iOS phone accounts and the Firebase phone provider are preserved. Apple remains configured as before; Google is not enabled.

## Required production preflight

- Enable Firebase Authentication Email/Password provider and its Email link (passwordless sign-in) option. Current read-only project metadata does NOT establish that these options are enabled: email.enabled/passwordRequired were not reported.
- Existing authorized domains include dementiacoachapp.com, www.dementiacoachapp.com and the project's firebaseapp.com/web.app domains. Serve `/abo/email-link.html` and `/abo/konto.html` over HTTPS with no-store/no-referrer headers. The callback bootstrap strips the action query before styles, SDKs or onward navigation. Keep action queries out of hosting/CDN request logs and error reporting. No analytics/marketing scripts belong on either auth page.
- Verify project billing, sender/template and actual delivery. Firebase's current email-link send limits are Spark 5/day and Blaze 25,000/day; link-generation quotas are separate. A billing instrument is required above five sends/day. No real email was sent for these tests.
- Deploy the separate minimal backend account-status proposal against the already integrated owner29 source, independent of AI metering and the new-sales pause flag. The global WEB_CHECKOUT_ENABLED service export remains unchanged; a completely unavailable account-status service blocks identity switching. It uses the authoritative Firestore reader for legacy and target account namespaces. Missing/malformed/failed reads must remain unknown, never false.
- Only then set public `signIn.emailLink` true. Translator usage, GrowthBook and supporter activation remain separately controlled. No provider/domain or billing setting was changed by this implementation.

## Identity and local data

A link request keeps only the email, random nonce, current UID, intended action and allowlisted return target in functional localStorage. The request is cleared after success or discarded on the next account visit after 30 minutes. Action codes remain only in callback memory and are never copied to storage, telemetry, errors or onward URLs. Checkout references remain only in the originating browser's local return target, not in the emailed continuation URL.

Same-browser linking uses the original authenticated UID and native Firebase linkWithCredential. A different browser asks for the email again; it cannot transfer the original guest's purchases. Existing-account collisions never auto-merge. An anonymous UID can switch only after an authenticated authoritative false purchase-binding result; true or unknown sends the user to account recovery/support. Existing phone identities can add an email on the original UID.

No newsletter is subscribed, no care text/history is uploaded, and helpful answers remain local. A consented neutral signup event may be queued in sessionStorage for the returning app page; the auth callback itself has no analytics.

## Primary documentation

- https://firebase.google.com/docs/auth/web/email-link-auth
- https://firebase.google.com/docs/auth/limits
- https://firebase.google.com/docs/auth/admin/email-action-links
- https://firebase.google.com/docs/auth/email-custom-domain
