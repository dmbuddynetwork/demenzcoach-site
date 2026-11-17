# Answer links on the website (frontend)

Status 17 Nov 2026: built and tested offline (`node scripts/test-share-links.cjs`, mocked backend). **Off by default.**
Turn on only after the backend steps below, by setting `snapshotLinks.enabled` to `true` in `abo/abo-config.js`.

Backend contract and limits: `docs/WEB_SNAPSHOT_LINKS.md` in the app repo (dmbuddynetwork/dementia).

## What the person sees

1. After an answer for a chosen goal, the button "Antwort als Link teilen" appears (DE) or "Share this answer as a link" (EN).
2. First use per situation: a short notice (30 days stored on our server, anyone with the link can read it, deletable here, copies cannot be recalled) and "Link erstellen". Nothing is stored before this click. Later states of the same situation do not ask again.
3. The link is `/de/geteilt.html#r=<readToken>` or `/en/shared.html#r=<readToken>`. The token is in the fragment, so it never reaches a server log or referrer. The situation text is never in the URL.
4. The reader page (`snapshot-view.js`) shows situation, goal, answer, stored safety notes and the expiry date. All text is inserted as text. No analytics, no cookies, `noindex`, `no-store`, `no-referrer`.
5. The creator sees "Link löschen" on the shared link's own page and next to the created link. The delete token stays only in this browser (`localStorage` key `demenzcoach.sharedLinks.v1`).

## How the proof chain works

`translator-ai.js` sends the previous proof in `X-Translator-Snapshot-Context` and reports the new `X-Translator-Snapshot-Proof` to the caller. `translator.js` keeps the chain in memory per situation. If the shown answer is older than the newest chain state (A, then B, then A from cache), `compose` merges them before `create`, so earlier safety notes stay in the shared record. The flag off means no extra header is sent and nothing changes.

## Before switching on

- Firestore TTL policies ACTIVE on `translator_private_snapshots_v1.expiresAt` and `translator_private_snapshot_quotas_v1.expiresAt`.
- `WEB_TRANSLATOR_SNAPSHOT_CREATE_ENABLED=true` and a functions deploy (Daniel's "Deploy <sha> ok").
- Privacy text: add the stored answer links (30 days, token, deletion) to `datenschutz.html`. Not changed by this work.
- Real check on the live site with a @netsetter.de test address: create, open in a fresh browser, delete, open again (must say expired).
