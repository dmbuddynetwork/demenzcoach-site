import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const landingRoot = path.join(repoRoot, "landingpage");
const baseURL = "https://dmbuddynetwork.github.io/demenzcoach-site";
const appURL = "https://apps.apple.com/app/apple-store/id6790763941?pt=120702089";
const published = "2026-07-29";
const displayDate = {
  de: "29. Juli 2026",
  en: "29 July 2026"
};

const escapeHTML = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const jsonLD = (value) => JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");

const sourceLinks = {
  communicationDE: {
    label: "Gesundheitsportal Österreich: Demenz – Kommunikation mit Betroffenen",
    url: "https://www.gesundheit.gv.at/krankheiten/gehirn-nerven/demenz/kommunikation.html"
  },
  validationDE: {
    label: "Alzheimer Forschung Initiative: Kommunikation und Validation bei Demenz",
    url: "https://www.alzheimer-forschung.de/demenz/pflege/umgang/kommunikation/"
  },
  reliefDE: {
    label: "Deutsche Alzheimer Gesellschaft: Entlastungsangebote für pflegende Angehörige",
    url: "https://www.deutsche-alzheimer.de/angebote-zur-unterstuetzung/entlastungsangebote"
  },
  overloadDE: {
    label: "gesund.bund.de: Überlastung bei pflegenden Angehörigen",
    url: "https://gesund.bund.de/belastungen-pflegende-angehoerige"
  },
  communicationDAlzG: {
    label: "Deutsche Alzheimer Gesellschaft: Umgang und Kommunikation bei Demenz",
    url: "https://www.deutsche-alzheimer.de/mit-demenz-leben/umgang-und-kommunikation"
  },
  homeEN: {
    label: "Alzheimer’s Society: “I want to go home” – what to say",
    url: "https://www.alzheimers.org.uk/blog/i-want-go-home-what-to-say-to-someone-in-dementia-care"
  },
  caringEN: {
    label: "NHS: Looking after someone with dementia",
    url: "https://www.nhs.uk/conditions/dementia/living-with-dementia/looking-after-someone/"
  },
  behaviourEN: {
    label: "NHS: Coping with dementia behaviour changes",
    url: "https://www.nhs.uk/conditions/dementia/living-with-dementia/behaviour/"
  }
};

