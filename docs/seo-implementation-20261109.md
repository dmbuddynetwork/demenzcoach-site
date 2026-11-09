# Gemeinsamer Website-Stand: Sprachpfade, Startseite und SEO

Auftrag: Daniels zehn SEO-Maßnahmen vollständig umsetzen; zusätzlich im bestehenden Startseiten-Task ausdrücklich gewählter Entwurf 2. Keine Veröffentlichung ohne `Site <sha> ok`.

| Punkt | Ergebnis |
| --- | --- |
| 1 | Werkzeugzustände verwenden feste `situation`/`ziel`-Schlüssel auf der tatsächlich geöffneten Werkzeugseite. Kein Eingabetext wird in die URL übernommen. Bestehende Fragmentlinks bleiben gültig; Reload/Zurück/Sicherheitsantworten sind regressionsgeprüft. |
| 2 | Deutsche und englische Situationskarten sind echte Inhaltslinks; normales Antippen bedient weiterhin das Werkzeug, neue Tabs und JavaScript-freie Aufrufe öffnen den jeweiligen Inhalt. |
| 3 | 33 Sprachpfade, deterministische Weiterleitungen und zugehörige SEO-Verweise aus dem bestehenden Sprachpfad-Task integriert. |
| 4 | Vorhandene neue URL-Präfix-Property im Unternehmenskonto ist angelegt. Der öffentliche Google-Nachweis ist auf der deutschen Ziel-Startseite eingebaut. Die tatsächliche Bestätigung, Sitemap-Einreichung und Datensicht werden nach der genehmigten Veröffentlichung im Anbieter geprüft. Noch kein Sucherfolg oder Ausgangswert behauptet. |
| 5 | Gewählter Startseitenentwurf enthält den kurzen Nutzensatz bei unveränderter H1 sowie das sichtbar beschriftete Formular vor sechs kompakten Situationen. |
| 6 | Mutter-Situationsseite bietet kurze Antworten; der eigenständige Ratgeber ordnet Gespräche über verstorbene Angehörige ein. Beide bleiben selbstkanonisch und gegenseitig verlinkt. Keine unbewiesene Ranking-Konkurrenz behauptet. |
| 7 | Alle acht deutschen Ratgeber bieten nach ihren Sicherheitshinweisen einen passenden Werkzeug-/Situationslink vor dem App-Angebot. |
| 8 | Bestätigte Anbieterin Deborah Frey mit Impressumsverweis und nachvollziehbare Quellen. Daniels direkte Auswahl: „Nur Anbieterin und Quellen nennen“. Keine erfundene Qualifikation, Erfahrung oder medizinische Fachprüfung. |
| 9 | Neun Themen der Tippsammlung erhalten konkrete Primärquellen. Sicherheitsrelevante Hinweise wurden zuerst präzisiert: Einverständnis, freie Fluchtwege, keine Person allein einschließen, individuelle Vorgaben bei Schluckproblemen. Website-Anpassungen liegen separat von der unveränderten App-Quellliste. Quellenorganisationen sind nicht beteiligt. |
| 10 | Eigenständige Themenseite `/alltagstricks/essen-trinken.html` mit Auswahlhilfe, sechs kuratierten Tipps, Quellen, Grenzen, eigenen Metadaten, sichtbarem Brotkrumenpfad und Sitemap-Eintrag. Themenwahl aufgrund vorhandener Inhalte; Suchvolumen unbekannt. |

## Quellen und Pflege

`scripts/build-alltagstricks.mjs` baut Sammlung und Themenseite deterministisch aus `alltagstricks/tricks.json` und `alltagstricks/sources.json`. Die Quellenangaben sind thematische Weiterleselinks, keine behaupteten Studiennachweise für jeden einzelnen Vorschlag. Der Quellenstand ist 09.11.2026. Die elf direkten Primärquellen waren bei Prüfung erreichbar. Den historischen `refresh-localized-pages.mjs` nicht ausführen.

## Fokussierte Prüfungen

