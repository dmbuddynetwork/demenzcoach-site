# Gemeinsamer Website-Stand: Sprachpfade, Startseite und SEO

Auftrag: Daniels zehn SEO-Maßnahmen vollständig umsetzen; zusätzlich die jeweils zuletzt im bestehenden Startseiten-Task gewählte Fassung. Daniels spätere Auswahl der reduzierten Variante 1 ersetzt den früheren Entwurf 2. Keine Veröffentlichung ohne `Site <sha> ok`.

| Punkt | Ergebnis |
| --- | --- |
| 1 | Werkzeugzustände verwenden feste `situation`/`ziel`-Schlüssel auf der tatsächlich geöffneten Werkzeugseite. Kein Eingabetext wird in die URL übernommen. Bestehende Fragmentlinks bleiben gültig; Reload/Zurück/Sicherheitsantworten sind regressionsgeprüft. |
| 2 | Deutsche und englische Situationskarten sind echte Inhaltslinks; normales Antippen bedient weiterhin das Werkzeug, neue Tabs und JavaScript-freie Aufrufe öffnen den jeweiligen Inhalt. |
| 3 | 33 Sprachpfade, deterministische Weiterleitungen und zugehörige SEO-Verweise aus dem bestehenden Sprachpfad-Task integriert. |
| 4 | Vorhandene neue URL-Präfix-Property im Unternehmenskonto ist angelegt. Der öffentliche Google-Nachweis ist auf der deutschen Ziel-Startseite eingebaut. Die tatsächliche Bestätigung, Sitemap-Einreichung und Datensicht werden nach der genehmigten Veröffentlichung im Anbieter geprüft. Noch kein Sucherfolg oder Ausgangswert behauptet. |
| 5 | Zuletzt gewählte reduzierte Startseite: eine Hauptfrage, direkt Eingabe/Beispiel/Antwortknopf, danach sechs kompakte Situationen. Doppelte Einleitung, Formularüberschrift und Hilfszeile entfernt; echte zugeordnete Beschriftung bleibt für Vorlesefunktionen vorhanden. Rechtsnote unverändert. |
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

- Die zuletzt gewünschte Reihenfolge lautet eine Hauptfrage → Eingabefeld/Antwortknopf → Situationen. Die frühere Situationen-zuerst-Ansicht ist überholt.
- Gewählte Funnel-Ideen 1+2: eine freiwillige neutrale Plan-Einladung nach vollständiger kostenloser Antwort; sieben passende Ratgeber erhalten einen kontextuellen Plan-Einstieg nach ihrer Hilfe. Der Selbstfürsorge-Ratgeber erhält keine Verkaufs-Einladung. Share-Konzept 3 ist nicht umgesetzt. Die vorhandenen kostenlosen Antworten, Ratgeber-/Werkzeuglinks und Sicherheitshinweise bleiben erhalten.
- Zum gemeldeten Eis-Chatfall: exakte Eingabe und Schreibvariante lokal ohne Safety-Treffer, tatsächlicher Live-Backend-Ausgang wegen 403 nicht belegt. Der synthetisch nachgestellte `kind:safety`-UI-Pfad bietet nun eine neutrale Präzisierungsfrage nach unverändertem Safety-Text. Bereits neu geschriebener Text wird nicht überschrieben; nur ein leeres Feld erhält den ursprünglichen Satz zurück. In genau diesem Klärungszustand sind Plan-Einladung und der E-Mail-Vorschlagslink mit der ursprünglichen Eingabe entfernt. Keine Klassifikations-, Backend- oder allgemeine Kontaktänderung.
- Bestehende statische Marketingbanner versprachen „7 Tage kostenlos testen“. Zum Zeitpunkt dieser Marketingprüfung lagen nur Client-Fallbacks (`trialDays ?? 7`) als Beleg vor. Die Marketingzeile wurde deshalb neutral formuliert; die spätere Beobachtung des aktuellen Kassenangebots ändert keine Vertrags- oder Preiseinstellung. Tatsächlicher Checkout, Preise, Verträge, Free-Beta-Schalter und Angebotskonfiguration sind unverändert; das ist keine allgemeine Kaufprüfung.
- Unabhängige Read-only-Abgleiche: SEO-Teilstand 07c5800 und Funnel-/Safety-Delta 340855e ohne offene Blocker in ihren begrenzten Prüfpunkten. Keine medizinische Freigabe oder Behebung einer unbewiesenen Live-Backend-Ursache behauptet.

Zusätzliche fokussierte Browserprüfungen: `scripts/validate-funnel-entries.cjs` (vollständige Antworten, Kontextlinks, Consent und erste Frage) sowie `scripts/validate-translator-chat.cjs` (synthetischer problematischer Servicepfad, Hauptfeld/Chat, Bearbeiten, Safety-Text und Ergebnislinks).

Bekannte geerbte Grenze: Im Safety-/Hinweiszustand kann 320px bei 225% Text auf 385px verbreitert werden. Die neue Einladung passt und vergrößert diesen Basiswert nicht. Die fünf im SEO-Auftrag betroffenen statischen Einstiege bestehen den 225%-Check.

Clean-Homepage72c33e4 wurde nach Writerstopp unabhängig eng geprüft: eindeutiger zugänglicher Feldname, echte sr-only-Beschriftung, gültige Beschreibungsziele, Tastatur/Fokus/Leerfehler, Antwort/Weiterschreiben/Reload und320px bei225% Text ohne Horizontalüberlauf. Keine umfassende Vorlesefunktions- oder Barrierefreiheitszertifizierung.

