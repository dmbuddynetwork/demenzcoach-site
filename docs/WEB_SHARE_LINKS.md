# Answer links on the website (frontend)

Status 17 Nov 2026: built and tested offline (`node scripts/test-share-links.cjs`, mocked backend). **Off by default.**
Switched on 17 Nov 2026 (`snapshotLinks.enabled: true`, mode `auto`) after the permanent-retention backend deploy (c0624ed) and a live create, open and delete test.

Backend contract and limits: `docs/WEB_SNAPSHOT_LINKS.md` in the app repo (dmbuddynetwork/dementia).

## Decision 17 Nov 2026 (Daniel): permanent, shared by copying the address bar

Links are stored permanently (no expiry). As soon as an answer is generated, its link appears in the address bar (`<page>#r=<readToken>`). Sharing works by copying the address bar. `snapshotLinks.mode` is `auto` (default, no question, a short notice under the answer says it is stored permanently and offers "Link löschen") or `ask` (one question per situation first). The address is cleared the moment a new situation or goal is chosen, so it never points at another answer. Opening a copied address on any translator page redirects to the read-only page with the same fragment.

Privacy: `auto` stores every generated answer together with the situation text. This changes what `datenschutz.html` and the FAQ ("Wird meine Eingabe gespeichert?") promise today. Do not switch on before the privacy text and the lawyer questions are settled.

## What the person sees (mode `ask`; `auto` skips steps 1 and 2)

1. After an answer for a chosen goal, the button "Antwort als Link teilen" appears (DE) or "Share this answer as a link" (EN).
2. First use per situation: a short notice (stored permanently on our server, anyone with the link can read it, deletable here, copies cannot be recalled) and "Link erstellen". Nothing is stored before this click. Later states of the same situation do not ask again.
3. The link is `/de/geteilt.html#r=<readToken>` or `/en/shared.html#r=<readToken>`. The token is in the fragment, so it never reaches a server log or referrer. The situation text is never in the URL.
4. The reader page (`snapshot-view.js`) shows situation, goal, answer, stored safety notes and, if there is one, the expiry date. All text is inserted as text. No analytics, no cookies, `noindex`, `no-store`, `no-referrer`.
5. The creator sees "Link löschen" on the shared link's own page and next to the created link. The delete token stays only in this browser (`localStorage` key `demenzcoach.sharedLinks.v1`).

## How the proof chain works

`translator-ai.js` sends the previous proof in `X-Translator-Snapshot-Context` and reports the new `X-Translator-Snapshot-Proof` to the caller. `translator.js` keeps the chain in memory per situation. If the shown answer is older than the newest chain state (A, then B, then A from cache), `compose` merges them before `create`, so earlier safety notes stay in the shared record. The flag off means no extra header is sent and nothing changes.

## Before switching on

- Backend: permanent retention mode and raised capacity (see the app repo PR), Firestore TTL ACTIVE on `translator_private_snapshot_quotas_v1.expiresAt` (counters only).
- `WEB_TRANSLATOR_SNAPSHOT_CREATE_ENABLED=true` and a functions deploy (Daniel's "Deploy <sha> ok").
- Privacy text: add the stored answer links (30 days, token, deletion) to `datenschutz.html`. Not changed by this work.
- Real check on the live site with a @netsetter.de test address: create, open in a fresh browser, delete, open again (must say expired).
