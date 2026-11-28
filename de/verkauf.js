// Verkaufs-Startseite (Daniel, 27. Nov 2026: „eine optimierte Sales-Startseite … relativ lang … typisch aufgebaut wie
// Sales-Seiten, wie zB bei Propstage“). Seit 28. Nov für alle Besucher (Daniel: „stelle die neue 100% online“); ?home=a zeigt die alte Seite, sie bleibt
// unverändert. Die Zuteilung passiert schon im <head> von /de/ (Klasse html.home-b), damit nichts flackert.
// Aufbau wie Propstage: Ausprobieren oben (unser Eingabefeld), Vertrauen, drei Schritte, Vorher/Nachher, Stimmen, Vergleich,
// viele Situationen, Preis mit Garantie, Vorteile, Fragen, Schluss. Jeder Kaufknopf öffnet sofort die Kasse (abo/kasse.js).
// Keine erfundenen Bewertungen, Zahlen oder Uhren. Stimmen aus start/stimmen.js (Vornamen mit Zustimmung).
const root = document.documentElement;
const arm = root.dataset.homeArm || 'a';
const track = (name, extra = {}) => { try { window.DemenzConsent?.track?.(name, { home_arm: arm, ...extra }); } catch { /* ohne Einwilligung nichts */ } };
track('home_arm_view');
if (arm === 'b') mount();

