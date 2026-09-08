import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const baseURL = "https://dementiacoachapp.com";

const languages = [
  ["de", "Deutsch"], ["en", "English"], ["pl", "Polski"], ["ro", "Română"],
  ["bg", "Български"], ["hr", "Hrvatski"], ["sk", "Slovenčina"], ["hu", "Magyar"],
  ["cs", "Čeština"], ["uk", "Українська"], ["bs", "Bosanski"], ["sr", "Srpski"],
  ["lt", "Lietuvių"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["et", "Eesti"],
  ["ru", "Русский"], ["tr", "Türkçe"], ["ar", "العربية", "rtl"], ["fr", "Français"],
  ["it", "Italiano"], ["es", "Español"], ["pt", "Português"], ["nl", "Nederlands"],
  ["el", "Ελληνικά"], ["sq", "Shqip"], ["fa", "فارسی", "rtl"], ["th", "ไทย"],
  ["da", "Dansk"], ["fi", "Suomi"], ["ga", "Gaeilge"], ["mt", "Malti"], ["sv", "Svenska"]
].map(([code, label, direction]) => ({ code, label, direction }));

const storeLocaleByLanguage = {
  ar: "ar-SA", cs: "cs", da: "da", de: "de-DE", el: "el", en: "en-US",
  es: "es-ES", fi: "fi", fr: "fr-FR", hr: "hr", hu: "hu", it: "it",
  nl: "nl-NL", pl: "pl", pt: "pt-PT", ro: "ro", ru: "ru", sk: "sk",
  sl: "sl-SI", sv: "sv", th: "th", tr: "tr", uk: "uk"
};

const screenshotHeadlines = {
  ar: ["ماذا أقول الآن؟", "صِف الموقف. واحصل على المساعدة.", "مساعدة تناسبك. سؤال سريع.", "شرح واضح. دعم هادئ.", "جرّب المساعدة فورًا.", "اختيارك. خصوصيتك."],
  cs: ["Co mám teď říct?", "Popište situaci. Získejte pomoc.", "Pomoc na míru. Jedna rychlá otázka.", "Jasné vedení. Klidná podpora.", "Vyzkoušejte pomoc hned.", "Vaše volba. Vaše soukromí."],
  da: ["Hvad siger jeg nu?", "Beskriv situationen. Få hjælp.", "Hjælp, der passer. Et hurtigt spørgsmål.", "Klar vejledning. Rolig støtte.", "Prøv hjælpen med det samme.", "Dit valg. Dit privatliv."],
  de: ["Was sage ich jetzt?", "Beschreiben. Hilfe bekommen.", "Passende Hilfe. Eine kurze Frage.", "Klar erklärt. Ruhig begleitet.", "Hilfe direkt ausprobieren.", "Deine Wahl. Deine Privatsphäre."],
  el: ["Τι να πω τώρα;", "Περιγράψτε το. Λάβετε βοήθεια.", "Βοήθεια που ταιριάζει. Μια σύντομη ερώτηση.", "Σαφής καθοδήγηση. Ήρεμη στήριξη.", "Δοκιμάστε τη βοήθεια τώρα.", "Δική σας επιλογή. Δικά σας δεδομένα."],
  en: ["What do I say now?", "Describe it. Get help.", "Help that fits. One quick question.", "Clear guidance. Calm support.", "Try help right away.", "Your choice. Your privacy."],
  es: ["¿Qué digo ahora?", "Describe la situación. Recibe ayuda.", "Ayuda a tu medida. Una pregunta breve.", "Orientación clara. Apoyo tranquilo.", "Prueba la ayuda ahora.", "Tu elección. Tu privacidad."],
  fi: ["Mitä sanoisin nyt?", "Kuvaile tilanne. Saat apua.", "Sopivaa apua. Yksi nopea kysymys.", "Selkeää ohjausta. Rauhallista tukea.", "Kokeile apua heti.", "Sinun valintasi. Sinun yksityisyytesi."],
  fr: ["Que dire maintenant ?", "Décrivez. Recevez de l’aide.", "Une aide adaptée. Une question rapide.", "Des conseils clairs. Un soutien serein.", "Essayez l’aide tout de suite.", "Votre choix. Votre vie privée."],
  hr: ["Što sada reći?", "Opišite situaciju. Dobijte pomoć.", "Pomoć koja odgovara. Jedno kratko pitanje.", "Jasne smjernice. Mirna podrška.", "Isprobajte pomoć odmah.", "Vaš izbor. Vaša privatnost."],
  hu: ["Mit mondjak most?", "Írja le. Kapjon segítséget.", "Önhöz illő segítség. Egy gyors kérdés.", "Világos útmutatás. Nyugodt támogatás.", "Próbálja ki azonnal.", "Az Ön döntése. Az Ön magánszférája."],
  it: ["Cosa posso dire ora?", "Descrivi la situazione. Ricevi aiuto.", "Un aiuto su misura. Una domanda veloce.", "Indicazioni chiare. Sostegno sereno.", "Prova subito l’aiuto.", "La tua scelta. La tua privacy."],
  nl: ["Wat zeg ik nu?", "Beschrijf het. Krijg hulp.", "Hulp die past. Eén korte vraag.", "Duidelijke uitleg. Rustige steun.", "Probeer de hulp meteen.", "Jouw keuze. Jouw privacy."],
  pl: ["Co mam teraz powiedzieć?", "Opisz sytuację. Uzyskaj pomoc.", "Pomoc dopasowana. Jedno krótkie pytanie.", "Jasne wskazówki. Spokojne wsparcie.", "Wypróbuj pomoc od razu.", "Twój wybór. Twoja prywatność."],
  pt: ["O que digo agora?", "Descreva a situação. Obtenha ajuda.", "Ajuda à sua medida. Uma pergunta rápida.", "Orientação clara. Apoio tranquilo.", "Experimente a ajuda agora.", "A sua escolha. A sua privacidade."],
  ro: ["Ce spun acum?", "Descrieți situația. Primiți ajutor.", "Ajutor potrivit. O întrebare scurtă.", "Îndrumare clară. Sprijin calm.", "Încercați ajutorul acum.", "Alegerea dvs. Confidențialitatea dvs."],
  ru: ["Что сказать сейчас?", "Опишите ситуацию. Получите помощь.", "Подходящая помощь. Один короткий вопрос.", "Понятные подсказки. Спокойная поддержка.", "Попробуйте помощь сразу.", "Ваш выбор. Ваша конфиденциальность."],
  sk: ["Čo mám teraz povedať?", "Opíšte situáciu. Získajte pomoc.", "Pomoc na mieru. Jedna krátka otázka.", "Jasné usmernenie. Pokojná podpora.", "Vyskúšajte pomoc hneď.", "Vaša voľba. Vaše súkromie."],
  sl: ["Kaj naj rečem zdaj?", "Opišite situacijo. Poiščite pomoč.", "Pomoč po meri. Eno kratko vprašanje.", "Jasna navodila. Mirna podpora.", "Preizkusite pomoč takoj.", "Vaša izbira. Vaša zasebnost."],
  sv: ["Vad säger jag nu?", "Beskriv situationen. Få hjälp.", "Hjälp som passar. En snabb fråga.", "Tydlig vägledning. Lugnt stöd.", "Prova hjälpen direkt.", "Ditt val. Din integritet."],
  th: ["ตอนนี้ควรพูดอะไร?", "เล่าสถานการณ์ รับคำแนะนำ", "ความช่วยเหลือที่ใช่ คำถามสั้น ๆ", "คำแนะนำชัดเจน ช่วยอย่างใจเย็น", "ลองรับความช่วยเหลือได้ทันที", "คุณเป็นผู้เลือก ความเป็นส่วนตัวของคุณ"],
  tr: ["Şimdi ne söylemeliyim?", "Durumu anlatın. Yardım alın.", "Size uygun yardım. Tek bir kısa soru.", "Net yönlendirme. Sakin destek.", "Yardımı hemen deneyin.", "Seçim sizin. Gizlilik sizin."],
  uk: ["Що сказати зараз?", "Опишіть ситуацію. Отримайте допомогу.", "Допомога, що пасує. Одне коротке питання.", "Чіткі підказки. Спокійна підтримка.", "Спробуйте допомогу одразу.", "Ваш вибір. Ваша приватність."]
};

const fallbackNotes = {
  bg: "Прегледът на приложението е на английски.",
  bs: "Prikaz aplikacije je na engleskom.",
  et: "Rakenduse eelvaade on inglise keeles.",
  fa: "پیش‌نمایش برنامه به زبان انگلیسی است.",
  ga: "Tá réamhamharc na haipe i mBéarla.",
  lt: "Programėlės peržiūra rodoma anglų kalba.",
  lv: "Lietotnes priekšskatījums ir angļu valodā.",
  mt: "Il-previżjoni tal-app hija bl-Ingliż.",
  sq: "Pamja paraprake e aplikacionit është në anglisht.",
  sr: "Prikaz aplikacije je na engleskom."
};

const screenshotFiles = [
  "01-soforthilfe", "02-situation", "03-passende-hilfe",
  "04-klare-begleitung", "05-direkt-testen", "06-datenschutz"
];

const htmlEscape = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const fileFor = (code) => code === "de" ? "index.html" : `index-${code}.html`;
const urlFor = (code) => code === "de" ? `${baseURL}/` : `${baseURL}/index-${code}.html`;

const alternateLinks = [
  ...languages.map(({ code }) => `  <link rel="alternate" hreflang="${code}" href="${urlFor(code)}">`),
  `  <link rel="alternate" hreflang="x-default" href="${baseURL}/">`
].join("\n");

const menuFor = (current) => languages.map(({ code, label, direction }) => {
  const directionAttribute = direction ? ` dir="${direction}"` : "";
  const currentAttribute = code === current ? ' aria-current="page"' : "";
  return `        <a href="${fileFor(code)}" lang="${code}"${directionAttribute}${currentAttribute}>${label}</a>`;
}).join("\n");

const screenshotGridFor = (language) => {
  const storeLocale = storeLocaleByLanguage[language] ?? "en-US";
  const textLanguage = storeLocaleByLanguage[language] ? language : "en";
  const headlines = screenshotHeadlines[textLanguage];
  const fallback = fallbackNotes[language];
  const note = fallback
    ? `        <p class="screenshot-language-note"><span aria-hidden="true">i</span>${htmlEscape(fallback)}</p>\n`
    : "";
  const figures = screenshotFiles.map((file, index) => {
    const caption = fallback
      ? ""
      : `            <figcaption><strong>${htmlEscape(headlines[index])}</strong></figcaption>\n`;
    return `          <figure class="screenshot-card reveal">
            <img src="assets/store/${storeLocale}/${file}.webp" width="640" height="1391" loading="lazy" decoding="async" alt="${htmlEscape(fallback ? `${fallback} ${index + 1}/6` : headlines[index])}">
${caption}          </figure>`;
  }).join("\n");
  return `${note}        <div class="screenshot-grid">\n${figures}\n        </div>`;
};

for (const { code } of languages) {
  const file = path.join(root, fileFor(code));
  let html = fs.readFileSync(file, "utf8");
  const storeLocale = storeLocaleByLanguage[code] ?? "en-US";
  const headlineLanguage = storeLocaleByLanguage[code] ? code : "en";

  html = html.replace(/\s*<p class="hero-language-note">[\s\S]*?<\/p>/g, "");
  html = html.replace(/\s*<p class="screenshot-language-note">[\s\S]*?<\/p>/g, "");

  html = html.replace(/<meta name="robots" content="[^"]+">/, '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">');
  html = html.replace(/<meta name="theme-color" content="[^"]+">/, '<meta name="theme-color" content="#f0f1ff">');
  html = html.replace(/<body([^>]*)data-page-type="localized-product-draft"/, '<body$1data-page-type="localized-product"');
  if (code !== "de" && !/<body\b[^>]*class="[^"]*localized-home/.test(html)) {
    html = html.replace(/<body\b/, '<body class="localized-home"');
  }
  html = html.replace('href="styles.css"', 'href="lovable-home.css?v=20260908b"');
  html = html.replace(/href="lovable-home\.css(?:\?v=[^"]+)?"/, 'href="lovable-home.css?v=20260908b"');
  html = html.replace('src="script.js"', 'src="lovable-home.js"');
  html = html.replace(/<span class="brand-mark" aria-hidden="true"><i><\/i><i><\/i><\/span>/g, '<img class="brand-logo" src="assets/lovable-logo.jpg" width="44" height="44" alt="">');
  html = html.replace(/<!-- localized-alternates:start -->[\s\S]*?<!-- localized-alternates:end -->/, `<!-- localized-alternates:start -->\n${alternateLinks}\n  <!-- localized-alternates:end -->`);
  html = html.replace(/<div class="language-menu">[\s\S]*?<\/div>/, `<div class="language-menu">\n${menuFor(code)}\n        </div>`);

  if (code === "de") {
    html = html.replace(
      '<link rel="preload" href="assets/lovable-hero.png" as="image" type="image/png">',
      '<link rel="preload" href="assets/lovable-hero-640.webp" imagesrcset="assets/lovable-hero-640.webp 640w, assets/lovable-hero-1280.webp 1280w" imagesizes="(max-width: 900px) calc(100vw - 40px), 620px" as="image" type="image/webp">'
    );
    html = html.replace(
      '<img src="assets/lovable-hero.png" width="1640" height="856" fetchpriority="high" alt="Warme Illustration einer Tochter, die ihre Mutter ruhig begleitet">',
      '<picture><source srcset="assets/lovable-hero-640.webp 640w, assets/lovable-hero-1280.webp 1280w" sizes="(max-width: 900px) calc(100vw - 40px), 620px" type="image/webp"><img src="assets/lovable-hero-1280.webp" width="1280" height="669" fetchpriority="high" alt="Warme Illustration einer Tochter, die ihre Mutter ruhig begleitet"></picture>'
    );
  } else {
    html = html.replace(/<link rel="preload" href="[^"]+" as="image" type="image\/webp">/, `<link rel="preload" href="assets/store/${storeLocale}/02-situation.webp" as="image" type="image/webp">`);
    const fallbackBadge = fallbackNotes[code]
      ? `\n          <p class="hero-language-note">${htmlEscape(fallbackNotes[code])}</p>`
      : "";
    const heroPattern = /(<div class="hero-visual reveal"[^>]*>\s*<div class="image-halo" aria-hidden="true">)[\s\S]*?(<\/div>)\s*<img\s+[^>]*fetchpriority="high"[^>]*>/;
    if (!heroPattern.test(html)) throw new Error(`${fileFor(code)}: hero image not found`);
    html = html.replace(
      heroPattern,
      `$1$2\n          <img src="assets/store/${storeLocale}/02-situation.webp" width="640" height="1391" fetchpriority="high" alt="${htmlEscape(fallbackNotes[code] ?? screenshotHeadlines[headlineLanguage][1])}">${fallbackBadge}`
    );
  }

  const gridPattern = /\s*<div class="screenshot-grid">[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/section>/;
  if (!gridPattern.test(html)) throw new Error(`${fileFor(code)}: screenshot grid not found`);
  html = html.replace(gridPattern, `\n${screenshotGridFor(code)}\n      </div>\n    </section>`);

  fs.writeFileSync(file, html);
}

const sitemapFile = path.join(root, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapFile, "utf8");
const firstNonHomeURL = sitemap.indexOf("  <url>\n    <loc>https://dementiacoachapp.com/support.html</loc>");
if (firstNonHomeURL < 0) throw new Error("sitemap.xml: non-home boundary not found");
const homeEntries = languages.map(({ code }) => `  <url>\n    <loc>${urlFor(code)}</loc>\n  </url>`).join("\n");
sitemap = `${sitemap.slice(0, sitemap.indexOf("  <url>"))}${homeEntries}\n${sitemap.slice(firstNonHomeURL)}`;
fs.writeFileSync(sitemapFile, sitemap);

console.log(`Refreshed ${languages.length} localized home pages and sitemap.`);
