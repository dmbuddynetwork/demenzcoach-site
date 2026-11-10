# Statische SEO-URLs sind direkte Generatoransichten

Eine Situations-URL zeigt dieselbe Web-App wie die Sprachstartseite: die bereits
erzeugte Antwort ist im HTML enthalten und das vorhandene Eingabefeld kann nach
der Initialisierung sofort für die nächste Situation verwendet werden. Es gibt
keinen zusätzlichen Ratgeber mit einem Umweg über „App öffnen“.

## Eine Oberfläche und ein Renderer

Der Builder kopiert die aktuelle DE-/EN-App-Shell. Die Antwort stammt ausschließlich
aus dem vorhandenen `render()` des Translators, nicht aus einer zweiten Vorlage.
Ein kontrollierter Browserexport hält genau dieses öffentliche Ergebnis fest.
Das eine Hauptformular wird dabei mechanisch aus dem Ergebnis herausgenommen;
beim statischen Einbau erhält es einen dauerhaften Platz in derselben App-Shell.
Der bestehende Live-Renderer übernimmt bei Initialisierung genau einen
Ergebniscontainer und öffnet dasselbe Formular. Optionaler bestehender Signup ist
im statischen HTML inert/deaktiviert, damit ohne JavaScript keine E-Mail in eine
GET-URL gelangen kann. Hydration erzeugt ihn unverändert mit seinem Submit-Handler.

## Kontrollierter, wiederholbarer Export

1. Nutzerbedarf nur aus ausdrücklich geprüften, bereits verallgemeinerten geteilten
   Sätzen lokal auswerten. `import-situation-demand.mjs` liest den bekannten Export
   über stdin und gibt nur feste Themenkennungen und Zahlen aus. Keine Originalprompts,
   Nutzerkennungen, privaten Geschichten oder Kontaktdaten übernehmen. Unbekannte
   Sätze werden nur gezählt und müssen redaktionell geprüft werden.
2. Ein sinnvolles neues Thema in beiden Sprachdateien ergänzen und auf vorhandene
   Hilfe prüfen. Beide beginnen `reviewStatus: pending`. Fachliche, sprachliche,
   Sicherheits- und Datenschutzprüfung abschließen, erst danach `reviewed` setzen.
   Das ist keine ärztliche oder Veröffentlichungsfreigabe.
3. Auf dem endgültigen integrierten App-Stand ausführen:

   ```sh
   node scripts/build-ready-situations.mjs --prepare-views
   node scripts/build-ready-situations.mjs --view-bindings > ../view-bindings.json
   ```

4. Eine frische isolierte lokale Browser-Origin mit gesperrten externen KI-,
   Analyse- und Zahlungsaufrufen verwenden. Keine gespeicherten persönlichen
   Eingaben, hilfreichen Antworten, Konten oder Sessions wiederverwenden.
5. Je Sprache/Situation den existierenden Generator mit festem Katalogschlüssel
   öffnen, zum Beispiel `/de/?situation=toilettefinden&ziel=jetzt`. Den echten
   Ergebnis-DOM exportieren. Der CUA-Helper in der zugehörigen Übergabe dokumentiert
   alle Schritte inklusive Quellenprüfung, leerem Eingabefeld und Formularentnahme.
   Kein Ergebnis-HTML manuell erfinden oder einen alten Cache als aktuell markieren.
6. Der Cache bindet vollständige Appdaten und alle lokalen Scripts der aktuellen
   Sprach-Shells einschließlich Renderer, Core, Locale, Signup/Access/Experiments
   sowie den dynamischen Situationskontext. Änderungen verlangen echten Neuxport.
   Cachefelder werden nicht selbst gehasht und nicht in Clientdaten übernommen.
7. `node scripts/build-ready-situations.mjs` erzeugt 88 statische
   Generatoransichten und ergänzt SEO-Metadaten, Sprachverweise und Sitemap.
   Fehlende/veraltete Caches sperren vor jeder Schreiboperation. `--preview` bleibt
   noindex; auch dafür ist ein echter passender Viewcache nötig.
8. Die Compiler-Verträge und Seiten prüfen:

   ```sh
   node --test scripts/test-ready-situations.mjs scripts/test-generator-migration.mjs
   node scripts/validate-seo.mjs .
   ```

   Die Unit-Fixtures verwenden ausdrücklich synthetische Fingerprints in temporären
   Kopien. Ein grüner Unit-Test ersetzt keinen echten Export oder Browsernachweis.
9. Direkte Routen mit/ohne JavaScript, Folgeeingabe, gültige/ungültige Query-/Hash-
   Zustände, Sicherheitsfälle, Zurücknavigation, Sprache, Mobilansicht und große
   Schrift prüfen. Der normale Erstaufruf verändert die SEO-URL nicht. Nach einer
   neuen Situation entsprechen URL, Titel und Canonical der Sprach-App.
