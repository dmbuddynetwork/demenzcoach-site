# Kampagnen-Framework (Anzeigen + Landingpages)

Daniel, 20. Nov 2026: Landingpages und Anzeigen sollen je Kampagne mit passendem Text flexibel gefüllt, verwaltet und gezählt werden.

```
intern/kampagnen/kampagnen.json ──►  scripts/build-campaigns.mjs  ──►  data.js  ──►  /start/?k=<kampagne>&a=<anzeige>
   (Quelle)            (prüft mit regeln.js)          (öffentlich)        (Landingpage + Tracking)
        ▲
        └── /intern/kampagnen/  (Verwaltung: bearbeiten, Vorschau, Links, CSV)
```

## Ablauf für eine neue Kampagne
1. `/intern/kampagnen/` öffnen, „+ Neue Kampagne“. Überschrift, Frage, Moment und Anzeigen eintragen. Die Vorschau zeigt die Seite sofort, die Prüfung meldet Regelverstöße.
2. „kampagnen.json herunterladen“ und die Datei in `intern/kampagnen/` ersetzen.
3. `node scripts/build-campaigns.mjs` (prüft und erzeugt `data.js`), dann Pull Request. Der Merge schaltet live.
4. Status `aktiv` schaltet die Landingpage frei. `entwurf` und `pausiert` sind nie öffentlich (nicht in `data.js`); Entwürfe sieht man nur in der Vorschau der Verwaltung.
5. Die Tracking-Links je Anzeige stehen in der Verwaltung (Kanal, Kampagne und Anzeige als feste Kennungen).

## Was eine Kampagne steuert
`landing.ueberschrift`, `landing.unterzeile` (leer = weniger ist mehr), `landing.frage`, `landing.moment` (`nachhause`, `wiederholt`, `mutter`, `wer`, `geld`, `arbeit`, `waschen`: belegt die Situation vor und überspringt die Frage), `landing.grossbuchstaben`. Ohne Kampagne bleibt der Standard aus `standard` in der Datei.

## Tracking
Jedes Ereignis in `/start/` trägt `entry` (Quelle), `kampagne` und `anzeige` (nur mit Einwilligung, keine Antworten, keine Personendaten). Der Kauf läuft mit `utm_campaign=<kampagne>` in die Kasse. In GA4 müssen `kampagne` und `anzeige` einmal als benutzerdefinierte Ereignisparameter angelegt werden (Admin, Benutzerdefinierte Definitionen).

## Regeln (`regeln.js`, gelten in der Verwaltung und im Build)
Nichtmedizinisch (keine Diagnose, Therapie, Medikamente, Wirkversprechen). Keine erfundenen Belege (Prozent, Millionen, Nutzerzahlen, Sterne, Testsieger) und keine falsche Dringlichkeit („nur heute“). Längen: Überschrift 70, Zeile 90, Frage 60, Anzeigentext 200, Titel 40, Beschreibung 40, Knopf 25 Zeichen.

## Schutz (Daniel, 20. Nov 2026: alle Admin-Sachen geschützt)
Alles unter `/intern/` (Verwaltung und `kampagnen.json` mit Notizen, Zielgruppen und Entwürfen) verlangt ein Passwort. Das prüft der Worker (`internGate` in `cloudflare-worker.js`), bevor eine Datei ausgeliefert wird. Das Passwort steht als Secret `INTERN_PASSWORD` im Cloudflare-Worker `dementiacoachapp` (Settings, Variables and Secrets), mindestens 16 Zeichen, nie im Repo. Benutzername `team` (oder Secret `INTERN_USER`). Fehlt das Secret, bleibt die Verwaltung gesperrt (503). Frei ist nur die Geräte-Markierung `/intern/` (speichert nur ein Merkzeichen im eigenen Browser). Öffentlich sind außerdem `regeln.js` (nur Regeln) und `data.js` (nur aktive Kampagnen).

## Auswertung in GA4 (ohne eigene Dimension)

Die GA4-Property hat das Limit von 50 Dimensionen auf Ereignisebene erreicht. Darum läuft die Auswertung über eingebaute Dimensionen:

- Kampagne = **Sitzungskampagne** (`utm_campaign`)
- Anzeige = **Sitzungs-Anzeigeninhalt** (`utm_content`)
- Kanal = **Sitzungsquelle / -medium** (`utm_source`, `utm_medium`)

Die Tracking-Links der Verwaltung tragen alle vier Werte. Ein Link nur mit `?k=…&a=…` bekommt sie von `start/kampagne-utm.js` ergänzt, bevor GA lädt (nicht in der Vorschau). Neue Kampagnen brauchen deshalb keine Einrichtung in GA4. Bericht: Berichte → Akquisition → Zugriffsquelle, Dimension „Sitzungskampagne“; Ereignisse (Quiz-Start, E-Mail, Kauf) per Exploration mit derselben Dimension.
