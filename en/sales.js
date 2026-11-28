// English sales homepage (Daniel, 28 Nov 2026: „release es, und stelle auch englisch so online“). Same structure as the
// German page de/verkauf.js (shared styles in de/verkauf.css): calm first screen, demo phones, example answers, tricks,
// voices, prices, FAQ. The head script of /en/ sets html.home-b for everyone; ?home=a shows the old page.
// Voices are real German voices (first names with consent), translated and marked as translated. No invented reviews.
// Prices come from the same Stripe plans as the German page (EUR). Checkout: abo/kasse.js (English texts on lang="en").
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
  const source = `home_en_${clean(root.dataset.homeSrc || params.get('src') || params.get('utm_source')) || 'direct'}`.slice(0, 30);
  const campaign = clean(root.dataset.homeCampaign || params.get('utm_campaign') || params.get('k'), 60);
  const load = src => new Promise(resolve => { const s = document.createElement('script'); s.src = src; s.onload = s.onerror = resolve; document.head.append(s); });

  const VOICES_EN = [
    { name: 'Monika', rolle: 'daughter', text: 'Mom wanted to call her old neighbor and held out the phone to me. At first I had no idea what to say. I typed exactly that into the app. The sentence I got was so simple that I could say it right away.' },
    { name: 'Gesa', rolle: 'daughter', text: 'My mother had packed her slippers into the shopping bag and was looking for them everywhere. I kept wanting to tell her where they usually are. The suggestion helped me search with her instead of correcting her all the time.' },
    { name: 'Kemal', rolle: 'son', text: 'The explanation under the sentence is the best part for me. When I understand what matters, I can say it in Turkish, the way I talk with Dad.' },
    { name: 'Doreen', rolle: 'daughter', text: 'On her birthday, after the first cup of coffee, Mom wanted everyone to leave. I was disappointed and said exactly that into the app. The answer gave me an idea how to change the afternoon for her, without starting a discussion in front of everyone.' },
    { name: 'Rike', rolle: 'daughter', text: 'My mother emptied the trash can twice because she was looking for a letter. The second time I noticed how tense I was myself. I got a sentence from the app that I could still say kindly, even in that mood. Sounds like a small thing. It meant a lot to me.' },
    { name: 'Lisa', rolle: 'granddaughter', text: 'Grandma was sure the flowers on the table were for a wedding. I had already taken a breath to contradict her. I’m glad I checked first. In the end she told me about her own bridal bouquet.' },
    { name: 'Timo', rolle: 'son', text: 'One sentence from the app helped me more than ten minutes of googling in the stairwell.' }
  ];

  // ---- Preise: feste Werte, dann die Werte des Servers (wie /hilfe/ und /start/) ------------------------------------
  let offer = { yearly: 6999, monthly: 1299, trialDays: 7 };
  let offersOn = true;
  const deal = () => (offersOn ? window.DemenzAngebot?.current?.() || null : null);
  const firstYear = () => deal()?.firstYear ?? offer.yearly;
  const euro = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const saving = () => Math.floor((1 - firstYear() / (offer.monthly * 12)) * 100);
  const trial = () => offer.trialDays > 0;
  // Price per day only as an extra line (Daniel, 28 Nov). The full price stays large and clear.
  const perDay = plan => Math.ceil((plan === 'yearly' ? firstYear() : offer.monthly * 12) / 365);
  const perDayText = plan => `Less than €0.${String(perDay(plan)).padStart(2, '0')} a day`;
  const startText = () => (trial() ? `Try ${offer.trialDays} days free` : 'Start now');
  const shortTerms = plan => `${trial() ? `${offer.trialDays} days free, then ` : ''}${plan === 'yearly'
    ? (deal() ? `${euro(firstYear())} for the first year` : `${euro(offer.yearly)} a year`) : `${euro(offer.monthly)} a month`}. Cancel online anytime.`;

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

  // ---- 0. Erster Bildschirm (Daniel, 28. Nov): nur Überschrift, Eingabe mit beschriftetem Knopf und die Situationen.
  // Kein Kaufknopf, kein Preis, keine Zusatz-Häkchen („zu viel text, zu unruhig“).

  // ---- Demo-Handys (Daniel, 28. Nov: „du sollst ja zeigen wie man sachen eingibt, welche antworten erscheinen, das als demo“)
  // Drei kleine Handys spielen den Ablauf vor: Text wird getippt, die Antwort erscheint, dann eine Nachfrage. Sie laufen nur,
  // solange sie zu sehen sind, und wiederholen sich. Mit „weniger Bewegung“ zeigen sie gleich das fertige Bild.
  const DEMO = {
    typed: 'Every evening Mom packs her bag because she says she has to go to work.',
    says: 'I have to go to work!',
    answer: 'You have always worked so hard. Tell me what’s on for today.',
    next: 'Then give her a small job, like folding towels.',
    ask: 'She is still restless.',
    reply: 'Sit with her and say: “I’m staying right here with you. We’ll do it together.”'
  };
  const demoRuns = [];
  const demoPhone = (index, label) => {
    const screen = el('div', { class: 'hs-ph-screen', 'aria-hidden': 'true' });
    const phone = el('div', { class: 'hs-phone', role: 'img', 'aria-label': label }, [
      el('div', { class: 'hs-ph-bar' }, [el('span', { text: '09:41' }), el('span', { class: 'hs-ph-island' }), el('span', { class: 'hs-ph-icons', text: '●●● ▮' })]), screen
    ]);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const typeInto = async (node, text, speed, run) => {
      node.textContent = '';
      for (const char of text) { if (run.stop) return false; node.textContent += char; await wait(speed); }
      return true;
    };
    const build = [
      () => {
        const field = el('p', { class: 'hs-ph-field' }), caret = el('span', { class: 'hs-ph-caret' });
        const button = el('p', { class: 'hs-ph-btn', text: 'Find answer →' });
        screen.replaceChildren(el('p', { class: 'hs-ph-title', text: 'What is going on with Mom?' }), el('div', { class: 'hs-ph-input' }, [field, caret]),
          el('p', { class: 'hs-ph-small', text: 'Or tap a common moment:' }),
          el('div', { class: 'hs-ph-chips' }, ['Wants to go home', 'Won’t eat', 'Looking for something', 'Restless at night'].map(text => el('span', { text }))), button);
        return { field, button };
      },
      () => {
        const card = el('div', { class: 'hs-ph-card' }), sentence = el('p', { class: 'hs-ph-say' }), after = el('p', { class: 'hs-ph-next' });
        const dots = el('p', { class: 'hs-ph-dots', html: '<span></span><span></span><span></span>' });
        card.append(el('p', { class: 'hs-ph-label', text: 'You can say:' }), sentence, el('p', { class: 'hs-ph-label', text: 'Then:' }), after);
        screen.replaceChildren(el('p', { class: 'hs-ph-head', text: 'Your answer' }), el('p', { class: 'hs-ph-label', text: 'Mom says:' }),
          el('p', { class: 'hs-ph-heard', text: `“${DEMO.says}”` }), dots, card);
        return { card, sentence, after, dots };
      },
      () => {
        const field = el('p', { class: 'hs-ph-chat-field' }), mine = el('p', { class: 'hs-ph-mine' }), dots = el('p', { class: 'hs-ph-dots', html: '<span></span><span></span><span></span>' });
        const reply = el('div', { class: 'hs-ph-card' }, [el('p', { class: 'hs-ph-label', text: 'Try this:' }), el('p', { class: 'hs-ph-say', text: DEMO.reply })]);
        const practice = el('p', { class: 'hs-ph-btn hs-ph-btn-light', text: 'Practice the talk' });
        screen.replaceChildren(el('p', { class: 'hs-ph-head', text: 'Your answer' }),
          el('div', { class: 'hs-ph-card is-old' }, [el('p', { class: 'hs-ph-label', text: 'You can say:' }), el('p', { class: 'hs-ph-say', text: `“${DEMO.answer}”` })]),
          mine, dots, reply, practice, el('div', { class: 'hs-ph-chat' }, [field, el('span', { class: 'hs-ph-send', text: '↑' })]));
        return { field, mine, dots, reply, practice };
      }
    ][index];
    const show = (node, on = true) => node.classList.toggle('is-shown', on);
    const finalState = () => {
      const parts = build();
      if (index === 0) { parts.field.textContent = DEMO.typed; show(parts.button); }
      if (index === 1) { parts.sentence.textContent = `“${DEMO.answer}”`; parts.after.textContent = DEMO.next; show(parts.card); }
      if (index === 2) { parts.mine.textContent = DEMO.ask; show(parts.mine); show(parts.reply); show(parts.practice); }
    };
    const loop = async run => {
      while (!run.stop) {
        const parts = build();
        if (index === 0) {
          await wait(500); if (!(await typeInto(parts.field, DEMO.typed, 55, run))) return;
          await wait(500); show(parts.button); parts.button.classList.add('is-pressed'); await wait(2600);
        } else if (index === 1) {
          await wait(400); show(parts.dots); await wait(1400); show(parts.dots, false); show(parts.card);
          if (!(await typeInto(parts.sentence, `“${DEMO.answer}”`, 38, run))) return;
          await wait(500); if (!(await typeInto(parts.after, DEMO.next, 22, run))) return; await wait(3200);
        } else {
          await wait(600); if (!(await typeInto(parts.field, DEMO.ask, 65, run))) return;
          await wait(400); parts.mine.textContent = DEMO.ask; parts.field.textContent = ''; show(parts.mine);
          await wait(500); show(parts.dots); await wait(1400); show(parts.dots, false); show(parts.reply);
          await wait(900); show(parts.practice); await wait(3200);
        }
      }
    };
    finalState();
    demoRuns.push({ phone, start: () => { const run = { stop: false }; loop(run); return run; } });
    return phone;
  };

  // ---- 1. So funktioniert es --------------------------------------------------------------------------------------
  const steps = section('hs-band', 'How it works', 'Three steps. No experience needed.', [
    el('ol', { class: 'hs-steps' }, [
      ['app-schreiben.webp', 'Describe the moment', 'Type or speak. For example: “Mom packs her bag every evening.”', 'The app asks: What is going on with Mom?'],
      ['app-antwort.webp', 'Read what you can say', 'One calm sentence for right now. Plus a small idea for what to do next.', 'The app shows a calm sentence to say.'],
      ['app-antwort-persoenlich.webp', 'Ask more or practice', 'Not quite right? Ask a follow-up question. Or practice the conversation first.', 'A personal answer with a follow-up question.']
    ].map(([img, title, text, alt], index) => el('li', {}, [
      demoPhone(index, alt),
      el('div', {}, [el('p', { class: 'hs-step-no', text: `Step ${index + 1}` }), el('h3', { text: title }), el('p', { text })])
    ])))
  ], 'so-gehts');

  // ---- 1b. So sieht eine Antwort aus (echte Antworten der Seite, mit Zeichnungen; Daniel, 28. Nov) --------------------
  const EXAMPLES = [
    { tab: 'Wants to go home', img: 'nach-hause.webp', w: 480, h: 664, says: 'I want to go home.', href: '/en/dementia-translator/i-want-to-go-home.html',
      phrases: ['You want to go home. Tell me what it’s like there.', 'You don’t feel at ease here right now. I’m with you.', 'Shall we go for a little walk together?'],
      todo: 'Walk a few steps together, for example to the window or into the garden. Then have something to drink.',
      trick: ['Photo album', 'Look through an album of old photos together. Pictures from the past give you plenty to talk about.', 'illu-trick-fotoalbum'] },
    { tab: 'Says money was stolen', img: 's-money.webp', w: 480, h: 396, says: 'You stole my money!', href: '/en/dementia-translator/someone-stole-my-purse.html',
      phrases: ['It’s awful when your money is gone. I’ll help you look.', 'You want your things to be safe. I understand.', 'Let’s look together where it might be.'],
      todo: 'Remember the favorite hiding places. Things often turn up in the same spots.',
      trick: ['A wallet of their own', 'Give the person a wallet with a little cash they can keep.', 'illu-trick-portemonnaie'] },
    { tab: 'Won’t take a shower', img: 'tuch-mama.webp', w: 480, h: 505, says: 'I don’t want a shower.', href: '/en/dementia-translator/i-dont-want-a-shower.html',
      phrases: ['Would you rather go now or after your coffee?', 'The bathroom is nice and warm. I’ll put a towel out for you.', 'You wash your face, I’ll help with your back.'],
      todo: 'Warm up the bathroom first and put a towel around the shoulders, so less skin is uncovered.',
      trick: ['Warm the bathroom', 'Warm up the bathroom and wrap a large towel around the shoulders. Keep covered what you are not washing right now.', 'illu-tuch-towel'] }
  ];
  const exampleCard = (ex, index) => el('article', { class: 'hs-example', id: `hs-example-${index}`, role: 'tabpanel', 'aria-labelledby': `hs-example-tab-${index}`, hidden: index > 0 }, [
    el('div', { class: 'hs-ex-head' }, [
      el('img', { src: `/assets/zeichnungen/${ex.img}`, width: ex.w, height: ex.h, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', {}, [el('p', { class: 'hs-ex-label', text: 'You hear' }), el('p', { class: 'hs-ex-says', text: `“${ex.says}”` })])
    ]),
    el('p', { class: 'hs-ex-label', text: 'What you can say' }),
    el('ul', { class: 'hs-ex-phrases' }, ex.phrases.map(text => el('li', { text }))),
    el('p', { class: 'hs-ex-label', text: 'What you can do' }),
    el('p', { class: 'hs-ex-todo', text: ex.todo }),
    el('div', { class: 'hs-ex-trick' }, [
      el('img', { src: `/alltagstricks/img/${ex.trick[2]}.webp`, width: 600, height: 472, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', {}, [el('p', { class: 'hs-ex-label', text: 'A trick that helps' }), el('h3', { text: ex.trick[0] }), el('p', { text: ex.trick[1] })])
    ]),
    el('a', { class: 'hs-link', href: ex.href, onclick: () => track('home_sales_example_open', { example: index }), text: 'See the full answer' })
  ]);
  const exampleTabs = el('div', { class: 'hs-ex-tabs', role: 'tablist', 'aria-label': 'Examples' }, EXAMPLES.map((ex, index) => el('button', {
    type: 'button', role: 'tab', id: `hs-example-tab-${index}`, 'aria-controls': `hs-example-${index}`, 'aria-selected': String(index === 0), text: ex.tab,
    onclick: event => {
      for (const tab of exampleTabs.children) tab.setAttribute('aria-selected', String(tab === event.currentTarget));
      for (const [i, panel] of examplePanels.entries()) panel.hidden = i !== index;
      track('home_sales_example', { example: index });
    }
  })));
  const examplePanels = EXAMPLES.map(exampleCard);
  const tryOwn = el('button', { type: 'button', class: 'hs-btn hs-btn-light', text: 'Try it with your situation', onclick: () => {
    track('home_sales_try');
    const input = document.getElementById('translator-input');
    if (!input) return;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus({ preventScroll: true }), 450);
  } });
  const examples = section('', 'What an answer looks like', 'Three real examples. Tap a situation.', [exampleTabs, ...examplePanels,
    el('p', { class: 'hs-ex-try' }, [tryOwn, el('span', { class: 'hs-quiet', text: 'Free, no sign-up needed.' })])], 'beispiele');

  // ---- 5b. Alltagstricks mit Zeichnungen (aus /alltagstricks/) -------------------------------------------------------
  const TRICKS = [
    ['roter-teller', 'illu-plate-red', 'A red plate', 'Food stands out clearly on a red plate.'],
    ['antwort-zettel', 'illu-trick-zettel', 'Write the answer down', 'Write the answer in big letters. Next time the question comes, just point to the note.'],
    ['abends-vorhaenge-zu', 'illu-trick-abends-vorhaenge-zu', 'Close the curtains early', 'Close the curtains before dusk and turn on bright lights inside.'],
    ['waesche-falten', 'illu-trick-waesche', 'Folding laundry', 'A familiar task gives the feeling of being needed.'],
    ['erst-riechen', 'illu-trick-riechen', 'Let them smell it first', 'Offer the food to smell first. The smell helps the appetite.'],
    ['armband', 'illu-trick-armband', 'Bracelet with your number', 'Their name and your phone number on the wrist help if they get lost.']
  ];
  // No English trick pages yet: cards without links.
  const tricks = section('', 'Small tricks for everyday life', 'Many answers come with a trick that makes the next day easier.', [
    el('ul', { class: 'hs-tricks', role: 'list' }, TRICKS.map(([, img, title, text]) => el('li', {}, [el('div', { class: 'hs-trick' }, [
      el('img', { src: `/alltagstricks/img/${img}.webp`, width: 600, height: 472, alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', {}, [el('strong', { text: title }), el('span', { text })])
    ])])))
  ], 'tricks');

  // ---- 2. Vorher / nachher ----------------------------------------------------------------------------------------
  const swap = section('', 'One sentence makes the difference', 'Explaining and correcting often ends in an argument. A sentence that meets the feeling often calms the moment.', [
    el('ul', { class: 'hs-swap' }, [
      ['You retired 20 years ago!', 'You were always so reliable. Tell me what’s on for today.'],
      ['Your mother died a long time ago.', 'You’re thinking about your mother. Tell me about her.'],
      ['I’ve told you three times already!', 'Look, it’s right here on the note: we leave at three o’clock.']
    ].map(([before, after]) => el('li', {}, [
      el('p', { class: 'hs-before' }, [el('span', { class: 'hs-tag', text: 'Instead of' }), el('span', { text: `“${before}”` })]),
      el('p', { class: 'hs-after' }, [el('span', { class: 'hs-tag', text: 'Try' }), el('span', { text: `“${after}”` })])
    ])))
  ]);

  // ---- 3. Stimmen (echt, per Skript) ------------------------------------------------------------------------------
  const voices = section('hs-band', 'What families say', null, [el('div', { class: 'hs-voices', role: 'list' }),
    el('p', { class: 'hs-quiet', text: 'Real voices of family caregivers in Germany who tried Dementia Coach, translated from German. First names shared with permission. The drawings show the story, not the people. Individual experiences, not a promise of your result.' })], 'stimmen');
  voices.hidden = true;

  // ---- 4. Drei Wege im Vergleich -----------------------------------------------------------------------------------
  const ways = section('', 'Three ways through a hard moment', 'How long each way takes before you know what to say.', [
    el('div', { class: 'hs-ways' }, [
      ['Searching online', 'A long time', ['Lots of pages, little about your situation', 'General tips instead of a sentence', 'No time for it in the moment'], false],
      ['Book or course', 'Days', ['Good knowledge, but a lot to read', 'The right sentence is missing when you need it', 'You can’t ask questions'], false],
      ['Dementia Coach', 'Seconds', ['A sentence for exactly your moment', 'Ask until it fits', 'Practice before it matters'], true]
    ].map(([title, time, items, ours]) => el('article', { class: `hs-way${ours ? ' is-ours' : ''}` }, [
      el('h3', { text: title }), el('p', { class: 'hs-way-time', text: time }),
      el('ul', {}, items.map(text => el('li', {}, [el('span', { class: 'hs-ico', html: ours ? ICON.check : ICON.cross }), el('span', { text })]))),
      ours ? buyButton('yearly', 'vergleich') : null
    ])))
  ]);

  // ---- 5. Viele Situationen ----------------------------------------------------------------------------------------
  const situations = section('hs-band', 'Help for many situations', 'For the moments that are hardest in daily life. Tap one.', [
    el('ul', { class: 'hs-cases', role: 'list' }, [
      ['nach-hause.webp', 'Wants to go home', 'Even when they are already home.', '/en/dementia-translator/i-want-to-go-home.html'],
      ['s-money.webp', 'Says money was stolen', 'When money or glasses have been “stolen”.', '/en/dementia-translator/someone-stole-my-purse.html'],
      ['tuch-mama.webp', 'Won’t take a shower', 'Getting into the bathroom without a fight.', '/en/dementia-translator/i-dont-want-a-shower.html'],
      ['s-recognize.webp', 'Doesn’t recognize me', 'When “Who are you?” hurts.', '/en/dementia-translator/who-are-you.html'],
      ['sunset.webp', 'Restless in the evening', 'When it gets dark and they want to leave.', '/en/dementia-translator/its-getting-dark-i-have-to-go.html'],
      ['s-meds.webp', 'Won’t take pills', 'Staying calm instead of persuading.', '/en/dementia-translator/im-not-taking-those-pills.html']
    ].map(([img, title, text, href]) => el('li', {}, [el('a', { class: 'hs-case', href, onclick: () => track('home_sales_case', { case: href }) }, [
      el('img', { src: `/assets/zeichnungen/${img}`, width: 480, height: 400, alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', {}, [el('strong', { text: title }), el('span', { text })])
    ])])))
  ]);

  // ---- 6. Zwischen-Aufruf -----------------------------------------------------------------------------------------
  const band = el('section', { class: 'hs-section hs-cta-band' }, [el('div', { class: 'hs-wrap hs-narrow' }, [
    el('h2', { text: 'Next time, you’ll have a sentence ready' }),
    el('p', { class: 'hs-sub', text: 'You don’t need an answer for everything. But you can have a place to start.' }),
    buyButton('yearly', 'band'), el('p', { class: 'hs-note' })
  ])]);

  // ---- Mehr Kaufstellen (wie /de/, Daniel, 28. Nov: „Bau mehr Kaufmöglichkeiten ein“). Nie im ersten Bildschirm.
  const miniCta = where => el('div', { class: 'hs-mini-cta' }, [buyButton('yearly', where), el('p', { class: 'hs-note' })]);
  for (const [block, where] of [[steps, 'schritte'], [examples, 'beispiele'], [voices, 'stimmen']]) block.querySelector('.hs-wrap').append(miniCta(where));

  // Kauf-Block unter jeder Antwort: Jahresplan wie im Preisblock, mit Garantie. Nicht für Kunden mit Abo, nicht bei Sicherheitshinweisen.
  const answerBuy = () => el('aside', { class: 'hs-answer-buy', 'aria-label': 'Unlock Dementia Coach' }, [
    el('p', { class: 'hs-answer-buy-kicker', text: 'For every hard moment' }),
    el('h3', { text: 'Get answers like this whenever you need them' }),
    el('p', { class: 'hs-answer-buy-price', 'data-answer-price': '' }),
    el('p', { class: 'hs-plan-day', 'data-per-day': 'yearly' }),
    buyButton('yearly', 'antwort'),
    el('p', { class: 'hs-note' }),
    el('p', { class: 'hs-answer-buy-seal' }, [el('span', { class: 'hs-ico', html: ICON.shield }), el('span', { text: '30-day money-back guarantee' })])
  ]);
  const placeAnswerBuy = () => {
    if (window.DemenzKiFreigabe?.isPaid?.()) { document.querySelectorAll('.hs-answer-buy').forEach(node => node.remove()); return; }
    let added = false;
    for (const answer of document.querySelectorAll('#translator-result .translator-goal-answer .translator-ai-answer')) {
      const box = answer.closest('.translator-goal-answer > *');
      if (!box || box.classList.contains('hs-answer-buy') || box.parentElement.querySelector(':scope > .hs-answer-buy') || box.querySelector('.safety-note')) continue;
      box.after(answerBuy()); added = true; track('home_sales_answer_buy_view');
    }
    if (added) refresh();
  };
  const resultRoot = document.getElementById('translator-result');
  if (resultRoot) new MutationObserver(() => placeAnswerBuy()).observe(resultRoot, { childList: true, subtree: true });

  // ---- 7. Preis ---------------------------------------------------------------------------------------------------
  const features = ['Sentences for every hard moment', 'Ask until it fits', 'Practice conversations calmly', 'Save and print your sentences', 'On the web and in the iPhone app'];
  const planCard = plan => el('article', { class: `hs-plan${plan === 'yearly' ? ' is-best' : ''}`, 'data-plan-card': plan }, [
    plan === 'yearly' ? el('p', { class: 'hs-plan-badge', 'data-badge': '' }) : null,
    el('h3', { text: plan === 'yearly' ? '12-month plan' : '1-month plan' }),
    el('p', { class: 'hs-plan-price', 'data-price': '' }),
    el('p', { class: 'hs-plan-then', 'data-then': '' }),
    el('p', { class: 'hs-plan-day', 'data-per-day': plan }),
    plan === 'yearly' ? el('div', { class: 'hs-cta-wrap' }, [buyButton('yearly', 'preis_jahr'), el('div', { class: 'hs-ap-slot', id: 'hs-ap-yearly', hidden: true })]) : buyButton('monthly', 'preis_monat'),
    plan === 'yearly' ? el('button', { type: 'button', class: 'hs-link hs-ap-alt', 'data-hs-buy': 'preis_jahr_andere', 'data-plan': 'yearly', hidden: true, text: 'Pay by card or another method' }) : null,
    el('p', { class: 'hs-plan-terms', 'data-terms': '' }),
    checks(features)
  ]);
  const guarantee = el('div', { class: 'hs-guarantee' }, [el('span', { class: 'hs-seal', html: ICON.shield }), el('p', {}, [
    el('strong', { text: '30-day money-back guarantee' }),
    el('span', { text: 'If it doesn’t help you, you get your money back. No reason needed. ' }),
    el('a', { href: '/terms-en.html#abo-web', onclick: () => track('home_sales_garantie'), text: 'Terms' })
  ])]);
  // Hinweis auf die iPhone-App (wie /de/, Daniel, 28. Nov). Nur weiter unten, nie im ersten Bildschirm. Nicht auf Android.
  const appHint = place => /Android/i.test(navigator.userAgent) ? el('span', { hidden: true }) : el('a', {
    class: 'hs-app', href: `https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=web_en_home_${place}&mt=8`,
    'data-store-link': `home-${place}`, onclick: () => track('home_sales_app', { place })
  }, [
    el('img', { src: '/assets/lovable-logo.jpg', width: 56, height: 56, alt: '', loading: 'lazy', decoding: 'async' }),
    el('span', { class: 'hs-app-text' }, [el('strong', { text: 'Also as an iPhone app' }), el('span', { text: 'Same account. Everything unlocked.' })]),
    el('span', { class: 'hs-app-btn', text: 'Get it on the App Store' })
  ]);
  const priceVoice = el('figure', { class: 'hs-voice-mini', hidden: true });
  const legal = el('p', { class: 'hs-legal' });
  const prices = section('', 'Choose your plan', null, [
    el('div', { class: 'hs-plans' }, [planCard('yearly'), planCard('monthly')]), guarantee, priceVoice, legal, appHint('preise')
  ], 'preise');

  // ---- 8. Vorteile ------------------------------------------------------------------------------------------------
  const perks = section('hs-band', 'No catch. No expertise. No waiting.', null, [el('ul', { class: 'hs-perks' }, [
    ['Cancel online', 'No login needed, just a few steps. No phone call.'],
    ['Money-back guarantee', '30 days. If it doesn’t help you, you get your money back.'],
    ['Your situation', 'Every answer starts from your words, not from a textbook.'],
    ['With you everywhere', 'In the browser on phone, tablet and computer. And as an iPhone app.']
  ].map(([title, text]) => el('li', {}, [el('span', { class: 'hs-ico', html: ICON.check }), el('div', {}, [el('h3', { text: title }), el('p', { text })])])))]);

  // ---- 9. Fragen --------------------------------------------------------------------------------------------------
  const faqYearly = el('span'), faqMonthly = el('span');
  const faq = section('', 'Common questions', null, [el('div', { class: 'hs-faq' }, [
    ['Who is Dementia Coach for?', ['For family members and caregivers who support a person with dementia in daily life. Especially when you can’t find the words.']],
    ['Do I need an iPhone?', ['No. Dementia Coach works in the browser on any phone, tablet and computer. On an iPhone you can also use the app.']],
    ['Do I have to phrase my question exactly?', ['No. Describe the moment in your own words. You can type or speak.']],
    ['Does Dementia Coach replace medical advice?', ['No. Dementia Coach helps with words and everyday life. It does not diagnose or treat anything. For medical questions, talk to a doctor. In an emergency, call 911 (US), 999 (UK) or 112 (EU).']],
    ['What does it cost?', [`The first ${offer.trialDays} days are free. After that, the 12-month plan costs `, faqYearly, ' and the 1-month plan ', faqMonthly, ' a month. Prices are in euros and include VAT.']],
    ['How do I cancel?', ['Online via “Cancel contracts here” at the bottom of every page, no login needed. If you cancel during the free trial, you pay nothing.']],
    ['Does it work in the app too?', ['Yes. Sign in to the iPhone app with the same account. Then everything is unlocked.']]
  ].map(([question, answer]) => el('details', { ontoggle: event => { if (event.target.open) track('home_sales_faq', { q: question.slice(0, 40) }); } }, [el('summary', { text: question }), el('p', {}, answer)])))]);

  // ---- 10. Schluss ------------------------------------------------------------------------------------------------
  const final = el('section', { class: 'hs-section hs-final' }, [el('div', { class: 'hs-wrap hs-narrow' }, [
    el('img', { src: '/assets/zeichnungen/v-umarmung.webp', width: 480, height: 489, alt: 'A daughter hugs her laughing mother', loading: 'lazy', decoding: 'async' }),
    el('h2', { text: 'Start today. At your own pace.' }),
    el('p', { class: 'hs-sub', text: 'Try Dementia Coach for 7 days. If it’s not for you, cancel online.' }),
    buyButton('yearly', 'schluss'), el('p', { class: 'hs-note' }), appHint('schluss')
  ])]);

  // ---- Einhängen: nach den Beispielsituationen, vor den Tipps --------------------------------------------------------
  const situationsBlock = document.querySelector('.home-situations');
  const anchor = situationsBlock || document.getElementById('translator-result');
  if (!anchor) return;
  const sales = el('div', { class: 'hs', id: 'verkauf' }, [steps, examples, swap, voices, ways, situations, tricks, band, prices, perks, faq, final]);
  anchor.after(sales);
  // Abwechselnd heller und getönter Hintergrund, egal wie viele Abschnitte es gibt.
  [...sales.children].filter(node => node.matches('.hs-section:not(.hs-cta-band):not(.hs-final)')).forEach((node, index) => node.classList.toggle('hs-band', index % 2 === 0));

  // Demo-Handys laufen nur, solange sie zu sehen sind.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const running = new Map();
    const demoWatch = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const demo = demoRuns.find(item => item.phone === entry.target);
        if (!demo) continue;
        if (entry.isIntersecting && !running.has(demo)) running.set(demo, demo.start());
        else if (!entry.isIntersecting && running.has(demo)) { running.get(demo).stop = true; running.delete(demo); }
      }
    }, { threshold: .35 });
    demoRuns.forEach(item => demoWatch.observe(item.phone));
  }

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
    for (const node of document.querySelectorAll('[data-answer-price]')) node.replaceChildren(el('strong', { text: `${euro(Math.round(firstYear() / 12))} a month` }), el('span', { text: deal() ? ` · ${euro(firstYear())} for the first year` : ` · ${euro(offer.yearly)} a year` }));
    const yearly = prices.querySelector('[data-plan-card="yearly"]'), monthly = prices.querySelector('[data-plan-card="monthly"]');
    yearly.querySelector('[data-price]').replaceChildren(el('strong', { text: euro(Math.round(firstYear() / 12)) }), el('span', { text: ' a month' }));
    yearly.querySelector('[data-then]').textContent = deal() ? `${euro(firstYear())} for the first year, then ${euro(offer.yearly)} a year` : `${euro(offer.yearly)} a year`;
    yearly.querySelector('[data-badge]').textContent = saving() >= 10 ? `Best value · Save ${saving()}%` : 'Best value';
    yearly.querySelector('[data-terms]').textContent = `${trial() ? `${offer.trialDays} days free. ` : ''}1-year term, then cancel with 1 month’s notice.`;
    monthly.querySelector('[data-price]').replaceChildren(el('strong', { text: euro(offer.monthly) }), el('span', { text: ' a month' }));
    monthly.querySelector('[data-then]').textContent = 'Cancel any month';
    monthly.querySelector('[data-terms]').textContent = `${trial() ? `${offer.trialDays} days free. ` : ''}Cancel anytime, effective at the end of the month.`;
    faqYearly.textContent = deal() ? `${euro(firstYear())} for the first year, then ${euro(offer.yearly)} a year` : `${euro(offer.yearly)} a year`;
    faqMonthly.textContent = euro(offer.monthly);
    legal.replaceChildren(`${trial() ? `After ${offer.trialDays} days the subscription starts and continues` : 'The subscription starts right away and continues'} at the chosen price until you cancel. The yearly plan has a 1-year term and can then be cancelled with 1 month’s notice; the monthly plan can be cancelled anytime, effective at the end of the month.${deal() ? ' The special price applies to the first year of the yearly plan.' : ''} Prices are in euros and include VAT. You can cancel online without logging in. The `,
      el('a', { href: '/terms-en.html', text: 'Terms of Use' }), ' apply, including your ', el('a', { href: '/terms-en.html#abo-web', text: 'right of withdrawal' }),
      '. General communication and everyday help, not a medical device.');
  };
  refresh();

  // ---- Stimmen ----------------------------------------------------------------------------------------------------
  const mountVoices = () => {
    // Same real voices as start/stimmen.js (first names with consent), translated from German. Do not invent or change the meaning.
    const all = VOICES_EN;
    // Zeichnung zur Geschichte der Stimme (Daniel, 28. Nov: Bilder zu den Stimmen). Keine Fotos, keine echten Gesichter.
    const DRAWN = { Monika: [560, 411], Gesa: [560, 553], Kemal: [560, 505], Doreen: [554, 560], Rike: [560, 422], Lisa: [560, 406], Timo: [492, 560] };
    const drawing = voice => (DRAWN[voice.name] ? el('img', { class: 'hs-voice-img', src: `/assets/stimmen/stimme-${voice.name.toLowerCase()}.webp`, width: DRAWN[voice.name][0], height: DRAWN[voice.name][1], alt: '', loading: 'lazy', decoding: 'async' }) : null);
    const card = voice => el('figure', { class: 'hs-voice', role: 'listitem' }, [drawing(voice), el('blockquote', { text: `“${voice.text}”` }), el('figcaption', { text: `${voice.name}, ${voice.rolle}` })]);
    voices.querySelector('.hs-voices').replaceChildren(...['Monika', 'Gesa', 'Kemal', 'Doreen', 'Rike', 'Lisa'].map(name => all.find(voice => voice.name === name)).filter(Boolean).map(card));
    voices.hidden = false;
    const mini = all.find(entry => entry.name === 'Timo');
    if (mini) { priceVoice.replaceChildren(...[drawing(mini)].filter(Boolean), el('blockquote', { text: `“${mini.text}”` }), el('figcaption', { text: `${mini.name}, ${mini.rolle} · translated from German, first name with permission` })); priceVoice.hidden = false; }
  };
  mountVoices();

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
