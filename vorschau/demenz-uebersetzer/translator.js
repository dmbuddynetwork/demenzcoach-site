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
  const retryBlock = (result) => {
    const block = element('div', { className: 'translator-retry', attributes: { id: `translator-retry-${result.key}`, tabindex: '-1' } });
    block.hidden = true;
    const text = () => core.personalize(result.retry.phrase, personal, data.formal);
    const quote = element('q', { text: text() });
    block.append(
      // Erst der neue Satz, dann der Hinweis dazu, zuletzt deutlich: Aufhören ist erlaubt.
      element('h3', { text: 'Zweiter Versuch' }),
      element('div', { className: 'translator-phrase' }, [quote]),
      element('p', { text: result.retry.tip }),
      element('p', { className: 'translator-retry-stop' }, [element('strong', { text: 'Du darfst aufhören. ' }), data.retryStop])
    );
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
  const offers = (result) => (onComputer() ? [signupBox(), appCTA(result)] : [appCTA(result), signupBox()]);
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
    nodes.push(disclaimer(true));
    // Anonymes Teilen gibt es vorerst nur auf Deutsch (der Server bietet es sonst auch nicht an).
    if (ui?.anonShare !== false && result.share?.sentence && result.share?.token) nodes.push(shareBox(result.share));
    return { node: element('div', { className: 'translator-ai-answer' }, nodes), focus: nodes[0].tagName === 'ASIDE' ? nodes[0] : first, top: nodes[0] };
  };
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
        const ok = await ai.share({ sentence: share.sentence, token: share.token, undo: true });
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
  // Warte-Ansicht in Form der Antwort: so wirkt die Wartezeit kürzer und nichts springt.
  const aiWaiting = () => element('div', { className: 'translator-ai-wait', attributes: { 'aria-hidden': 'true' } }, [
    element('span', { className: 'translator-skeleton translator-skeleton-title' }),
    element('span', { className: 'translator-skeleton' }),
    element('span', { className: 'translator-skeleton translator-skeleton-quote' }),
    element('span', { className: 'translator-skeleton translator-skeleton-short' })
  ]);
  // Runde 198 (Daniels Wahl „Automatisch“): Unbekannte Sätze gehen ohne Knopf an die KI.
  // Der Hinweis unter dem Eingabefeld sagt das. Der Knopf erscheint nur noch zum erneuten
  // Versuch oder nach „Nein“ beim zweiten Versuch (auto = false).
  const aiBox = (text, source, onFail = () => {}, { auto = false } = {}) => {
    if (!ai || !text || text.length < 2) return null;
    const status = element('p', { className: 'translator-ai-status', attributes: { role: 'status' } });
    const box = element('div', { className: 'translator-ai' });
    const waiting = aiWaiting();
    const run = async () => {
      ask.disabled = true;
      ask.hidden = auto;
      status.textContent = tr('Einen Moment, die KI schreibt eine Antwort …');
      if (auto) box.append(waiting);
      track('translator_ai', { step: 'ask', source: auto ? `${source}_auto` : source });
      const result = await ai.ask(text, { formal: personal.formal });
      waiting.remove();
      track('translator_ai', { step: result.kind, source });
      if (!box.isConnected) return;
      if (result.kind === 'answer' && Array.isArray(result.phrases)) {
        const { node, focus, top } = aiAnswer(result);
        // Die allgemeinen Ersatz-Sätze und „Diesen Satz kenne ich noch nicht.“ braucht es neben der KI-Antwort nicht mehr.
        output.querySelector('.translator-fallback')?.remove();
        output.querySelector('.translator-near-group')?.remove();
        // Die KI-Antwort bringt ihren eigenen Hinweis mit („KI-Antworten können Fehler enthalten“).
        output.querySelector('.translator-disclaimer')?.remove();
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

  const renderUnknown = ({ safetyHit, typed }) => {
    const nodes = [];
    if (safetyHit) nodes.push(generalNote());
    // Gleicher Aufbau wie ein Treffer: oben der Satz, dann klar, was jetzt hilft.
    const shown = typed.length > 90 ? `${typed.slice(0, 88).trim()}…` : typed;
    const heading = element('h2', { text: shown ? `„${shown}“` : 'Diesen Satz kenne ich noch nicht.', attributes: { tabindex: '-1' } });
    nodes.push(heading);
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
    const similar = typed ? core.near(typed, data) : [];
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
    nodes.push(disclaimer());
    nodes.push(suggestLink(typed));
    nodes.push(...offers());
    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
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

  const render = (entry, { safetyHit = false, alternatives = [], also = [], typed = '', mood = null } = {}) => {
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
    } else if (safetyHit || result.safetyOnly) {
      const typedForLead = core.normalize(typed);
      const lead = result.urgentLead?.cues?.some((cue) => typedForLead.includes(` ${cue}`)) ? result.urgentLead.text : '';
      nodes.push(result.safetyOnly ? urgentNote(result.safety, lead) : generalNote(lead));
    }

    // Steht der getippte Satz schon als Überschrift da, braucht es keine Wiederholung.
    if (typed && (result.selfCare || core.normalize(typed) !== core.normalize(result.says ?? ''))) nodes.push(element('p', { className: 'translator-echo', text: `Deine Eingabe: „${typed}“` }));
    // Entlastung spricht dich direkt an, statt dir einen Satz wie „Ich kann nicht mehr.“ in den Mund zu legen.
    if (!result.selfCare) nodes.push(element('span', { className: 'eyebrow', text: result.feeling ? 'Nach Gefühl' : 'Übersetzung' }));
    const heading = element('h2', { text: result.selfCare ? 'Das ist gerade viel für dich.' : result.feeling ? `Bei ${result.feeling}` : `„${result.says}“`, attributes: { tabindex: '-1' } });
    nodes.push(heading);
    // Bei manchen Eingaben gehört der Hinweis „Wann ein Gespräch nicht ausreicht“ nach oben,
    // zum Beispiel wenn jemand seit Tagen kaum trinkt.
    const typedNormalized = core.normalize(typed);
    const safetyFirst = Boolean(result.safety) && !result.safetyOnly && !safetyHit && !result.selfCare
      && (result.safetyFirst ?? []).some((cue) => typedNormalized.includes(` ${cue}`));
    // Runde 197: Oben steht der Hinweis unter der kurzen Überschrift „Erst die Sicherheit“ (eine Zeile statt zwei),
    // damit der erste Satz auf dem Handy näher rückt. Unten bleibt „Wann ein Gespräch nicht ausreicht“.
    const safetyAside = (first = false) => element('aside', { className: first ? 'safety-note safety-first' : 'safety-note' }, [
      element('strong', { text: first ? 'Erst die Sicherheit' : 'Wann ein Gespräch nicht ausreicht' }),
      element('span', { text: result.safety }),
      safetyCalls(result.safety)
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
    // Passende Zeichnung oben in der Karte (nur wenn die Seite eine mitliefert, siehe answer-drawings.json).
    if (result.image && !result.safetyOnly && !result.selfCare) {
      answerCard.append(element('img', { className: 'translator-answer-art', attributes: { src: result.image, alt: '', width: String(result.imageWidth ?? 480), height: String(result.imageHeight ?? 400), decoding: 'async' } }));
    }
    if (lead) {
      answerCard.append(element('h3', { className: 'translator-step', text: result.meaningTitle || (result.feeling ? 'Was jetzt hilft' : 'Was dahintersteckt') }));
      answerCard.append(element('p', { className: 'translator-meaning', text: lead }));
    }
    if (result.phrases.length) {
      answerCard.append(element('h3', { className: 'translator-step', text: result.phrasesTitle || 'Das kannst du sagen' }));
      const phraseList = element('div', { className: 'translator-phrases' });
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
            element('q', { text })
          ]);
        }));
      };
      paint();
      // Auf dem Handy muss der erste Satz ohne Scrollen sichtbar sein: Sätze zuerst, Anpassen und Erklärung danach.
      const usesExampleName = result.phrases.some((original) => /\bAnna\b/.test(original));
      // Runde 198: Wie bei der KI-Antwort (und in der App) ein konkreter Schritt direkt unter den Sätzen.
      const doNow = !result.selfCare && !result.safetyOnly && result.next?.length ? result.next[0] : '';
      const doNodes = doNow ? [
        element('h3', { className: 'translator-step', text: 'Das kannst du tun' }),
        element('p', { className: 'translator-meaning translator-do', text: doNow })
      ] : [];
      answerCard.append(phraseList, ...doNodes);
      nodes.push(alsoWrapper, result.selfCare ? null : personalPanel(() => { paint(); retry?.refresh(); }, { open: usesExampleName }));
    } else if (alsoWrapper) {
      nodes.push(alsoWrapper);
    }
    if (retry) nodes.push(retry.toggle, retry.block);

    // Antwort zuerst, alles Weitere in EINER Klappe: Für Menschen über 60 ist eine Klappe
    // leichter als drei. Innen kurze Zwischenüberschriften.
    const section = (title, items, intro) => (items.length || intro ? [
      element('h4', { className: 'translator-more-title', text: title }),
      intro ? element('p', { text: intro }) : null,
      items.length ? element('ul', {}, items.map((item) => element('li', { text: item }))) : null
    ] : []);
    const moreContent = [
      ...section(rest ? 'Hintergrund' : 'Weitere mögliche Gründe', result.meanings ?? [], rest),
      ...section('Eher vermeiden', result.avoid ?? [], result.avoid?.length ? 'Eher ungünstig ist es,' : ''),
      ...section('Was danach helfen kann', !result.selfCare && !result.safetyOnly && result.phrases.length ? (result.next ?? []).slice(1) : (result.next ?? []))
    ].filter(Boolean);
    // Runde 199 (schlankes Layout): Ratgeber- und Übungs-Link stehen im Aufklappbereich „Mehr dazu“,
    // unter der Antwort bleibt nur „Neuen Satz übersetzen“.
    const deeper = [
      result.href ? element('a', { className: 'text-link', text: `${result.linkLabel} →`, attributes: { href: result.href, 'data-related-link': result.key } }) : null,
      result.trainer ? element('a', { className: 'text-link', text: 'Diese Situation üben →', attributes: { href: result.trainer, 'data-related-link': 'gespraechstrainer' } }) : null
    ].filter(Boolean);
    if (moreContent.length) {
      nodes.push(element('div', { className: 'translator-more-group' }, [
        element('details', { className: 'translator-more' }, [
          element('summary', { text: 'Mehr dazu' }),
          ...moreContent,
          deeper.length ? element('div', { className: 'translator-result-links translator-more-links' }, deeper) : null
        ].filter(Boolean))
      ]));
    }

    if (result.safety && !result.safetyOnly && !safetyHit && !safetyFirst) nodes.push(safetyAside());

    const actions = element('div', { className: 'translator-result-links' });
    if (!moreContent.length) actions.append(...deeper);
    actions.append(button('Neuen Satz übersetzen', 'translator-copy', () => {
      input.value = '';
      grow();
      history.replaceState(null, '', location.pathname);
      input.focus();
      input.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));
    nodes.push(actions);
    nodes.push(disclaimer());

    if (!result.safetyOnly) {
      if (result.feeling) nodes.push(feelingPicker('Anderes Gefühl?'));
      nodes.push(feedbackBlock(result, retry));
      nodes.push(...offers(result));
    }

    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    requestAnimationFrame(() => syncSticky());
    focusResult(heading);
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const setHash = (key) => {
    const hash = key && key !== 'none' ? `#${phraseHash}${key}` : '';
    history.replaceState(null, '', `${location.pathname}${hash}`);
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
    render(entry);
    setHash(entry.key);
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
    const { entry, alternatives, safetyHit, feeling, also, mood } = core.match(text, data);
    const feelingEntry = !entry && feeling ? feelingEntries.get(feeling.id) : null;
    if (feelingEntry) {
      render(feelingEntry, { safetyHit, typed: text });
      history.replaceState(null, '', `${location.pathname}#${feelingHash}${feeling.id}`);
      track('translator_result', { result_key: feelingEntry.key, input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no' });
      return;
    }
    const knownPhrase = entry && entry.says === text;
    render(entry, { safetyHit, alternatives, also, mood, typed: knownPhrase ? '' : text });
    setHash(entry?.key);
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
})();