const articles = {
  de: [
    {
      slug: "demenz-kommunikation",
      pair: "dementia-communication",
      campaign: "seo_de_kommunikation",
      cluster: "communication",
      related: ["demenz-nach-hause-was-sagen", "pflegende-angehoerige-ueberfordert"],
      title: "Kommunikation bei Demenz: ruhig sprechen in schwierigen Momenten",
      shortTitle: "Kommunikation bei Demenz",
      description: "Konkrete, respektvolle Formulierungen und ein ruhiger Vier-Schritte-Plan für belastende Gespräche mit einem Menschen mit Demenz.",
      eyebrow: "Ratgeber für Angehörige",
      lead: "Wenn ein Gespräch kippt, helfen selten lange Erklärungen. Oft ist ein kurzer Satz, Zeit zum Antworten und ein Blick auf das Gefühl hinter den Worten der bessere Anfang.",
      quick: "Sprich langsam, verwende einen Gedanken pro Satz und gib Zeit. Anerkenne das Gefühl, ohne über Fakten zu streiten. Beobachte danach, ob die Formulierung für diese Person gerade hilfreich ist.",
      body: `
        <section id="erste-schritte">
          <h2>Vier kleine Schritte für den nächsten Moment</h2>
          <ol class="content-steps">
            <li><strong>Kurz innehalten.</strong><span>Prüfe zuerst, ob beide Personen unmittelbar sicher sind. Senke, wenn möglich, Lautstärke und Tempo.</span></li>
            <li><strong>Das Gefühl aufgreifen.</strong><span>Versuche nicht sofort zu korrigieren. Benenne vorsichtig, was du wahrnimmst: Unsicherheit, Sehnsucht oder Ärger.</span></li>
            <li><strong>Einen kurzen Satz anbieten.</strong><span>Eine Aussage oder eine einfache Frage reicht. Mehrere Erklärungen hintereinander können zusätzlich belasten.</span></li>
            <li><strong>Reaktion beobachten.</strong><span>Was heute hilft, kann morgen unpassend sein. Lass die Antwort der Person bestimmen, wie es weitergeht.</span></li>
          </ol>
        </section>
        <section id="formulierungen">
          <h2>Mögliche Formulierungen zum Ausprobieren</h2>
          <div class="phrase-list">
            <p>„Ich bin bei dir. Wir schauen gemeinsam.“</p>
            <p>„Das klingt gerade beunruhigend. Was würde dir jetzt guttun?“</p>
            <p>„Nimm dir Zeit. Ich höre dir zu.“</p>
          </div>
          <p>Diese Sätze sind keine Regeln. Passe Anrede, Nähe und Wortwahl an die Person und eure Beziehung an.</p>
        </section>
        <section id="vermeiden">
          <h2>Was Gespräche unnötig schwer machen kann</h2>
          <ul>
            <li>über Erinnerungen oder die „richtige“ Wirklichkeit zu streiten,</li>
            <li>mehrere Fragen oder Wahlmöglichkeiten gleichzeitig zu geben,</li>
            <li>in einem kindlichen oder prüfenden Ton zu sprechen,</li>
            <li>eine einmal erfolgreiche Formulierung als sichere Lösung zu behandeln.</li>
          </ul>
        </section>
        <section id="professionelle-hilfe">
          <h2>Wann ein Gespräch nicht ausreicht</h2>
          <p>Plötzlich neu auftretende oder deutlich stärkere Verwirrtheit, Schmerzen, Atemnot, ein Sturz oder unmittelbare Gefahr gehören nicht in eine Kommunikations-App. Hole dann zeitnah professionelle beziehungsweise örtliche Notfallhilfe. Demenz Coach ersetzt keine medizinische Beratung.</p>
        </section>`,
      sources: [sourceLinks.communicationDE, sourceLinks.validationDE]
    },
    {
      slug: "demenz-nach-hause-was-sagen",
      pair: "dementia-wants-to-go-home",
      campaign: "seo_de_nach_hause",
      cluster: "situations",
      related: ["demenz-kommunikation", "pflegende-angehoerige-ueberfordert"],
      title: "„Ich will nach Hause“ bei Demenz: Was kann ich sagen?",
      shortTitle: "Wenn jemand nach Hause will",
      description: "Ruhige Antworten, wenn ein Mensch mit Demenz nach Hause möchte – auch wenn die Person bereits zu Hause ist.",
      eyebrow: "Konkrete Demenz-Situation",
      lead: "„Ich will nach Hause“ kann Angehörige ratlos machen. Statt den Ort zu beweisen, kannst du zuerst die Sehnsucht oder Unsicherheit hinter dem Satz aufgreifen.",
      quick: "Vermeide einen Streit darüber, ob die Person bereits zu Hause ist. Greife das Gefühl vorsichtig auf, frage nach dem vermissten Ort oder Menschen und biete etwas Vertrautes an – nur wenn es willkommen ist.",
      body: `
        <section id="was-zuhause-bedeuten-kann">
          <h2>„Zuhause“ kann mehr als einen Ort meinen</h2>
          <p>Der Wunsch kann mit Sicherheit, Vertrautheit, einer früheren Lebensphase oder einer vermissten Person verbunden sein. Das ist eine mögliche Deutung, keine Gewissheit. Frage behutsam und höre auf die Antwort.</p>
        </section>
        <section id="formulierungen">
          <h2>Mögliche Sätze zum Ausprobieren</h2>
          <div class="phrase-list">
            <p>„Du vermisst dein Zuhause. Erzähl mir davon.“</p>
            <p>„Was fehlt dir dort gerade am meisten?“</p>
            <p>„Du möchtest dich sicher fühlen. Ich bleibe einen Moment bei dir.“</p>
          </div>
          <p>Versprich keine Fahrt oder Rückkehr, die du nicht einhalten kannst. Manchmal ist ruhiges Zuhören bereits hilfreicher als ein neuer Vorschlag.</p>
        </section>
        <section id="naechster-schritt">
          <h2>Ein kleiner nächster Schritt</h2>
          <ul>
            <li>Prüfe ohne Verhör, ob Hunger, Durst, Schmerzen, Müdigkeit oder zu viele Reize eine Rolle spielen könnten.</li>
            <li>Biete eine vertraute Tätigkeit, Musik, ein Fotoalbum oder einen ruhigen Raum an, wenn die Person das mag.</li>
            <li>Wenn der Wunsch stärker wird, reduziere deine Worte und wiederhole lieber ruhig einen kurzen Satz.</li>
          </ul>
        </section>
        <section id="sicherheit">
          <h2>Sicherheit geht vor</h2>
          <p>Wenn die Person das Haus verlassen möchte und sich dadurch gefährden könnte, wenn sie vermisst wird oder unmittelbare Gefahr besteht, hole örtliche professionelle beziehungsweise Notfallhilfe. Versuche nicht, eine gefährliche Situation allein mit Worten zu lösen.</p>
        </section>`,
      sources: [sourceLinks.homeEN, sourceLinks.validationDE]
    },
    {
      slug: "pflegende-angehoerige-ueberfordert",
      pair: "dementia-caregiver-overwhelmed",
      campaign: "seo_de_ueberfordert",
      cluster: "safety",
      related: ["demenz-kommunikation", "demenz-nach-hause-was-sagen"],
      title: "Als pflegender Angehöriger überfordert: Was hilft jetzt?",
      shortTitle: "Wenn dir alles zu viel wird",
      description: "Ein kurzer Plan mit Sicherheitscheck für pflegende Angehörige, wenn die Belastung im Demenz-Alltag zu groß wird.",
      eyebrow: "Selbstfürsorge für Angehörige",
      lead: "Überforderung ist kein persönliches Versagen. Pflege kann körperlich, emotional und sozial stark belasten. Du musst die nächste Stunde nicht allein lösen.",
      quick: "Sorge zuerst für unmittelbare Sicherheit. Reduziere Anforderungen, hole eine vertraute Person dazu und nimm eine kurze Pause, wenn die betreute Person dabei sicher ist. Organisiere Unterstützung früh, nicht erst im Zusammenbruch.",
      body: `
        <section id="jetzt">
          <h2>Ein kurzer Plan für die nächsten Minuten</h2>
          <ol class="content-steps">
            <li><strong>Sicherheit prüfen.</strong><span>Besteht unmittelbare Gefahr für dich oder die andere Person? Dann hole örtliche Hilfe.</span></li>
            <li><strong>Anforderungen senken.</strong><span>Verschiebe, was nicht jetzt erledigt werden muss. Weniger Worte und weniger Reize können beiden Seiten Raum geben.</span></li>
            <li><strong>Eine Person kontaktieren.</strong><span>Bitte konkret um eine kleine Aufgabe: zehn Minuten übernehmen, einkaufen oder einfach am Telefon bleiben.</span></li>
            <li><strong>Kurz ausatmen.</strong><span>Wenn die betreute Person sicher ist, trink etwas, setz dich oder geh für einen Moment aus der Situation.</span></li>
          </ol>
        </section>
        <section id="entlastung">
          <h2>Entlastung ist Teil guter Pflege</h2>
          <p>Regelmäßige Pausen, Beratung, Angehörigengruppen und zeitweise Betreuung sind keine Belohnung, sondern können helfen, die eigene Gesundheit und die Beziehung zu schützen. Plane Unterstützung möglichst bevor jede Reserve aufgebraucht ist.</p>
        </section>
        <section id="warnzeichen">
          <h2>Wann du zusätzliche Hilfe brauchst</h2>
          <p>Wenn Erschöpfung, Schlafprobleme, Gereiztheit, Niedergeschlagenheit oder sozialer Rückzug anhalten, sprich mit einer medizinischen oder psychosozialen Fachstelle über deine eigene Belastung. Wenn du fürchtest, die Kontrolle zu verlieren oder jemand unmittelbar gefährdet ist, schaffe Abstand, soweit das sicher möglich ist, und hole örtliche Notfallhilfe.</p>
        </section>`,
      sources: [sourceLinks.overloadDE, sourceLinks.reliefDE]
    }
  ],
  en: [
    {
      slug: "dementia-communication",
      pair: "demenz-kommunikation",
      campaign: "seo_en_communication",
      cluster: "communication",
      related: ["dementia-wants-to-go-home", "dementia-caregiver-overwhelmed"],
      title: "Dementia communication: calm words for difficult moments",
      shortTitle: "Dementia communication",
      description: "Respectful phrases and a calm four-step plan for difficult conversations with a person living with dementia.",
      eyebrow: "Guide for family caregivers",
      lead: "When a conversation becomes difficult, long explanations rarely help. A short sentence, time to respond and attention to the feeling behind the words can be a better start.",
      quick: "Speak slowly, use one idea per sentence and allow time. Acknowledge the feeling without arguing about facts. Then watch whether the approach is helpful for this person today.",
      body: `
        <section id="first-steps">
          <h2>Four small steps for the next moment</h2>
          <ol class="content-steps">
            <li><strong>Pause briefly.</strong><span>First check that both people are immediately safe. Reduce noise and pace if you can.</span></li>
            <li><strong>Notice the feeling.</strong><span>Do not rush to correct. Gently name what you may be seeing, such as uncertainty, longing or anger.</span></li>
            <li><strong>Offer one short sentence.</strong><span>One statement or simple question is enough. Several explanations can add pressure.</span></li>
            <li><strong>Watch the response.</strong><span>What helps today may not fit tomorrow. Let the person’s response guide what happens next.</span></li>
          </ol>
        </section>
        <section id="phrases">
          <h2>Possible phrases to try</h2>
          <div class="phrase-list">
            <p>“I’m here with you. We can look at this together.”</p>
            <p>“This seems worrying right now. What might feel helpful?”</p>
            <p>“Take your time. I’m listening.”</p>
          </div>
          <p>These are not rules. Adapt the words, closeness and form of address to the person and your relationship.</p>
        </section>
        <section id="avoid">
          <h2>What can make a conversation harder</h2>
          <ul>
            <li>arguing about memories or the “correct” version of events,</li>
            <li>offering several questions or choices at once,</li>
            <li>using a childish or testing tone,</li>
            <li>treating a phrase that worked once as a guaranteed solution.</li>
          </ul>
        </section>
        <section id="professional-help">
          <h2>When conversation is not enough</h2>
          <p>New or sharply increased confusion, pain, breathing difficulty, a fall or immediate danger should not be handled by a communication app. Seek timely professional or local emergency help. Dementia Coach does not replace medical advice.</p>
        </section>`,
      sources: [sourceLinks.caringEN, sourceLinks.behaviourEN]
    },
    {
      slug: "dementia-wants-to-go-home",
      pair: "demenz-nach-hause-was-sagen",
      campaign: "seo_en_go_home",
      cluster: "situations",
      related: ["dementia-communication", "dementia-caregiver-overwhelmed"],
      title: "When a person with dementia wants to go home: what can I say?",
      shortTitle: "When someone wants to go home",
      description: "Calm responses when a person with dementia asks to go home, including when they are already at home.",
      eyebrow: "A common dementia-care moment",
      lead: "“I want to go home” can leave family caregivers unsure what to say. Instead of proving the location, start with the longing or uncertainty behind the words.",
      quick: "Avoid arguing that the person is already home. Gently acknowledge the feeling, ask about the place or person they miss and offer something familiar only if it is welcome.",
      body: `
        <section id="what-home-can-mean">
          <h2>“Home” may mean more than a place</h2>
          <p>The wish may be connected with safety, familiarity, an earlier time in life or a person they miss. This is a possibility, not a certainty. Ask gently and listen to the answer.</p>
        </section>
        <section id="phrases">
          <h2>Possible phrases to try</h2>
          <div class="phrase-list">
            <p>“You miss home. Tell me about it.”</p>
            <p>“What do you miss most there?”</p>
            <p>“You want to feel safe. I can stay with you for a moment.”</p>
          </div>
          <p>Do not promise a journey or return that you cannot provide. Sometimes calm listening is more helpful than another suggestion.</p>
        </section>
        <section id="next-step">
          <h2>One small next step</h2>
          <ul>
            <li>Without turning it into a test, consider whether hunger, thirst, pain, tiredness or too much stimulation may be involved.</li>
            <li>Offer a familiar activity, music, photographs or a quieter space if the person enjoys them.</li>
            <li>If distress increases, use fewer words and calmly repeat one short sentence.</li>
          </ul>
        </section>
        <section id="safety">
          <h2>Safety comes first</h2>
          <p>If the person may be at risk by leaving, is missing, or there is immediate danger, seek local professional or emergency help. Do not try to manage a dangerous situation with words alone.</p>
        </section>`,
      sources: [sourceLinks.homeEN, sourceLinks.caringEN]
    },
    {
      slug: "dementia-caregiver-overwhelmed",
      pair: "pflegende-angehoerige-ueberfordert",
      campaign: "seo_en_overwhelmed",
      cluster: "safety",
      related: ["dementia-communication", "dementia-wants-to-go-home"],
      title: "Overwhelmed as a dementia caregiver: what can help now?",
      shortTitle: "When caregiving feels too much",
      description: "A short plan with a safety check for family caregivers when the demands of dementia care feel overwhelming.",
      eyebrow: "Caregiver self-care",
      lead: "Feeling overwhelmed is not a personal failure. Caregiving can be physically, emotionally and socially demanding. You do not have to solve the next hour alone.",
      quick: "Start with immediate safety. Reduce demands, ask one trusted person for a specific task and take a short break when the person you support is safe. Arrange support early, not only at breaking point.",
      body: `
        <section id="right-now">
          <h2>A short plan for the next few minutes</h2>
          <ol class="content-steps">
            <li><strong>Check safety.</strong><span>Is there immediate danger to you or the other person? Seek local help if there is.</span></li>
            <li><strong>Lower the demands.</strong><span>Postpone anything that does not need to happen now. Fewer words and less stimulation can create space.</span></li>
            <li><strong>Contact one person.</strong><span>Ask for one concrete task: stay for ten minutes, collect groceries or remain on the phone.</span></li>
            <li><strong>Take one breath of space.</strong><span>If the person is safe, drink something, sit down or step away briefly.</span></li>
          </ol>
        </section>
        <section id="relief">
          <h2>Support is part of sustainable care</h2>
          <p>Regular breaks, professional advice, caregiver groups and respite support can protect your health and your relationship. Try to arrange support before every reserve has been used.</p>
        </section>
        <section id="warning-signs">
          <h2>When to seek more help</h2>
          <p>If exhaustion, sleep problems, irritability, low mood or social withdrawal continue, speak with a health or psychosocial professional about your own wellbeing. If you fear losing control or someone is in immediate danger, create distance when safe and seek local emergency help.</p>
        </section>`,
      sources: [sourceLinks.caringEN, sourceLinks.behaviourEN]
    }
  ]
};

