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
    intro: "Wähle eine Situation. Eine KI spielt die Person. Du übst, was du sagen kannst.",
    siteName: "Demenz Coach",
    home: "/de/",
    brandLabel: "Demenz Coach App Startseite",
    brand: "Demenz Coach App",
    skip: "Zum Inhalt springen",
    fontLabel: "Schrift größer",
    appNav: "Zur App",
    translatorHref: "/de/demenz-uebersetzer/",
    translatorName: "Demenz-Übersetzer",
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
      "Im Stress fallen uns oft zuerst Erklärungen und Korrekturen ein. Wer vorher übt, hat eher einen ruhigen Satz bereit. Die Person hier ist erfunden. Du kannst nichts falsch machen."
    ],
    howTitle: "So geht es",
    how: [
      "Wähle eine Situation.",
      "Tippe an, was du sagen würdest.",
      "Du siehst, ob es hilft. Die Person antwortet."
    ],
    safetyTitle: "Sicherheit zuerst",
    safety: "Nur eine Übung. Kein ärztlicher Rat. Bei Schmerzen, Sturz, Atemnot oder Gefahr: Notruf 112, Bereitschaftsdienst 116 117.",
    noscript: "Der Gesprächs-Simulator braucht JavaScript. Situationen und Sätze ohne Übung findest du im Demenz-Übersetzer.",
    ui: {
      more: "Mehr Situationen",
      freeLabel: "Oder schreibe eure Situation:",
      freePlaceholder: "Zum Beispiel: Mama will nachts zur Arbeit.",
      freeButton: "Üben",
      freeTooShort: "Bitte schreibe einen kurzen Satz.",
      freeNote: "Der Text wird nicht gespeichert.",
      privacyLink: "Datenschutz",
      back: "Andere Situation",
      thePerson: "Die Person",
      says: "{who} sagt:",
      wait: "Die Person antwortet …",
      ask: "Was sagst du?",
      answer: "Antwort",
      next: "Weiter",
      tryAgain: "Nochmal versuchen",
      ownOpen: "Eigenen Satz schreiben",
      ownLabel: "Dein Satz",
      ownPlaceholder: "Schreibe deinen Satz …",
      sayButton: "Sagen",
      verdict: { good: "Gut gemacht.", ok: "Geht so.", tricky: "Lieber anders." },
      better: "Besser:",
      doneTitle: { calm: "Geschafft! {who} ist ruhig.", calmer: "Gut! {who} ist ruhiger.", unsure: "Gut geübt. Das war schwer.", upset: "Gut geübt. Das war schwer." },
      again: "Nochmal üben",
      other: "Andere Situation",
      app: "Mehr Sätze in der App",
      busy: "Gerade üben viele. Bitte versuche es gleich noch einmal.",
      unavailable: "Das Üben geht gerade nicht. Bitte versuche es gleich noch einmal.",
      retry: "Nochmal versuchen",
      offTopic: "Das können wir hier nicht üben. Schreibe, was die Person sagt oder tut. Zum Beispiel: Mama will nachts zur Arbeit."
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
    intro: "Pick a situation. An AI plays the person. You practise what to say.",
    siteName: "Dementia Coach",
    home: "/en/",
    brandLabel: "Dementia Coach App home",
    brand: "Dementia Coach App",
    skip: "Skip to content",
    fontLabel: "Larger text",
    appNav: "Get the app",
    translatorHref: "/en/dementia-translator/",
    translatorName: "Dementia Translator",
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
      "Under stress, explanations and corrections come to mind first. If you practise beforehand, a calm sentence is easier to find. The person here is invented. You cannot do anything wrong."
    ],
    howTitle: "How it works",
    how: [
      "Pick a situation.",
      "Tap what you would say.",
      "You see if it helps. The person answers."
    ],
    safetyTitle: "Safety first",
    safety: "Practice only. Not medical advice. For pain, a fall, trouble breathing or danger, call your local emergency number.",
    noscript: "The conversation simulator needs JavaScript. You can find situations and sentences without practice in the Dementia Translator.",
    ui: {
      more: "More situations",
      freeLabel: "Or write your situation:",
      freePlaceholder: "For example: Mom wants to go to work at night.",
      freeButton: "Practise",
      freeTooShort: "Please write a short sentence.",
      freeNote: "The text is not stored.",
      privacyLink: "Privacy",
      back: "Other situation",
      thePerson: "The person",
      says: "{who} says:",
      wait: "The person is answering …",
      ask: "What do you say?",
      answer: "Answer",
      next: "Continue",
      tryAgain: "Try again",
      ownOpen: "Write your own sentence",
      ownLabel: "Your sentence",
      ownPlaceholder: "Write your sentence …",
      sayButton: "Say it",
      verdict: { good: "Well done.", ok: "So-so.", tricky: "Better not." },
      better: "Better:",
      doneTitle: { calm: "Well done! {who} is calm.", calmer: "Good! {who} is calmer.", unsure: "Good practice. That was hard.", upset: "Good practice. That was hard." },
      again: "Practise again",
      other: "Other situation",
      app: "More sentences in the app",
      busy: "Many people are practising. Please try again in a moment.",
      unavailable: "Practice is not available right now. Please try again in a moment.",
      retry: "Try again",
      offTopic: "We cannot practise that here. Write what the person says or does. For example: Mom wants to go to work at night."
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
  <link rel="stylesheet" href="/simulator.css?v=20261120i">
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
    </section>
    <div id="sim" aria-live="polite">
      <noscript><p>${escape(c.noscript)} <a href="${c.translatorHref}">${escape(c.translatorName)}</a></p></noscript>
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
  <script src="/simulator.js?v=20261120i"></script>
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