10. Ein gemeinsamer integrierter Stand wird über `Site <sha> ok` freigegeben und
    anschließend live geprüft. Es wird keine Google-Aufnahme oder Platzierung
    garantiert.

## Grenzen

Kein laufender Datenbankimport, Zeitplan oder automatische Veröffentlichung
ungeprüfter Texte. Angehörigenkonflikte bleiben gezielt auswählbar, um sie nicht
als Patientenaussage fehlzudeuten. Die DE-Verknüpfung zur persönlichen Hilfe gehört
weiterhin dem Integrator; ein englischer Bezahlfunnel wird nicht hinzugefügt.

## Bestand und feste Pfade

Die Registry benennt genau 84 bestehende öffentliche Situationen plus vier neue
Sprachversionen. Je Sprache bleibt der vorhandene Katalog mit 45 Einträgen erhalten
und wächst um zwei. Sechs vorhandene Sicherheitszustände mit Hash bleiben davon
getrennt. Ein klinischer Fingerprint bindet die unveränderten Bestandsinhalte;
zusätzliche Integrationsfelder und individuelle Toolpfade bleiben erhalten.
Nur die registrierten 84 Dateihashes dürfen bestehende Inhaltsseiten ersetzen.
Die englische Angehörigenseite unter `/guides/` ist die explizite Sprachausnahme.

`--topics=finding-toilet,sharing-family-care` begrenzt Pilotexport und öffentliche
Registry auf vier neue Seiten; der Standard umfasst alle 88. Die Oberfläche fügt
nur die zwei neuen Themen pro Sprache hinzu, keine 44 doppelten Auswahlknöpfe.
`--prepare-views` und `--view-bindings` dürfen vor der abschließenden Quellenprüfung
laufen; der reguläre Indexbuild bleibt durch `reviewStatus` gesperrt.

Der einzige Pfadvertrag ist `data.generatorRoutes`: Der Hauptpfad bleibt die
bisherige öffentliche `.html`-Adresse. Deutsche Patientensituationen erhalten
`goalPaths`: `jetzt` ist der Hauptpfad, `verstehen` und `tipps` verwenden feste
Unterpfade des Themenstamms. `selectionPath` endet auf `/auswahl/`. Englisch und
Angehörigenhilfe haben keine Zielvarianten. Der zuständige Integrationswriter
setzt dies im vorhandenen Controller und Worker um. Alte gültige Querylinks
werden weiterhin gelesen und auf den registrierten Pfad normalisiert. Alle
Zielvarianten haben den Themenhauptpfad als Canonical und stehen nicht in der
Sitemap. Ausschließlich feste Schlüssel und geprüfte Themenpfade gelangen in URLs.

## Integrierter, kontrollierter Headless-Export

`PLAYWRIGHT_MODULE` benennt eine vorhandene Playwright-Installation; `CHROME_PATH` optional einen vorhandenen Chromium-Browser. Keine Providerfreigabe wird verändert.

```sh
node scripts/build-ready-situations.mjs --prepare-views
node scripts/export-ready-situations.cjs --evidence-dir /tmp/public-export-proof
node scripts/build-ready-situations.mjs
```

Der Export verwendet nur den bestehenden Renderer, zweimal je Fall in frischen isolierten Kontexten. Er sperrt externe Provider, prüft alle aktuellen lokalen JS-/CSS-/E-Mail-Abhängigkeiten und die reale öffentliche Standard-Anrede/Locale. Nur das vorhandene Hauptformular wird mechanisch aus dem Ergebnis entfernt. Sein Original bleibt an seiner Shellposition; statischer Newsletter-Signup ist bis zur Hydration inert/deaktiviert. Der vollständige Build schreibt die aktive `content/generator-public-routes.json` erst nach erfolgreicher Prüfung sämtlicher ausgewählter Views. Das88er-Inventar allein aktiviert keine Routen.

Ein Pilot verwendet in allen drei Befehlen dieselbe Auswahl `--topics=finding-toilet,sharing-family-care`. Ohne Auswahl werden alle88 geprüften Ansichten exportiert und kompiliert. `--verify-only` beim Export prüft frische DOMs gegen vorhandene Caches ohne zu schreiben. Niemals alte Bindungen als aktuelle exportierte Views umetikettieren.

`node scripts/generator-preview.cjs` startet nur eine lokale noindex-Vorschau mit dem tatsächlichen Produktionsworker und gebauten Assets. Kanonische Topics und feste Ziel-/Auswahlpfade sind queryfrei; Ziele kanonisieren auf ihr Haupttopic. Unbekannte private Eingaben erhalten keine öffentlichen Pfade. Bestehende Safety-/Gefühls-Hashes bleiben feste Hashzustände.