const retiredPageSlugs = new Set([
  "demenz-wiederholt-fragen",
  "demenz-unruhe-am-abend",
  "ploetzliche-verwirrtheit-demenz"
]);

const publicArticles = Object.fromEntries(
  Object.entries(articles).map(([lang, entries]) => [
    lang,
    entries.filter((article) => !retiredPageSlugs.has(article.slug))
  ])
);

const locale = {
  de: {
    lang: "de",
    directory: "ratgeber",
    hubTitle: "Demenz-Ratgeber für Angehörige",
    hubDescription: "Kurze, quellenbasierte Ratgeber zu Kommunikation, schwierigen Demenz-Momenten und der Entlastung pflegender Angehöriger.",
    hubLead: "Konkrete Worte für den nächsten Moment – respektvoll, verständlich und ohne medizinische Versprechen.",
    guideLabel: "Ratgeber",
    home: "Startseite",
    app: "App entdecken",
    menu: "Menü öffnen",
    menuClose: "Menü schließen",
    mainNav: "Hauptnavigation",
    skip: "Zum Inhalt springen",
    updated: "Aktualisiert",
    quick: "Kurzantwort",
    sources: "Quellen und weiterführende Informationen",
    sourceNote: "Die verlinkten Quellen dienen der fachlichen Einordnung. Demenz Coach ist nicht mit diesen Organisationen verbunden.",
    editorial: "Redaktionelle Leitlinien",
    allGuides: "Alle Ratgeber",
    ctaTitle: "Wenn dir im Moment die Worte fehlen",
    ctaText: "Demenz Coach bietet mögliche Formulierungen und kleine nächste Schritte für belastende Alltagssituationen.",
    ctaButton: "Im App Store ansehen",
    safety: "Kein Ersatz für medizinische Beratung oder örtliche Notfallhilfe.",
    legal: {
      support: "Support",
      privacy: "Datenschutz",
      terms: "Nutzungsbedingungen",
      imprint: "Impressum"
    }
  },
  en: {
    lang: "en",
    directory: "guides",
    hubTitle: "Dementia guides for family caregivers",
    hubDescription: "Short, source-based guides to dementia communication, difficult moments and family caregiver wellbeing.",
    hubLead: "Practical words for the next moment — respectful, clear and free of medical promises.",
    guideLabel: "Guides",
    home: "Home",
    app: "Explore the app",
    menu: "Open menu",
    menuClose: "Close menu",
    mainNav: "Main navigation",
    skip: "Skip to content",
    updated: "Updated",
    quick: "Quick answer",
    sources: "Sources and further information",
    sourceNote: "These links provide background information. Dementia Coach is not affiliated with the organisations listed.",
    editorial: "Editorial guidelines",
    allGuides: "All guides",
    ctaTitle: "When you do not know what to say",
    ctaText: "Dementia Coach offers possible phrases and small next steps for difficult everyday moments.",
    ctaButton: "View on the App Store",
    safety: "Not a replacement for medical advice or local emergency help.",
    legal: {
      support: "Support",
      privacy: "Privacy",
      terms: "Terms",
      imprint: "Imprint"
    }
  }
};

