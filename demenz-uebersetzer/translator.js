// Demenz-Übersetzer (Oberfläche). Der eingegebene Satz bleibt im Browser: Er wird
// nicht gespeichert, nicht gesendet und nie an Analytics übergeben. Gemessen wird
// nach Einwilligung höchstens ein fester Ergebnis-Schlüssel.
(() => {
  const dataElement = document.getElementById('translator-data');
  const form = document.getElementById('translator-form');
  const input = document.getElementById('translator-input');
  // Das Feld wächst mit dem Text: Ältere sehen den ganzen Satz, den sie getippt haben.
  // Enter schickt ab wie bei einem einzeiligen Feld.
  const grow = () => {
    if (input?.tagName !== 'TEXTAREA') return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight + 4}px`;
  };
  const output = document.getElementById('translator-result');
  const core = window.DemenzTranslatorCore;
  if (!dataElement || !form || !input || !output || !core) return;

  const data = JSON.parse(dataElement.textContent);
  // Andere Sprachen (zuerst Englisch): Texte und Einstellungen der Oberfläche kommen aus data.ui,
  // übersetzt von translator-locale.js. Auf deutschen Seiten fehlt data.ui, alles bleibt wie bisher.
  const ui = data.ui ?? null;
  const tr = window.DemenzTranslatorLocale?.create(ui) ?? ((text) => text);
  const translatedAttributes = new Set(['alt', 'aria-label', 'placeholder', 'title']);
  const phraseHash = ui?.phraseHash ?? 'satz-';
  const feelingHash = ui?.feelingHash ?? 'gefuehl-';
  const entryByKey = new Map(data.entries.map((entry) => [entry.key, entry]));
  const toolURL = data.toolURL;
  const appURL = ui?.appURL ?? 'https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=seo_de_translator&mt=8';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Ab dieser Punktzahl (translator-core rank) gilt ein Treffer als sicher: mehrere Wörter oder ein langes Stichwort.
  const strongScore = ui?.strongScore ?? 4;
  // Kurze Warte-Ansicht vor bekannten Antworten (die Haken laufen in einfach.css schneller).
  const quickWaitMs = 1800;

  const track = (name, parameters) => {
    if (typeof websiteAnalytics === 'undefined') return;
    websiteAnalytics.track(name, parameters);
  };

  const element = (tag, options = {}, children = []) => {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text) node.textContent = tr(options.text);
    Object.entries(options.attributes ?? {}).forEach(([name, value]) => node.setAttribute(name, translatedAttributes.has(name) ? tr(value) : value));
    children.filter(Boolean).forEach((child) => node.append(typeof child === 'string' ? tr(child) : child));
    return node;
  };

  const button = (text, className, onClick, attributes = {}) => {
    const node = element('button', { className, text, attributes: { type: 'button', ...attributes } });
    node.addEventListener('click', onClick);
    return node;
  };

  // Symbole (Daumen, Hörer) nur fürs Auge: Vorlesen soll nur „Ja“ oder
  // „Notruf 112“ sagen, nicht „Daumen hoch Ja“.
  const withIcon = (node, icon, label) => {
    node.replaceChildren(element('span', { text: icon, attributes: { 'aria-hidden': 'true' } }), ` ${tr(label)}`);
    return node;
  };

  const flash = (node, text) => {
    const original = node.textContent;
    node.textContent = tr(text);
    setTimeout(() => { node.textContent = original; }, 1800);
  };

  const copyText = async (text, node) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(node, 'Kopiert ✓');
      return true;
    } catch {
      flash(node, 'Bitte markieren');
      return false;
    }
  };

  const listSection = (title, items) => items.length
    ? [element('h3', { text: title }), element('ul', {}, items.map((item) => element('li', { text: item })))]
    : [];

  const fallback = {
    key: 'none',
    says: '',
    short: 'Diesen Satz kennt der Übersetzer noch nicht. Diese Schritte helfen in vielen schwierigen Gesprächen:',
    meanings: [],
    avoid: ['über Fakten oder die „richtige“ Wirklichkeit zu streiten,', 'mehrere Fragen auf einmal zu stellen,', 'lange Erklärungen zu geben.'],
    phrases: ['Ich bin bei dir. Wir schauen gemeinsam.', 'Das klingt gerade beunruhigend. Was würde dir jetzt guttun?', 'Nimm dir Zeit. Ich höre dir zu.'],
    next: ['Kurz innehalten und prüfen, ob alle sicher sind.', 'Das Gefühl hinter dem Satz aufgreifen, statt zu korrigieren.', 'Einen kurzen Satz anbieten und beobachten, wie er ankommt.'],
    safety: '',
    href: '/ratgeber/demenz-kommunikation.html',
    linkLabel: 'Ratgeber: Kommunikation bei Demenz',
    url: toolURL
  };

  const shareText = (result) => result.says
    ? `Hilfreich, wenn ein Mensch mit Demenz sagt „${result.says}“:`
    : result.feeling
      ? `Demenz und ${result.feeling} – diese Sätze helfen:`
      : 'Kostenloser Demenz-Übersetzer für Angehörige:';

  // Geteilt wird nur die öffentliche Seite des Ergebnisses, nie die Eingabe.
  const shareBlock = (result) => {
    const url = result.url || toolURL;
    const text = tr(shareText(result));
    // Ein einziger Knopf: Teilen-Menü des Handys, sonst WhatsApp.
    if (navigator.share) {
      return element('div', { className: 'translator-share' }, [button('Mit Familie teilen', 'translator-copy', async () => {
        try {
          await navigator.share({ title: tr('Demenz-Übersetzer'), text, url });
          track('translator_share', { result_key: result.key, method: 'native' });
        } catch {
          // Abgebrochen – nichts zu tun.
        }
      })]);
    }
    const whatsapp = element('a', {
      className: 'translator-copy',
      text: 'Per WhatsApp teilen',
      attributes: { href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, rel: 'noopener', target: '_blank' }
    });
    whatsapp.addEventListener('click', () => track('translator_share', { result_key: result.key, method: 'whatsapp' }));
    const wrapper = element('div', { className: 'translator-share' }, [whatsapp]);
    return wrapper;
  };

  // „Wenn das nicht hilft“: zweiter Versuch für den Moment, mit persönlichem Satz.
  // Ruhige Zeichnung im Ergebnis (Daniel, 8. Nov 17:16: „lockert die Textwüste auf“). Kommt fest aus den Seitendaten.
  const sceneArt = (image) => (image?.src
    ? element('img', { className: 'translator-scene-art', attributes: { src: image.src, alt: '', width: String(image.width ?? 480), height: String(image.height ?? 400), decoding: 'async' } })
    : null);
  const retryBlock = (result) => {
    const block = element('div', { className: 'translator-retry', attributes: { id: `translator-retry-${result.key}`, tabindex: '-1' } });
    block.hidden = true;
    const text = () => core.personalize(result.retry.phrase, personal, data.formal);
    const quote = element('q', { text: text() });
    block.append(...[
      // Erst der neue Satz, dann der Hinweis dazu, zuletzt deutlich: Aufhören ist erlaubt.
      element('h3', { text: 'Zweiter Versuch' }),
      sceneArt(data.retryImage),
      element('div', { className: 'translator-phrase' }, [quote]),
      element('p', { text: result.retry.tip }),
      element('p', { className: 'translator-retry-stop' }, [element('strong', { text: 'Du darfst aufhören. ' }), data.retryStop])
    ].filter(Boolean));
    const toggle = button('Hat nicht geholfen? Zweiter Versuch', 'translator-copy translator-retry-toggle', () => open('button'), {
      'aria-expanded': 'false',
      'aria-controls': block.id
    });
    const open = (source) => {
      quote.textContent = text();
      if (!block.hidden) return;
      block.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.hidden = true;
      block.focus({ preventScroll: true });
      block.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      track('translator_retry', { result_key: result.key, input_source: source });
    };
    const refresh = () => { quote.textContent = text(); };
    // Nach „Nein“: der Knopf „KI fragen“ steht direkt im zweiten Versuch, nicht weit unten.
    const addAI = (box) => {
      if (!box || block.querySelector('.translator-ai, .translator-ai-answer')) return;
      block.append(element('p', { className: 'translator-retry-ai', text: 'Passt das nicht zu eurer Lage? Dann frag die KI:' }), box);
    };
    return { toggle, block, open, refresh, addAI };
  };

  const feedbackBlock = (result, retry) => {
    const wrapper = element('div', { className: 'translator-feedback', attributes: { role: 'group', 'aria-label': 'War das hilfreich?' } }, [
      element('span', { text: 'War das hilfreich?' })
    ]);
    const answer = (helpful) => () => {
      track('translator_feedback', { result_key: result.key, helpful: helpful ? 'yes' : 'no' });
      // Teilen erst nach „Ja“: eine Zeile weniger unter dem Ergebnis, und
      // gefragt wird genau dann, wenn es geholfen hat.
      // Der gedrückte Knopf verschwindet; damit Tastatur und Vorlesen nicht
      // ins Leere springen, bekommt der Dank-Satz den Fokus.
      const thanks = (text) => element('span', { text, attributes: { tabindex: '-1' } });
      if (helpful) {
        const note = thanks('Danke! Teile es gern mit deiner Familie:');
        wrapper.replaceChildren(note, shareBlock(result));
        note.focus({ preventScroll: true });
        return;
      }
      const asked = input.value.trim() || result.says || '';
      const box = aiBox(asked, 'feedback');
      const note = thanks(retry
        ? 'Danke. Oben steht ein zweiter Versuch.'
        : (box ? 'Danke. Frag gern die KI nach einer Antwort für eure Lage:' : 'Danke für die Rückmeldung.'));
      wrapper.replaceChildren(note, retry ? '' : (box || ''));
      note.focus({ preventScroll: true });
      if (retry) {
        retry.addAI(box);
        retry.open('feedback');
      }
    };
    wrapper.append(withIcon(button('', 'translator-copy', answer(true)), '👍', 'Ja'), withIcon(button('', 'translator-copy', answer(false)), '👎', 'Nein'));
    return wrapper;
  };

  // App-Link je Situation mit eigenem Kampagnen-Token (fester Schlüssel, nie Text),
  // damit messbar wird, welche Situationen zur App führen.
  const appLinkFor = (result) => (result?.campaign ? appURL.replace(/ct=[^&]+/, `ct=${result.campaign}`) : appURL);
  // E-Mail-Liste (translator-signup.js): nur sichtbar, wenn das Skript geladen ist.
  const signupBox = () => window.DemenzTranslatorSignup?.box((step) => track('translator_signup', { step }));
  // Am Computer lässt sich die iPhone-App nicht direkt laden, und einen QR-Code nutzt die Zielgruppe nicht
  // (Daniel, 8. Nov). Dort kommt deshalb zuerst die E-Mail-Liste, dann der App-Hinweis.
  const onComputer = () => window.matchMedia?.('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches === true;
  // Web-Plan (Daniel, 9. Nov: „Webfunnel in die neue Webseite integrieren, damit Nutzer zu Zahlenden werden“).
  // Nur Deutsch, nie bei Notfall oder Entlastung. Der Link trägt nur den Ort und den festen Situations-Schlüssel, nie Text.
  const planMoments = new Set(['nachhause', 'mutter', 'wer', 'geld', 'arbeit', 'waschen']);
  // Direkt unter der Antwort statt unten (Daniel, 9. Nov 03:44): ab der zweiten eigenen Eingabe
  // („Das passiert öfter?“) und beim Ziel „Tipps“ („Mehr Tipps für euren Alltag im Plan“).
  let typedCount = 0;
  const planTitles = { ergebnis: 'Dein Plan für solche Momente', wieder: 'Das passiert öfter? Dein Plan für solche Momente', tipps: 'Mehr Tipps für euren Alltag im Plan' };
  const planCTA = (result, place = 'ergebnis') => {
    if (ui || result?.safetyOnly || result?.selfCare) return null;
    const moment = result?.key && planMoments.has(result.key) ? `&m=${result.key}` : '';
    const link = element('a', { className: 'button', text: 'Plan erstellen', attributes: { href: `/start/?src=${place}${moment}`, 'data-related-link': `plan_${place}` } });
    link.addEventListener('click', () => track('plan_start_click', { place, result_key: result?.key ?? '' }));
    return element('aside', { className: `translator-plan-cta${place === 'ergebnis' ? '' : ' translator-plan-up'}` }, [
      data.planImage ? element('img', { className: 'translator-plan-art', attributes: { src: data.planImage.src, width: String(data.planImage.width), height: String(data.planImage.height), alt: '', decoding: 'async' } }) : null,
      element('div', {}, [
        element('h2', { text: planTitles[place] ?? planTitles.ergebnis }),
        element('ul', { className: 'e-checks' }, [
          element('li', { text: 'Ein paar kurze Fragen zu eurer Lage' }),
          element('li', { text: 'Dann ein Plan mit Sätzen für euren Alltag' }),
          element('li', { text: '7 Tage kostenlos testen' })
        ]),
        link
      ])
    ]);
  };
  const offers = (result, safetyHit = false, planShown = false) => [safetyHit || planShown ? null : planCTA(result), ...(onComputer() ? [signupBox(), appCTA(result)] : [appCTA(result), signupBox()])];
  const appCTA = (result) => element('aside', { className: 'article-cta translator-app-cta' }, [
    element('div', {}, [
      element('h2', { text: 'Für eure eigene Situation' }),
      // Beim Treffer an den Satz anknüpfen: „Kommt das bei euch öfter vor?“ ist der ehrliche Grund für die App.
      element('p', { text: result?.says && !result.feeling && !result.selfCare
        ? `Kommt „${result.says.replace(/[.!]+$/, '')}“ bei euch öfter vor? In der App Demenz Coach beschreibst du eure Lage und bekommst passende Sätze. Kostenlos laden, Abo nur, wenn du willst.`
        : 'In der App Demenz Coach beschreibst du eure Lage und bekommst passende Sätze. Kostenlos laden, Abo nur, wenn du willst.' })
    ]),
    element('div', { className: 'translator-app-visual' }, [
      element('img', {
        attributes: {
          src: ui?.appImage ?? '../assets/app-de-help.webp',
          width: '720',
          height: '1566',
          loading: 'lazy',
          decoding: 'async',
          alt: 'Demenz Coach App: Hilfe für eine konkrete Situation'
        }
      }),
      element('a', {
        className: 'button',
        text: 'Kostenlos im App Store',
        attributes: { href: appLinkFor(result), 'data-store-link': result?.key ? `translator-result-${result.key}` : 'translator-result' }
      })
    ])
  ]);

  // Persönliche Sätze: nur im Arbeitsspeicher dieser Seite, nie gespeichert,
  // nie gesendet. Analytics erfährt höchstens, welche Einstellung genutzt wurde.
  const personal = { formal: false, callName: '', me: '', role: '' };
  const personalTracked = new Set();
  const trackPersonal = (setting) => {
    if (personalTracked.has(setting)) return;
    personalTracked.add(setting);
    track('translator_personalize', { setting });
  };
  let panelCounter = 0;

  const personalPanel = (repaint, { open = false } = {}) => {
    panelCounter += 1;
    const id = (suffix) => `translator-personal-${suffix}-${panelCounter}`;
    const isSet = personal.formal || personal.callName || personal.me || personal.role;
    const details = element('details', { className: 'translator-personal' });
    if (isSet || open) details.open = true;
    details.append(element('summary', { text: isSet ? 'Persönlich angepasst – ändern' : 'Sätze persönlich machen: Name, du oder Sie' }));

    const formality = element('div', { className: 'translator-personal-toggle', attributes: { role: 'group', 'aria-label': 'Anrede' } }, [
      element('span', { text: 'Anrede:' })
    ]);
    const toggles = [false, true].map((formal) => {
      const toggle = button(formal ? 'Sie' : 'du', 'translator-chip', () => {
        personal.formal = formal;
        toggles.forEach((candidate, index) => candidate.setAttribute('aria-pressed', String(Boolean(index) === formal)));
        trackPersonal('formal');
        repaint();
      }, { 'aria-pressed': String(personal.formal === formal) });
      formality.append(toggle);
      return toggle;
    });

    const field = (key, label, placeholder, setting) => {
      const control = element('input', {
        attributes: { id: id(key), type: 'text', maxlength: '40', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder }
      });
      control.value = personal[key];
      control.addEventListener('input', () => {
        personal[key] = control.value;
        trackPersonal(setting);
        repaint();
      });
      return element('div', { className: 'translator-personal-field' }, [
        element('label', { text: label, attributes: { for: id(key) } }),
        control
      ]);
    };

    const roleSelect = element('select', { attributes: { id: id('role') } }, [
      element('option', { text: 'keine Angabe', attributes: { value: '' } }),
      ...core.roles.map((role) => element('option', { text: role, attributes: { value: role } }))
    ]);
    roleSelect.value = personal.role;
    roleSelect.addEventListener('change', () => {
      personal.role = roleSelect.value;
      trackPersonal('role');
      repaint();
    });

    details.append(element('div', { className: 'translator-personal-body' }, [
      // Der eigene Name zuerst: Er ersetzt den Beispielnamen „Anna“ in den Sätzen.
      field('me', 'Dein Vorname', 'z. B. Anna', 'own_name'),
      element('div', { className: 'translator-personal-field' }, [
        element('label', { text: 'Du bist für die Person', attributes: { for: id('role') } }),
        roleSelect
      ]),
      field('callName', 'So nennst du die Person', 'z. B. Mama, Opa, Frau Weber', 'call_name'),
      // Englisch kennt kein du/Sie: dort keine Anrede-Wahl.
      ui?.formality === false ? null : formality,
      element('p', { className: 'translator-privacy', text: '🔒 Wird nicht gespeichert und nicht gesendet.' })
    ]));
    return details;
  };

  // Ziel-Frage vor der Antwort wie in der App (Daniel, 8. Nov 16:32: „Vor der Antwort wie in der App“).
  // Drei Ziele je Situation, das erste nach der Situation benannt, eines immer praktische Tipps.
  // Die Antwort selbst bleibt die geprüfte feste Antwort; das Ziel bestimmt, was zuerst und ausführlich kommt.
  // Keine Ziel-Frage bei Sicherheitshinweisen, Entlastung, Gefühlen, geteilten Links und auf anderen Sprachen.
  const goalsFor = (entry) => {
    if (ui || !entry || entry.safetyOnly || entry.selfCare || entry.feeling || !entry.phrases?.length) return null;
    // Texte je Situation aus ziele.json (Daniel, 9. Nov: „die Ziele sollen flexibel sein“), sonst allgemein.
    const labels = Array.isArray(entry.goals) && entry.goals.length === 3 ? entry.goals : ['Jetzt die richtigen Worte finden', 'Verstehen, was dahintersteckt', 'Tipps, damit es leichter wird'];
    return ['jetzt', 'verstehen', 'tipps'].map((id, index) => ({ id, label: labels[index] }));
  };
  // Der gehörte Satz als weiße Sprechblase mit Zeichnung daneben, wie auf den App-Store-Bildern
  // (Daniel, 8. Nov: „stell das in eine Sprechblase, als würde das gesagt werden“).
  const saidBlock = (says, entry, heading) => {
    const art = entry?.image && !entry.safetyOnly && !entry.selfCare
      ? element('img', { className: 'translator-said-art', attributes: { src: entry.image, alt: '', width: String(entry.imageWidth ?? 480), height: String(entry.imageHeight ?? 400), decoding: 'async' } })
      : null;
    heading.classList.add('translator-said-bubble');
    return element('div', { className: art ? 'translator-said translator-said-with-art' : 'translator-said' }, [
      element('div', { className: 'translator-said-text' }, [element('p', { className: 'translator-said-label', text: 'Du hörst:' }), heading]),
      art
    ].filter(Boolean));
  };
  // Echte Seiten-Adressen statt #satz-… (Daniel, 9. Nov): Ein Satz zeigt die Adresse seiner Satz-Seite
  // (…/ich-will-nicht-duschen.html), ein Ziel die eigene Ziel-Seite (…-was-sagen.html, -was-dahintersteckt.html,
  // -tipps.html; build-preview.mjs baut sie). Neu laden öffnet genau diese Seite; Zurück lädt die vorige.
  const startPath = location.pathname;
  const goalSlugs = { jetzt: 'was-sagen', verstehen: 'was-dahintersteckt', tipps: 'tipps' };
  const pathFor = (entry, goal = '') => {
    if (!entry?.href || /^[a-z]+:/i.test(entry.href) && !entry.href.startsWith(location.origin)) return null;
    const path = new URL(entry.href, location.href).pathname;
    return goal && goalSlugs[goal] ? path.replace(/\.html$/, `-${goalSlugs[goal]}.html`) : path;
  };
  let pushed = false;
  const setPage = (entry, goal = '', push = true) => {
    const path = pathFor(entry, goal);
    if (!path) { setHash(entry?.key ?? ''); return; }
    if (path === location.pathname && !location.hash) return;
    history[push ? 'pushState' : 'replaceState']({ translator: true }, '', path);
    pushed = pushed || push;
  };
  window.addEventListener('popstate', () => { if (pushed) location.reload(); });
  // Nach dem Ergebnis rückt das Eingabefeld unter die Antwort (Daniel, 9. Nov: oben lenkt es von den Ziel-Knöpfen ab;
  // statt „Neuen Satz übersetzen“ einfach weiterschreiben). Dasselbe Formular, nur verschoben und leer.
  let formMoved = false;
  // Es steht direkt nach Hinweis und „War das hilfreich?“, vor App- und Listen-Angeboten.
  const formBelow = () => {
    const anchors = [...output.children].filter((node) => node.matches('.translator-notes, .translator-feedback, .translator-suggest'));
    const anchor = anchors[anchors.length - 1];
    if (anchor) { if (anchor.nextElementSibling !== form) anchor.after(form); } else if (form.parentElement !== output) output.append(form);
    input.value = '';
    grow();
    if (formMoved) return;
    formMoved = true;
    form.classList.add('translator-form-below');
    form.prepend(element('p', { className: 'translator-form-below-title', text: 'Noch etwas schreiben?' }));
    input.setAttribute('placeholder', tr('Was ist noch passiert? Schreib es hier.'));
  };
  // In der Sprechblase steht, was die Person eingetippt hat (Daniel, 9. Nov: „sie schreit mich an“ ist nicht
  // „Lass mich in Ruhe!“). Nur ohne eigene Eingabe (Kachel, Link) steht der bekannte Satz dort.
  const bubbleText = (entry, typed = '') => {
    if (!typed || core.normalize(typed) === core.normalize(entry.says ?? '')) return entry.says;
    return typed.length > 90 ? `${typed.slice(0, 88).trim()}…` : typed;
  };
  // Ziel-Knöpfe mit weißem Symbol links und Pfeil rechts, klar als Knopf erkennbar (Daniel, 9. Nov).
  const goalIcons = {
    jetzt: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5Z"/><path d="M7.5 10h9M7.5 13h6"/>',
    verstehen: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z"/>',
    tipps: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.5 1.5 2.5-3M3.5 12l1.5 1.5 2.5-3M3.5 17.5 5 19l2.5-3"/>'
  };
  const goalSvg = (paths, className = 'translator-goal-icon') => {
    const span = element('span', { className, attributes: { 'aria-hidden': 'true' } });
    span.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    return span;
  };
  const goalButton = (goal, onClick) => {
    const node = button('', 'translator-goal', onClick);
    node.append(goalSvg(goalIcons[goal.id] ?? goalIcons.jetzt), element('span', { className: 'translator-goal-label', text: goal.label }), goalSvg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', 'translator-goal-arrow'));
    return node;
  };
  const askGoal = (entry, options = {}) => {
    const goals = goalsFor(entry);
    if (!goals) { render(entry, options); return; }
    const heading = element('h2', { text: `„${bubbleText(entry, options.typed)}“`, attributes: { tabindex: '-1' } });
    output.replaceChildren(...[
      saidBlock(entry.says, entry, heading),
      element('p', { className: 'translator-goal-question', text: 'Was möchtest du jetzt erreichen?' }),
      element('div', { className: 'translator-goals', attributes: { role: 'group', 'aria-label': 'Dein Ziel' } }, goals.map((goal) => goalButton(goal, () => {
        track('translator_goal', { goal: goal.id, result_key: entry.key });
        setPage(entry, goal.id);
        render(entry, { ...options, goal: goal.id });
      })))
    ].filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    formBelow();
    heading.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  // Sätze merken (Daniel, 8. Nov): nur in diesem Browser (translator-saved.js), nur Sätze aus den festen Antworten.
  const savedStore = window.DemenzSavedPhrases ?? null;
  let saveButtons = [];
  const saveButton = (result, original) => {
    if (!savedStore || ui || result.selfCare || !result.key) return null;
    const item = { key: result.key, says: result.says || '', text: original };
    const node = button('', 'translator-save', () => {
      const on = savedStore.toggle(item);
      track('translator_save', { step: on ? 'saved' : 'removed', result_key: result.key });
    });
    const set = (on) => {
      node.setAttribute('aria-pressed', String(on));
      node.setAttribute('aria-label', on ? 'Gemerkt – nicht mehr merken' : 'Satz merken');
      node.setAttribute('title', on ? 'Gemerkt' : 'Merken');
      // Nur das Herz (Daniel, 8. Nov: „Merken“ als Knopf nahm zu viel Platz weg).
      node.replaceChildren(element('span', { text: on ? '♥' : '♡', attributes: { 'aria-hidden': 'true' } }));
    };
    set(savedStore.has(item));
    saveButtons.push({ node, item, set });
    return node;
  };
  // Satz an die Familie schicken (Daniel, 8. Nov 17:02): Teilen-Menü des Handys, sonst WhatsApp.
  // Geteilt wird nur der feste Satz (ohne eingetragene Namen) und die öffentliche Seite der Situation mit eigenem Vorschaubild.
  const phraseShareButton = (result, original) => {
    if (ui || result.selfCare || result.safetyOnly || !result.url || !result.says) return null;
    const plain = core.personalize(original, { formal: personal.formal, callName: '', me: '', role: '' }, data.formal);
    const text = `„${plain}“ – das kann man sagen, wenn ein Mensch mit Demenz sagt: „${result.says}“. Mehr Sätze und Tipps:`;
    const label = 'Satz teilen';
    if (navigator.share) {
      return button('', 'translator-phrase-share', async () => {
        try {
          await navigator.share({ text, url: result.url });
          track('translator_share', { result_key: result.key, method: 'native', step: 'phrase' });
        } catch {
          // Abgebrochen – nichts zu tun.
        }
      }, { 'aria-label': label, title: label });
    }
    const link = element('a', { className: 'translator-phrase-share', attributes: { href: `https://wa.me/?text=${encodeURIComponent(`${text} ${result.url}`)}`, rel: 'noopener', target: '_blank', 'aria-label': label, title: label } });
    link.addEventListener('click', () => track('translator_share', { result_key: result.key, method: 'whatsapp', step: 'phrase' }));
    return link;
  };
  // „Meine Sätze“ oben in der Menüleiste mit Zähler (Daniel, 9. Nov 03:26: nicht wahllos auf der Seite).
  // Der Knopf öffnet die Liste als Fenster unter der Leiste; ohne gemerkte Sätze bleibt er unsichtbar.
  const savedNav = document.querySelector('.e-header nav');
  let savedBox = document.getElementById('translator-saved');
  let savedToggle = null;
  let savedCount = null;
  if (savedStore && savedNav && !ui) {
    if (!savedBox) {
      savedBox = element('section', { className: 'translator-saved', attributes: { id: 'translator-saved', 'aria-label': 'Meine Sätze', hidden: '' } });
      document.body.append(savedBox);
    } else if (savedBox.parentElement !== document.body) document.body.append(savedBox);
    savedBox.classList.add('translator-saved-panel');
    savedCount = element('span', { className: 'e-saved-count' });
    savedToggle = element('button', { className: 'e-saved-toggle', attributes: { type: 'button', 'aria-controls': 'translator-saved', 'aria-expanded': 'false', hidden: '' } }, [
      element('span', { className: 'e-saved-label', text: 'Meine Sätze' }),
      savedCount
    ]);
    savedNav.prepend(savedToggle);
  }
  const openSaved = (open) => {
    if (!savedToggle) return;
    savedBox.hidden = !open;
    savedToggle.setAttribute('aria-expanded', String(open));
    if (open) { savedBox.querySelector('button')?.focus(); track('translator_save', { step: 'list_opened' }); }
  };
  savedToggle?.addEventListener('click', () => openSaved(savedBox.hidden));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && savedToggle && !savedBox.hidden) { openSaved(false); savedToggle.focus(); } });
  document.addEventListener('click', (event) => { if (savedToggle && !savedBox.hidden && !savedBox.contains(event.target) && !savedToggle.contains(event.target)) openSaved(false); });
  const renderSaved = () => {
    saveButtons = saveButtons.filter(({ node }) => node.isConnected);
    saveButtons.forEach(({ item, set }) => set(savedStore.has(item)));
    if (!savedBox || !savedStore) return;
    const items = savedStore.list();
    if (savedToggle) {
      const before = savedCount.textContent;
      savedToggle.hidden = !items.length;
      savedCount.textContent = String(items.length);
      savedToggle.setAttribute('aria-label', `${tr('Meine Sätze')}: ${items.length}`);
      if (before && before !== savedCount.textContent) { savedToggle.classList.remove('e-saved-bump'); void savedToggle.offsetWidth; savedToggle.classList.add('e-saved-bump'); }
      if (!items.length) openSaved(false);
    } else savedBox.hidden = !items.length;
    if (!items.length) { savedBox.replaceChildren(); return; }
    savedBox.replaceChildren(
      element('div', { className: 'translator-saved-head' }, [
        element('h2', { text: 'Meine Sätze' }),
        savedToggle ? button('Schließen', 'translator-saved-close', () => { openSaved(false); savedToggle.focus(); }) : null
      ]),
      element('div', { className: 'translator-phrases' }, items.map((item) => element('div', { className: 'translator-phrase translator-saved-phrase' }, [
        element('q', { text: core.personalize(item.text, personal, data.formal) }),
        button('Entfernen', 'translator-saved-remove', () => {
          savedStore.remove(item);
          track('translator_save', { step: 'removed_list', result_key: item.key });
        })
      ]))),
      element('p', { className: 'translator-privacy', text: 'Nur auf diesem Gerät gespeichert.' })
    );
  };
  savedStore?.onChange(renderSaved);

  // Gefühle als eigene Ergebnisse: Einstieg, wenn ein Satz unbekannt ist oder nicht passt.
  const feelingEntries = new Map((data.feelings ?? []).map((feeling) => [feeling.id, {
    key: `gefuehl-${feeling.id}`,
    feeling: feeling.label,
    says: '',
    short: feeling.short,
    meanings: [],
    avoid: [],
    phrases: feeling.phrases,
    next: feeling.next,
    safety: '',
    href: '',
    linkLabel: '',
    related: feeling.related,
    retry: feeling.retry,
    afterImage: feeling.image ?? null,
    urgentLead: feeling.urgentLead ?? null,
    url: `${toolURL}#${feelingHash}${feeling.id}`
  }]));

  const feelingPicker = (title) => {
    const wrapper = element('div', { className: 'translator-feelings', attributes: { role: 'group', 'aria-label': title || 'Gefühl wählen' } }, [
      title ? element('p', { className: 'translator-feelings-title', text: title }) : null
    ].filter(Boolean));
    feelingEntries.forEach((feelingEntry, id) => {
      wrapper.append(button(feelingEntry.feeling, 'translator-chip', () => showFeeling(id, 'feeling_picker')));
    });
    return wrapper;
  };

  const suggestLink = (typed) => {
    if (!data.suggestMail) return null;
    const body = typed ? `Gesagt wurde: „${typed}“\n\nSituation (optional, ohne Namen):\n` : 'Gesagt wurde:\n\nSituation (optional, ohne Namen):\n';
    const link = element('a', {
      className: 'translator-copy',
      text: 'Satz per E-Mail vorschlagen',
      attributes: { href: `mailto:${data.suggestMail}?subject=${encodeURIComponent('Satz für den Demenz-Übersetzer')}&body=${encodeURIComponent(body)}` }
    });
    link.addEventListener('click', () => track('translator_suggest', { result_key: 'none' }));
    return element('p', { className: 'translator-suggest' }, [
      element('span', { text: 'Fehlt dieser Satz? Schick ihn uns, damit wir ihn ergänzen können.' }),
      link
    ]);
  };

  // Nummern im Sicherheitshinweis als große Anruf-Knöpfe: im Notfall antippen statt abtippen.
  const callNumbers = ui?.callNumbers ? ui.callNumbers.map(({ pattern, label, tel }) => ({ pattern: new RegExp(pattern), label, tel })) : [
    { pattern: /\b112\b/, label: 'Notruf 112', tel: '112' },
    { pattern: /\b110\b/, label: 'Polizei 110', tel: '110' },
    { pattern: /116 117/, label: 'Bereitschafts\u00ADdienst 116 117', tel: '116117' },
    { pattern: /0800 111 0 111/, label: 'Telefon\u00ADSeelsorge 0800 111 0 111', tel: '08001110111' }
  ];
  // Bei Entlastung für Angehörige steht das Gespräch (TelefonSeelsorge) vor dem Notruf.
  const safetyCalls = (text, listenFirst = false) => {
    const matches = callNumbers.filter(({ pattern }) => pattern.test(text));
    const found = listenFirst ? [...matches].reverse() : matches;
    return found.length
      ? element('div', { className: 'translator-calls' }, found.map(({ label, tel }) => withIcon(element('a', { className: 'translator-call', attributes: { href: `tel:${tel}` } }), '📞', label)))
      : null;
  };
  // Fokus nach dem Übersetzen: normalerweise die Überschrift. Steht ein
  // Notfall-Hinweis darüber, beginnt Vorlesen dort – sonst würden die
  // Anruf-Knöpfe übersprungen.
  const focusResult = (heading) => {
    const urgent = output.querySelector('.safety-urgent');
    const target = urgent && (urgent.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING) ? urgent : heading;
    if (target === urgent) urgent.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  // Nummern im Text als schlichte Links (tel:), ohne roten Knopf.
  const quietCalls = (text) => {
    const span = element('span');
    let restText = text;
    while (restText) {
      const hits = callNumbers.map((call) => ({ call, match: call.pattern.exec(restText) })).filter(({ match }) => match).sort((a, b) => a.match.index - b.match.index);
      if (!hits.length) { span.append(restText); break; }
      const { call, match } = hits[0];
      span.append(restText.slice(0, match.index), element('a', { className: 'translator-call-link', text: match[0], attributes: { href: `tel:${call.tel}` } }));
      restText = restText.slice(match.index + match[0].length);
    }
    return span;
  };
  const urgentNote = (text, lead = '') => element('aside', { className: 'safety-note safety-urgent', attributes: { role: 'note' } }, [
    // Im Notfall zuerst die Knöpfe zum Anrufen (112 immer vorn), dann die Erklärung.
    element('strong', { text: 'Erst die Sicherheit' }),
    lead ? element('p', { className: 'safety-lead', text: lead }) : null,
    safetyCalls(text),
    element('span', { text })
  ]);
  // Ein einziger, ungestufter Hinweis: Das Tool schätzt nicht ein, wie dringend etwas ist.
  const generalNote = (lead = '') => urgentNote(data.safetySignals.text, lead);

  // KI für Sätze, die die feste Liste nicht kennt. Bekannte Sätze bleiben auf dem Gerät;
  // unbekannte gehen automatisch an die KI (Hinweis unter dem Eingabefeld).
  const ai = window.DemenzTranslatorAI;
  const aiAnswer = (result) => {
    const nodes = [];
    // Ohne Stufen (englische Seiten): bei jedem Sicherheitshinweis der KI derselbe feste Hinweis.
    const ungraded = ui?.gradedSafety === false && result.safetyLevel !== 'standard';
    if (result.safetyLevel === 'urgent' || ungraded) nodes.push(urgentNote(data.safetySignals.text));
    if (!ungraded && result.safetyLevel === 'concern' && result.safetyMessage) {
      nodes.push(element('aside', { className: 'safety-note', attributes: { role: 'note' } }, [element('span', { text: result.safetyMessage })]));
    }
    // Gleich oben sagen, dass das von der KI kommt – nicht erst nach den Sätzen.
    nodes.push(element('p', { className: 'translator-ai-label', text: 'Antwort der KI. Prüfe, ob sie zu euch passt.' }));
    const first = element('h3', { className: 'translator-step', text: 'Was dahintersteckt', attributes: { tabindex: '-1' } });
    nodes.push(first, element('p', { className: 'translator-meaning', text: result.meaning }));
    nodes.push(element('h3', { className: 'translator-step', text: 'Das kannst du sagen' }));
    nodes.push(element('div', { className: 'translator-phrases' }, result.phrases.map((phrase) => element('div', { className: 'translator-phrase' }, [element('q', { text: phrase })]))));
    // Runde 198: Wie in der App gibt es einen konkreten nächsten Schritt.
    if (typeof result.nextStep === 'string' && result.nextStep) {
      nodes.push(element('h3', { className: 'translator-step', text: 'Das kannst du tun' }));
      nodes.push(element('p', { className: 'translator-meaning translator-ai-next', text: result.nextStep }));
    }
    nodes.push(element('p', { className: 'translator-ai-avoid' }, [element('strong', { text: 'Besser nicht: ' }), `„${result.avoid}“`]));
    nodes.push(notesCard(disclaimer(true)));
    // Anonymes Teilen gibt es vorerst nur auf Deutsch (der Server bietet es sonst auch nicht an).
    if (ui?.anonShare !== false && result.share?.sentence && result.share?.token) nodes.push(shareBox(result.share));
    return { node: element('div', { className: 'translator-ai-answer' }, nodes), focus: nodes[0].tagName === 'ASIDE' ? nodes[0] : first, top: nodes[0] };
  };
  // Hinweise in einer Karte: oben „Wann ein Gespräch nicht ausreicht“ (falls vorhanden), darunter die Haftungszeile.
  const notesCard = (...children) => element('div', { className: 'translator-notes', attributes: { role: 'note' } }, children.filter(Boolean));
  // Haftungs- und Gesundheitshinweis unter jeder Antwort (Daniel, 8. Nov), kurz und gut lesbar.
  const disclaimer = (fromAI = false) => element('p', { className: 'translator-disclaimer' }, [
    ...(fromAI ? ['KI-Antworten können Fehler enthalten. '] : []),
    'Allgemeine Hinweise ohne Gewähr, kein Ersatz für ärztlichen Rat. ',
    element('a', { className: 'text-link', text: 'Nutzungsbedingungen', attributes: { href: ui?.termsURL ?? '/nutzungsbedingungen.html' } })
  ]);
  // Daniels Wahl (8. Nov) „nur bereinigt sammeln“: freiwillig, auf Knopfdruck, und man sieht genau,
  // was geteilt wird. Daraus entstehen später neue Satz-Seiten und Einträge in der App.
  const shareBox = (share) => {
    const status = element('p', { className: 'translator-share-status', attributes: { role: 'status' } });
    // Automatisch gespeichert (erst nach Anwaltscheck per Remote Config): offen zeigen, was, und abwählbar.
    if (share.stored) {
      const undo = button('Nicht speichern', 'translator-copy', async () => {
        undo.disabled = true;
        const ok = await ai.share({ ...share, undo: true });
        track('translator_ai', { step: ok ? 'share_undone' : 'share_undo_failed', source: 'answer' });
        if (ok) {
          undo.hidden = true;
          status.textContent = 'Erledigt, der Satz ist gelöscht.';
        } else {
          undo.disabled = false;
          status.textContent = 'Das hat gerade nicht geklappt. Bitte später noch einmal.';
        }
      });
      return element('div', { className: 'translator-share-ai' }, [
        element('p', { text: `Zur Verbesserung des Übersetzers haben wir nur diese anonyme Fassung gespeichert: „${share.sentence}“. Deine Eingabe speichern wir nicht.` }),
        undo,
        status
      ]);
    }
    const send = button('Anonym teilen', 'translator-copy', async () => {
      send.disabled = true;
      const ok = await ai.share(share);
      track('translator_ai', { step: ok ? 'shared' : 'share_failed', source: 'answer' });
      if (ok) {
        send.hidden = true;
        status.textContent = 'Danke! Der Satz ist geteilt.';
      } else {
        send.disabled = false;
        status.textContent = 'Das hat gerade nicht geklappt. Bitte später noch einmal.';
      }
    });
    return element('div', { className: 'translator-share-ai' }, [
      element('p', { text: `Hilf anderen Familien: Teile diesen Satz anonym. Geteilt wird nur „${share.sentence}“, ohne deine Eingabe.` }),
      send,
      status
    ]);
  };
  // Warte-Ansicht (Daniel, 9. Nov: Ladeanimation auf Conversion optimiert): ruhige Zeichnung und drei Schritte,
  // die nacheinander abgehakt werden, wie „Dein Plan wird erstellt“ bei Noom. Oben deutlich: Es lädt (Daniel, 9. Nov 02:41).
  // Rein gestalterisch: die Schritte laufen per CSS, die Antwort erscheint, sobald sie da ist.
  // quick: dieselbe Ansicht kurz auch vor bekannten Antworten (Daniel, 9. Nov: „das Ergebnis kommt sofort, das verwirrt“).
  const aiWaiting = (quick = false) => element('div', { className: quick ? 'translator-ai-wait translator-ai-wait-quick' : 'translator-ai-wait', attributes: { role: 'status' } }, [
    element('p', { className: 'translator-ai-wait-title' }, [element('span', { className: 'translator-spinner', attributes: { 'aria-hidden': 'true' } }), tr(quick ? 'Deine Antwort wird zusammengestellt …' : 'Deine Antwort wird geschrieben …')]),
    element('span', { className: 'translator-ai-wait-bar', attributes: { 'aria-hidden': 'true' } }),
    sceneArt(data.waitImage),
    element('ol', { className: 'translator-ai-steps', attributes: { 'aria-hidden': 'true' } }, [
      element('li', { text: 'Satz verstehen' }),
      element('li', { text: 'Gefühl dahinter erkennen' }),
      element('li', { text: 'Passende Sätze finden' })
    ])
  ]);
  // Runde 198 (Daniels Wahl „Automatisch“): Unbekannte Sätze gehen ohne Knopf an die KI.
  // Der Hinweis unter dem Eingabefeld sagt das. Der Knopf erscheint nur noch zum erneuten
  // Versuch oder nach „Nein“ beim zweiten Versuch (auto = false).
  // KI-Freigabe der Web-Kasse (/abo/ki-freigabe.js, Daniel 8. Nov: „1 gratis, dann Probezeit“).
  // Aus, solange translatorGate.enabled nicht true ist; bekannte Sätze bleiben immer frei, Englisch auch.
  // Gesperrt: Angebotskarte statt Warte-Ansicht. Der Sicherheitshinweis darüber und „Meinst du vielleicht“
  // bleiben stehen; onFail zeigt die Gefühle-Auswahl und den allgemeinen Satz.
  const aiLocked = async (box, text, source, waiting) => {
    const gate = window.DemenzKiFreigabe;
    if (!gate) return false;
    const access = await gate.check({ language: (document.documentElement.lang || 'de').slice(0, 2) });
    if (access.allowed) return false;
    waiting.remove();
    box.replaceChildren(gate.offerCard({ sentence: text }));
    track('translator_ai', { step: 'limit', source });
    return true;
  };
  const aiBox = (text, source, onFail = () => {}, { auto = false } = {}) => {
    if (!ai || !text || text.length < 2) return null;
    const status = element('p', { className: 'translator-ai-status', attributes: { role: 'status' } });
    const box = element('div', { className: 'translator-ai' });
    const waiting = aiWaiting();
    const run = async () => {
      ask.disabled = true;
      ask.hidden = auto;
      // Automatisch: Die Warte-Ansicht sagt schon, dass die Antwort geschrieben wird (kein doppelter Text).
      status.textContent = auto ? '' : tr('Einen Moment, die KI schreibt eine Antwort …');
      if (auto) box.append(waiting);
      track('translator_ai', { step: 'ask', source: auto ? `${source}_auto` : source });
      if (await aiLocked(box, text, source, waiting)) { onFail(); return; }
      const result = await ai.ask(text, { formal: personal.formal });
      waiting.remove();
      track('translator_ai', { step: result.kind, source });
      if (!box.isConnected) return;
      if (result.kind === 'answer' && Array.isArray(result.phrases)) {
        window.DemenzKiFreigabe?.noteAnswer();
        const { node, focus, top } = aiAnswer(result);
        // Die allgemeinen Ersatz-Sätze und „Diesen Satz kenne ich noch nicht.“ braucht es neben der KI-Antwort nicht mehr.
        output.querySelector('.translator-fallback')?.remove();
        output.querySelector('.translator-near-group')?.remove();
        // Die KI-Antwort bringt ihren eigenen Hinweis mit („KI-Antworten können Fehler enthalten“).
        output.querySelector('.translator-notes')?.remove();
        if (box.previousElementSibling?.classList.contains('translator-unknown-note')) box.previousElementSibling.remove();
        box.replaceWith(node);
        document.body.classList.remove('translator-answers-seen');
        if (!auto) {
          focus.setAttribute('tabindex', '-1');
          focus.focus({ preventScroll: true });
          top.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
        return;
      }
      if (result.kind === 'safety') {
        const note = urgentNote(data.safetySignals.text);
        box.replaceWith(note);
        note.setAttribute('tabindex', '-1');
        note.focus({ preventScroll: true });
        return;
      }
      if (result.kind === 'off_topic') {
        status.textContent = tr('Dazu kann der Übersetzer nicht helfen. Tippe einen Satz ein, den die Person mit Demenz gesagt hat.');
        output.querySelector('.translator-fallback')?.remove();
        output.querySelector('.translator-suggest')?.remove();
        return;
      }
      // Ohne Treffer gibt es darunter die Gefühle-Auswahl: dorthin führen statt nur „später“.
      const next = source === 'unknown' ? ' Wähle unten, was du bei der Person spürst.' : '';
      status.textContent = tr(result.reason === 'busy'
        ? `Gerade kommen viele Fragen an.${next || ' Bitte versuch es in ein paar Minuten noch einmal.'}`
        : `Die KI ist gerade nicht erreichbar.${next || ' Bitte versuch es später noch einmal.'}`);
      ask.textContent = tr('Noch einmal versuchen');
      ask.hidden = false;
      ask.disabled = false;
      onFail();
    };
    const ask = button('KI fragen', 'button translator-ai-button', run);
    // Bei einem Fehler steht erst die Erklärung, dann der Knopf zum erneuten Versuch.
    box.append(...(auto ? [status, ask] : [ask, status]));
    if (!auto) box.append(element('p', { className: 'translator-ai-note', text: 'Dein Satz geht dafür an OpenAI. Wir speichern ihn nicht. Bitte ohne Namen.' }));
    if (auto) {
      ask.hidden = true;
      // Erst nach dem Einhängen starten, damit die Warte-Ansicht an der richtigen Stelle steht.
      requestAnimationFrame(() => { run(); });
    }
    return box;
  };

  // hint: ein schwacher Treffer der festen Liste. Die KI antwortet passend zur Eingabe; der Treffer
  // steht als erster Vorschlag unter „Meinst du vielleicht“ und gibt der Sprechblase seine Zeichnung.
  const renderUnknown = ({ safetyHit, typed, hint = null }) => {
    const nodes = [];
    if (safetyHit) nodes.push(generalNote());
    // Gleicher Aufbau wie ein Treffer: oben der Satz, dann klar, was jetzt hilft.
    const shown = typed.length > 90 ? `${typed.slice(0, 88).trim()}…` : typed;
    const heading = element('h2', { text: shown ? `„${shown}“` : 'Diesen Satz kenne ich noch nicht.', attributes: { tabindex: '-1' } });
    nodes.push(shown ? saidBlock(shown, hint, heading) : heading);
    if (shown && !(ai && typed.length >= 2)) nodes.push(element('p', { className: 'translator-meaning translator-unknown-note', text: 'Diesen Satz kenne ich noch nicht.' }));
    // Mit KI-Knopf ist die Gefühle-Auswahl ein Weg zu viel. Sie erscheint erst,
    // wenn die KI nicht antworten kann (oder es keinen KI-Knopf gibt).
    const feelings = element('div', { className: 'translator-feelings-step' }, [
      element('h3', { className: 'translator-step', text: 'Was spürst du bei der Person?' }),
      feelingPicker('')
    ]);
    const box = aiBox(typed, 'unknown', () => { feelings.hidden = false; if (fallbackBox) fallbackBox.hidden = false; }, { auto: true });
    if (box) feelings.hidden = true;
    nodes.push(box);
    // Ähnliche Situationen zuerst: Sie führen am schnellsten zu genauen Sätzen.
    const similar = typed ? [...new Set([hint, ...core.near(typed, data)].filter(Boolean))].slice(0, 2) : [];
    if (similar.length) {
      nodes.push(element('div', { className: 'translator-near-group' }, [
        element('h3', { className: 'translator-step', text: 'Meinst du vielleicht:' }),
        element('div', { className: 'translator-chips translator-near' }, similar.map((candidate) => button(`„${candidate.says}“`, 'translator-chip', () => show(candidate, 'alternative'))))
      ]));
    }
    // Während die KI schreibt, steht hier nichts Allgemeines – erst wenn sie nicht antworten kann.
    const fallbackBox = element('div', { className: 'translator-fallback' }, [
      element('h3', { className: 'translator-step', text: 'Das kannst du sagen' }),
      element('div', { className: 'translator-phrases' }, [
        element('div', { className: 'translator-phrase' }, [element('q', { text: core.personalize(fallback.phrases[0], personal, data.formal) })])
      ]),
      feelings
    ]);
    if (box) fallbackBox.hidden = true;
    nodes.push(fallbackBox);
    const planUp = !safetyHit && typedCount >= 2 ? planCTA(null, 'wieder') : null;
    nodes.push(planUp);
    nodes.push(notesCard(disclaimer()));
    nodes.push(suggestLink(typed));
    nodes.push(...offers(null, safetyHit, Boolean(planUp)));
    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow();
    requestAnimationFrame(() => syncSticky());
    focusResult(heading);
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const splitLead = (text) => {
    const sentences = String(text ?? '').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/);
    let lead = '';
    let index = 0;
    while (index < sentences.length && lead.length < 70) {
      lead = lead ? `${lead} ${sentences[index]}` : sentences[index];
      index += 1;
    }
    return [lead, sentences.slice(index).join(' ')];
  };

  const moodLead = ui?.moodLead ?? { wut: 'Zuerst beruhigen', trauer: 'Zuerst trösten', angst: 'Zuerst Sicherheit geben' };

  const render = (entry, { safetyHit = false, alternatives = [], also = [], typed = '', mood = null, goal = '' } = {}) => {
    if (!entry) {
      renderUnknown({ safetyHit, typed });
      return;
    }
    const result = entry;
    const nodes = [];

    if (result.selfCare) {
      // Angehörige schreiben über sich selbst: Hilfe für sie zuerst, ruhig statt alarmierend.
      nodes.push(element('aside', { className: safetyHit ? 'safety-note safety-urgent' : 'safety-note translator-selfcare', attributes: { role: 'note' } }, [
        element('strong', { text: result.safetyTitle || 'Hilfe für dich' }),
        element('span', { text: result.safety }),
        safetyCalls(result.safety, !safetyHit)
      ]));
      if (!safetyHit) nodes.push(sceneArt(data.selfCareImage));
    } else if (safetyHit || result.safetyOnly) {
      const typedForLead = core.normalize(typed);
      const lead = result.urgentLead?.cues?.some((cue) => typedForLead.includes(` ${cue}`)) ? result.urgentLead.text : '';
      nodes.push(result.safetyOnly ? urgentNote(result.safety, lead) : generalNote(lead));
    }

    // Entlastung spricht dich direkt an, statt dir einen Satz wie „Ich kann nicht mehr.“ in den Mund zu legen.
    if (result.feeling) nodes.push(element('span', { className: 'eyebrow', text: 'Nach Gefühl' }));
    const heading = element('h2', { text: result.selfCare ? 'Das ist gerade viel für dich.' : result.feeling ? `Bei ${result.feeling}` : `„${bubbleText(result, typed)}“`, attributes: { tabindex: '-1' } });
    nodes.push(result.selfCare || result.feeling ? heading : saidBlock(result.says, result, heading));
    // Bei manchen Eingaben gehört der Hinweis „Wann ein Gespräch nicht ausreicht“ nach oben,
    // zum Beispiel wenn jemand seit Tagen kaum trinkt.
    const typedNormalized = core.normalize(typed);
    const safetyFirst = Boolean(result.safety) && !result.safetyOnly && !safetyHit && !result.selfCare
      && (result.safetyFirst ?? []).some((cue) => typedNormalized.includes(` ${cue}`));
    // Runde 197: Oben steht der Hinweis unter der kurzen Überschrift „Erst die Sicherheit“ (eine Zeile statt zwei),
    // damit der erste Satz auf dem Handy näher rückt. Unten bleibt „Wann ein Gespräch nicht ausreicht“.
    // Normale Antworten: Hinweis ruhig als kleiner Text mit antippbaren Nummern (Daniel, 8. Nov: „Notruf/Polizei
    // nicht so krass verlinken“). Echte Notfälle (safety-urgent, „Erst die Sicherheit“) behalten die Anruf-Knöpfe.
    const safetyAside = (first = false) => element('aside', { className: first ? 'safety-note safety-first' : 'safety-note safety-quiet' }, [
      element('strong', { text: first ? 'Erst die Sicherheit' : 'Wann ein Gespräch nicht ausreicht' }),
      first ? element('span', { text: result.safety }) : quietCalls(result.safety),
      first ? safetyCalls(result.safety) : null
    ]);
    if (safetyFirst) nodes.push(safetyAside(true));
    // Weitere Anliegen kommen direkt nach den Sätzen: Der erste Satz zum Ausprobieren bleibt auf dem Handy oben.
    let alsoWrapper = null;
    if (also.length) {
      alsoWrapper = element('div', { className: 'translator-also', attributes: { role: 'group', 'aria-label': 'Weitere Anliegen in deiner Eingabe' } }, [
        element('p', { className: 'translator-also-title', text: result.selfCare ? 'Für das Gespräch mit der Person:' : also.length > 1 ? 'Du hast noch mehr beschrieben:' : 'Du hast noch etwas beschrieben:' })
      ]);
      also.forEach((candidate) => {
        alsoWrapper.append(button(`„${candidate.says}“ →`, 'translator-chip', () => show(candidate, 'also')));
      });
    }
    if (alternatives.length) {
      const altWrapper = element('p', { className: 'translator-alternatives' }, [element('span', { text: 'Passt eher? ' })]);
      alternatives.forEach((alternative) => {
        altWrapper.append(button(`„${alternative.says}“`, 'translator-chip', () => show(alternative, 'alternative')));
      });
      nodes.push(altWrapper);
    }

    const retry = result.retry ? retryBlock(result) : null;
    // Erst verstehen, dann antworten: genau die zwei Fragen, mit denen jemand kommt.
    // Auf dem Handy mit großer Schrift soll der erste Antwortsatz schnell kommen: Unter
    // „Was dahintersteckt“ steht nur der Kern (ein, zwei Sätze), der Rest unter „Hintergrund“.
    const [lead, rest] = result.safetyOnly ? [result.short, ''] : splitLead(result.short);
    // Wie in der App: Erklärung, Sätze und der nächste Schritt stehen zusammen in EINER Karte.
    const answerCard = element('div', { className: 'translator-answer' });
    nodes.push(answerCard);
    const goals = goal ? goalsFor(result) : null;
    const chosenGoal = goals?.find((candidate) => candidate.id === goal) ?? null;
    // Gewähltes Ziel als ruhige graue Zeile oben in der Karte (wie in der App, nie wie ein Knopf).
    if (chosenGoal) answerCard.append(element('p', { className: 'translator-goal-chosen', text: `Dein Ziel: ${chosenGoal.label}` }));
    // Die Zeichnung steht oben neben der Sprechblase (saidBlock), nicht mehr in der Karte.
    // Bausteine der Karte; die Reihenfolge richtet sich nach dem Ziel.
    const meaningBlock = [];
    if (lead) {
      meaningBlock.push(element('h3', { className: 'translator-step', text: result.meaningTitle || (result.feeling ? 'Was jetzt hilft' : 'Was dahintersteckt') }));
      meaningBlock.push(element('p', { className: 'translator-meaning', text: lead }));
      // Ziel „Verstehen“: Hintergrund und mögliche Gründe direkt in der Karte statt in einer Klappe.
      if (goal === 'verstehen') {
        if (rest) meaningBlock.push(element('p', { className: 'translator-meaning', text: rest }));
        if (result.meanings?.length) meaningBlock.push(element('ul', { className: 'translator-goal-list' }, result.meanings.map((item) => element('li', { text: item }))));
      }
    }
    const phraseBlock = [];
    let quickRow = null;
    const doBlock = [];
    let panel = null;
    if (result.phrases.length) {
      phraseBlock.push(element('h3', { className: 'translator-step', text: result.phrasesTitle || 'Das kannst du sagen' }));
      const phraseList = element('div', { className: 'translator-phrases' });
      // Anrede als kleine Zeile unten in der Karte (Daniel, 8. Nov: sichtbar, aber nicht über den Sätzen, das lenkt ab).
      let quickToggles = [];
      const syncQuick = () => {
        quickToggles.forEach((toggle, index) => toggle.setAttribute('aria-pressed', String(Boolean(index) === personal.formal)));
        panel?.querySelectorAll('.translator-personal-toggle .translator-chip').forEach((toggle, index) => toggle.setAttribute('aria-pressed', String(Boolean(index) === personal.formal)));
      };
      const paint = () => {
        // Bei Wut, Tränen oder Angst kommt zuerst ein kurzer beruhigender Satz.
        const first = mood && mood.phrases?.length ? [{ original: mood.phrases[0], lead: moodLead[mood.id] }] : [];
        // „Anna“ ist ein Beispielname: Solange kein eigener Name eingetragen ist, einmal darauf hinweisen.
        let exampleHintShown = false;
        phraseList.replaceChildren(...[...first, ...result.phrases.map((original) => ({ original }))].map(({ original, lead }) => {
          // Bitten an Familie oder Freunde bleiben, wie sie sind: keine Anrede der erkrankten Person davor.
          const text = result.selfCare ? original : core.personalize(original, personal, data.formal);
          const exampleHint = !exampleHintShown && !String(personal.me ?? '').trim() && /\bAnna\b/.test(text);
          if (exampleHint) exampleHintShown = true;
          return element('div', { className: lead ? 'translator-phrase translator-phrase-mood' : exampleHint ? 'translator-phrase translator-phrase-example' : 'translator-phrase' }, [
            lead ? element('span', { className: 'translator-mood-lead', text: lead }) : null,
            exampleHint ? element('span', { className: 'translator-example-name', text: '„Anna“ ist ein Beispiel – trag unten deinen Namen ein.' }) : null,
            element('q', { text }),
            element('div', { className: 'translator-phrase-actions' }, [saveButton(result, original), phraseShareButton(result, original)])
          ]);
        }));
        syncQuick();
      };
      const repaint = () => { paint(); retry?.refresh(); renderSaved(); };
      if (!result.selfCare && ui?.formality !== false && !ui) {
        const quick = element('div', { className: 'translator-quick', attributes: { role: 'group', 'aria-label': 'Anrede' } }, [element('span', { text: 'Anrede:' })]);
        quickToggles = [false, true].map((formal) => {
          const toggle = button(formal ? 'Sie' : 'du', 'translator-chip', () => {
            personal.formal = formal;
            trackPersonal('formal');
            repaint();
          }, { 'aria-pressed': String(personal.formal === formal) });
          quick.append(toggle);
          return toggle;
        });
        quick.append(button('Namen einsetzen', 'translator-chip translator-quick-name', () => {
          if (!panel) return;
          panel.open = true;
          panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          panel.querySelector('input')?.focus({ preventScroll: true });
        }));
        quickRow = quick;
      }
      paint();
      phraseBlock.push(phraseList);
      // Auf dem Handy muss der erste Satz ohne Scrollen sichtbar sein: Sätze zuerst, Anpassen und Erklärung danach.
      const usesExampleName = result.phrases.some((original) => /\bAnna\b/.test(original));
      // Runde 198: Wie bei der KI-Antwort (und in der App) ein konkreter Schritt direkt unter den Sätzen.
      const doNow = !result.selfCare && !result.safetyOnly && result.next?.length ? result.next[0] : '';
      if (goal === 'tipps' && result.next?.length) {
        // Ziel „Tipps“: alle Tipps und „Eher vermeiden“ direkt in der Karte.
        doBlock.push(element('h3', { className: 'translator-step', text: 'Das kannst du tun' }));
        doBlock.push(element('ul', { className: 'translator-goal-list' }, result.next.map((item) => element('li', { text: item }))));
        if (result.avoid?.length) {
          doBlock.push(element('h3', { className: 'translator-step', text: 'Eher vermeiden' }));
          doBlock.push(element('ul', { className: 'translator-goal-list' }, result.avoid.map((item) => element('li', { text: item }))));
        }
      } else if (doNow) {
        doBlock.push(element('h3', { className: 'translator-step', text: 'Das kannst du tun' }));
        doBlock.push(element('p', { className: 'translator-meaning translator-do', text: doNow }));
      }
      panel = result.selfCare ? null : personalPanel(repaint, { open: usesExampleName });
      // Mit der Anrede-Zeile in der Karte braucht es keine zweite Zeile „Sätze persönlich machen“: Die Felder öffnen über „Namen einsetzen“.
      if (panel && quickRow) panel.classList.add('translator-personal-quiet');
      nodes.push(alsoWrapper, panel);
    } else if (alsoWrapper) {
      nodes.push(alsoWrapper);
    }
    // Alltagstrick zur Situation direkt unter „Das kannst du tun“ (Daniel, 8. Nov: wie der rote Teller).
    // Kommt fest aus den Seitendaten (nie aus KI oder Eingabe), Notfall und Entlastung bekommen keinen.
    // „Noch ein Trick“ zeigt den nächsten passenden (Debby/Daniel, 8. Nov), danach wieder den ersten.
    const tricks = !result.safetyOnly && !result.selfCare && Array.isArray(result.tricks) ? result.tricks.filter((item) => item?.title) : [];
    const trick = tricks[0] ?? null;
    let trickBlock = [];
    if (trick) {
      let shown = 0;
      const art = element('img', { className: 'translator-trick-art', attributes: { src: trick.image, alt: '', width: String(trick.imageWidth ?? 480), height: String(trick.imageHeight ?? 400), decoding: 'async' } });
      const title = element('p', { className: 'translator-trick-title', text: trick.title });
      const body = element('p', { text: trick.text });
      const trickLink = element('a', { className: 'text-link translator-trick-link', text: 'Alle Tricks', attributes: { href: trick.href } });
      trickLink.addEventListener('click', () => track('translator_trick', { result_key: result.key, trick_id: tricks[shown].id }));
      const links = element('div', { className: 'translator-trick-links' }, [
        tricks.length > 1 ? button('Noch ein Trick', 'translator-trick-next', () => {
          shown = (shown + 1) % tricks.length;
          const next = tricks[shown];
          art.setAttribute('src', next.image);
          art.setAttribute('width', String(next.imageWidth ?? 480));
          art.setAttribute('height', String(next.imageHeight ?? 400));
          title.textContent = next.title;
          body.textContent = next.text;
          trickLink.setAttribute('href', next.href);
          track('translator_trick', { result_key: result.key, trick_id: next.id, step: 'next' });
        }) : null,
        trickLink
      ]);
      trickBlock = [element('div', { className: 'translator-trick', attributes: { 'aria-live': 'polite' } }, [
        art,
        element('div', { className: 'translator-trick-text' }, [element('p', { className: 'translator-trick-label', text: 'Dieser Trick hilft' }), title, body, links])
      ])];
    }
    if (trick && !doBlock.length) trickBlock.unshift(element('h3', { className: 'translator-step', text: 'Das kannst du tun' }));
    const doWithTrick = [...doBlock, ...trickBlock];
    const order = goal === 'jetzt' ? [phraseBlock, doWithTrick, meaningBlock]
      : goal === 'tipps' ? [doWithTrick, phraseBlock, meaningBlock]
        : [meaningBlock, phraseBlock, doWithTrick];
    // Anrede-Zeile direkt unter den Sprechblasen (Daniel, 8. Nov 16:51), nicht am Ende der Karte.
    if (quickRow) phraseBlock.push(quickRow);
    // Unter den Sätzen dieselbe Situation, wenn es wieder ruhig ist („Danach“-Zeichnung).
    if (phraseBlock.length && !result.safetyOnly && !result.selfCare && !safetyHit) phraseBlock.push(sceneArt(result.afterImage));
    answerCard.append(...order.flat().filter(Boolean));
    const planPlace = safetyHit || result.feeling ? '' : typedCount >= 2 ? 'wieder' : goal === 'tipps' ? 'tipps' : '';
    const planUp = planPlace ? planCTA(result, planPlace) : null;
    if (planUp) nodes.push(planUp);
    // Die anderen Ziele und „Zweiter Versuch“ stehen unter der Antwort als EINE ruhige Liste
    // (Daniel, 8. Nov: drei große lila Knöpfe untereinander waren zu laut).
    const nextRows = chosenGoal ? goals.filter((candidate) => candidate !== chosenGoal).map((candidate) => button(candidate.label, 'translator-copy', () => {
      track('translator_goal', { goal: candidate.id, result_key: result.key, step: 'switch' });
      setPage(result, candidate.id, false);
      render(result, { safetyHit, alternatives, also, typed, mood, goal: candidate.id });
    })) : [];
    // Runde 199 (schlankes Layout): Ratgeber- und Übungs-Link stehen im Aufklappbereich „Mehr dazu“,
    // unter der Antwort bleibt nur „Neuen Satz übersetzen“.
    const deeper = [
      result.href ? element('a', { className: 'text-link', text: `${result.linkLabel} →`, attributes: { href: result.href, 'data-related-link': result.key } }) : null,
      result.trainer ? element('a', { className: 'text-link', text: 'Diese Situation üben →', attributes: { href: result.trainer, 'data-related-link': 'gespraechstrainer' } }) : null
    ].filter(Boolean);
    if (retry) nextRows.push(retry.toggle);
    // Mit Ziel stehen Ratgeber und Üben als Zeilen in derselben Liste statt als große unterstrichene Links.
    const deeperInList = Boolean(chosenGoal);
    if (deeperInList) deeper.forEach((link) => { link.className = 'translator-copy'; link.textContent = link.textContent.replace(/\s*→$/, ''); });
    if (deeperInList) nextRows.push(...deeper);
    if (nextRows.length) {
      nodes.push(element('div', { className: 'translator-next' }, [
        chosenGoal ? element('p', { className: 'translator-next-title', text: 'Mehr zu dieser Situation' }) : null,
        element('div', { className: 'translator-next-rows', attributes: { role: 'group', 'aria-label': 'Mehr zu dieser Situation' } }, nextRows)
      ].filter(Boolean)));
    }
    if (retry) nodes.push(retry.block);

    // Antwort zuerst, alles Weitere in EINER Klappe: Für Menschen über 60 ist eine Klappe
    // leichter als drei. Innen kurze Zwischenüberschriften.
    const section = (title, items, intro) => (items.length || intro ? [
      element('h4', { className: 'translator-more-title', text: title }),
      intro ? element('p', { text: intro }) : null,
      items.length ? element('ul', {}, items.map((item) => element('li', { text: item }))) : null
    ] : []);
    // Mit Ziel stehen Hintergrund und Tipps hinter den anderen Ziel-Zeilen: keine zusätzliche Klappe
    // (Daniel, 8. Nov: „‚Mehr dazu‘ ist komisch“). Ohne Ziel (geteilter Link) heißt die Klappe klarer.
    const moreContent = chosenGoal ? [] : [
      ...section(rest ? 'Hintergrund' : 'Weitere mögliche Gründe', result.meanings ?? [], rest),
      ...section('Eher vermeiden', result.avoid ?? [], result.avoid?.length ? 'Eher ungünstig ist es,' : ''),
      ...section('Was danach helfen kann', !result.selfCare && !result.safetyOnly && result.phrases.length ? (result.next ?? []).slice(1) : (result.next ?? []))
    ].filter(Boolean);
    if (moreContent.length) {
      nodes.push(element('div', { className: 'translator-more-group' }, [
        element('details', { className: 'translator-more' }, [
          element('summary', { text: 'Hintergrund und weitere Tipps' }),
          ...moreContent,
          deeper.length ? element('div', { className: 'translator-result-links translator-more-links' }, deeper) : null
        ].filter(Boolean))
      ]));
    }

    // „Neuen Satz übersetzen“ entfällt (Daniel, 9. Nov): Unter dem Ergebnis steht das Feld zum Weiterschreiben (formBelow).
    if (!moreContent.length && !deeperInList && deeper.length) nodes.push(element('div', { className: 'translator-result-links' }, deeper));
    // Sicherheits- und Haftungshinweis als EINE ruhige Karte (Daniel, 9. Nov: „gestalte disclaimer besser“).
    nodes.push(notesCard(result.safety && !result.safetyOnly && !safetyHit && !safetyFirst ? safetyAside() : null, disclaimer()));

    if (!result.safetyOnly) {
      if (result.feeling) nodes.push(feelingPicker('Anderes Gefühl?'));
      nodes.push(feedbackBlock(result, retry));
      nodes.push(...offers(result, safetyHit, Boolean(planUp)));
    }

    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow();
    requestAnimationFrame(() => syncSticky());
    focusResult(heading);
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const setHash = (key) => {
    const hash = key && key !== 'none' ? `#${phraseHash}${key}` : '';
    history.replaceState(null, '', `${startPath}${hash}`);
  };

  function showFeeling(id, source) {
    const entry = feelingEntries.get(id);
    if (!entry) return;
    render(entry);
    history.replaceState(null, '', `${location.pathname}#${feelingHash}${id}`);
    track('translator_result', { result_key: entry.key, input_source: source, safety_hint: 'no' });
  }

  function show(entry, source) {
    input.value = entry.says;
    grow();
    askGoal(entry);
    setPage(entry);
    track('translator_result', { result_key: entry.key, input_source: source, safety_hint: 'no' });
  }

  const emptyHint = document.getElementById('translator-empty-hint') ?? element('p');
  input.addEventListener('input', () => { grow(); if (input.value.trim()) emptyHint.textContent = ''; });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && input.tagName === 'TEXTAREA') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      // Leeres Feld: sagen, was fehlt – sichtbar und für Vorlesen.
      emptyHint.textContent = tr('Bitte zuerst einen Satz eintippen – oder unten einen antippen.');
      input.focus();
      return;
    }
    emptyHint.textContent = '';
    typedCount += 1;
    const { entry, alternatives, safetyHit, feeling, also, mood } = core.match(text, data);
    const feelingEntry = !entry && feeling ? feelingEntries.get(feeling.id) : null;
    if (feelingEntry) {
      render(feelingEntry, { safetyHit, typed: text });
      history.replaceState(null, '', `${location.pathname}#${feelingHash}${feeling.id}`);
      track('translator_result', { result_key: feelingEntry.key, input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no' });
      return;
    }
    const knownPhrase = entry && entry.says === text;
    // Feste Antwort nur bei einem echten Treffer (Daniel, 9. Nov): eigener Satz, eine Variante davon oder
    // ein klarer Treffer (Punktzahl ab strongScore). Ein einzelnes Stichwort („sie schreit mich an“ → „schreit“)
    // geht an die KI; der Treffer bleibt als Vorschlag und Ersatz, falls die KI nicht antworten kann.
    const own = (value) => core.normalize(value ?? '') === core.normalize(text);
    const score = entry ? core.rank(text, [entry])[0]?.score ?? 0 : 0;
    const strong = !entry || knownPhrase || own(entry.says) || (entry.variants ?? []).some(own) || score >= strongScore || entry.safetyOnly || entry.selfCare;
    if (!strong && ai && !safetyHit) {
      renderUnknown({ safetyHit, typed: text, hint: entry });
      setHash('');
      track('translator_result', { result_key: 'none', input_source: 'typed', safety_hint: 'no', multiple: also.length ? 'yes' : 'no', mood: mood?.id ?? 'none', weak_key: entry.key });
      return;
    }
    const answer = () => (safetyHit ? render : askGoal)(entry, { safetyHit, alternatives, also, mood, typed: knownPhrase ? '' : text });
    // Auch bekannte Antworten kommen nach einer kurzen Warte-Ansicht, nicht schlagartig. Sicherheit nie verzögern.
    if (entry && !safetyHit && !entry.safetyOnly) {
      const waiting = aiWaiting(true);
      output.replaceChildren(waiting);
      output.hidden = false;
      document.body.classList.add('translator-has-result');
      output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => { if (waiting.isConnected) answer(); }, reduceMotion ? 300 : quickWaitMs);
    } else {
      answer();
    }
    if (entry && !entry.safetyOnly) setPage(entry); else setHash(entry?.key);
    track('translator_result', { result_key: entry?.key ?? 'none', input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no', multiple: also.length ? 'yes' : 'no', mood: mood?.id ?? 'none' });
  });

  document.querySelectorAll('[data-translator-key]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const entry = entryByKey.get(chip.dataset.translatorKey);
      if (entry) show(entry, 'chip');
    });
  });

  document.querySelectorAll('[data-translator-feeling]').forEach((chip) => {
    chip.addEventListener('click', () => showFeeling(chip.dataset.translatorFeeling, 'feeling_chip'));
  });

  // Kein wechselndes Beispiel im Feld: bewegter Text lenkt ab, Beispiele stehen als Knöpfe darunter.

  // Geteilte Links wie …/demenz-uebersetzer/#satz-mutter öffnen das Ergebnis direkt.
  const openFromHash = () => {
    if (location.hash.startsWith(`#${feelingHash}`)) {
      showFeeling(location.hash.slice(feelingHash.length + 1), 'link');
      return;
    }
    const key = location.hash.startsWith(`#${phraseHash}`) ? location.hash.slice(phraseHash.length + 1) : '';
    const entry = entryByKey.get(key);
    if (!entry) return;
    input.value = entry.says;
    grow();
    render(entry);
    track('translator_result', { result_key: entry.key, input_source: 'link', safety_hint: 'no' });
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
  renderSaved();

  // Zurück von Kasse oder Anmeldung: den gemerkten Satz (nur sessionStorage dieses Tabs) gleich übersetzen.
  const pendingSentence = window.DemenzKiFreigabe?.takePending();
  if (pendingSentence) {
    input.value = pendingSentence;
    grow();
    form.requestSubmit();
  }

  // Beim Drucken alle aufklappbaren Abschnitte zeigen.
  window.addEventListener('beforeprint', () => {
    output.querySelectorAll('details').forEach((details) => { details.open = true; });
  });

  // Mobile Leiste zur App nach dem ersten Ergebnis (schließbar).
  const stickyBar = document.getElementById('translator-sticky');
  stickyBar?.querySelector('button')?.addEventListener('click', () => {
    stickyBar.hidden = true;
    document.body.classList.add('translator-sticky-closed');
  });
  // Ist der große App-Kasten im Bild, braucht es die Leiste nicht doppelt.
  const syncSticky = () => {
    // Die App-Leiste erst zeigen, wenn die Antwortsätze ganz zu sehen waren –
    // sonst verdeckt sie auf kleinen Handys genau die erste Antwort.
    const answers = output.querySelector('.translator-phrases')?.getBoundingClientRect();
    if (answers && answers.height && answers.bottom < innerHeight) document.body.classList.add('translator-answers-seen');
    const box = document.querySelector('.translator-app-cta')?.getBoundingClientRect();
    document.body.classList.toggle('translator-cta-visible', Boolean(box && box.height && box.top < innerHeight && box.bottom > 0));
  };
  addEventListener('scroll', syncSticky, { passive: true });
  addEventListener('resize', syncSticky, { passive: true });

  // Eingabe immer in Reichweite (Daniel, 9. Nov 03:27 und 04:09): Ist das Feld aus dem Bild gescrollt, erscheint
  // unten rechts ein kleines Chat-Fenster wie bei Support-Chats: die junge Frau aus den Zeichnungen, eine
  // Sprechblase und ein echtes Eingabefeld. Abschicken trägt den Text ins große Feld und schickt es dort ab.
  // Mit × wird es zum runden Bild; ein Tipp darauf öffnet es wieder.
  if (document.body.classList.contains('einfach') && 'IntersectionObserver' in window) {
    const chatImage = data.chatImage ?? null;
    const avatar = () => chatImage
      ? element('img', { className: 'translator-chat-avatar', attributes: { src: chatImage.src, width: '56', height: '56', alt: '', decoding: 'async' } })
      : element('span', { className: 'translator-chat-avatar' });
    const field = element('input', { className: 'translator-chat-input', attributes: { type: 'text', maxlength: '200', autocomplete: 'off', enterkeyhint: 'send', placeholder: 'Hier schreiben …', 'aria-label': 'Was ist passiert?' } });
    const send = element('button', { className: 'translator-chat-send', attributes: { type: 'submit', 'aria-label': 'Senden' } });
    send.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
    const chatForm = element('form', { className: 'translator-chat-form' }, [field, send]);
    const close = element('button', { className: 'translator-chat-close', text: '×', attributes: { type: 'button', 'aria-label': 'Chat verkleinern' } });
    const panel = element('div', { className: 'translator-chat-panel' }, [
      element('div', { className: 'translator-chat-head' }, [avatar(), element('p', { className: 'translator-chat-bubble', text: 'Was ist passiert? Schreib es mir.' }), close]),
      chatForm
    ]);
    const bubbleOnly = element('button', { className: 'translator-chat-open', attributes: { type: 'button', 'aria-label': 'Chat öffnen' } }, [avatar()]);
    const chat = element('aside', { className: 'translator-chat', attributes: { 'aria-label': 'Noch etwas schreiben', hidden: '' } }, [panel, bubbleOnly]);
    let small = false;
    const setSmall = (value) => { small = value; chat.classList.toggle('translator-chat-small', value); };
    close.addEventListener('click', () => { setSmall(true); bubbleOnly.focus(); track('translator_write_chat', { step: 'closed' }); });
    bubbleOnly.addEventListener('click', () => { setSmall(false); field.focus(); track('translator_write_chat', { step: 'opened' }); });
    chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = field.value.trim();
      if (!value) { field.focus(); return; }
      input.value = value;
      field.value = '';
      field.blur();
      grow();
      track('translator_write_chat', { step: 'sent' });
      form.requestSubmit();
    });
    document.body.append(chat);
    new IntersectionObserver(([seen]) => {
      const wasHidden = chat.hidden;
      chat.hidden = seen.isIntersecting;
      if (wasHidden && !chat.hidden) { chat.classList.remove('translator-chat-in'); void chat.offsetWidth; chat.classList.add('translator-chat-in'); }
    }).observe(input);
  }
})();
