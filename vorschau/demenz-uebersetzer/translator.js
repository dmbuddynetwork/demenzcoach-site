// Demenz-Übersetzer (Oberfläche). Der eingegebene Satz bleibt im Browser: Er wird
// nicht gespeichert, nicht gesendet und nie an Analytics übergeben. Gemessen wird
// nach Einwilligung höchstens ein fester Ergebnis-Schlüssel.
(() => {
  const dataElement = document.getElementById('translator-data');
  const form = document.getElementById('translator-form');
  const input = document.getElementById('translator-input');
  const output = document.getElementById('translator-result');
  const core = window.DemenzTranslatorCore;
  if (!dataElement || !form || !input || !output || !core) return;

  const data = JSON.parse(dataElement.textContent);
  const entryByKey = new Map(data.entries.map((entry) => [entry.key, entry]));
  const toolURL = data.toolURL;
  const appURL = 'https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=seo_de_translator&mt=8';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const track = (name, parameters) => {
    if (typeof websiteAnalytics === 'undefined') return;
    websiteAnalytics.track(name, parameters);
  };

  const element = (tag, options = {}, children = []) => {
    const node = document.createElement(tag);
    if (options.className) node.className = options.className;
    if (options.text) node.textContent = options.text;
    Object.entries(options.attributes ?? {}).forEach(([name, value]) => node.setAttribute(name, value));
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  };

  const button = (text, className, onClick, attributes = {}) => {
    const node = element('button', { className, text, attributes: { type: 'button', ...attributes } });
    node.addEventListener('click', onClick);
    return node;
  };

  const flash = (node, text) => {
    const original = node.textContent;
    node.textContent = text;
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
    : 'Kostenloser Demenz-Übersetzer für Angehörige:';

  // Geteilt wird nur die öffentliche Seite des Ergebnisses, nie die Eingabe.
  const shareBlock = (result) => {
    const url = result.url || toolURL;
    const text = shareText(result);
    // Ein einziger Knopf: Teilen-Menü des Handys, sonst WhatsApp.
    if (navigator.share) {
      return element('div', { className: 'translator-share' }, [button('Mit Familie teilen', 'translator-copy', async () => {
        try {
          await navigator.share({ title: 'Demenz-Übersetzer', text, url });
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
      element('h3', { text: 'Zweiter Versuch' }),
      element('p', { text: result.retry.tip }),
      element('div', { className: 'translator-phrase' }, [quote]),
      element('p', { className: 'translator-retry-stop', text: data.retryStop })
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
    return { toggle, block, open, refresh };
  };

  const feedbackBlock = (result, retry) => {
    const wrapper = element('div', { className: 'translator-feedback', attributes: { role: 'group', 'aria-label': 'War das hilfreich?' } }, [
      element('span', { text: 'War das hilfreich?' })
    ]);
    const answer = (helpful) => () => {
      track('translator_feedback', { result_key: result.key, helpful: helpful ? 'yes' : 'no' });
      wrapper.replaceChildren(element('span', {
        text: helpful
          ? 'Danke! Teile den Übersetzer gern mit anderen Angehörigen.'
          : retry
            ? 'Danke. Hier ist ein zweiter Versuch – und in der App kannst du eure Situation genauer beschreiben.'
            : 'Danke für die Rückmeldung. In der App kannst du eure Situation genauer beschreiben.'
      }));
      if (!helpful && retry) retry.open('feedback');
    };
    wrapper.append(button('👍 Ja', 'translator-copy', answer(true)), button('👎 Nein', 'translator-copy', answer(false)));
    return wrapper;
  };

  // App-Link je Situation mit eigenem Kampagnen-Token (fester Schlüssel, nie Text),
  // damit messbar wird, welche Situationen zur App führen.
  const appLinkFor = (result) => (result?.campaign ? appURL.replace('ct=seo_de_translator', `ct=${result.campaign}`) : appURL);
  const appCTA = (result) => element('aside', { className: 'article-cta translator-app-cta' }, [
    element('div', {}, [
      element('h2', { text: 'Hilfe für eure ganz eigene Situation' }),
      element('p', { text: 'Mit der App Demenz Coach beschreibst du eure Lage in wenigen Worten und bekommst passende Sätze und einen nächsten Schritt.' }),
      element('p', { text: 'Kostenloser Download, optionales Abo.' })
    ]),
    element('div', { className: 'translator-app-visual' }, [
      element('img', {
        attributes: {
          src: '../assets/app-de-help.webp',
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
      formality,
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
    url: `${toolURL}#gefuehl-${feeling.id}`
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

  const renderUnknown = ({ safetyHit, typed }) => {
    const nodes = [];
    if (safetyHit) {
      nodes.push(element('aside', { className: 'safety-note safety-urgent', attributes: { role: 'note' } }, [
        element('strong', { text: 'Erst die Sicherheit' }),
        element('span', { text: data.safetySignals.text })
      ]));
    }
    // Gleicher Aufbau wie ein Treffer: oben der Satz, dann klar, was jetzt hilft.
    const shown = typed.length > 90 ? `${typed.slice(0, 88).trim()}…` : typed;
    const heading = element('h2', { text: shown ? `„${shown}“` : 'Diesen Satz kenne ich noch nicht.', attributes: { tabindex: '-1' } });
    nodes.push(heading);
    if (shown) nodes.push(element('p', { className: 'translator-meaning', text: 'Diesen Satz kenne ich noch nicht.' }));
    // Ähnliche Situationen zuerst: Sie führen am schnellsten zu genauen Sätzen.
    const similar = typed ? core.near(typed, data) : [];
    if (similar.length) {
      nodes.push(element('h3', { className: 'translator-step', text: 'Meinst du vielleicht:' }));
      nodes.push(element('div', { className: 'translator-chips translator-near' }, similar.map((candidate) => button(`„${candidate.says}“`, 'translator-chip', () => show(candidate, 'alternative')))));
    }
    nodes.push(element('h3', { className: 'translator-step', text: 'Das kannst du sagen' }));
    nodes.push(element('div', { className: 'translator-phrases' }, [
      element('div', { className: 'translator-phrase' }, [element('q', { text: core.personalize(fallback.phrases[0], personal, data.formal) })])
    ]));
    nodes.push(element('h3', { className: 'translator-step', text: 'Was spürst du bei der Person?' }));
    nodes.push(feelingPicker(''));
    nodes.push(suggestLink(typed));
    nodes.push(appCTA());
    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    heading.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const moodLead = { wut: 'Zuerst beruhigen', trauer: 'Zuerst trösten', angst: 'Zuerst Sicherheit geben' };

  const render = (entry, { safetyHit = false, alternatives = [], also = [], typed = '', mood = null } = {}) => {
    if (!entry) {
      renderUnknown({ safetyHit, typed });
      return;
    }
    const result = entry;
    const nodes = [];

    if (safetyHit || result.safetyOnly) {
      nodes.push(element('aside', { className: 'safety-note safety-urgent', attributes: { role: 'note' } }, [
        element('strong', { text: 'Erst die Sicherheit' }),
        element('span', { text: result.safetyOnly ? result.safety : data.safetySignals.text })
      ]));
    }

    if (typed) nodes.push(element('p', { className: 'translator-echo', text: `Deine Eingabe: „${typed}“` }));
    nodes.push(element('span', { className: 'eyebrow', text: result.feeling ? 'Nach Gefühl' : 'Übersetzung' }));
    const heading = element('h2', { text: result.feeling ? `Bei ${result.feeling}` : `„${result.says}“`, attributes: { tabindex: '-1' } });
    nodes.push(heading);
    // Weitere Anliegen kommen direkt nach den Sätzen: Der erste Satz zum Ausprobieren bleibt auf dem Handy oben.
    let alsoWrapper = null;
    if (also.length) {
      alsoWrapper = element('div', { className: 'translator-also', attributes: { role: 'group', 'aria-label': 'Weitere Anliegen in deiner Eingabe' } }, [
        element('p', { className: 'translator-also-title', text: also.length > 1 ? 'Du hast noch mehr beschrieben. Antworten dazu:' : 'Du hast noch etwas beschrieben. Antwort dazu:' })
      ]);
      also.forEach((candidate) => {
        alsoWrapper.append(button(`„${candidate.says}“ →`, 'translator-chip', () => show(candidate, 'also')));
      });
    }
    // Kurzer Hinweis direkt unter der Überschrift, damit das zweite Anliegen nicht übersehen wird.
    if (also.length) {
      const quick = element('p', { className: 'translator-also-quick' }, [element('span', { text: 'Auch beschrieben: ' })]);
      also.forEach((candidate) => quick.append(button(`„${candidate.says}“`, 'translator-also-link', () => show(candidate, 'also'))));
      nodes.push(quick);
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
    if (result.short) {
      nodes.push(element('h3', { className: 'translator-step', text: result.feeling ? 'Was jetzt hilft' : 'Was dahintersteckt' }));
      nodes.push(element('p', { className: 'translator-meaning', text: result.short }));
    }
    if (result.phrases.length) {
      nodes.push(element('h3', { className: 'translator-step', text: 'Das kannst du sagen' }));
      const phraseList = element('div', { className: 'translator-phrases' });
      const paint = () => {
        // Bei Wut, Tränen oder Angst kommt zuerst ein kurzer beruhigender Satz.
        const first = mood && mood.phrases?.length ? [{ original: mood.phrases[0], lead: moodLead[mood.id] }] : [];
        // „Anna“ ist ein Beispielname: Solange kein eigener Name eingetragen ist, einmal darauf hinweisen.
        let exampleHintShown = false;
        phraseList.replaceChildren(...[...first, ...result.phrases.map((original) => ({ original }))].map(({ original, lead }) => {
          const text = core.personalize(original, personal, data.formal);
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
      nodes.push(phraseList, alsoWrapper, personalPanel(() => { paint(); retry?.refresh(); }, { open: usesExampleName }));
    } else if (alsoWrapper) {
      nodes.push(alsoWrapper);
    }
    if (retry) nodes.push(retry.toggle, retry.block);

    // Antwort zuerst, Hintergrund zum Aufklappen: hält das Ergebnis auf dem Handy kurz.
    const more = (title, items, intro) => items.length
      ? element('details', { className: 'translator-more' }, [
        element('summary', { text: title }),
        intro ? element('p', { text: intro }) : null,
        element('ul', {}, items.map((item) => element('li', { text: item })))
      ])
      : null;
    const moreBlocks = [
      more('Weitere mögliche Gründe', result.meanings),
      more('Was du eher vermeiden solltest', result.avoid, 'Eher ungünstig ist es,'),
      more('Was danach helfen kann', result.next)
    ].filter(Boolean);
    if (moreBlocks.length) nodes.push(element('div', { className: 'translator-more-group' }, moreBlocks));

    if (result.safety && !result.safetyOnly && !safetyHit) {
      nodes.push(element('aside', { className: 'safety-note' }, [
        element('strong', { text: 'Wann ein Gespräch nicht ausreicht' }),
        element('span', { text: result.safety })
      ]));
    }

    const actions = element('div', { className: 'translator-result-links' });
    if (result.href) {
      actions.append(element('a', {
        className: 'text-link',
        text: `${result.linkLabel} →`,
        attributes: { href: result.href, 'data-related-link': result.key }
      }));
    }
    if (result.trainer) {
      actions.append(element('a', {
        className: 'text-link',
        text: 'Diese Situation üben →',
        attributes: { href: result.trainer, 'data-related-link': 'gespraechstrainer' }
      }));
    }
    actions.append(button('Neuen Satz übersetzen', 'translator-copy', () => {
      input.value = '';
      history.replaceState(null, '', location.pathname);
      input.focus();
      input.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));
    nodes.push(actions);

    if (!result.safetyOnly) {
      if (result.feeling) nodes.push(feelingPicker('Anderes Gefühl?'));
      nodes.push(feedbackBlock(result, retry));
      nodes.push(shareBlock(result));
      nodes.push(appCTA(result));
    }

    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    heading.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const setHash = (key) => {
    const hash = key && key !== 'none' ? `#satz-${key}` : '';
    history.replaceState(null, '', `${location.pathname}${hash}`);
  };

  function showFeeling(id, source) {
    const entry = feelingEntries.get(id);
    if (!entry) return;
    render(entry);
    history.replaceState(null, '', `${location.pathname}#gefuehl-${id}`);
    track('translator_result', { result_key: entry.key, input_source: source, safety_hint: 'no' });
  }

  function show(entry, source) {
    input.value = entry.says;
    render(entry);
    setHash(entry.key);
    track('translator_result', { result_key: entry.key, input_source: source, safety_hint: 'no' });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    const { entry, alternatives, safetyHit, feeling, also, mood } = core.match(text, data);
    const feelingEntry = !entry && feeling ? feelingEntries.get(feeling.id) : null;
    if (feelingEntry) {
      render(feelingEntry, { safetyHit, typed: text });
      history.replaceState(null, '', `${location.pathname}#gefuehl-${feeling.id}`);
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

  // Vorschläge beim Tippen (nur feste Beispielsätze, nichts wird gespeichert).
  const suggestions = document.getElementById('translator-suggestions');
  if (suggestions) {
    data.entries.filter((entry) => !entry.safetyOnly).forEach((entry) => {
      [entry.says, ...(entry.variants ?? [])].forEach((value) => suggestions.append(element('option', { attributes: { value } })));
    });
  }

  // Wechselnde Beispiele im Eingabefeld.
  if (!reduceMotion) {
    // Nur kurze Sätze, damit das Beispiel auch auf schmalen Handys nicht abgeschnitten wird.
    const examples = data.entries.filter((entry) => !entry.safetyOnly && entry.says.length <= 20).map((entry) => entry.says);
    let index = 0;
    setInterval(() => {
      if (document.activeElement === input || input.value) return;
      index = (index + 1) % examples.length;
      input.placeholder = examples[index];
    }, 3500);
  }

  // Geteilte Links wie …/demenz-uebersetzer/#satz-mutter öffnen das Ergebnis direkt.
  const openFromHash = () => {
    if (location.hash.startsWith('#gefuehl-')) {
      showFeeling(location.hash.slice(9), 'link');
      return;
    }
    const key = location.hash.startsWith('#satz-') ? location.hash.slice(6) : '';
    const entry = entryByKey.get(key);
    if (!entry) return;
    input.value = entry.says;
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
})();