const alternateURL = (lang, slug = "") => {
  const directory = locale[lang].directory;
  return slug ? `${baseURL}/${directory}/${slug}.html` : `${baseURL}/${directory}/`;
};

const sharedHead = ({
  lang,
  title,
  description,
  canonical,
  alternate,
  image,
  schema,
  titleTag = title,
  ogType = "article"
}) => `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHTML(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#f7f3ea">
  <meta name="apple-itunes-app" content="app-id=6790763941">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Demenz Coach">
  <meta property="og:locale" content="${lang === "de" ? "de_DE" : "en_US"}">
  <meta property="og:title" content="${escapeHTML(title)}">
  <meta property="og:description" content="${escapeHTML(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHTML(title)}">
  <meta name="twitter:description" content="${escapeHTML(description)}">
  <meta name="twitter:image" content="${image}">
  <title>${escapeHTML(titleTag)} | Demenz Coach</title>
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${lang}" href="${canonical}">
  ${alternate ? `<link rel="alternate" hreflang="${alternate.lang}" href="${alternate.url}">` : ""}
  <link rel="alternate" hreflang="x-default" href="${lang === "de" || !alternate ? canonical : alternate.url}">
  <link rel="sitemap" type="application/xml" href="${baseURL}/sitemap.xml">
  <link rel="icon" type="image/png" sizes="192x192" href="../assets/favicon-192.png">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="manifest" href="../site.webmanifest">
  <link rel="stylesheet" href="../styles.css">
  <script type="application/ld+json">${jsonLD(schema)}</script>`;