Bestehender Statistikzugang rein lesend im Firmenkonto bestätigt: Google-Analytics-Konto401069243, Property545531012, Webstream15256467817. Mess-ID `G-5NRN1EMJDC` stimmt exakt mit der Website überein; laut Anbieter war Erhebung in den vergangenen48Stunden aktiv. Es wurde keine neue Property angelegt und keine Einstellung verändert. Das belegt noch keine Messung des unveröffentlichten Teller-Vergleichs.

## Zusätzlich integrierter Teller-Einstieg

`/teller` verteilt neue Aufrufe zufällig etwa zur Hälfte auf die Website und den bestehenden Fragebogen. Die Weiterleitung ist vorübergehend und nicht cachebar; freie Eingabeparameter werden nicht weitergereicht. Erst nach Statistik-Zustimmung bleibt die feste Variante bis zu 30 Tage gespeichert. Ohne Zustimmung gibt es keine dauerhafte Experimentzuordnung und keine Experimentmetadaten an der Kasse. Widerruf und externe Löschung der Zustimmung stoppen auch bereits geladenes Analytics.

`docs/teller-measurement.md` beschreibt die begrenzte Messstichprobe; `docs/teller-purchases.sql` zählt nur positiv bezahlte Rechnungen mit erfolgreicher Zahlung, getrennt von Erstattungen. Ausstehende SEPA-Zahlungen, Probezeiten und Klicks sind keine bezahlten Käufe. Beide Arme hatten vor Ausspielung erwartungsgemäß noch keine Anbieterbelege; keine Kaufquote berechnet. Eine konkrete gemeinsame Site-Freigabe muss diese 30-Tage-Zuordnung mit umfassen.

Nach Integration von92f5541 und72c33e4 bestanden auf0d29cea erneut25 kombinierte Node-Tests, SEO299/147/147 sowie der vollständige synthetische Teller-Browsercheck einschließlich beider Varianten, beider Kassenanfragen, mehrerer Tabs und Consent-/GA-Löschung. Keine reale Anmeldung oder Zahlung.

## Zahlungsrückkehr im gemeinsamen Site-Kandidaten

Die Erfolgsadresse allein bestätigt weder Zahlung noch Zugang. Die Seite fragt den geschützten Status mit dem bestehenden Kontotoken ab und unterscheidet bezahltes Abo, Probezeit, Rechnung ohne fällige Zahlung, ausstehenden Einzug, notwendige zusätzliche Bestätigung und fehlgeschlagene/unbestätigte Prüfung. Plan-/App-Links erscheinen nur bei bestätigtem Zugang. Aus der Rückkehr-URL wird kein Kaufereignis erzeugt. Die Teller-Attribution bleibt erhalten.

Der ergänzende Checkout-Backendstand wird getrennt geprüft und benötigt die gemeinsame Functions-Freigabe; der Site-Commit alleine stellt diesen Endpunkt nicht bereit. Ein unabhängiger synthetischer Browsercheck auf f0f1fec bestand19 DOM-Fälle auf1280/320px einschließlich pending→paid, Owner-Token, altem Schema, Fehlern und Sichtbarkeit der Links. Keine echte Zahlung oder Freischaltung wurde durchgeführt.

Offener Anbieterbefund: Im bestehenden Live-SEPA-Mandat und der Kartenzustimmung zum Demenz-Coach-Produkt steht „Propstage AI“. Die Vertragspartnerentscheidung wird mit Daniel im Hauptchat geklärt; keine globale Kontoumbenennung oder Produktionsbereitschaft für SEPA daraus ableiten.

## Fragebogen nach Neuladen fortsetzen

Der belegte Fortschrittsverlust ist behoben: Ein kurzlebiger Checkpoint im selben Tab enthält nur feste Auswahlkürzel und den Schritt, keine Namen, E-Mail-Adressen oder freien Eingaben. Wiederaufnahme ist bis30Minuten nach dem letzten Schritt möglich; ein Timer entfernt den Eintrag während der geöffneten Seite, beim erneuten Zugriff werden veraltete Daten zusätzlich verworfen. „Neu anfangen“ entfernt die drei flüchtigen Quiz-/Übergabewerte und setzt das Quiz zurück. Andere gespeicherte Daten und echte Konten/Abos bleiben erhalten. Keine Antworten aus dem Checkpoint werden für Analytics versendet. DE/EN-Hinweise erklären die tatsächlichen Grenzen.

Die vier Dateien aus fdb1ae8 wurden nach unabhängig akzeptiertem Funktions-/Privacy-Abgleich normal integriert. Fokussierter Resumecheck mit Ablauf, tatsächlichem Idle-Timer, Neustart, History, Kontextwechsel und gesperrtem Speicher sowie vollständige Quizstrecken1280/320 bestanden beim Owner. Die vermeintliche doppelte Logo-Sektion in einer frühen Aufnahme war ein bestätigtes Screenshot-Artefakt nach Größenwechsel; kein Produktfix dafür nötig.

Backendfreigabe separat: Der Payment-Owner allein bereitet den gemeinsamen Functions-Release vor. Sein Taskstand1f5684a auf88155fc bestand die finale Pflichtprüfung mit250 Tests und7 Firestore-Emulator-Skips sowie49 gezielten Paymenttests. Das ist noch keine globale Deploy-SHA oder Produktionsfreigabe. Der bestehende Live-Webhook hört bislang nur auf `checkout.session.completed`; zusätzliche asynchrone Zahlungs-/Invoice-/Subscription-Ereignisse und echter Stripe→Firebase→Adapty-Nachweis bleiben vor vollständiger Produktionsbereitschaft abzustimmen.
