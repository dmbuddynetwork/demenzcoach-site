# Reel-Links: jedes Reel auf die Verkaufs-Startseite

Stand: 28. Nov 2026. Auftrag: Daniel, Lehre A der Diagnose („jedes Reel verlinkt `/de/` mit eigener Quelle“).

```
Reel ─► dementiacoachapp.com/fb/<reel> ─► /de/?src=fbreel&utm_source=facebook&utm_medium=reel&utm_campaign=reels&utm_content=<reel>
          (Worker, 302, sofort)                │
                                               ▼
                         erste Antwort ohne Anmeldung ─► Preis ─► Kasse (Stripe: source home_fbreel, ad <reel>)
```

## Links

| Plattform | Link im Reel | Quelle (`src`) | `utm_source` |
| --- | --- | --- | --- |
| Facebook | `dementiacoachapp.com/fb/<reel>` | `fbreel` | `facebook` |
| Instagram | `dementiacoachapp.com/ig/<reel>` | `igreel` | `instagram` |
| TikTok | `dementiacoachapp.com/tt/<reel>` | `ttreel` | `tiktok` |
| YouTube Shorts | `dementiacoachapp.com/yt/<reel>` | `ytreel` | `youtube` |
| Link in der Bio | `dementiacoachapp.com/fb` (ohne Namen) | wie oben | Reel-Name `bio` |

Regeln für `<reel>`:

- Kurz, klein, ohne Leerzeichen: `a-z`, `0-9`, `-`. Beispiele: `mama-nach-hause`, `teller`, `r12`.
- Alles andere wird entfernt (`Teller_Trick` → `tellertrick`). Höchstens 40 Zeichen.
- Ein Name je Reel. Denselben Reel auf Facebook und Instagram mit demselben Namen verlinken, nur die Plattform wechselt.
- Kein neuer Code nötig. Jeder neue Name funktioniert sofort.

## Wo der Link steht

1. **Erster Kommentar** unter dem Reel (anheften): „Hier tippen und deine Situation eintragen: dementiacoachapp.com/fb/<reel>“.
2. **Beschreibung** (Caption), erste Zeile: derselbe Link.
3. **Bio**: `dementiacoachapp.com/fb` bzw. `/ig`, `/tt`.
4. **Endkarte** (letzte 2 Sekunden): „dementiacoachapp.com/fb“ groß ins Bild, dazu „Link im Kommentar“. Kurzer Pfad, weil Leute ihn abtippen.

Der Link führt auf die Verkaufs-Startseite. Oben steht nur das Eingabefeld. Die erste Antwort kommt ohne Anmeldung. Preis und Kauf kommen erst weiter unten.

## Messung

| Was | Wo | Mit Einwilligung? |
| --- | --- | --- |
| Besuche, Fragen, Preis gesehen, Kaufknopf, Kasse, Apple Pay (alle Reels zusammen) | Firestore `quizStepCounts`, Schritte `reel_view`, `reel_ask`, `reel_price`, `reel_cta`, `reel_kasse`, `reel_applepay`, `reel_applepay_ok` | Nein, nur Summen je Tag. Wirkt erst nach dem nächsten Functions-Deploy (`api`). |
| Dieselben Schritte für alle anderen Besucher von `/de/` | `home_*` | Nein |
| Sitzungen und Ereignisse je Reel | GA4: Sitzungsquelle/-medium `facebook / reel`, Sitzungskampagne `reels`, Sitzungs-Anzeigeninhalt = Reel | Ja |
| Käufe je Reel | Stripe: `metadata.source = home_fbreel`, `metadata.campaign = reels`, `metadata.ad = <reel>` | Nein (Vertragsdaten) |

Technik:

- `cloudflare-worker.js` → `reelTarget()` baut die Weiterleitung. Tests: `node --test scripts/test-worker-routing.mjs`.
- `de/index.html` und `en/index.html` (`<head>`): merken `data-home-ad` und `data-home-utm` beim Laden. Der Übersetzer leert die Adresse beim Laden und nach der Antwort; ohne diese Werte ging das Reel verloren.
- `abo/kasse.js` → `measureFields()`: nimmt `data-home-ad`, wenn die Adresse leer ist.
- `lovable-home.js` → `landingCampaign()`: gibt GA4 `campaign_source/medium/name/content` aus `data-home-utm`.
- `de/verkauf.js`: Zähler-Weg `reel` (Quelle endet auf `reel`) oder `home`.
- E2E: `dementia/backend/e2e-web-kasse-startseite.mjs` Fälle 5–7.