const header = (copy, current = "guides", showAppCTA = true) => `
  <header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="../${copy.lang === "de" ? "" : "index-en.html"}" aria-label="Demenz Coach">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <span>Demenz Coach</span>
      </a>
      <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">
        <span class="sr-only">${copy.menu}</span><span></span><span></span>
      </button>
      <nav id="site-nav" class="site-nav" aria-label="${copy.mainNav}">
        <a href="../${copy.lang === "de" ? "" : "index-en.html"}">${copy.home}</a>
        <a href="./" ${current === "guides" ? "aria-current=\"page\"" : ""}>${copy.guideLabel}</a>
        <a href="redaktion.html" ${current === "editorial" ? "aria-current=\"page\"" : ""}>${copy.editorial}</a>
        ${showAppCTA ? `<a class="button button-small" href="${appURL}&amp;ct=seo_${copy.lang}_nav&amp;mt=8" data-store-link="seo-${copy.lang}-nav">${copy.app}</a>` : ""}
      </nav>
    </div>
  </header>`;

const footer = (copy) => `
  <footer class="site-footer">
    <div class="container footer-grid">
      <a class="brand" href="../${copy.lang === "de" ? "" : "index-en.html"}"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span>Demenz Coach</span></a>
      <p>${copy.safety}</p>
      <nav aria-label="${copy.legal.support}">
        <a href="./">${copy.allGuides}</a>
        <a href="redaktion.html">${copy.editorial}</a>
        <a href="../${copy.lang === "de" ? "support.html" : "support-en.html"}">${copy.legal.support}</a>
        <a href="../${copy.lang === "de" ? "datenschutz.html" : "privacy-en.html"}">${copy.legal.privacy}</a>
        <a href="../${copy.lang === "de" ? "nutzungsbedingungen.html" : "terms-en.html"}">${copy.legal.terms}</a>
        <a href="../${copy.lang === "de" ? "impressum.html" : "imprint-en.html"}">${copy.legal.imprint}</a>
      </nav>
    </div>
  </footer>`;

const contentSchema = ({
  lang,
  canonical,
  title,
  description,
  image,
  sources,
  breadcrumb,
  type = "Article",
  items = []
}) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": type,
      "@id": `${canonical}#content`,
      "mainEntityOfPage": { "@id": `${canonical}#webpage` },
      "headline": title,
      "description": description,
      "inLanguage": lang,
      "isAccessibleForFree": true,
      "datePublished": published,
      "dateModified": published,
      "author": { "@id": `${baseURL}/#organization` },
      "publisher": { "@id": `${baseURL}/#organization` },
      "image": image,
      ...(sources?.length ? { "citation": sources.map(({ url }) => url) } : {}),
      ...(items.length ? {
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "url": item.url
          }))
        }
      } : {})
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      "url": canonical,
      "name": title,
      "description": description,
      "inLanguage": lang,
      "isPartOf": { "@id": `${baseURL}/#website` },
      "primaryImageOfPage": image
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumb.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": item.url
      }))
    },
    {
      "@type": "Organization",
      "@id": `${baseURL}/#organization`,
      "name": "Demenz Coach",
      "url": `${baseURL}/`
    },
    {
      "@type": "WebSite",
      "@id": `${baseURL}/#website`,
      "url": `${baseURL}/`,
      "name": "Demenz Coach",
      "publisher": { "@id": `${baseURL}/#organization` }
    }
  ]
});

const sources = (copy, articleSources) => `
  <section class="article-sources" aria-labelledby="sources-title">
    <h2 id="sources-title">${copy.sources}</h2>
    <ul>
      ${articleSources.map(({ label, url }) => `<li><a href="${url}" rel="noopener">${escapeHTML(label)}</a></li>`).join("\n")}
    </ul>
    <p><small>${copy.sourceNote}</small></p>
  </section>`;

const cta = (copy, campaign) => `
  <aside class="article-cta">
    <div>
      <span class="eyebrow">Demenz Coach</span>
      <h2>${copy.ctaTitle}</h2>
      <p>${copy.ctaText}</p>
    </div>
    <a class="button" href="${appURL}&amp;ct=${campaign}&amp;mt=8" data-store-link="${campaign}">${copy.ctaButton}</a>
  </aside>`;

