// Baut die Seiten des Gesprächs-Simulators (Deutsch und Englisch) aus content/ready-situations.*.json.
// Aufruf: node scripts/build-simulator.mjs
// Die Seiten sind erzeugt. Texte und Situationen ändert man hier und in den Inhaltsdateien, dann neu bauen.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "https://dementiacoachapp.com";
const endpoint = "https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/simulator-web";
const german = JSON.parse(readFileSync(join(root, "content/ready-situations.de.json"), "utf8"));
const englishEntries = JSON.parse(readFileSync(join(root, "content/ready-situations.en.json"), "utf8"));
const englishByPath = new Map(englishEntries.map((entry) => [entry.page.path, entry]));
// Keine Selbstfürsorge-Karten, kein Notruf-Satz („Hilfe! Hilfe!“): Das üben wir hier nicht.
const excluded = new Set(["erschoepft", "pflegeaufteilen", "hilfe"]);
const firstKeys = ["nachhause", "waschen", "geld", "bett", "arbeit", "hunger"];
// Welche gespielte Person die Zeichnung zeigt (Standard: eine ältere Frau).
const male = new Set(["arbeit", "geld", "auto", "untreue", "liegen"]);

const imageSize = (value) => ({ src: value.image, width: value.imageWidth, height: value.imageHeight });
const cleanKeyword = (keyword) => keyword.replace(/^[=^]/u, "").replace(/\$$/u, "");

const situations = (entries, language) => {
  const ordered = [...german.filter((entry) => !excluded.has(entry.key) && entry.image)];
  ordered.sort((a, b) => {
    const rank = (entry) => firstKeys.includes(entry.key) ? firstKeys.indexOf(entry.key) : firstKeys.length;
    return rank(a) - rank(b);
  });
  return ordered.map((entry) => {
    const source = language === "en" ? englishByPath.get(entry.page.alternatePath) : entry;
    if (!source) throw new Error(`Missing ${language} entry for ${entry.key}`);
    return {
      key: entry.key,
      says: source.says,
      kw: [...(source.variants ?? []), ...(source.keywords ?? []).map(cleanKeyword)],
      who: male.has(entry.key) ? "m" : "f",
      image: imageSize(entry),
      afterImage: entry.afterImage ? { src: entry.afterImage.src, width: entry.afterImage.width, height: entry.afterImage.height } : null,
      realHref: source.page.path
    };
  });
};