function mount() {
  const params = new URLSearchParams(location.search);
  const config = window.DEMENZ_ABO_CONFIG || {};
  const clean = (value, max = 30) => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, max);
  // Quelle „home_<kanal>“: Käufe über diese Seite sind in Kasse und Stripe vom Rest getrennt.
  const source = `home_${clean(root.dataset.homeSrc || params.get('src') || params.get('utm_source')) || 'direkt'}`.slice(0, 30);
  const campaign = clean(root.dataset.homeCampaign || params.get('utm_campaign') || params.get('k'), 60);
  const load = src => new Promise(resolve => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = resolve; document.head.append(s); });

  // ---- Preise: feste Werte, dann die Werte des Servers (wie /hilfe/ und /start/) ------------------------------------
  let offer = { yearly: 6999, monthly: 1299, trialDays: 7 };
  let offersOn = true;
  const deal = () => (offersOn ? window.DemenzAngebot?.current?.() || null : null);
  const firstYear = () => deal()?.firstYear ?? offer.yearly;
  const euro = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const saving = () => Math.floor((1 - firstYear() / (offer.monthly * 12)) * 100);
  const trial = () => offer.trialDays > 0;
  // Preis pro Tag nur als Zusatz (Daniel, 28. Nov). Der Gesamtpreis bleibt groß und klar (Preisangabenverordnung).
  const perDay = plan => Math.ceil((plan === 'yearly' ? firstYear() : offer.monthly * 12) / 365);
  const perDayText = plan => `Weniger als ${perDay(plan)} Cent am Tag`;
  const startText = () => (trial() ? `${offer.trialDays} Tage kostenlos testen` : 'Jetzt starten');
  const shortTerms = plan => `${trial() ? `${offer.trialDays} Tage kostenlos, dann ` : ''}${plan === 'yearly'
    ? (deal() ? `${euro(firstYear())} im ersten Jahr` : `${euro(offer.yearly)} im Jahr`) : `${euro(offer.monthly)} im Monat`}. Online kündbar.`;

  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };
  const section = (cls, title, sub, children, id) => el('section', { class: `hs-section ${cls}`, id, 'aria-labelledby': id ? `${id}-title` : undefined }, [
    el('div', { class: 'hs-wrap' }, [title && el('h2', { id: id ? `${id}-title` : undefined, text: title }), sub && el('p', { class: 'hs-sub', text: sub }), ...children])
  ]);
  const buyButton = (plan, where, label) => el('button', { type: 'button', class: 'hs-btn', 'data-hs-buy': where, 'data-plan': plan, text: label || startText() });
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>'
  };
  const checks = items => el('ul', { class: 'hs-checks' }, items.map(text => el('li', {}, [el('span', { class: 'hs-ico', html: ICON.check }), el('span', { text })])));

  // ---- 0. Direkt unter dem Eingabefeld: Kaufknopf und Vertrauen (kein Text über dem Knopf) ---------------------------
  const heroNote = el('p', { class: 'hs-note' });
  const hero = el('div', { class: 'hs-hero-cta' }, [
    buyButton('yearly', 'hero'),
    heroNote,
    el('ul', { class: 'hs-chips', 'aria-label': 'Das Wichtigste' }, ['30 Tage Geld-zurück-Garantie', 'Online kündbar', 'Im Web und als iPhone-App', '']
      .map(text => el('li', {}, [el('span', { class: 'hs-ico', html: ICON.check }), el('span', { text, 'data-per-day': text ? undefined : 'yearly' })])))
  ]);

  // ---- 1. So funktioniert es --------------------------------------------------------------------------------------
  const steps = section('hs-band', 'So einfach geht es', 'Drei Schritte. Ohne Vorwissen.', [
    el('ol', { class: 'hs-steps' }, [
      ['app-schreiben.webp', 'Beschreibe den Moment', 'Tippe oder sprich. Zum Beispiel: „Mama packt jeden Abend ihre Tasche.“', 'Startseite der App mit der Frage: Was ist gerade mit Mama los?'],
      ['app-antwort.webp', 'Lies, was du sagen kannst', 'Ein ruhiger Satz für den Moment. Dazu eine kleine Idee für danach.', 'Antwort der App mit einem ruhigen Satz zum Sagen.'],
      ['app-antwort-persoenlich.webp', 'Frag nach oder übe', 'Passt der Satz nicht? Frag weiter. Oder übe das Gespräch vorher in Ruhe.', 'Persönliche Antwort der App mit Knöpfen zum Nachfragen.']
    ].map(([img, title, text, alt], index) => el('li', {}, [
      el('img', { src: `/assets/angebot/${img}`, width: 720, height: 1566, alt, loading: 'lazy', decoding: 'async' }),
      el('div', {}, [el('p', { class: 'hs-step-no', text: `Schritt ${index + 1}` }), el('h3', { text: title }), el('p', { text })])
    ])))
  ], 'so-gehts');

  // ---- 1b. So sieht eine Antwort aus (echte Antworten der Seite, mit Zeichnungen; Daniel, 28. Nov) --------------------
  const EXAMPLES = [
    { tab: 'Will nach Hause', img: 'nach-hause.webp', w: 480, h: 664, says: 'Ich will nach Hause.', href: '/de/ratgeber/demenz-nach-hause-was-sagen.html',
      phrases: ['Du möchtest nach Hause. Erzähl mir, wie es da ist.', 'Du fühlst dich hier gerade nicht wohl. Ich bin bei dir.', 'Wollen wir zusammen eine kleine Runde gehen?'],
      todo: 'Geht zusammen ein paar Schritte, zum Beispiel ans Fenster oder in den Garten. Danach gibt es etwas zu trinken.',
      trick: ['Fotoalbum', 'Schaut zusammen ein Album mit alten Fotos an. Bilder von früher geben Gesprächsstoff.', 'illu-trick-fotoalbum'] },
    { tab: 'Wirft Diebstahl vor', img: 's-money.webp', w: 480, h: 396, says: 'Du hast mein Geld gestohlen!', href: '/de/demenz-uebersetzer/du-hast-mein-geld-gestohlen.html',
      phrases: ['Das ist schlimm, wenn das Geld weg ist. Ich helfe dir beim Suchen.', 'Du möchtest, dass deine Sachen sicher sind. Das verstehe ich.', 'Lass uns gemeinsam schauen, wo es sein könnte.'],
      todo: 'Merke dir Lieblingsverstecke. Oft tauchen Dinge an denselben Orten wieder auf.',
      trick: ['Eigenes Portemonnaie', 'Gib der Person ein Portemonnaie mit etwas Kleingeld, das sie behalten darf.', 'illu-trick-portemonnaie'] },
    { tab: 'Will nicht duschen', img: 'tuch-mama.webp', w: 480, h: 505, says: 'Ich will nicht duschen.', href: '/de/demenz-uebersetzer/ich-will-nicht-duschen.html',
      phrases: ['Möchtest du lieber jetzt oder nach dem Kaffee?', 'Das Bad ist schön warm. Ich lege dir das Handtuch bereit.', 'Du machst das Gesicht, ich helfe dir beim Rücken.'],
      todo: 'Wärme das Bad vor und lege ein Handtuch um die Schultern, damit weniger Haut unbedeckt ist.',
      trick: ['Bad vorwärmen', 'Wärme das Bad vor und lege ein großes Handtuch um die Schultern. Decke beim Waschen ab, was gerade nicht dran ist.', 'illu-tuch-towel'] }
  ];
  const exampleCard = (ex, index) => el('article', { class: 'hs-example', id: `hs-example-${index}`, role: 'tabpanel', 'aria-labelledby': `hs-example-tab-${index}`, hidden: index > 0 }, [
    el('div', { class: 'hs-ex-head' }, [
      el('img', { src: `/assets/zeichnungen/${ex.img}`, width: ex.w, height: ex.h, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', {}, [el('p', { class: 'hs-ex-label', text: 'Du hörst' }), el('p', { class: 'hs-ex-says', text: `„${ex.says}“` })])
    ]),
    el('p', { class: 'hs-ex-label', text: 'Das kannst du sagen' }),
    el('ul', { class: 'hs-ex-phrases' }, ex.phrases.map(text => el('li', { text }))),
    el('p', { class: 'hs-ex-label', text: 'Das kannst du tun' }),
    el('p', { class: 'hs-ex-todo', text: ex.todo }),
    el('div', { class: 'hs-ex-trick' }, [
      el('img', { src: `/alltagstricks/img/${ex.trick[2]}.webp`, width: 600, height: 472, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', {}, [el('p', { class: 'hs-ex-label', text: 'Dieser Trick hilft' }), el('h3', { text: ex.trick[0] }), el('p', { text: ex.trick[1] })])
    ]),
    el('a', { class: 'hs-link', href: ex.href, onclick: () => track('home_sales_example_open', { example: index }), text: 'Ganze Antwort ansehen' })
  ]);
  const exampleTabs = el('div', { class: 'hs-ex-tabs', role: 'tablist', 'aria-label': 'Beispiele' }, EXAMPLES.map((ex, index) => el('button', {
    type: 'button', role: 'tab', id: `hs-example-tab-${index}`, 'aria-controls': `hs-example-${index}`, 'aria-selected': String(index === 0), text: ex.tab,
    onclick: event => {
      for (const tab of exampleTabs.children) tab.setAttribute('aria-selected', String(tab === event.currentTarget));
      for (const [i, panel] of examplePanels.entries()) panel.hidden = i !== index;
      track('home_sales_example', { example: index });
    }
  })));
  const examplePanels = EXAMPLES.map(exampleCard);
  const tryOwn = el('button', { type: 'button', class: 'hs-btn hs-btn-light', text: 'Mit deiner Situation ausprobieren', onclick: () => {
    track('home_sales_try');
    const input = document.getElementById('translator-input');
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus({ preventScroll: true }), 450);
  } });
  const examples = section('', 'So sieht eine Antwort aus', 'Drei echte Beispiele. Tippe auf eine Situation.', [exampleTabs, ...examplePanels,
    el('p', { class: 'hs-ex-try' }, [tryOwn, el('span', { class: 'hs-quiet', text: 'Kostenlos und ohne Anmeldung.' })])], 'beispiele');

  // ---- 5b. Alltagstricks mit Zeichnungen (aus /alltagstricks/) -------------------------------------------------------
  const TRICKS = [
    ['roter-teller', 'illu-plate-red', 'Roter Teller', 'Auf einem roten Teller hebt sich das Essen deutlich ab.'],
    ['antwort-zettel', 'illu-trick-zettel', 'Antwort auf den Zettel', 'Schreib die Antwort groß auf. Bei der nächsten Frage zeigst du den Zettel.'],
    ['abends-vorhaenge-zu', 'illu-trick-abends-vorhaenge-zu', 'Abends Vorhänge zu', 'Vor der Dämmerung Vorhänge zu und drinnen helles Licht an.'],
    ['waesche-falten', 'illu-trick-waesche', 'Wäsche falten', 'Eine bekannte Handarbeit gibt das Gefühl, gebraucht zu werden.'],
    ['erst-riechen', 'illu-trick-riechen', 'Erst riechen lassen', 'Biete das Essen zuerst zum Riechen an. Der Duft macht Appetit.'],
    ['armband', 'illu-trick-armband', 'Armband mit Telefonnummer', 'Name und deine Nummer am Handgelenk helfen, wenn sie sich verläuft.']
  ];
  const tricks = section('', 'Kleine Tricks für den Alltag', 'Zu vielen Antworten gibt es einen Trick, der den nächsten Tag leichter macht.', [
    el('ul', { class: 'hs-tricks', role: 'list' }, TRICKS.map(([id, img, title, text]) => el('li', {}, [el('a', { class: 'hs-trick', href: `/alltagstricks/${id}.html`, onclick: () => track('home_sales_trick', { trick: id }) }, [
      el('img', { src: `/alltagstricks/img/${img}.webp`, width: 600, height: 472, alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', {}, [el('strong', { text: title }), el('span', { text })])
    ])]))),
    el('p', { class: 'hs-center' }, [el('a', { class: 'hs-link', href: '/alltagstricks/', onclick: () => track('home_sales_tricks_all'), text: 'Alle Alltagstricks ansehen' })])
  ], 'tricks');

  // ---- 2. Vorher / nachher ----------------------------------------------------------------------------------------
  const swap = section('', 'Ein Satz macht den Unterschied', 'Erklären und Korrigieren endet oft im Streit. Ein Satz, der das Gefühl aufgreift, macht den Moment oft ruhiger.', [
    el('ul', { class: 'hs-swap' }, [
      ['Du bist seit 20 Jahren in Rente!', 'Du warst immer sehr zuverlässig. Erzähl mir, was heute ansteht.'],
      ['Deine Mutter lebt doch schon lange nicht mehr.', 'Du denkst gerade an deine Mutter. Erzähl mir von ihr.'],
      ['Das hab ich dir doch schon dreimal gesagt!', 'Schau, hier auf dem Zettel steht es: Um drei Uhr fahren wir los.']
    ].map(([before, after]) => el('li', {}, [
      el('p', { class: 'hs-before' }, [el('span', { class: 'hs-tag', text: 'Statt' }), el('span', { text: `„${before}“` })]),
      el('p', { class: 'hs-after' }, [el('span', { class: 'hs-tag', text: 'Lieber' }), el('span', { text: `„${after}“` })])
    ])))
  ]);

  // ---- 3. Stimmen (echt, per Skript) ------------------------------------------------------------------------------
  const voices = section('hs-band', 'Das sagen Angehörige', null, [el('div', { class: 'hs-voices', role: 'list' }),
    el('p', { class: 'hs-quiet', text: 'Stimmen von Angehörigen, die Demenz Coach ausprobiert haben. Vornamen mit Zustimmung. Die Zeichnungen zeigen die Geschichte, nicht die Personen. Einzelne Erfahrungen, kein Versprechen für dein Ergebnis.' })], 'stimmen');
  voices.hidden = true;

  // ---- 4. Drei Wege im Vergleich -----------------------------------------------------------------------------------
  const ways = section('', 'Drei Wege durch einen schweren Moment', 'Was dich jeder Weg kostet, bevor du weißt, was du sagen kannst.', [
    el('div', { class: 'hs-ways' }, [
      ['Im Internet suchen', 'Lange', ['Viele Seiten, wenig zu deiner Lage', 'Allgemeine Tipps statt eines Satzes', 'Im Moment selbst keine Zeit dafür'], false],
      ['Ratgeber oder Kurs', 'Tage', ['Gutes Wissen, aber viel zu lesen', 'Der passende Satz fehlt oft genau dann', 'Fragen kannst du nicht stellen'], false],
      ['Demenz Coach', 'Sekunden', ['Ein Satz für genau deinen Moment', 'Nachfragen, bis es passt', 'Üben, bevor es ernst wird'], true]
    ].map(([title, time, items, ours]) => el('article', { class: `hs-way${ours ? ' is-ours' : ''}` }, [
      el('h3', { text: title }), el('p', { class: 'hs-way-time', text: time }),
      el('ul', {}, items.map(text => el('li', {}, [el('span', { class: 'hs-ico', html: ours ? ICON.check : ICON.cross }), el('span', { text })]))),
      ours ? buyButton('yearly', 'vergleich') : null
    ])))
  ]);

  // ---- 5. Viele Situationen ----------------------------------------------------------------------------------------
  const situations = section('hs-band', 'Eine Hilfe für viele Situationen', 'Für die Momente, die im Alltag am schwersten sind. Tippe eine an.', [
    el('ul', { class: 'hs-cases', role: 'list' }, [
      ['nach-hause.webp', 'Will nach Hause', 'Auch wenn sie schon zu Hause ist.', '/de/ratgeber/demenz-nach-hause-was-sagen.html'],
      ['s-money.webp', 'Wirft Diebstahl vor', 'Wenn Geld oder Brille „gestohlen“ sind.', '/de/demenz-uebersetzer/du-hast-mein-geld-gestohlen.html'],
      ['tuch-mama.webp', 'Will nicht duschen', 'Ohne Streit ins Bad kommen.', '/de/demenz-uebersetzer/ich-will-nicht-duschen.html'],
      ['s-recognize.webp', 'Erkennt mich nicht', 'Wenn die Frage „Wer sind Sie?“ wehtut.', '/de/demenz-uebersetzer/wer-sind-sie.html'],
      ['sunset.webp', 'Unruhig am Abend', 'Wenn es dunkel wird und sie los will.', '/de/demenz-uebersetzer/es-wird-dunkel-ich-muss-los.html'],
      ['s-meds.webp', 'Will keine Tabletten', 'Ruhig bleiben statt überreden.', '/de/demenz-uebersetzer/ich-nehme-keine-tabletten.html']
    ].map(([img, title, text, href]) => el('li', {}, [el('a', { class: 'hs-case', href, onclick: () => track('home_sales_case', { case: href }) }, [
      el('img', { src: `/assets/zeichnungen/${img}`, width: 480, height: 400, alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', {}, [el('strong', { text: title }), el('span', { text })])
    ])])))
  ]);

  // ---- 6. Zwischen-Aufruf -----------------------------------------------------------------------------------------
  const band = el('section', { class: 'hs-section hs-cta-band' }, [el('div', { class: 'hs-wrap hs-narrow' }, [
    el('h2', { text: 'Beim nächsten Mal hast du einen Satz' }),
    el('p', { class: 'hs-sub', text: 'Du musst nicht auf alles eine Antwort haben. Aber du kannst einen Anfang haben.' }),
    buyButton('yearly', 'band'), el('p', { class: 'hs-note' })
  ])]);

  // ---- 7. Preis ---------------------------------------------------------------------------------------------------
  const features = ['Sätze für jeden schweren Moment', 'Nachfragen, bis es passt', 'Gespräche in Ruhe üben', 'Meine Sätze speichern und drucken', 'Im Web und in der iPhone-App'];
  const planCard = plan => el('article', { class: `hs-plan${plan === 'yearly' ? ' is-best' : ''}`, 'data-plan-card': plan }, [
    plan === 'yearly' ? el('p', { class: 'hs-plan-badge', 'data-badge': '' }) : null,
    el('h3', { text: plan === 'yearly' ? '12-Monats-Plan' : '1-Monats-Plan' }),
    el('p', { class: 'hs-plan-price', 'data-price': '' }),
    el('p', { class: 'hs-plan-then', 'data-then': '' }),
    el('p', { class: 'hs-plan-day', 'data-per-day': plan }),
    plan === 'yearly' ? el('div', { class: 'hs-cta-wrap' }, [buyButton('yearly', 'preis_jahr'), el('div', { class: 'hs-ap-slot', id: 'hs-ap-yearly', hidden: true })]) : buyButton('monthly', 'preis_monat'),
    plan === 'yearly' ? el('button', { type: 'button', class: 'hs-link hs-ap-alt', 'data-hs-buy': 'preis_jahr_andere', 'data-plan': 'yearly', hidden: true, text: 'Mit Karte oder anderer Zahlart bezahlen' }) : null,
    el('p', { class: 'hs-plan-terms', 'data-terms': '' }),
    checks(features)
  ]);
  const guarantee = el('div', { class: 'hs-guarantee' }, [el('span', { class: 'hs-seal', html: ICON.shield }), el('p', {}, [
    el('strong', { text: '30 Tage Geld-zurück-Garantie' }),
    el('span', { text: 'Hilft es dir nicht, bekommst du dein Geld zurück. Ohne Begründung. ' }),
    el('a', { href: '/abo/garantie.html', onclick: () => track('home_sales_garantie'), text: 'Bedingungen' })
  ])]);
  const priceVoice = el('figure', { class: 'hs-voice-mini', hidden: true });
  const legal = el('p', { class: 'hs-legal' });
  const prices = section('', 'Wähle deinen Plan', null, [
    el('div', { class: 'hs-plans' }, [planCard('yearly'), planCard('monthly')]), guarantee, priceVoice, legal
  ], 'preise');

  // ---- 8. Vorteile ------------------------------------------------------------------------------------------------
  const perks = section('hs-band', 'Kein Haken. Kein Fachwissen. Kein Warten.', null, [el('ul', { class: 'hs-perks' }, [
    ['Online kündbar', 'Ohne Anmeldung, in wenigen Schritten. Kein Anruf nötig.'],
    ['Geld-zurück-Garantie', '30 Tage. Hilft es dir nicht, bekommst du dein Geld zurück.'],
    ['Deine Situation', 'Jede Antwort geht von deinen Worten aus, nicht von einem Lehrbuch.'],
    ['Überall dabei', 'Im Browser auf Handy, Tablet und Computer. Und als iPhone-App.']
  ].map(([title, text]) => el('li', {}, [el('span', { class: 'hs-ico', html: ICON.check }), el('div', {}, [el('h3', { text: title }), el('p', { text })])])))]);

  // ---- 9. Fragen --------------------------------------------------------------------------------------------------
  const faqYearly = el('span'), faqMonthly = el('span');
  const faq = section('', 'Häufige Fragen', null, [el('div', { class: 'hs-faq' }, [
    ['Für wen ist Demenz Coach?', ['Für Angehörige und Pflegende, die einen Menschen mit Demenz im Alltag begleiten. Besonders, wenn im Gespräch die Worte fehlen.']],
    ['Brauche ich ein iPhone?', ['Nein. Demenz Coach läuft im Browser auf jedem Handy, Tablet und Computer. Auf dem iPhone kannst du zusätzlich die App nutzen.']],
    ['Muss ich meine Frage genau formulieren?', ['Nein. Beschreibe den Moment in deinen Worten. Du kannst tippen oder sprechen.']],
    ['Ersetzt Demenz Coach ärztlichen Rat?', ['Nein. Demenz Coach hilft bei Worten und Alltag. Es gibt keine Diagnose und keine Behandlung. Bei medizinischen Fragen sprich mit einer Ärztin oder einem Arzt. Im Notfall 112.']],
    ['Was kostet es?', [`Die ersten ${offer.trialDays} Tage sind kostenlos. Danach kostet der 12-Monats-Plan `, faqYearly, ', der 1-Monats-Plan ', faqMonthly, ' im Monat. Alle Preise inklusive MwSt.']],
    ['Wie kündige ich?', ['Online über „Verträge hier kündigen“ unten auf jeder Seite, ohne Anmeldung. Kündigst du in der Probezeit, zahlst du nichts.']],
    ['Gilt das auch in der App?', ['Ja. Du meldest dich in der iPhone-App mit demselben Konto an. Dann ist alles freigeschaltet.']]
  ].map(([question, answer]) => el('details', { ontoggle: event => { if (event.target.open) track('home_sales_faq', { q: question.slice(0, 40) }); } }, [el('summary', { text: question }), el('p', {}, answer)])))]);

  // ---- 10. Schluss ------------------------------------------------------------------------------------------------
  const final = el('section', { class: 'hs-section hs-final' }, [el('div', { class: 'hs-wrap hs-narrow' }, [
    el('img', { src: '/assets/zeichnungen/v-umarmung.webp', width: 480, height: 489, alt: 'Eine Tochter umarmt ihre lachende Mutter', loading: 'lazy', decoding: 'async' }),
    el('h2', { text: 'Fang heute an. In Ruhe.' }),
    el('p', { class: 'hs-sub', text: 'Probiere Demenz Coach 7 Tage aus. Passt es nicht, kündigst du online.' }),
    buyButton('yearly', 'schluss'), el('p', { class: 'hs-note' })
  ])]);
  const more = el('h2', { class: 'hs-more-title', text: 'Noch mehr Situationen und Alltagstricks' });

  // ---- Einhängen: nach den Beispielsituationen, vor den Tipps --------------------------------------------------------
  const situationsBlock = document.querySelector('.home-situations');
  const anchor = situationsBlock || document.getElementById('translator-result');
  if (!anchor) return;
  situationsBlock?.before(hero);
  const sales = el('div', { class: 'hs', id: 'verkauf' }, [steps, examples, swap, voices, ways, situations, tricks, band, prices, perks, faq, final, more]);
  anchor.after(sales);
  // Abwechselnd heller und getönter Hintergrund, egal wie viele Abschnitte es gibt.
  [...sales.children].filter(node => node.matches('.hs-section:not(.hs-cta-band):not(.hs-final)')).forEach((node, index) => node.classList.toggle('hs-band', index % 2 === 0));

  // ---- Bewegung (Daniel, 28. Nov: „kannst du die Sachen animiert machen, also die Bilder?“) ----------------------------
  // Beim Scrollen gleiten Bilder und Karten sanft herein. Handy-Bilder schweben leicht. In den Beispielen erscheinen die
  // Sätze nacheinander wie Nachrichten. Ohne IntersectionObserver oder mit „weniger Bewegung“ steht alles sofort da.
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && 'IntersectionObserver' in window) {
    root.classList.add('hs-anim');
    const groups = [
      ['.hs-steps li', 'side'], ['.hs-example:not([hidden])', 'up'], ['.hs-swap li', 'up'], ['.hs-voice', 'pop'], ['.hs-way', 'up'],
      ['.hs-cases li', 'pop'], ['.hs-tricks li', 'pop'], ['.hs-plan', 'up'], ['.hs-guarantee', 'up'], ['.hs-perks li', 'up'], ['.hs-final img', 'pop']
    ];
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); reveal.unobserve(entry.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
    for (const [selector, kind] of groups) {
      sales.querySelectorAll(selector).forEach((node, index) => { node.dataset.hsReveal = kind; node.style.setProperty('--hs-i', String(index % 3)); reveal.observe(node); });
    }
    // Beispiel: Sätze nacheinander, auch nach jedem Wechsel der Situation.
    const playExample = panel => { panel.classList.remove('is-playing'); void panel.offsetWidth; panel.classList.add('is-playing'); };
    const exampleWatch = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { playExample(entry.target); exampleWatch.unobserve(entry.target); }
    }, { threshold: .35 });
    examplePanels.forEach(panel => exampleWatch.observe(panel));
    exampleTabs.addEventListener('click', () => { const open = examplePanels.find(panel => !panel.hidden); if (open) { open.classList.add('is-in'); playExample(open); } });
  }

  // ---- Inhalte füllen ---------------------------------------------------------------------------------------------
  const refresh = () => {
    for (const note of document.querySelectorAll('.hs-note')) note.textContent = shortTerms('yearly');
    for (const node of document.querySelectorAll('[data-per-day]')) node.textContent = perDayText(node.dataset.perDay);
    for (const button of document.querySelectorAll('[data-hs-buy]:not(.hs-link)')) button.textContent = startText();
    const yearly = prices.querySelector('[data-plan-card="yearly"]'), monthly = prices.querySelector('[data-plan-card="monthly"]');
    yearly.querySelector('[data-price]').replaceChildren(el('strong', { text: euro(Math.round(firstYear() / 12)) }), el('span', { text: ' im Monat' }));
    yearly.querySelector('[data-then]').textContent = deal() ? `${euro(firstYear())} im ersten Jahr, danach ${euro(offer.yearly)} im Jahr` : `${euro(offer.yearly)} im Jahr`;
    yearly.querySelector('[data-badge]').textContent = saving() >= 10 ? `Bester Preis · Spare ${saving()} %` : 'Bester Preis';
    yearly.querySelector('[data-terms]').textContent = `${trial() ? `${offer.trialDays} Tage kostenlos. ` : ''}Laufzeit 1 Jahr, danach mit 1 Monat Frist kündbar.`;
    monthly.querySelector('[data-price]').replaceChildren(el('strong', { text: euro(offer.monthly) }), el('span', { text: ' im Monat' }));
    monthly.querySelector('[data-then]').textContent = 'Monatlich kündbar';
    monthly.querySelector('[data-terms]').textContent = `${trial() ? `${offer.trialDays} Tage kostenlos. ` : ''}Jederzeit zum Monatsende kündbar.`;
    faqYearly.textContent = deal() ? `${euro(firstYear())} im ersten Jahr, danach ${euro(offer.yearly)} im Jahr` : `${euro(offer.yearly)} im Jahr`;
    faqMonthly.textContent = euro(offer.monthly);
    legal.replaceChildren(`${trial() ? `Nach ${offer.trialDays} Tagen beginnt das Abo und läuft` : 'Das Abo beginnt sofort und läuft'} zum gewählten Preis weiter, bis du kündigst. Der Jahresplan hat eine Laufzeit von einem Jahr und ist danach mit einer Frist von einem Monat kündbar, der Monatsplan jederzeit zum Monatsende.${deal() ? ' Der Sonderpreis gilt für das erste Jahr des Jahresplans.' : ''} Alle Preise inklusive gesetzlicher Umsatzsteuer. Kündigen geht online ohne Anmeldung. Es gelten die `,
      el('a', { href: '/nutzungsbedingungen.html', text: 'Nutzungsbedingungen' }), ' und die ', el('a', { href: '/abo/widerruf.html', text: 'Widerrufsbelehrung' }),
      '. Allgemeine Kommunikations- und Alltagshilfe, kein Medizinprodukt.');
  };
  refresh();

  // ---- Stimmen ----------------------------------------------------------------------------------------------------
  const mountVoices = () => {
    const all = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
    if (!all.length) return;
    // Zeichnung zur Geschichte der Stimme (Daniel, 28. Nov: Bilder zu den Stimmen). Keine Fotos, keine echten Gesichter.
    const DRAWN = { Monika: [560, 411], Gesa: [560, 553], Kemal: [560, 505], Doreen: [554, 560], Rike: [560, 422], Lisa: [560, 406], Timo: [492, 560] };
    const drawing = voice => (DRAWN[voice.name] ? el('img', { class: 'hs-voice-img', src: `/assets/stimmen/stimme-${voice.name.toLowerCase()}.webp`, width: DRAWN[voice.name][0], height: DRAWN[voice.name][1], alt: '', loading: 'lazy', decoding: 'async' }) : null);
    const card = voice => el('figure', { class: 'hs-voice', role: 'listitem' }, [drawing(voice), el('blockquote', { text: `„${voice.text}“` }), el('figcaption', { text: `${voice.name}, ${voice.rolle}` })]);
    voices.querySelector('.hs-voices').replaceChildren(...[0, 2, 3, 5, 10, 8].map(index => all[index]).filter(Boolean).map(card));
    voices.hidden = false;
    const mini = all.find(entry => entry.name === 'Timo') || all[1];
    if (mini) { priceVoice.replaceChildren(...[drawing(mini)].filter(Boolean), el('blockquote', { text: `„${mini.text}“` }), el('figcaption', { text: `${mini.name}, ${mini.rolle} · Vorname mit Zustimmung` })); priceVoice.hidden = false; }
  };
  load('/start/stimmen.js').then(mountVoices);

  // ---- Kasse ------------------------------------------------------------------------------------------------------
  const checkoutOffer = plan => (plan === 'yearly' && deal() ? window.DemenzAngebot.forCheckout() : null);
  let kasseReady = null;
  const kasse = () => (kasseReady ||= import('/abo/kasse.js').then(() => window.DemenzKasse).catch(() => null));
  let prepared = '';
  const prepare = plan => kasse().then(api => {
    const key = `${plan}|${plan === 'yearly' ? deal()?.token || '' : ''}`;
    if (!api?.prepare || prepared === key) return;
    prepared = key; api.prepare({ plan, source, campaign, offer: checkoutOffer(plan) });
  });
  const buy = async (plan, where) => {
    track('home_sales_checkout', { where, plan });
    try { window.DemenzConsent?.trackMarketing?.('InitiateCheckout'); } catch { /* */ }
    const api = await kasse();
    if (!api || !config.firebase?.apiKey) { location.href = `/abo/?plan=${plan}&src=${source}${campaign ? `&c=${campaign}` : ''}&weiter=1`; return; }
    history.pushState({ sheet: true }, '', location.href);
    api.open({ plan, source, campaign, offer: checkoutOffer(plan), stripePage: where.endsWith('_andere'), track: name => track(name, { where }),
      onClose: () => { if (history.state?.sheet) history.back(); },
      onOfferExpired: () => { const gone = deal(); if (gone) window.DemenzAngebot.drop(gone.kind); refresh(); } });
  };
  addEventListener('popstate', () => { if (window.DemenzKasse?.isOpen?.()) window.DemenzKasse.close(); });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-hs-buy]');
    if (!target) return;
    event.preventDefault();
    buy(target.dataset.plan === 'monthly' ? 'monthly' : 'yearly', target.dataset.hsBuy);
  });
  document.addEventListener('pointerdown', event => { const target = event.target.closest('[data-hs-buy]'); if (target) prepare(target.dataset.plan === 'monthly' ? 'monthly' : 'yearly'); }, { passive: true });

  // Apple Pay auf dem Jahresplan (wie /hilfe/ und /start/): Stripes unsichtbarer Express-Knopf liegt über unserem Knopf.
  const mountApplePay = () => kasse().then(api => {
    const slot = document.getElementById('hs-ap-yearly');
    if (!api?.mountApplePay || !config.firebase?.apiKey || !slot || slot.dataset.mounted) return;
    slot.dataset.mounted = '1';
    api.mountApplePay(slot, { plan: 'yearly', offer: checkoutOffer('yearly'), source, campaign, track: name => track(name, { where: 'preis_jahr' }),
      onError: message => { prices.querySelector('[data-plan-card="yearly"] [data-terms]').textContent = message; } })
      .then(shown => { if (shown) { slot.hidden = false; prices.querySelector('.hs-ap-alt').hidden = false; } else delete slot.dataset.mounted; });
  });

  // ---- Server-Preise und Willkommenspreis ----------------------------------------------------------------------------
  if (config.endpoint) {
    fetch(`${config.endpoint}/config`).then(response => (response.ok ? response.json() : null)).then(data => {
      if (!data?.plans?.yearly?.amount || !data?.plans?.monthly?.amount) return;
      offer = { yearly: data.plans.yearly.amount, monthly: data.plans.monthly.amount, trialDays: data.trialDays ?? 7 };
      offersOn = Boolean(data.offers?.intro || data.offers?.exit);
      refresh();
    }).catch(() => { /* feste Preise bleiben */ });
  }
  let expiryTimer = null;
  const watchExpiry = () => {
    clearTimeout(expiryTimer);
    const current = deal();
    if (current) expiryTimer = setTimeout(() => { window.DemenzAngebot.drop(current.kind); refresh(); watchExpiry(); }, Math.max(0, current.expiresAt - Date.now()) + 500);
  };
  load('/abo/angebot.js').then(() => {
    if (window.DemenzAngebot && !window.DemenzAngebot.ended('intro')) window.DemenzAngebot.start('intro').then(() => { refresh(); watchExpiry(); }).catch(() => {});
  });

  // ---- Beobachter: Preis sichtbar → Kasse vorbereiten und Apple Pay prüfen; Lesetiefe -----------------------------------
  if ('IntersectionObserver' in window) {
    let timer = null;
    const warm = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { clearTimeout(timer); timer = setTimeout(() => { track('home_sales_price_seen'); prepare('yearly'); mountApplePay(); warm.disconnect(); }, 1500); }
      else clearTimeout(timer);
    // Mittleres Band des Bildschirms statt Anteil: Der Preisblock ist auf dem Handy höher als drei Bildschirme.
    }, { rootMargin: '-30% 0px -30% 0px', threshold: 0 });
    warm.observe(prices);
    const depth = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { track('home_sales_section', { section: entry.target.id || entry.target.className.split(' ').pop() }); depth.unobserve(entry.target); }
    }, { threshold: .4 });
    for (const node of sales.querySelectorAll(':scope > section')) depth.observe(node);
  }
}