const relatedGuides = (lang, article) => {
  const copy = locale[lang];
  const articleBySlug = new Map(publicArticles[lang].map((candidate) => [candidate.slug, candidate]));
  const related = (article.related ?? [])
    .map((slug) => articleBySlug.get(slug))
    .filter(Boolean);
  if (!related.length) return "";

  return `
  <section class="related-guides" aria-labelledby="related-guides-title">
    <span class="eyebrow">${lang === "de" ? "Weiterlesen" : "Keep reading"}</span>
    <h2 id="related-guides-title">${lang === "de" ? "Passende Ratgeber" : "Related guides"}</h2>
    <div class="related-guide-grid">
      ${related.map((candidate) => `<a class="related-guide-link" href="${candidate.slug}.html" data-related-link="${candidate.slug}">
        <span>${escapeHTML(candidate.eyebrow)}</span>
        <strong>${escapeHTML(candidate.shortTitle)}</strong>
      </a>`).join("\n")}
    </div>
    <p><a class="text-link" href="./" data-related-link="${copy.directory}">${copy.allGuides} <span aria-hidden="true">→</span></a></p>
  </section>`;
};

const renderArticle = (lang, article) => {
  const copy = locale[lang];
  const otherLang = lang === "de" ? "en" : "de";
  const canonical = alternateURL(lang, article.slug);
  const alternate = article.pair
    ? { lang: otherLang, url: alternateURL(otherLang, article.pair) }
    : null;
  const image = `${baseURL}/assets/og-${lang}.webp`;
  const conciseTitles = {
    "demenz-kommunikation": "Kommunikation bei Demenz: ruhige Sätze",
    "demenz-nach-hause-was-sagen": "Demenz will nach Hause: Was sagen?",
    "pflegende-angehoerige-ueberfordert": "Pflegende Angehörige überfordert: Was tun?",
    "dementia-communication": "Dementia communication tips",
    "dementia-wants-to-go-home": "Dementia wants to go home: what to say",
    "dementia-caregiver-overwhelmed": "Overwhelmed dementia caregiver: what helps?"
  };
  const schema = contentSchema({
    lang,
    canonical,
    title: article.title,
    description: article.description,
    image,
    sources: article.sources,
    breadcrumb: [
      { name: copy.home, url: lang === "de" ? `${baseURL}/` : `${baseURL}/index-en.html` },
      { name: copy.guideLabel, url: alternateURL(lang) },
      { name: article.shortTitle, url: canonical }
    ]
  });

  return `<!doctype html>
<html lang="${lang}">
<head>
${sharedHead({
  lang,
  title: article.title,
  titleTag: conciseTitles[article.slug],
  description: article.description,
  canonical,
  alternate,
  image,
  schema
})}
</head>
<body data-page-type="seo-guide" data-page-language="${lang}" data-page-slug="${article.slug}">
  <a class="skip-link" href="#main">${copy.skip}</a>
${header(copy, "guides", article.safetyFirst !== true)}
  <main id="main" class="content-main">
    <article class="seo-article">
      <div class="container content-narrow">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="../${lang === "de" ? "" : "index-en.html"}">${copy.home}</a><span aria-hidden="true">›</span>
          <a href="./">${copy.guideLabel}</a><span aria-hidden="true">›</span>
          <span aria-current="page">${escapeHTML(article.shortTitle)}</span>
        </nav>
        <header class="article-header">
          <span class="eyebrow">${escapeHTML(article.eyebrow)}</span>
          <h1>${escapeHTML(article.title)}</h1>
          <p class="article-lead">${escapeHTML(article.lead)}</p>
          <p class="article-meta">${copy.updated}: <time datetime="${published}">${displayDate[lang]}</time> · <a href="redaktion.html">Demenz Coach ${copy.editorial}</a></p>
        </header>
        <aside class="safety-note">
          <strong>${copy.safety}</strong>
          <span>${article.safetyNotice ?? (lang === "de"
            ? "Die Hinweise sind allgemeine Kommunikations- und Alltagshilfe. Plötzliche deutliche Veränderungen, Stürze, Atemnot oder unmittelbare Gefahr brauchen professionelle beziehungsweise örtliche Notfallhilfe."
            : "These are general communication and everyday support ideas. Sudden significant changes, falls, breathing difficulty or immediate danger require professional or local emergency help.")}</span>
        </aside>
        <section class="quick-answer" aria-labelledby="quick-answer-title">
          <h2 id="quick-answer-title">${copy.quick}</h2>
          <p>${escapeHTML(article.quick)}</p>
        </section>
        <div class="article-body">
${article.body}
        </div>
${relatedGuides(lang, article)}
${cta(copy, article.campaign)}
${sources(copy, article.sources)}
      </div>
    </article>
  </main>
${footer(copy)}
  <script>window.demenzCoachSiteLocale=${jsonLD({
    menuOpen: copy.menu,
    menuClose: copy.menuClose,
    privacyURL: `../${lang === "de" ? "datenschutz.html" : "privacy-en.html"}`
  })};</script>
  <script src="../script.js"></script>
</body>
</html>
`;
};