const copy = {
  de: {
    lang: "de",
    htmlLang: "de",
    path: "/de/gespraeche-ueben/",
    otherPath: "/en/practice-conversations/",
    title: "Gespräche bei Demenz üben: Was sagst du? | Demenz Coach",
    description: "Übe ruhige Sätze im Gespräch mit einer erfundenen Person. Wähle eine Alltagssituation oder beschreibe deine eigene. Die Person reagiert, du bekommst eine kurze Rückmeldung. Kostenlos.",
    ogLocale: "de_DE",
    ogImage: `${baseURL}/assets/og-de.webp`,
    h1: "Gespräche üben",
    intro: "Du sprichst mit einer erfundenen Person. Sie reagiert auf jeden Satz. So übst du, was du im echten Moment sagen kannst.",
    steps: ["Situation wählen", "Satz sagen", "Rückmeldung lesen"],
    siteName: "Demenz Coach",
    home: "/de/",
    brandLabel: "Demenz Coach App Startseite",
    brand: "Demenz Coach App",
    skip: "Zum Inhalt springen",
    fontLabel: "Schrift größer",
    appNav: "Zur App",
    translatorHref: "/de/demenz-uebersetzer/",
    trainerHref: "/de/demenz-uebersetzer/gespraechstrainer.html",
    planHref: "/start/?src=ueben",
    termsHref: "/nutzungsbedingungen.html",
    privacyHref: "/datenschutz.html",
    footerNav: [["/de/demenz-uebersetzer/", "Alle Sätze"], ["/de/ratgeber/", "Ratgeber"], ["/impressum.html", "Impressum"], ["/abo/kuendigen.html", "Verträge hier kündigen"], ["/datenschutz.html", "Datenschutz"], ["/nutzungsbedingungen.html", "Nutzungsbedingungen"]],
    footerNote: "Allgemeine Hinweise ohne Gewähr, kein Ersatz für ärztlichen Rat. Kein Medizinprodukt. Bei Gefahr: Notruf 112.",
    otherLabel: "English",
    app: "https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&mt=8&ct=",
    infoTitle: "Warum üben hilft",
    info: [
      "In belastenden Momenten fallen uns oft zuerst Erklärungen und Korrekturen ein. Wer typische Situationen vorher durchspielt, hat eher einen kurzen, wertschätzenden Satz bereit.",
      "Hier übst du ohne Druck. Die Person im Spiel ist erfunden. Dein Satz kann nichts kaputt machen. Jede Rückmeldung zeigt dir, wie ein Satz wirken kann und was du als Nächstes versuchen kannst.",
      "Die Rückmeldungen sind Beispiele, keine Regeln. Was passt, hängt von der Person und eurer Beziehung ab."
    ],
    howTitle: "So funktioniert es",
    how: [
      "Du wählst eine Situation oder beschreibst eure eigene. Die Person sagt ihren ersten Satz.",
      "Du schreibst, was du sagen würdest, oder tippst einen Vorschlag an.",
      "Die Person reagiert. Du siehst, wie es ihr geht, und liest eine kurze Rückmeldung zu deinem Satz.",
      "Nach höchstens fünf Sätzen siehst du, was geholfen hat und was du das nächste Mal probieren kannst."
    ],
    safetyTitle: "Sicherheit zuerst",
    safety: "Das ist eine Übung mit einer erfundenen Person. Sie ersetzt keine ärztliche Beratung. Bei plötzlichen Veränderungen, Stürzen, Schmerzen, Atemnot oder Gefahr: Notruf 112, ärztlicher Bereitschaftsdienst 116 117.",
    noscript: "Der Gesprächs-Simulator braucht JavaScript. Situationen und Sätze ohne Übung findest du im Demenz-Übersetzer.",
    ui: {
      pickTitle: "Wähle eine Situation",
      addressLabel: "Du sprichst die Person an mit:",
      more: "{count} weitere Situationen",
      freeLabel: "Oder beschreibe eure Situation",
      freePlaceholder: "Zum Beispiel: Mama will nachts zur Arbeit.",
      freeButton: "Üben starten",
      freeTooShort: "Bitte beschreibe die Situation in einem kurzen Satz.",
      freeNote: "Es gelten die",
      termsLink: "Nutzungsbedingungen",
      and: "und",
      privacyLink: "Datenschutz",
      freeNoteEnd: "(inkl. KI). Der Text geht nur für diese Übung an den Server und wird nicht gespeichert.",
      disclaimer: "Übung mit einer erfundenen Person. Eine KI spielt sie und kann Fehler machen. Allgemeine Hinweise ohne Gewähr, kein Ersatz für ärztlichen Rat.",
      practicing: "Du übst",
      back: "Andere Situation",
      restart: "Neu beginnen",
      moodTitle: "So geht es der Person",
      moods: { upset: "Aufgewühlt", unsure: "Unsicher", calmer: "Ruhiger", calm: "Ruhig" },
      says: "{who} sagt:",
      thePerson: "Die Person",
      you: "Du sagst:",
      thinking: "{who} überlegt …",
      preparing: "Die Situation wird vorbereitet …",
      sayLabel: "Was sagst du?",
      sayLabelRound: "Was sagst du? (Satz {round} von {max})",
      sayPlaceholder: "Schreibe deinen Satz …",
      sayButton: "Sagen",
      choicesTitle: "Oder tippe einen Satz an:",
      choicesLoading: "Sätze zur Auswahl werden geladen …",
      choicesRetry: "Sätze neu laden",
      feedbackLabel: "Rückmeldung zu deinem Satz",
      verdict: { good: "Das hilft.", ok: "Geht so.", tricky: "Eher ungünstig." },
      betterGood: "Das passt auch:",
      betterOther: "Besser:",
      save: "Merken",
      saved: "Gemerkt",
      doneTitle: { calm: "Das Gespräch ist ruhig geworden.", calmer: "Das Gespräch ist ruhiger geworden.", unsure: "Das Gespräch ist noch unsicher.", upset: "Das Gespräch ist noch aufgewühlt. Das passiert. Dafür übst du." },
      doneStats: "{good} von {total} Sätzen haben geholfen.",
      workedTitle: "Das hat geholfen",
      nextTitle: "Das nächste Mal",
      again: "Dieselbe Situation nochmal",
      other: "Andere Situation üben",
      real: "Eure echte Situation im Übersetzer",
      appTitle: "Üben und nachschlagen in der App",
      appText: "In der App beschreibst du eure Lage und bekommst passende Sätze. Kostenlos laden.",
      appButton: "Kostenlos im App Store",
      planLink: "Persönlichen Plan ansehen",
      busy: "Gerade üben viele Menschen. Bitte versuche es in einer Minute noch einmal.",
      unavailable: "Die Übung ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      retry: "Noch einmal versuchen",
      fallbackBefore: "Eine Übung ohne KI findest du im",
      fallbackLink: "Gesprächstrainer",
      safetyTitle: "Wichtig",
      offTopicMore: "Für eure eigenen Fragen hilft der",
      translatorLink: "Demenz-Übersetzer",
      offTopic: "Das ist keine Gesprächssituation mit der Person. Beschreibe bitte, was die Person sagt oder tut. Zum Beispiel: Mama will nachts zur Arbeit."
    }
  },
  en: {
    lang: "en",
    htmlLang: "en-US",
    path: "/en/practice-conversations/",
    otherPath: "/de/gespraeche-ueben/",
    title: "Practice Dementia Conversations: What Would You Say? | Dementia Coach",
    description: "Practice calm sentences in a talk with an invented person. Pick an everyday situation or describe your own. The person reacts and you get short feedback. Free.",
    ogLocale: "en_US",
    ogImage: `${baseURL}/assets/og-en.webp`,
    h1: "Practice conversations",
    intro: "You talk with an invented person. They react to every sentence. This is how you practise what you can say in the real moment.",
    steps: ["Pick a situation", "Say a sentence", "Read the feedback"],
    siteName: "Dementia Coach",
    home: "/en/",
    brandLabel: "Dementia Coach App home",
    brand: "Dementia Coach App",
    skip: "Skip to content",
    fontLabel: "Larger text",
    appNav: "Get the app",
    translatorHref: "/en/dementia-translator/",
    trainerHref: "/en/dementia-translator/",
    planHref: "",
    termsHref: "/terms-en.html",
    privacyHref: "/privacy-en.html",
    footerNav: [["/en/dementia-translator/", "All sentences"], ["/imprint-en.html", "Imprint"], ["/privacy-en.html", "Privacy"], ["/terms-en.html", "Terms of use"]],
    footerNote: "General information without guarantee, not a substitute for medical advice. Not a medical device. In danger, call your local emergency number.",
    otherLabel: "Deutsch",
    app: "https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&mt=8&ct=",
    infoTitle: "Why practising helps",
    info: [
      "In stressful moments, explanations and corrections often come to mind first. If you play through typical situations beforehand, a short, appreciative sentence is easier to find.",
      "Here you practise without pressure. The person in the game is invented. Your sentence cannot break anything. Every piece of feedback shows how a sentence can land and what to try next.",
      "The feedback gives examples, not rules. What fits depends on the person and your relationship."
    ],
    howTitle: "How it works",
    how: [
      "You pick a situation or describe your own. The person says their first sentence.",
      "You write what you would say, or tap a suggestion.",
      "The person reacts. You see how they feel and read short feedback on your sentence.",
      "After at most five sentences you see what helped and what to try next time."
    ],
    safetyTitle: "Safety first",
    safety: "This is practice with an invented person. It does not replace medical advice. For sudden changes, falls, pain, trouble breathing or danger, call your local emergency number.",
    noscript: "The conversation simulator needs JavaScript. You can find situations and sentences without practice in the Dementia Translator.",
    ui: {
      pickTitle: "Pick a situation",
      addressLabel: "",
      more: "{count} more situations",
      freeLabel: "Or describe your situation",
      freePlaceholder: "For example: Mom wants to go to work at night.",
      freeButton: "Start practising",
      freeTooShort: "Please describe the situation in a short sentence.",
      freeNote: "Our",
      termsLink: "terms of use",
      and: "and",
      privacyLink: "privacy policy",
      freeNoteEnd: "(incl. AI) apply. The text goes to the server only for this practice and is not stored.",
      disclaimer: "Practice with an invented person. An AI plays them and can make mistakes. General information without guarantee, not a substitute for medical advice.",
      practicing: "You practise",
      back: "Other situation",
      restart: "Start over",
      moodTitle: "How the person feels",
      moods: { upset: "Upset", unsure: "Unsure", calmer: "Calmer", calm: "Calm" },
      says: "{who} says:",
      thePerson: "The person",
      you: "You say:",
      thinking: "{who} is thinking …",
      preparing: "Preparing the situation …",
      sayLabel: "What do you say?",
      sayLabelRound: "What do you say? (Sentence {round} of {max})",
      sayPlaceholder: "Write your sentence …",
      sayButton: "Say it",
      choicesTitle: "Or tap a sentence:",
      choicesLoading: "Loading suggestions …",
      choicesRetry: "Reload suggestions",
      feedbackLabel: "Feedback on your sentence",
      verdict: { good: "That helps.", ok: "So-so.", tricky: "Rather unhelpful." },
      betterGood: "This works too:",
      betterOther: "Better:",
      save: "Save",
      saved: "Saved",
      doneTitle: { calm: "The conversation became calm.", calmer: "The conversation became calmer.", unsure: "The conversation is still unsure.", upset: "The conversation is still upset. That happens. That is what you practise for." },
      doneStats: "{good} of {total} sentences helped.",
      workedTitle: "What helped",
      nextTitle: "Next time",
      again: "Same situation again",
      other: "Practise another situation",
      real: "Your real situation in the translator",
      appTitle: "Practise and look things up in the app",
      appText: "In the app you describe your situation and get fitting sentences. Free to download.",
      appButton: "Free on the App Store",
      planLink: "",
      busy: "Many people are practising right now. Please try again in a minute.",
      unavailable: "The practice is not available right now. Please try again shortly.",
      retry: "Try again",
      fallbackBefore: "You can find sentences without AI in the",
      fallbackLink: "Dementia Translator",
      safetyTitle: "Important",
      offTopicMore: "For your own questions, try the",
      translatorLink: "Dementia Translator",
      offTopic: "That is not a conversation with the person. Please describe what the person says or does. For example: Mom wants to go to work at night."
    }
  }
};

