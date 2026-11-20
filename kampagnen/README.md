# Kampagnen-Framework (Anzeigen + Landingpages)

Daniel, 20. Nov 2026: Landingpages und Anzeigen sollen je Kampagne mit passendem Text flexibel gefüllt, verwaltet und gezählt werden.

```
kampagnen.json  ──►  scripts/build-campaigns.mjs  ──►  data.js  ──►  /start/?k=<kampagne>&a=<anzeige>
   (Quelle)            (prüft mit regeln.js)          (öffentlich)        (Landingpage + Tracking)
        ▲
        └── /intern/kampagnen/  (Verwaltung: bearbeiten, Vorschau, Links, CSV)
```

## Ablauf für eine neue Kampagne
1. `/intern/kampagnen/` öffnen, „+ Neue Kampagne“. Überschrift, Frage, Moment und Anzeigen eintragen. Die Vorschau zeigt die Seite sofort, die Prüfung meldet Regelverstöße.
2. „kampagnen.json herunterladen“ und die Datei in `kampagnen/` ersetzen.
3. `node scripts/build-campaigns.mjs` (prüft und erzeugt `data.js`), dann Pull Request. Der Merge schaltet live.
4. Status `aktiv` schaltet die Landingpage frei. `entwurf` ist nur mit `&vorschau=1` sichtbar, `pausiert` gar nicht.
5. Die Tracking-Links je Anzeige stehen in der Verwaltung (Kanal, Kampagne und Anzeige als feste Kennungen).

## Was eine Kampagne steuert
`landing.ueberschrift`, `landing.unterzeile` (leer = weniger ist mehr), `landing.frage`, `landing.moment` (`nachhause`, `wiederholt`, `mutter`, `wer`, `geld`, `arbeit`, `waschen`: belegt die Situation vor und überspringt die Frage), `landing.grossbuchstaben`. Ohne Kampagne bleibt der Standard aus `standard` in der Datei.

## Tracking
Jedes Ereignis in `/start/` trägt `entry` (Quelle), `kampagne` und `anzeige` (nur mit Einwilligung, keine Antworten, keine Personendaten). Der Kauf läuft mit `utm_campaign=<kampagne>` in die Kasse. In GA4 müssen `kampagne` und `anzeige` einmal als benutzerdefinierte Ereignisparameter angelegt werden (Admin, Benutzerdefinierte Definitionen).

## Regeln (`regeln.js`, gelten in der Verwaltung und im Build)
Nichtmedizinisch (keine Diagnose, Therapie, Medikamente, Wirkversprechen). Keine erfundenen Belege (Prozent, Millionen, Nutzerzahlen, Sterne, Testsieger) und keine falsche Dringlichkeit („nur heute“). Längen: Überschrift 70, Zeile 90, Frage 60, Anzeigentext 200, Titel 40, Beschreibung 40, Knopf 25 Zeichen.