const renderHub = (lang) => {
  const copy = locale[lang];
  const otherLang = lang === "de" ? "en" : "de";
  const canonical = alternateURL(lang);
  const alternate = { lang: otherLang, url: alternateURL(otherLang) };
  const image = `${baseURL}/assets/og-${lang}.webp`;
  const clusterOrder = ["communication", "situations", "safety"];
  const clusterLabels = lang === "de"
    ? {
        communication: {
          eyebrow: "Grundlagen",
          title: "Verstehen und ruhig kommunizieren",
          description: "Kurze Sätze, Orientierung und respektvolle Antworten für wiederkehrende Fragen."
        },
        situations: {
          eyebrow: "Alltagssituationen",
          title: "Konkrete Momente gemeinsam sortieren",
          description: "Mögliche nächste Schritte, wenn Zuhause-Sehnsucht belastet."
        },
        safety: {
          eyebrow: "Sicherheit und Entlastung",
          title: "Angehörige mitdenken",
          description: "Ein kurzer Plan bei eigener Überforderung."
        }
      }
    : {
        communication: {
          eyebrow: "Foundations",
          title: "Understand and communicate calmly",
          description: "Short, respectful communication ideas for difficult moments."
        },
        situations: {
          eyebrow: "Everyday situations",
          title: "Make sense of a specific moment",
          description: "Possible words and next steps when someone wants to go home."
        },
        safety: {
          eyebrow: "Caregiver wellbeing",
          title: "Include the person providing care",
          description: "A short safety and support plan when caregiving feels too much."
        }
      };
  const schema = contentSchema({
    lang,
    canonical,
    title: copy.hubTitle,
    description: copy.hubDescription,
    image,
    breadcrumb: [
      { name: copy.home, url: lang === "de" ? `${baseURL}/` : `${baseURL}/index-en.html` },
      { name: copy.guideLabel, url: canonical }
    ],
    type: "CollectionPage",
    items: publicArticles[lang].map((article) => ({
      name: article.shortTitle,
      url: alternateURL(lang, article.slug)
    }))
  });
  return `<!doctype html>
<html lang="${lang}">
<head>
${sharedHead({
  lang,
  title: copy.hubTitle,
  description: copy.hubDescription,
  canonical,
  alternate,
  image,
  schema,
  ogType: "website"
})}
</head>
<body data-page-type="seo-hub" data-page-language="${lang}" data-page-slug="${copy.directory}">
  <a class="skip-link" href="#main">${copy.skip}</a>
${header(copy)}
  <main id="main" class="content-main">
    <section class="content-hero">
      <div class="container content-narrow">
        <span class="eyebrow">Demenz Coach</span>
        <h1>${copy.hubTitle}</h1>
        <p>${copy.hubLead}</p>
      </div>
    </section>
    <section class="section content-library">
      <div class="container">
${clusterOrder.map((cluster) => {
    const clusterArticles = publicArticles[lang].filter((article) => article.cluster === cluster);
    if (!clusterArticles.length) return "";
    const label = clusterLabels[cluster];
    return `        <section class="topic-cluster" aria-labelledby="${cluster}-cluster-title">
          <header class="topic-cluster-header">
            <span class="eyebrow">${label.eyebrow}</span>
            <h2 id="${cluster}-cluster-title">${label.title}</h2>
            <p>${label.description}</p>
          </header>
          <div class="content-card-grid">
${clusterArticles.map((article) => `            <article class="content-card">
            <span class="eyebrow">${escapeHTML(article.eyebrow)}</span>
            <h3><a href="${article.slug}.html" data-content-link="${article.slug}">${escapeHTML(article.shortTitle)}</a></h3>
            <p>${escapeHTML(article.description)}</p>
            <a class="text-link" href="${article.slug}.html" data-content-link="${article.slug}">${lang === "de" ? "Ratgeber lesen" : "Read the guide"} <span aria-hidden="true">→</span></a>
            </article>`).join("\n")}
          </div>
        </section>`;
  }).join("\n")}
        <aside class="safety-note"><strong>${copy.safety}</strong></aside>
      </div>
    </section>
  </main>
${footer(copy)}
  <script>window.demenzCoachSiteLocale=${jsonLD({
    menuOpen: copy.menu,
    menuClose: copy.menuClose,
    privacyURL: `../${lang === "de" ? "datenschutz.html" : "privacy-en.html"}`
  })};</script>
  <script src="../script.js"></script>
</body>
</html>
`;
};

