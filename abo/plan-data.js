// Inhalte für Fragebogen (/start/) und „Mein Plan“ (/abo/mein-plan.html). Alle Texte 1:1 aus den geprüften
// Übersetzer-Inhalten (landingpage/translator-content.mjs und die Satz-Seiten /demenz-uebersetzer/<seite>.html,
// Stand 8. Nov 2026). Nichtmedizinisch: allgemeine Kommunikations- und Alltagshilfe.
window.DEMENZ_PLAN_DATA = Object.freeze({
  relations: [
    { key: "mama", label: "Meine Mutter", call: "Mama", pron: "sie" },
    { key: "papa", label: "Mein Vater", call: "Papa", pron: "ihn" },
    { key: "partner", label: "Mein Partner oder meine Partnerin", call: "", pron: "sie oder ihn" },
    { key: "grosseltern", label: "Oma oder Opa", call: "", pron: "sie oder ihn" },
    { key: "andere", label: "Jemand anderes", call: "", pron: "die Person" }
  ],
  situations: [
    { key: "nachhause", label: "Will nach Hause", quote: "Ich will nach Hause.", href: "/ratgeber/demenz-nach-hause-was-sagen.html",
      meaning: "„Zuhause“ meint oft weniger einen Ort als ein Gefühl: Sicherheit, Vertrautheit, eine frühere Lebenszeit.",
      say: ["Du möchtest nach Hause. Erzähl mir, wie es da ist.", "Du fühlst dich hier gerade nicht wohl. Ich bin bei dir.", "Wollen wir zusammen eine kleine Runde gehen?"],
      tip: "Achte darauf, wann der Wunsch kommt, oft am späten Nachmittag. Plane dann etwas Ruhiges und Vertrautes." },
    { key: "wiederholt", label: "Fragt immer wieder dasselbe", quote: "Wann gehen wir?", href: "/demenz-uebersetzer/wann-gehen-wir.html",
      meaning: "Für die Person ist es jedes Mal die erste Frage. Die Antwort von vor fünf Minuten ist nicht mehr da.",
      say: ["Wir fahren nach dem Mittagessen. Ich sage dir rechtzeitig Bescheid.", "Ich habe die Uhr im Blick. Du kannst dich auf mich verlassen.", "Schau, hier auf dem Zettel steht es: Um drei Uhr fahren wir los."],
      tip: "Ein großer Zettel oder eine Tafel mit Tag und nächstem Termin kann die Frage selbst beantworten." },
    { key: "mutter", label: "Fragt nach der Mutter", quote: "Wo ist meine Mutter?", href: "/demenz-uebersetzer/wo-ist-meine-mutter.html",
      meaning: "Oft geht es weniger um die Mutter als Person heute, sondern um Geborgenheit, Sicherheit oder Sehnsucht.",
      say: ["Du denkst gerade an deine Mutter. Erzähl mir von ihr.", "Du vermisst sie. Was hat sie gemacht, wenn es dir nicht gut ging?", "Ich bin jetzt bei dir. Wir schauen zusammen, was du brauchst."],
      tip: "Ein Foto, ein vertrautes Lied oder ein Gegenstand von früher kann eine Brücke sein." },
    { key: "wer", label: "Erkennt mich nicht", quote: "Wer sind Sie?", href: "/demenz-uebersetzer/wer-sind-sie.html",
      meaning: "Nicht erkannt zu werden tut weh. Für die Person wirkt dein Gesicht gerade vielleicht fremd.",
      say: ["Ich bin jemand, der dich sehr gern hat.", "Ich bin heute für dich da.", "Darf ich mich zu dir setzen?"],
      tip: "Nenne beim Begrüßen ruhig deinen Namen und deine Rolle, jedes Mal, ohne Vorwurf." },
    { key: "geld", label: "Sagt, Geld wurde gestohlen", quote: "Du hast mein Geld gestohlen!", href: "/demenz-uebersetzer/du-hast-mein-geld-gestohlen.html",
      meaning: "Wenn Dinge verlegt und nicht wiedergefunden werden, kann ein Diebstahl für die Person die einzig logische Erklärung sein.",
      say: ["Das ist schlimm, wenn das Geld weg ist. Ich helfe dir beim Suchen.", "Du möchtest, dass deine Sachen sicher sind. Das verstehe ich.", "Lass uns gemeinsam schauen, wo es sein könnte."],
      tip: "Merke dir Lieblingsverstecke. Oft tauchen Dinge an denselben Orten wieder auf." },
    { key: "arbeit", label: "Will zur Arbeit", quote: "Ich muss zur Arbeit.", href: "/demenz-uebersetzer/ich-muss-zur-arbeit.html",
      meaning: "Oft möchte die Person gebraucht werden, etwas Sinnvolles tun und Verantwortung tragen.",
      say: ["Du warst immer sehr zuverlässig. Erzähl mir, was heute ansteht.", "Bevor du gehst: Kannst du mir kurz hier helfen?", "Lass uns zusammen schauen, was jetzt dran ist."],
      tip: "Kleine, echte Aufgaben wie Wäsche falten, Tisch decken oder Blumen gießen können das Bedürfnis nach Sinn aufgreifen." },
    { key: "waschen", label: "Will nicht duschen", quote: "Ich will nicht duschen.", href: "/demenz-uebersetzer/ich-will-nicht-duschen.html",
      meaning: "Körperpflege ist sehr privat. Oft stecken Scham, Kälte oder Angst vor dem Wasser dahinter, oder das Gefühl, bevormundet zu werden.",
      say: ["Möchtest du lieber jetzt oder nach dem Kaffee?", "Das Bad ist schön warm. Ich lege dir das Handtuch bereit.", "Du machst das Gesicht, ich helfe dir beim Rücken."],
      tip: "Ein Waschlappen am Waschbecken ist auch Körperpflege. Es muss nicht jeden Tag die Dusche sein." },
    { key: "andere", label: "Etwas anderes" }
  ],
  frequencies: [
    { key: "mehrmals", label: "Mehrmals am Tag" },
    { key: "taeglich", label: "Fast jeden Tag" },
    { key: "woche", label: "Ein paar Mal pro Woche" },
    { key: "selten", label: "Seltener" }
  ],
  // Weitere Fragen des Fragebogens (nach dem Aufbau von Noom/BetterMe: erst kennenlernen, dann Plan).
  dayTimes: [
    { key: "morgens", label: "Morgens", text: "morgens" },
    { key: "mittags", label: "Mittags", text: "mittags" },
    { key: "abends", label: "Am späten Nachmittag oder Abend", text: "abends" },
    { key: "nachts", label: "Nachts", text: "nachts" },
    { key: "immer", label: "Ganz unterschiedlich", text: "zu ganz unterschiedlichen Zeiten" }
  ],
  durations: [
    { key: "neu", label: "Seit ein paar Wochen" },
    { key: "jahr", label: "Seit einigen Monaten" },
    { key: "jahre", label: "Seit über einem Jahr" },
    { key: "lange", label: "Seit vielen Jahren" }
  ],
  livings: [
    { key: "zusammen", label: "Wir wohnen zusammen" },
    { key: "nah", label: "Ich wohne in der Nähe" },
    { key: "weit", label: "Ich wohne weiter weg" },
    { key: "heim", label: "Im Pflegeheim oder betreuten Wohnen" }
  ],
  tries: [
    { key: "erklaeren", label: "Erklären, wie es wirklich ist" },
    { key: "widersprechen", label: "Widersprechen oder korrigieren" },
    { key: "ablenken", label: "Ablenken" },
    { key: "aushalten", label: "Schweigen und aushalten" },
    { key: "nichts", label: "Ich weiß nicht weiter" }
  ],
  goals: [
    { key: "streit", label: "Weniger Streit", text: "weniger Streit" },
    { key: "ruhe", label: "Ruhigere Momente", text: "ruhigere Momente" },
    { key: "worte", label: "Wissen, was ich sagen kann", text: "die richtigen Worte" },
    { key: "kraft", label: "Mehr Kraft für mich", text: "mehr Kraft für dich" }
  ],
  minutes: [
    { key: "2", label: "2 Minuten am Tag" },
    { key: "5", label: "5 Minuten am Tag" },
    { key: "10", label: "10 Minuten am Tag" }
  ],
  burdens: [
    { key: "worte", label: "Ich weiß oft nicht, was ich sagen soll", check: "Du weißt im Moment, was du sagen kannst" },
    { key: "streit", label: "Es endet oft im Streit", check: "Sätze, die Streit vermeiden helfen" },
    { key: "kraft", label: "Ich bin oft erschöpft", check: "Auch kleine Hilfen für dich selbst" },
    { key: "allein", label: "Ich fühle mich allein damit", check: "Hilfe jederzeit, auch abends und nachts" }
  ],
  // Tag 7 „Für dich“: Entlastung ohne Gesundheitsrat, nur Hinweis auf kostenlose Beratung.
  selfCare: {
    title: "Für dich",
    text: "Du darfst Pausen machen. Kurz den Raum verlassen und durchatmen ist in Ordnung.",
    say: ["Ich bin gleich wieder da.", "Ich hole uns kurz etwas zu trinken."],
    tip: "Pflegestützpunkte und Pflegekassen beraten Angehörige kostenlos. Auch eine Angehörigengruppe kann entlasten."
  },
  // Ab Woche 2 jede Woche ein neuer Moment (Daniels Wahl 8. Nov: „Plan weiter“). Texte 1:1 aus
  // translator-content.mjs (Kern der Erklärung, drei Sätze, erster Tipp). Dieselbe Liste steht für die
  // Wochen-E-Mail in backend/web-plan-weeks.json (Test prüft, dass beide gleich sind).
  weeks: [
    {"key": "hunger", "quote": "Ich habe heute noch nichts gegessen.", "href": "/demenz-uebersetzer/ich-habe-noch-nichts-gegessen.html", "meaning": "Das Essen ist vielleicht vergessen, aber das Gefühl dahinter ist echt.", "say": ["Du hast Hunger. Magst du ein Stück Obst mit mir essen?", "Ich mache uns einen Tee und etwas Kleines dazu.", "Komm, wir schauen zusammen, was wir dahaben."], "tip": "Kleine, geplante Zwischenmahlzeiten und Getränke können über den Tag Sicherheit geben."},
    {"key": "ruhe", "quote": "Lass mich in Ruhe!", "href": "/demenz-uebersetzer/lass-mich-in-ruhe.html", "meaning": "Abwehr zeigt oft Überforderung, Schmerz, Angst oder zu viel Nähe in diesem Moment.", "say": ["Gut. Ich lasse dich kurz in Ruhe und komme gleich wieder.", "Ich merke, das ist gerade zu viel. Ich bin nebenan.", "Du entscheidest. Sag mir, wenn ich helfen darf."], "tip": "Geh einen Schritt zurück, behalte die Person aber im Blick, wenn das für ihre Sicherheit nötig ist."},
    {"key": "kinder", "quote": "Wo sind meine Kinder?", "href": "/demenz-uebersetzer/wo-sind-meine-kinder.html", "meaning": "Die Person erlebt sich vielleicht gerade in einer Zeit, in der sie für kleine Kinder verantwortlich war.", "say": ["Die Kinder sind gut versorgt. Du hast immer gut für sie gesorgt.", "Erzähl mir, was die Kinder am liebsten gegessen haben.", "Magst du mir beim Tischdecken helfen?"], "tip": "Eine Puppe oder ein Kuscheltier kann für manche tröstlich sein – biete es an, ohne zu drängen."},
    {"key": "langweilig", "quote": "Mir ist so langweilig.", "href": "/demenz-uebersetzer/mir-ist-langweilig.html", "meaning": "Langeweile oder immer gleiche Handgriffe zeigen oft: Die Person sucht eine Aufgabe, kann sie aber nicht mehr selbst beginnen.", "say": ["Kannst du mir helfen? Die Wäsche geht zu zweit schneller.", "Komm, wir hören dein Lieblingslied.", "Magst du mit mir die alten Fotos anschauen?"], "tip": "Vertraute Tätigkeiten aus dem früheren Leben aufgreifen: Gartenarbeit, Werkeln, Backen, Sortieren. Immer gleiche Handgriffe darfst du lassen, solange sie niemandem schaden."},
    {"key": "luegen", "quote": "Du lügst mich an!", "href": "/demenz-uebersetzer/du-luegst-mich-an.html", "meaning": "Wenn die eigene Erinnerung lückenhaft wird, passen Aussagen anderer oft nicht zum eigenen Erleben.", "say": ["Du glaubst, keiner sagt dir die Wahrheit. Das ist bestimmt schlimm.", "Ich möchte dich nicht anlügen. Lass uns in Ruhe zusammen schauen.", "Erzähl mir, was du erlebt hast."], "tip": "Sprich in Gegenwart der Person mit ihr, nicht über sie."},
    {"key": "bett", "quote": "Ich will nicht ins Bett.", "href": "/demenz-uebersetzer/ich-will-nicht-ins-bett.html", "meaning": "Am Abend sind viele Menschen mit Demenz unruhiger, und das Bett kann sich fremd oder sogar unheimlich anfühlen.", "say": ["Du bist noch nicht müde. Dann bleiben wir noch ein bisschen sitzen.", "Komm, wir machen es uns gemütlich. Ich mache dir noch einen warmen Tee.", "Ich bringe dich hin und bleibe noch kurz bei dir."], "tip": "Ein gleicher Ablauf am Abend gibt Halt, zum Beispiel: Licht dimmen, Musik, Waschen, Toilette, Bett."},
    {"key": "abend", "quote": "Es wird dunkel, ich muss jetzt los!", "href": "/demenz-uebersetzer/es-wird-dunkel-ich-muss-los.html", "meaning": "Viele Menschen mit Demenz werden am späten Nachmittag oder Abend unruhiger.", "say": ["Es wird dunkel. Ich mache uns Licht, dann ist es gemütlich.", "Du hast heute viel geschafft. Jetzt ruhen wir uns zusammen aus.", "Bevor du gehst, trinken wir noch einen Tee zusammen."], "tip": "Rechtzeitig vor der Dämmerung Licht einschalten und Vorhänge schließen, damit Schatten und Spiegelungen weniger verunsichern."},
    {"key": "krank", "quote": "Ich bin doch nicht dement!", "href": "/demenz-uebersetzer/ich-bin-doch-nicht-dement.html", "meaning": "Viele Menschen mit Demenz merken ihre Einschränkungen selbst nicht oder nur zum Teil.", "say": ["Du kommst mit vielem gut zurecht. Ich will dir nur ein bisschen helfen.", "Mir ist nur wichtig, dass es dir gut geht.", "Lass uns das zusammen machen, dann geht es leichter."], "tip": "Sprich über konkrete Anliegen, die die Person selbst wichtig findet – etwa Schlaf, Kraft oder Sehen."},
    {"key": "partner", "quote": "Wo ist mein Mann?", "href": "/demenz-uebersetzer/wo-ist-mein-mann.html", "meaning": "Wer nach Mann oder Frau fragt, sucht oft Halt und jemanden an der Seite.", "say": ["Ihr gehört zusammen. Erzähl mir, wie ihr euch kennengelernt habt.", "Ihr habt so viel zusammen erlebt. Was habt ihr am liebsten gemacht?", "Ich bin jetzt bei dir. Du bist nicht allein."], "tip": "Fotos, die Hochzeitsgeschichte oder ein gemeinsames Lied können eine Brücke sein – wenn es gerade willkommen ist."},
    {"key": "besuch", "quote": "Wann kommt mein Sohn?", "href": "/demenz-uebersetzer/wann-kommt-mein-sohn.html", "meaning": "Bei Demenz geht das Gefühl für Zeit oft verloren: Gestern fühlt sich an wie vor Wochen.", "say": ["Du vermisst deine Familie. Das verstehe ich gut.", "Komm, wir schauen zusammen in den Kalender, wann der nächste Besuch ist.", "Magst du mir ein Foto zeigen? Dann erzählst du mir von euch."], "tip": "Ein großer Kalender mit Fotos der Besuche und den nächsten Terminen gibt Halt, ohne dass jemand etwas beweisen muss."},
    {"key": "allein", "quote": "Lass mich nicht allein!", "href": "/demenz-uebersetzer/lass-mich-nicht-allein.html", "meaning": "Wer dich nicht gehen lassen will, hat oft Angst: Ohne dich fehlt der Halt in einer Welt, die schwer zu verstehen ist.", "say": ["Ich bin da. Ich bleibe bei dir.", "Ich gehe kurz in die Küche und komme gleich zurück. Du hörst mich.", "Hier, halt bitte meine Jacke. Ich hole sie mir gleich wieder."], "tip": "Eine kleine Aufgabe in deiner Nähe, Musik oder ein vertrauter Gegenstand können die Zeit überbrücken."},
    {"key": "einkaufen", "quote": "Ich muss noch einkaufen.", "href": "/demenz-uebersetzer/ich-muss-noch-einkaufen.html", "meaning": "Einkaufen war oft jahrzehntelang eine wichtige Aufgabe: für die Familie sorgen, selbstständig sein, unter Leute kommen.", "say": ["Du hast immer so gut für uns gesorgt. Was brauchen wir denn?", "Komm, wir schreiben zusammen einen Einkaufszettel.", "Gute Idee. Ich komme mit, dann tragen wir zusammen."], "tip": "Ein gemeinsamer kleiner Einkauf oder ein Gang zum Bäcker kann den Wunsch erfüllen und Bewegung bringen."},
    {"key": "dumm", "quote": "Ich kann gar nichts mehr.", "href": "/demenz-uebersetzer/ich-kann-gar-nichts-mehr.html", "meaning": "Hinter dem Satz stehen oft Scham, Trauer und das Spüren eigener Verluste.", "say": ["Das ist gerade frustrierend. Das darf auch so sein.", "Du bist nicht dumm. Dein Kopf macht es dir gerade schwer.", "Du hast mir so oft geholfen. Jetzt helfe ich dir."], "tip": "Teile Aufgaben in kleine Schritte, damit Erfolgserlebnisse möglich bleiben."},
    {"key": "umziehen", "quote": "Ich ziehe mich nicht um.", "href": "/demenz-uebersetzer/ich-ziehe-mich-nicht-um.html", "meaning": "Sich umziehen bedeutet viele kleine Schritte, Kälte und manchmal Scham.", "say": ["Wir machen uns schön. Magst du die blaue oder die grüne Bluse?", "Die Sachen sind noch warm von der Heizung. Fühl mal.", "Lass uns das später machen. Erst trinken wir einen Kaffee."], "tip": "Zwei Teile zur Auswahl hinlegen, in der Reihenfolge, in der sie angezogen werden."},
    {"key": "kind", "quote": "Ich bin doch kein Kind!", "href": "/demenz-uebersetzer/ich-bin-doch-kein-kind.html", "meaning": "„Ich bin doch kein Kind!“ ist ein Ruf nach Würde.", "say": ["Du hast recht. Du entscheidest das.", "Entschuldige, so war das nicht gemeint. Wie möchtest du es machen?", "Ich brauche deinen Rat. Wie würdest du es machen?"], "tip": "Zwei Möglichkeiten anbieten statt eine Anweisung zu geben: „Möchtest du lieber … oder …?“"},
    {"key": "kalt", "quote": "Mir ist so kalt.", "href": "/demenz-uebersetzer/mir-ist-so-kalt.html", "meaning": "Viele ältere Menschen frieren tatsächlich schneller: Sie bewegen sich weniger, sitzen lange und spüren Temperatur anders.", "say": ["Dir ist kalt. Komm, ich hole dir deine warme Jacke.", "Hier ist eine Decke. Fühl mal, wie weich sie ist.", "Magst du eine Tasse Tee? Die wärmt von innen."], "tip": "Mehrere dünne Schichten, warme Socken und eine Decke auf dem Schoß helfen oft mehr als eine sehr warme Heizung."},
    {"key": "haustier", "quote": "Wo ist mein Hund?", "href": "/demenz-uebersetzer/wo-ist-mein-hund.html", "meaning": "Ein Haustier steht oft für Nähe, Verantwortung und einen vertrauten Alltag.", "say": ["Du hast ihn sehr lieb. Erzähl mir von ihm.", "Wie hieß er noch? Was hat er am liebsten gemacht?", "Komm, wir gehen zusammen eine kleine Runde, wie früher."], "tip": "Fotos des Tieres oder ein Stofftier können für manche tröstlich sein – biete es an, ohne zu drängen."},
    {"key": "tagespflege", "quote": "Ich gehe nicht in die Tagespflege!", "href": "/demenz-uebersetzer/ich-gehe-nicht-in-die-tagespflege.html", "meaning": "Tagespflege oder ein Pflegedienst bedeuten fremde Menschen, neue Abläufe und das Eingeständnis, Hilfe zu brauchen.", "say": ["Du hast recht, das ist alles neu. Wir schauen es uns zusammen an.", "Heute kommt jemand Neues. Ich bin dabei, wenn sie kommt.", "Ich hole dich nach dem Mittagessen ab. Darauf kannst du dich verlassen."], "tip": "Klein anfangen: zuerst gemeinsam hingehen, wenige Stunden, immer dieselben Wochentage."},
    {"key": "heim", "quote": "Ich will nicht ins Heim.", "href": "/demenz-uebersetzer/ich-will-nicht-ins-heim.html", "meaning": "Hinter dem Satz steht oft die Angst, abgeschoben, vergessen oder nicht mehr gewollt zu sein.", "say": ["Du gehörst zu uns. Daran ändert sich nichts.", "Das macht dir Angst, das verstehe ich. Was ist dir am wichtigsten?", "Wir schauen es uns zusammen an. Du sagst mir, wie es ist."], "tip": "Ein gemeinsamer Besuch, zum Beispiel in einer Tagespflege, kann Ängste abbauen."},
    {"key": "schongegessen", "quote": "Ich habe schon gegessen.", "href": "/demenz-uebersetzer/ich-habe-schon-gegessen.html", "meaning": "Hunger wird oft schwächer gespürt, und das Essen sieht vielleicht fremd aus.", "say": ["Gut. Ich esse jetzt etwas – leistest du mir Gesellschaft?", "Probier mal, ob dir das schmeckt. Ich bin gespannt, was du sagst.", "Magst du ein paar Bissen mit mir zusammen essen?"], "tip": "Gemeinsam essen, kleine Portionen und Essen, das man mit der Hand nehmen kann, machen es oft leichter."}
  ],
  // Wird nur im Browser gespeichert (localStorage), nie gesendet.
  storageKey: "demenzCoachPlan"
});