const escape = (value) => String(value).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
const json = (value) => JSON.stringify(value).replace(/</gu, "\\u003c").replace(/\u2028/gu, "\\u2028").replace(/\u2029/gu, "\\u2029");

const page = (language) => {
  const c = copy[language];
  const url = `${baseURL}${c.path}`;
  const otherURL = `${baseURL}${c.otherPath}`;
  const list = situations(language === "en" ? englishEntries : german, language);
  const data = {
    lang: c.lang,
    endpoint,
    firstCount: 6,
    fallbackImage: "/assets/zeichnungen/v-haende.webp",
    trainerHref: c.trainerHref,
    translatorHref: c.translatorHref,
    appHref: `${c.app}${language === "en" ? "web_en_simulator" : "web_de_simulator"}`,
    planHref: c.planHref,
    termsHref: c.termsHref,
    privacyHref: c.privacyHref,
    ui: c.ui,
    situations: list
  };
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: c.title,
    description: c.description,
    inLanguage: c.lang,
    isAccessibleForFree: true,
    isPartOf: { "@type": "WebSite", name: c.siteName, url: `${baseURL}${c.home}` }
  };
  const font = "(function(){var d=document.documentElement,u=navigator.userAgent||'';d.classList.add('app-check');try{if(localStorage.getItem('demenzcoach.textSize.v1')==='large')d.classList.add('e-large');}catch(e){}document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-font-toggle]');if(!b)return;var on=d.classList.toggle('e-large');b.setAttribute('aria-pressed',String(on));try{if(on)localStorage.setItem('demenzcoach.textSize.v1','large');else localStorage.removeItem('demenzcoach.textSize.v1');}catch(e){}});document.addEventListener('DOMContentLoaded',function(){var b=document.querySelector('[data-font-toggle]');if(b)b.setAttribute('aria-pressed',String(d.classList.contains('e-large')));});if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))d.classList.add('is-ios');document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href*=\"apps.apple.com\"]');if(a){a.target='_blank';a.rel='noopener';}},true);})();";
  const alternates = language === "de"
    ? `<link rel="alternate" hreflang="de" href="${url}">\n  <link rel="alternate" hreflang="en" href="${otherURL}">\n  <link rel="alternate" hreflang="x-default" href="${url}">`
    : `<link rel="alternate" hreflang="de" href="${otherURL}">\n  <link rel="alternate" hreflang="en" href="${url}">\n  <link rel="alternate" hreflang="x-default" href="${otherURL}">`;
  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(c.description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#faf8f4">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escape(c.siteName)}">
  <meta property="og:locale" content="${c.ogLocale}">
  <meta property="og:title" content="${escape(c.title)}">
  <meta property="og:description" content="${escape(c.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${c.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(c.title)}">
  <meta name="twitter:description" content="${escape(c.description)}">
  <meta name="twitter:image" content="${c.ogImage}">
  <title>${escape(c.title)}</title>
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="canonical" href="${url}">
  ${alternates}
  <link rel="sitemap" type="application/xml" href="${baseURL}/sitemap.xml">
  <link rel="stylesheet" href="/translator.css">
  <link rel="stylesheet" href="/einfach.css">
  <link rel="stylesheet" href="/simulator.css?v=20261120b">
  <script>${font}</script>
  <script type="application/ld+json">${json(schema)}</script>
</head>
<body class="einfach sim-page" data-page-type="simulator" data-page-language="${c.lang}" data-page-slug="${language === "en" ? "practice-conversations" : "gespraeche-ueben"}">
  <a class="skip-link" href="#main">${escape(c.skip)}</a>
  <header class="e-header">
    <div class="e-wrap">
      <a class="e-brand" href="${c.home}" aria-label="${escape(c.brandLabel)}"><img src="/assets/lovable-logo.jpg" width="40" height="40" alt=""><span>${escape(c.brand)}</span></a>
      <nav aria-label="${language === "en" ? "Main navigation" : "Hauptnavigation"}"><button type="button" class="e-font-toggle" data-font-toggle aria-pressed="false" aria-label="${escape(c.fontLabel)}" title="${escape(c.fontLabel)}">${escape(c.fontLabel)}</button><a href="${c.app}web_${c.lang}_simulator_nav" data-store-link="simulator-nav">${escape(c.appNav)}</a></nav>
    </div>
  </header>
  <main id="main" class="e-wrap">
    <section class="sim-hero">
      <h1>${escape(c.h1)}</h1>
      <p>${escape(c.intro)}</p>
      <ol class="sim-steps">${c.steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol>
    </section>
    <div id="sim" aria-live="off">
      <noscript><p>${escape(c.noscript)} <a href="${c.translatorHref}">${escape(c.ui.fallbackLink)}</a></p></noscript>
    </div>
    <section class="sim-info" aria-labelledby="sim-how-title">
      <h2 id="sim-how-title">${escape(c.howTitle)}</h2>
      <ol>${c.how.map((item) => `<li>${escape(item)}</li>`).join("")}</ol>
      <h2>${escape(c.infoTitle)}</h2>
      ${c.info.map((item) => `<p>${escape(item)}</p>`).join("\n      ")}
      <aside class="sim-safety"><strong>${escape(c.safetyTitle)}</strong> ${escape(c.safety)}</aside>
    </section>
  </main>
  <footer class="e-footer">
    <div class="e-wrap">
      <nav aria-label="${language === "en" ? "More pages" : "Weitere Seiten"}">
        ${c.footerNav.map(([href, label]) => `<a href="${href}">${escape(label)}</a>`).join("\n        ")}
        <a href="${c.otherPath}" lang="${language === "en" ? "de" : "en"}">${escape(c.otherLabel)}</a>
      </nav>
      <p>${escape(c.footerNote)}</p>
    </div>
  </footer>
  <script>window.demenzCoachSiteLocale=${json(language === "en" ? { menuOpen: "Open menu", menuClose: "Close menu", privacyURL: "/privacy-en.html" } : { menuOpen: "Menü öffnen", menuClose: "Menü schließen", privacyURL: "/datenschutz.html" })};</script>
  <script src="/lovable-home.js?v=20261108a"></script>
  <script type="application/json" id="sim-data">${json(data)}</script>
  <script src="/demenz-uebersetzer/translator-saved.js"></script>
  <script src="/simulator.js?v=20261120b"></script>
</body>
</html>
`;
};

for (const language of ["de", "en"]) {
  const file = join(root, copy[language].path.replace(/^\//u, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(language));
  console.log(`wrote ${file}`);
}