- `node --test scripts/test-worker-routing.mjs scripts/test-seo-content.mjs`
- `node scripts/validate-seo.mjs .`
- `node scripts/validate-situation-guides.mjs`
- `node scripts/validate-translator-routing.cjs` gegen lokalen Server, mit `PLAYWRIGHT_MODULE` und `CHROME_PATH` bei Bedarf
- `node scripts/validate-language-routing.cjs` gegen echten lokalen Cloudflare-Worker
- `node scripts/validate-mobile.cjs` mit den betroffenen Seiten als Argumenten
- `git diff --check`

## Nach Site-Freigabe

1. Genau den freigegebenen gemeinsamen Stand veröffentlichen und dessen Live-Erreichbarkeit prüfen.
2. In Search Console unter `d.m@viralgrowthventures.com` die vorhandene Property `https://dementiacoachapp.com/` per HTML-Tag bestätigen; keine weitere Property erstellen.
3. `https://dementiacoachapp.com/sitemap.xml` einreichen und Anbieterantwort/Indexierungsstand tatsächlich lesen. Daten können erst später vorliegen.
4. Keine DNS-, Rollen-, Credential- oder zusätzlichen Trackingänderungen aus diesem Auftrag ableiten.

## Zusätzliche direkte Nutzeraufträge im gemeinsamen Endstand

- Die zuletzt gewünschte Reihenfolge lautet Intro → Eingabefeld/Antwortknopf → Situationen. Die frühere Situationen-zuerst-Ansicht ist überholt.
- Gewählte Funnel-Ideen 1+2: eine freiwillige neutrale Plan-Einladung nach vollständiger kostenloser Antwort; sieben passende Ratgeber erhalten einen kontextuellen Plan-Einstieg nach ihrer Hilfe. Der Selbstfürsorge-Ratgeber erhält keine Verkaufs-Einladung. Share-Konzept 3 ist nicht umgesetzt. Die vorhandenen kostenlosen Antworten, Ratgeber-/Werkzeuglinks und Sicherheitshinweise bleiben erhalten.
- Zum gemeldeten Eis-Chatfall: exakte Eingabe und Schreibvariante lokal ohne Safety-Treffer, tatsächlicher Live-Backend-Ausgang wegen 403 nicht belegt. Der synthetisch nachgestellte `kind:safety`-UI-Pfad bietet nun eine neutrale Präzisierungsfrage nach unverändertem Safety-Text. Bereits neu geschriebener Text wird nicht überschrieben; nur ein leeres Feld erhält den ursprünglichen Satz zurück. In genau diesem Klärungszustand sind Plan-Einladung und der E-Mail-Vorschlagslink mit der ursprünglichen Eingabe entfernt. Keine Klassifikations-, Backend- oder allgemeine Kontaktänderung.
- Bestehende statische Marketingbanner versprachen „7 Tage kostenlos testen“. Belegt sind nur Client-Fallbacks (`trialDays ?? 7`), kein aktuelles Server-/Stripe-Angebot. Die Marketingzeile ist deshalb neutral formuliert. Tatsächlicher Checkout, Preise, Verträge, Free-Beta-Schalter und Angebotskonfiguration sind unverändert; das ist keine allgemeine Kaufprüfung.
- Unabhängige Read-only-Abgleiche: SEO-Teilstand 07c5800 und Funnel-/Safety-Delta 340855e ohne offene Blocker in ihren begrenzten Prüfpunkten. Keine medizinische Freigabe oder Behebung einer unbewiesenen Live-Backend-Ursache behauptet.

Zusätzliche fokussierte Browserprüfungen: `scripts/validate-funnel-entries.cjs` (vollständige Antworten, Kontextlinks, Consent und erste Frage) sowie `scripts/validate-translator-chat.cjs` (synthetischer problematischer Servicepfad, Hauptfeld/Chat, Bearbeiten, Safety-Text und Ergebnislinks).

Bekannte geerbte Grenze: Im Safety-/Hinweiszustand kann 320px bei 225% Text auf 385px verbreitert werden. Die neue Einladung passt und vergrößert diesen Basiswert nicht. Die fünf im SEO-Auftrag betroffenen statischen Einstiege bestehen den 225%-Check.