const renderEditorial = (lang) => {
  const copy = locale[lang];
  const otherLang = lang === "de" ? "en" : "de";
  const canonical = `${alternateURL(lang)}redaktion.html`;
  const alternate = { lang: otherLang, url: `${alternateURL(otherLang)}redaktion.html` };
  const image = `${baseURL}/assets/og-${lang}.webp`;
  const title = lang === "de" ? "Redaktionelle Leitlinien" : "Editorial guidelines";
  const description = lang === "de"
    ? "So recherchiert, begrenzt und aktualisiert Demenz Coach seine Ratgeber für pflegende Angehörige."
    : "How Dementia Coach researches, limits and updates its guides for family caregivers.";
  const schema = contentSchema({
    lang,
    canonical,
    title,
    description,
    image,
    breadcrumb: [
      { name: copy.home, url: lang === "de" ? `${baseURL}/` : `${baseURL}/index-en.html` },
      { name: copy.guideLabel, url: alternateURL(lang) },
      { name: title, url: canonical }
    ],
    type: "WebPage"
  });
  const body = lang === "de" ? `
    <section><h2>Wofür die Ratgeber da sind</h2><p>Unsere Texte helfen Angehörigen, eine belastende Alltagssituation zu sortieren und mögliche Worte zum Ausprobieren zu finden. Sie stellen keine Diagnose, Therapie oder individuelle medizinische Beratung dar.</p></section>
    <section><h2>Quellen und fachliche Grenzen</h2><p>Wir bevorzugen öffentliche Gesundheitsportale, anerkannte Demenzorganisationen und aktuelle Primärquellen. Aussagen werden konservativ paraphrasiert. Wo Situationen individuell verschieden sind, schreiben wir ausdrücklich von Möglichkeiten statt Gewissheiten.</p></section>
    <section><h2>Sicherheit</h2><p>Plötzliche deutliche Veränderungen, Schmerzen, Atemnot, Stürze, vermisste Personen und unmittelbare Gefahr werden nicht als Kommunikationsproblem behandelt. Die Seiten verweisen in solchen Fällen auf professionelle beziehungsweise örtliche Notfallhilfe.</p></section>
    <section><h2>KI und menschliche Verantwortung</h2><p>KI kann bei Struktur, Übersetzungsentwürfen und Qualitätschecks unterstützen. Gesundheitsbezogene Inhalte werden nicht automatisiert in viele Sprachen skaliert. Veröffentlichung, Quellenwahl und Sicherheitsgrenzen bleiben eine redaktionelle Verantwortung.</p></section>
    <section><h2>Aktualisierung und Korrekturen</h2><p>Jede Seite trägt ein Aktualisierungsdatum. Hinweise auf Fehler oder unklare Formulierungen können über den <a href="../support.html">Support</a> gemeldet werden.</p></section>`
    : `
    <section><h2>What the guides are for</h2><p>Our guides help family caregivers make sense of a difficult everyday moment and find possible words to try. They do not provide diagnosis, treatment or individual medical advice.</p></section>
    <section><h2>Sources and limits</h2><p>We prefer public health services, recognised dementia organisations and current primary sources. Claims are paraphrased conservatively. Where every person and moment may differ, we describe possibilities rather than certainties.</p></section>
    <section><h2>Safety</h2><p>Sudden significant changes, pain, breathing difficulty, falls, a missing person and immediate danger are not treated as communication problems. In these situations, the guides direct readers to professional or local emergency help.</p></section>
    <section><h2>AI and human responsibility</h2><p>AI may support structure, translation drafts and quality checks. Health-related articles are not automatically scaled across many languages. Publication, source selection and safety boundaries remain an editorial responsibility.</p></section>
    <section><h2>Updates and corrections</h2><p>Every page shows an update date. You can report an error or unclear wording through <a href="../support-en.html">support</a>.</p></section>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
${sharedHead({ lang, title, description, canonical, alternate, image, schema, ogType: "website" })}
</head>
<body data-page-type="editorial-policy" data-page-language="${lang}" data-page-slug="editorial">
  <a class="skip-link" href="#main">${copy.skip}</a>
${header(copy, "editorial")}
  <main id="main" class="content-main">
    <article class="seo-article">
      <div class="container content-narrow">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../${lang === "de" ? "" : "index-en.html"}">${copy.home}</a><span aria-hidden="true">›</span><a href="./">${copy.guideLabel}</a><span aria-hidden="true">›</span><span aria-current="page">${title}</span></nav>
        <header class="article-header"><span class="eyebrow">Demenz Coach</span><h1>${title}</h1><p class="article-lead">${description}</p><p class="article-meta">${copy.updated}: <time datetime="${published}">${displayDate[lang]}</time></p></header>
        <div class="article-body">${body}</div>
      </div>
    </article>
  </main>
${footer(copy)}
  <script>window.demenzCoachSiteLocale=${jsonLD({
    menuOpen: copy.menu,
    menuClose: copy.menuClose,
    privacyURL: `../${lang === "de" ? "datenschutz.html" : "privacy-en.html"}`
  })};</script>
  <script src="../script.js"></script>
</body>
</html>
`;
};

for (const lang of ["de", "en"]) {
  const copy = locale[lang];
  const directory = path.join(landingRoot, copy.directory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), renderHub(lang));
  fs.writeFileSync(path.join(directory, "redaktion.html"), renderEditorial(lang));
  for (const article of publicArticles[lang]) {
    fs.writeFileSync(path.join(directory, `${article.slug}.html`), renderArticle(lang, article));
  }
}

const manifest = {
  generatedAt: published,
  pages: [
    ...["de", "en"].flatMap((lang) => {
      const copy = locale[lang];
      return [
        {
          lang,
          type: "hub",
          path: `${copy.directory}/`,
          url: alternateURL(lang)
        },
        {
          lang,
          type: "editorial",
          path: `${copy.directory}/redaktion.html`,
          url: `${alternateURL(lang)}redaktion.html`
        },
        ...publicArticles[lang].map((article) => ({
          lang,
          type: "article",
          slug: article.slug,
          alternateSlug: article.pair,
          campaign: article.campaign,
          cluster: article.cluster,
          path: `${copy.directory}/${article.slug}.html`,
          url: alternateURL(lang, article.slug)
        }))
      ];
    })
  ]
};

fs.writeFileSync(
  path.join(landingRoot, "seo-pages.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

const campaignManifest = {
  generatedAt: published,
  privacyBoundary: "No care text, search query, profile, device identifier or user-level web-to-app join.",
  stages: [
    {
      stage: "website",
      source: "Google Analytics 4 after consent",
      events: ["page_view", "app_store_click", "related_guide_click"]
    },
    {
      stage: "app_store",
      source: "App Store Connect App Analytics",
      dimensions: ["campaign_token"],
      metrics: ["impressions", "product_page_views", "first_time_downloads", "usage", "sales"]
    },
    {
      stage: "activation",
      source: "Consent-aware in-app analytics, aggregate reporting only",
      events: [
        "app_install_recorded",
        "first_help_received",
        "first_qualifying_help_received",
        "user_activated",
        "activated_user_returned"
      ]
    }
  ],
  campaigns: ["de", "en"].flatMap((lang) =>
    publicArticles[lang].map((article) => ({
      language: lang,
      page_slug: article.slug,
      page_url: alternateURL(lang, article.slug),
      campaign_token: article.campaign
    }))
  )
};

fs.writeFileSync(
  path.join(landingRoot, "seo-campaigns.json"),
  `${JSON.stringify(campaignManifest, null, 2)}\n`
);

console.log(`Generated ${manifest.pages.length} SEO content pages and ${campaignManifest.campaigns.length} SEO campaign mappings.`);
