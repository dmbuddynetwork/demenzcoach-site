// Demenz-Übersetzer (Oberfläche). Freitext geht zur KI-Zielklärung und nach der
// Zielwahl zur KI-Antwort, nie an Analytics oder die öffentliche Sammlung.
// Gemessen wird nach Einwilligung höchstens ein fester Ergebnis-Schlüssel.
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
  let homeHeading = document.getElementById('home-title');
  let initialTitle = document.title;
  const formStartParent = form.parentNode;
  const formStartNext = form.nextSibling;
  const keepInputAtTop = document.body.dataset.translatorInputPosition === 'top';
  const initialPlaceholder = input.getAttribute('placeholder') ?? '';
  let syncChat = () => {};
  let syncHelpful = () => {};
  const setViewState = (state) => {
    document.body.dataset.translatorState = state;
    const examples = document.querySelector('[data-ready-situations]');
    if (examples) examples.hidden = state !== 'input';
    syncHelpful();
    requestAnimationFrame(() => syncChat());
    if (!homeHeading) return;
    homeHeading.hidden = state !== 'input';
    // Nur feste Zustandsnamen: eingegebener Freitext gehört nicht in Seitentitel/Analytics.
    document.title = state !== 'input' && activePublicRoute ? activePublicRoute.title : state === 'input' ? initialTitle : ui?.lang === 'en'
      ? (state === 'goal' ? 'Choose your goal | Dementia Coach' : 'Your answer | Dementia Coach')
      : ui ? initialTitle : state === 'goal' ? 'Dein Ziel wählen | Demenz Coach' : 'Deine Antwort | Demenz Coach';
  };
  const translatedAttributes = new Set(['alt', 'aria-label', 'placeholder', 'title']);
  const phraseHash = ui?.phraseHash ?? 'satz-';
  const feelingHash = ui?.feelingHash ?? 'gefuehl-';
  const entryByKey = new Map(data.entries.map((entry) => [entry.key, entry]));
  const toolURL = data.toolURL;
  const appURL = ui?.appURL ?? 'https://apps.apple.com/app/apple-store/id6790763941?pt=120702089&ct=seo_de_translator&mt=8';
  // Only routes emitted by the successful current app build are public app states.
  const routeLanguage = ui?.lang === 'en' ? 'en' : 'de';
  const publicRoutes = (data.generatorRoutes || []).filter(route => route.language === routeLanguage && entryByKey.has(route.key) && /^\/(?!\/)[^?&#]*$/.test(route.path));
  const publicByKey = new Map(publicRoutes.map(route => [route.key, route]));
  const routePath = (route, goal = 'jetzt') => route.goalPaths ? (['jetzt','verstehen','tipps'].includes(goal) && Object.hasOwn(route.goalPaths, goal) ? route.goalPaths[goal] : route.selectionPath) : route.path;
  const pathState = publicRoutes.flatMap(route => [{route,goal:route.goalPaths?'jetzt':'',path:route.path},...(route.goalPaths ? Object.entries(route.goalPaths).filter(([goal])=>goal!=='jetzt').map(([goal,path])=>({route,goal,path})).concat([{route,goal:'',path:route.selectionPath}]) : [])]).find(state=>state.path===location.pathname);
  let activePublicRoute = pathState?.route || null;
  let currentGoal = pathState?.goal || new URLSearchParams(location.search).get('ziel') || 'jetzt';
  const appMetadataNode = document.getElementById('translator-app-meta');
  const appMetadata = appMetadataNode ? JSON.parse(appMetadataNode.textContent) : {title:initialTitle,description:document.querySelector('meta[name="description"]')?.content||'',canonical:new URL('/'+routeLanguage+'/',toolURL).href,alternates:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(node=>({lang:node.hreflang,href:node.href})),structuredData:[...document.querySelectorAll('script[type="application/ld+json"]')].map(node=>JSON.parse(node.textContent))};
  let topicContextActive = false;
  const topicMetadata = route => {
    activePublicRoute=route;
    const canonical=new URL(route.path,toolURL).href;
    document.title=route.title;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical);
    for(const [selector,value] of [['meta[name="description"]',route.description],['meta[property="og:title"]',route.title],['meta[property="og:description"]',route.description],['meta[property="og:url"]',canonical],['meta[name="twitter:title"]',route.title],['meta[name="twitter:description"]',route.description]])document.querySelector(selector)?.setAttribute('content',value);
    const de=route.language==='de'?route.path:route.alternatePath,en=route.language==='en'?route.path:route.alternatePath;
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node=>node.remove());
    for(const [lang,path]of [['de',de],['en',en],['x-default',de]]){const node=document.createElement('link');node.rel='alternate';node.hreflang=lang;node.href=new URL(path,toolURL).href;document.head.append(node);}
    let schema=document.getElementById('translator-situation-schema');
    if(!schema){schema=document.createElement('script');schema.type='application/ld+json';schema.id='translator-situation-schema';document.head.append(schema);}
    schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage','@id':canonical,url:canonical,name:route.title,description:route.description,inLanguage:route.language});
    topicContextActive=true;
  };
  const shareLink = result => {
    const route=publicByKey.get(result?.key);
    return route ? new URL(routePath(route,currentGoal),toolURL).href : result.url || toolURL;
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Ab dieser Punktzahl (translator-core rank) gilt ein Treffer als sicher: mehrere Wörter oder ein langes Stichwort.
  const strongScore = ui?.strongScore ?? 4;

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
    node.addEventListener('click', (event) => {
      if (node.classList.contains('translator-chip') && event.detail > 1) return;
      onClick(event);
    });
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
    const url = shareLink(result);
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

  // Separate from savedPhrases: explicitly requested browser-local answer copies.
  // No original input, personalization settings, sharing data or network writes.
  const helpfulKey = 'demenzcoach.helpfulAnswers.v1';
  const helpfulLanguage = ui?.lang || 'de';
  const helpfulCopy = helpfulLanguage === 'de' ? {
    title: 'Deine hilfreichen Antworten', ai: 'Gemerkte KI-Antwort', open: 'Antwort öffnen',
    notice: '„Ja, merken“ speichert die Antwort in diesem Browser, sichtbar für alle, die ihn nutzen.',
    yes: 'Ja, merken', saved: 'Antwort gemerkt.', failed: 'Das Merken konnte nicht bestätigt werden. Bitte erneut versuchen.',
    local: 'Nur in diesem Browser gespeichert.', remove: 'Entfernen', clear: 'Alle hilfreichen Antworten löschen',
    removed: 'Antwort entfernt.', cleared: 'Hilfreiche Antworten gelöscht.',
    removeFailed: 'Das Löschen konnte nicht bestätigt werden.', broken: 'Die gemerkten Antworten konnten nicht gelesen werden.',
    unavailable: 'Diese vorbereitete Antwort ist nicht mehr verfügbar.',
    history: 'Gemerkte KI-Antwort. Prüfe, ob sie noch zu eurer Situation passt.'
  } : helpfulLanguage === 'en' ? {
    title: 'Your helpful answers', ai: 'Saved AI answer', open: 'Open answer',
    notice: '“Yes, save” keeps this answer in this browser, visible to anyone who uses it.',
    yes: 'Yes, save', saved: 'Answer saved.', failed: 'Saving could not be confirmed. Please try again.',
    local: 'Saved only in this browser.', remove: 'Remove', clear: 'Delete all helpful answers',
    removed: 'Answer removed.', cleared: 'Helpful answers deleted.',
    removeFailed: 'Deletion could not be confirmed.', broken: 'Your saved answers could not be read.',
    unavailable: 'This prepared answer is no longer available.',
    history: 'Saved AI answer. Check whether it still fits your situation.'
  } : null;
  const exactFields = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const helpfulText = (text, max, allowEmpty = false) => typeof text === 'string'
    && text.length <= max && (allowEmpty || text.trim().length > 0);
  const normalizeHelpful = (item) => {
    if (!item || !['de', 'en'].includes(item.language)) return null;
    if (item.kind === 'catalog' && exactFields(item, ['kind', 'language', 'key', 'goal'])
      && typeof item.key === 'string' && /^[a-z0-9-]{1,60}$/u.test(item.key)
      && ['', 'jetzt', 'verstehen', 'tipps'].includes(item.goal)) {
      return { kind: 'catalog', language: item.language, key: item.key, goal: item.goal };
    }
    if (item.kind !== 'ai' || !exactFields(item, ['kind', 'language', 'answer'])) return null;
    const answer = item.answer;
    if (!exactFields(answer, ['meaning', 'phrases', 'avoid', 'nextStep', 'safetyLevel'])
      || answer.safetyLevel !== 'standard' || !helpfulText(answer.meaning, 1600)
      || !Array.isArray(answer.phrases) || !answer.phrases.length || answer.phrases.length > 3
      || !answer.phrases.every((phrase) => helpfulText(phrase, 1000))
      || !helpfulText(answer.avoid, 1000) || !helpfulText(answer.nextStep, 1600, true)) return null;
    return { kind: 'ai', language: item.language, answer: { meaning: answer.meaning,
      phrases: [...answer.phrases], avoid: answer.avoid, nextStep: answer.nextStep, safetyLevel: 'standard' } };
  };
  const helpfulStore = {
    read() {
      try {
        const raw = localStorage.getItem(helpfulKey);
        if (raw === null) return { ok: true, items: [] };
        if (raw.length > 120000) return { ok: false, items: [] };
        const value = JSON.parse(raw);
        if (!exactFields(value, ['version', 'items']) || value.version !== 1
          || !Array.isArray(value.items) || value.items.length > 20) return { ok: false, items: [] };
        const items = value.items.map(normalizeHelpful);
        return items.some((item) => !item) ? { ok: false, items: [] } : { ok: true, items };
      } catch { return { ok: false, items: [] }; }
    },
    write(items) {
      try {
        const normalized = items.slice(0, 20).map(normalizeHelpful);
        if (normalized.some((item) => !item)) return false;
        const value = JSON.stringify({ version: 1, items: normalized });
        if (value.length > 120000) return false;
        if (normalized.length) {
          localStorage.setItem(helpfulKey, value);
          return localStorage.getItem(helpfulKey) === value;
        }
        localStorage.removeItem(helpfulKey);
        return localStorage.getItem(helpfulKey) === null;
      } catch { return false; }
    },
    add(item) {
      const current = this.read(), normalized = normalizeHelpful(item);
      if (!current.ok || !normalized) return false;
      const encoded = JSON.stringify(normalized);
      return this.write([normalized, ...current.items.filter((saved) => JSON.stringify(saved) !== encoded)]);
    },
    remove(item) {
      const current = this.read();
      return current.ok && this.write(current.items.filter((saved) => JSON.stringify(saved) !== JSON.stringify(item)));
    },
    clear() { return this.write([]); }
  };
  const helpfulCatalog = (entry) => entry && entryByKey.get(entry.key) === entry && !entry.safetyOnly
    && !entry.safety && !entry.urgentLead && !(entry.safetyFirst?.length);
  const helpfulAI = (result) => result.safetyLevel === 'standard' && !result.safetyMessage ? normalizeHelpful({
    kind: 'ai', language: helpfulLanguage, answer: { meaning: result.meaning, phrases: result.phrases,
      avoid: result.avoid, nextStep: result.nextStep ?? '', safetyLevel: result.safetyLevel }
  }) : null;
  let renderHelpful = () => {};

  const feedbackCopy = !ui ? {
    question: 'Was hat nicht gepasst?', situation: 'Die Situation wurde falsch verstanden.',
    wording: 'Die Formulierung passte nicht.', send: 'Mit deiner Auswahl sendest du uns den Grund.',
    saving: 'Wird gespeichert …', saved: 'Danke, deine Auswahl wurde gespeichert.',
    missing: 'Bestätigung fehlt. Bitte versuche es erneut.', skip: 'Ohne Auswahl weiter', next: 'Weiter'
  } : ui.lang === 'en' ? {
    question: 'What did not fit?', situation: 'The situation was misunderstood.',
    wording: 'The wording did not fit.', send: 'Choosing an option sends us the reason.',
    saving: 'Saving …', saved: 'Thank you. Your choice has been saved.',
    missing: 'Confirmation is missing. Please try again.', skip: 'Continue without choosing', next: 'Continue'
  } : null;
  const feedbackBlock = (result, retry, { allowShare = true, askReason = true, onContinue, helpfulItem } = {}) => {
    const wrapper = element('div', { className: 'translator-feedback', attributes: { role: 'group', 'aria-label': 'War das hilfreich?' } }, [
      element('span', { text: 'War das hilfreich?' })
    ]);
    const answer = (helpful) => () => {
      track('translator_feedback', { result_key: result.key, helpful: helpful ? 'yes' : 'no' });
      if (helpful && helpfulItem) {
        if (!helpfulStore.add(helpfulItem)) { saveStatus.textContent = helpfulCopy.failed; return; }
        renderHelpful();
      }
      // Teilen erst nach „Ja“: eine Zeile weniger unter dem Ergebnis, und
      // gefragt wird genau dann, wenn es geholfen hat.
      // Der gedrückte Knopf verschwindet; damit Tastatur und Vorlesen nicht
      // ins Leere springen, bekommt der Dank-Satz den Fokus.
      const thanks = (text) => element('span', { text, attributes: { tabindex: '-1' } });
      if (helpful) {
        const note = thanks(helpfulItem ? helpfulCopy.saved : allowShare ? 'Danke! Teile es gern mit deiner Familie:' : 'Danke für die Rückmeldung.');
        wrapper.replaceChildren(note, ...(allowShare ? [shareBlock(result)] : []));
        note.focus({ preventScroll: true });
        if (result.requestID) {
          const supporter = window.DemenzKiFreigabe?.supporterCard();
          if (supporter) wrapper.append(supporter);
        }
        return;
      }
      const continueAfterFeedback = () => {
        if (onContinue) { onContinue(); return; }
        const asked = input.value.trim() || result.says || '';
        const box = aiBox(asked, 'feedback', () => {}, { allowHelpful: Boolean(helpfulItem) });
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
      // Other translated interfaces retain their existing feedback flow until their
      // own wording is ready; no German fallback strings appear in those interfaces.
      if (!feedbackCopy || !askReason) { continueAfterFeedback(); return; }
      wrapper.setAttribute('aria-label', feedbackCopy.question);
      const question = thanks(feedbackCopy.question);
      const status = element('span', { attributes: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
      let saving = false;
      let saved = false;
      const choices = [];
      const next = button(feedbackCopy.skip, 'translator-copy', () => {
        if (!saving) continueAfterFeedback();
      });
      const choose = async (reason, selected) => {
        if (saving || saved) return;
        saving = true;
        choices.forEach((choice) => choice.setAttribute('aria-disabled', 'true'));
        next.setAttribute('aria-disabled', 'true');
        status.textContent = feedbackCopy.saving;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const endpoint = window.DemenzTranslatorAI?.endpoint;
          if (!endpoint) throw new Error('unavailable');
          const response = await fetch(`${endpoint}/feedback`, {
            method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }), signal: controller.signal
          });
          if (!response.ok || (await response.json())?.ok !== true) throw new Error('unconfirmed');
          saved = true;
          selected.setAttribute('aria-pressed', 'true');
          status.textContent = feedbackCopy.saved;
        } catch {
          // A lost acknowledgement can follow a successful write. Never claim
          // that nothing was saved or retry automatically.
          status.textContent = feedbackCopy.missing;
        } finally {
          clearTimeout(timer);
          saving = false;
          choices.forEach((choice) => choice.setAttribute('aria-disabled', String(saved)));
          next.setAttribute('aria-disabled', 'false');
          next.textContent = feedbackCopy.next;
        }
      };
      for (const [reason, label] of [['situation_mismatch', feedbackCopy.situation], ['wording_mismatch', feedbackCopy.wording]]) {
        const choice = button(label, 'translator-copy', () => choose(reason, choice), { 'aria-pressed': 'false' });
        choices.push(choice);
      }
      wrapper.replaceChildren(question, element('span', { text: feedbackCopy.send }), ...choices, status, next);
      question.focus({ preventScroll: true });
    };
    const saveStatus = element('span', { attributes: { role: 'status', 'aria-live': 'polite' } });
    wrapper.append(withIcon(button('', 'translator-copy', answer(true)), '👍', helpfulItem ? helpfulCopy.yes : 'Ja'), withIcon(button('', 'translator-copy', answer(false)), '👎', 'Nein'), saveStatus);
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
  const planMoments = new Set(['nachhause', 'mutter', 'wer', 'geld', 'arbeit', 'waschen', 'wiederholt']);
  // Erst nach der vollständigen Antwort, freiwillig und ohne Preis-/Testzeitversprechen.
  let typedCount = 0;
  const planTitles = { ergebnis: 'Und wenn dieser Satz wiederkommt?', wieder: 'Das passiert öfter?', tipps: 'Ein Plan für euren Alltag' };
  const planCTA = (result, place = 'ergebnis') => {
    if (ui || result?.safetyOnly || result?.selfCare || result?.feeling) return null;
    const moment = result?.key ? `&s=${encodeURIComponent(result.key)}` : '';
    const link = element('a', { className: 'button', text: 'Persönliche Hilfe ansehen', attributes: { href: `/start/?src=${place}&direkt=1${moment}`, 'data-related-link': `plan_${place}` } });
    link.addEventListener('click', () => track('plan_start_click', { place, result_key: result?.key ?? '' }));
    return element('aside', { className: `translator-plan-cta${place === 'ergebnis' ? '' : ' translator-plan-up'}` }, [
      data.planImage ? element('img', { className: 'translator-plan-art', attributes: { src: data.planImage.src, width: String(data.planImage.width), height: String(data.planImage.height), alt: '', decoding: 'async' } }) : null,
      element('div', {}, [
        element('h2', { text: planTitles[place] ?? planTitles.ergebnis }),
        element('p', { text: 'Passende Worte und nächste Schritte für schwierige Alltagssituationen. Wähle, wobei du Unterstützung brauchst.' }),
        link
      ])
    ]);
  };
  const offers = (result, safetyHit = false, planShown = false) => [safetyHit || planShown || !result ? null : planCTA(result), ...(onComputer() ? [signupBox(), appCTA(result)] : [appCTA(result), signupBox()])];
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
          src: ui?.appImage ?? '/assets/app-de-help.webp',
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

  // Grundansprache ohne zusätzliche Anrede-/Namensauswahl. Der Zustand bleibt
  // nur im Arbeitsspeicher dieser Seite und wird nicht gespeichert.
  const personal = { formal: false, callName: '', me: '', role: '' };
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
  const fallbackIllustration = '/assets/zeichnungen/chat-helferin-fragend-lossless.png';
  const saidBlock = (says, entry, heading) => {
    const art = !entry?.safetyOnly
      ? element('img', { className: 'translator-said-art', attributes: { src: entry?.image || fallbackIllustration, alt: '', width: String(entry?.imageWidth ?? (entry?.image ? 480 : 200)), height: String(entry?.imageHeight ?? (entry?.image ? 400 : 200)), decoding: 'async' } })
      : null;
    if (art) {
      let fallbackUsed = !entry?.image;
      art.addEventListener('error', () => {
        if (fallbackUsed) { art.hidden = true; return; }
        fallbackUsed = true;
        art.src = fallbackIllustration;
        art.width = 200; art.height = 200;
      });
    }
    heading.classList.add('translator-said-bubble');
    return element('div', { className: art ? 'translator-said translator-said-with-art' : 'translator-said' }, [
      element('div', { className: 'translator-said-text' }, [element('p', { className: 'translator-said-label', text: ui?.lang === 'en' ? 'The situation' : ui ? tr('Du hörst:') : 'Die Situation' }), heading]),
      art
    ].filter(Boolean));
  };
  // Das Werkzeug hat eigene, teilbare Zustände. entry.href ist ein redaktioneller
  // Weiterlese-Link und darf ohne Dokumentwechsel keine Ratgeberadresse übernehmen.
  // Nur feste Situations-/Zielschlüssel gelangen in die URL, niemals Eingabetext.
  // Static SEO routes hydrate the same app; later edits return to its language home.
  const staticEntry = entryByKey.get(pathState?.route.key || document.body.dataset.translatorInitialSituation);
  const staticAppPath = document.body.dataset.translatorAppPath || (pathState ? '/'+routeLanguage+'/' : '');
  const staticDefault = staticEntry && (!staticEntry.safetyOnly || (pathState && staticEntry.selfCare)) && staticAppPath === (ui?.lang === 'en' ? '/en/' : '/de/') ? staticEntry : null;
  const startPath = staticDefault ? staticAppPath : location.pathname;
  let staticContextActive = Boolean(staticDefault);
  const leaveStaticContext = () => {
    if (!staticContextActive && !topicContextActive) return;
    activePublicRoute=null;
    const state=document.body.dataset.translatorState;
    document.title=state==='input'?appMetadata.title:ui?.lang==='en'?(state==='goal'?'Choose your goal | Dementia Coach':'Your answer | Dementia Coach'):(state==='goal'?'Dein Ziel wählen | Demenz Coach':'Deine Antwort | Demenz Coach');
    const meta = appMetadata;
    if (meta) {
      initialTitle = meta.title;
      if (document.body.dataset.translatorState === 'input') document.title = initialTitle;
      document.querySelector('link[rel="canonical"]')?.setAttribute('href', new URL(startPath, toolURL).href);
      for (const [selector, key] of [['meta[name="description"]','description'], ['meta[property="og:title"]','title'], ['meta[property="og:description"]','description'], ['meta[property="og:url"]','canonical'], ['meta[name="twitter:title"]','title'], ['meta[name="twitter:description"]','description']]) {
        document.querySelector(selector)?.setAttribute('content', meta[key]);
      }
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node => node.remove());
      for (const alternate of meta.alternates) {
        const link = document.createElement('link');
        link.rel = 'alternate'; link.hreflang = alternate.lang; link.href = alternate.href;
        document.head.append(link);
      }
      const schema = document.getElementById('translator-situation-schema');
      if (schema) schema.textContent = JSON.stringify(meta.structuredData);
    }
    if (homeHeading?.tagName === 'H2') {
      const heading = document.createElement('h1');
      for (const attr of homeHeading.attributes) heading.setAttribute(attr.name, attr.value);
      heading.textContent = homeHeading.textContent;
      homeHeading.replaceWith(heading); homeHeading = heading;
    }
    staticContextActive = false;
    topicContextActive = false;
  };
  const validGoals = new Set(['jetzt', 'verstehen', 'tipps']);
  const staticHistory = Boolean(staticDefault || history.state?.translatorStatic);
  let pushed = false;
  const setPage = (entry, goal = '', push = true) => {
    leaveStaticContext();
    if (!entryByKey.has(entry?.key) || (entry.safetyOnly && !entry.selfCare)) { setHash(entry?.key ?? ''); return; }
    currentGoal=goal;
    const route=publicByKey.get(entry.key),url=new URL(location.href);
    url.pathname=route?routePath(route,goal):startPath;
    url.search='';url.hash=route?'':`${phraseHash}${entry.key}`;
    if(route)topicMetadata(route);
    if(url.href===location.href)return;
    history[push?'pushState':'replaceState']({translator:true,...((staticHistory||route)?{translatorStatic:true}:{})},'',url);
    pushed=pushed||push;
  };
  window.addEventListener('popstate', () => { if (pushed || staticHistory) location.reload(); });
  // Nach dem Ergebnis rückt das Eingabefeld unter die Antwort (Daniel, 9. Nov: oben lenkt es von den Ziel-Knöpfen ab;
  // statt „Neuen Satz übersetzen“ einfach weiterschreiben). Dasselbe Formular, nur verschoben und leer.
  let formMoved = false;
  // Legacy pages keep the follow-up below; prepared app pages keep the same form above the answer.
  const setFollowupOpen = (open) => {
    if (keepInputAtTop && open) form.hidden = false;
    const details = output.querySelector('.translator-followup-question');
    if (details) details.open = open || Boolean(input.value.trim()) || form.contains(document.activeElement);
  };
  const foldSignup = () => {
    const signup = output.querySelector(':scope > .translator-signup');
    if (signup) {
      const extra = element('details', { className: 'translator-extra-offers' }, [element('summary', { text: 'Alle Sätze zum Ausdrucken' })]);
      signup.before(extra);
      extra.append(signup);
    }
  };
  const formBelow = ({ open = false } = {}) => {
    form.hidden = false;
    if (keepInputAtTop) {
      form.hidden = document.body.dataset.translatorState !== 'input';
      formStartParent.insertBefore(form, formStartNext?.parentNode === formStartParent ? formStartNext : null);
      form.classList.remove('translator-form-below');
      formMoved = false;
      input.setAttribute('placeholder', initialPlaceholder);
      grow();
      foldSignup();
      return;
    }
    let followup = output.querySelector(':scope > .translator-followup');
    if (!followup) {
      followup = element('section', { className: 'translator-followup' });
      const feedback = output.querySelector(':scope > .translator-feedback');
      if (feedback) followup.append(feedback);
      const details = element('details', { className: 'translator-followup-question' }, [element('summary', { text: 'Noch etwas schreiben?' }), form]);
      followup.append(details);
      const offer = output.querySelector(':scope > .translator-plan-cta, :scope > .translator-suggest, :scope > .translator-signup, :scope > .translator-app-cta');
      output.insertBefore(followup, offer);
    }
    input.value = '';
    grow();
    setFollowupOpen(open);
    foldSignup();
    if (formMoved) return;
    formMoved = true;
    form.classList.add('translator-form-below');
    input.setAttribute('placeholder', tr('Was ist noch passiert? Schreib es hier.'));
  };
  const returnToInput = () => {
    formStartParent.insertBefore(form, formStartNext?.parentNode === formStartParent ? formStartNext : null);
    form.hidden = false;
    form.classList.remove('translator-form-below');
    form.querySelector('.translator-form-below-title')?.remove();
    formMoved = false;
    input.setAttribute('placeholder', initialPlaceholder);
    output.replaceChildren();
    output.hidden = true;
    document.body.classList.remove('translator-has-result', 'translator-answers-seen');
    setViewState('input');
    setHash('');
    grow();
    input.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: 'instant', block: 'start' });
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
    setViewState('goal');
    const situation = element('p', { text: `„${bubbleText(entry, options.typed)}“`, attributes: { id: 'translator-selected-situation' } });
    const heading = element(homeHeading ? 'h1' : 'h2', { className: 'translator-goal-question', text: 'Was möchtest du jetzt erreichen?', attributes: { tabindex: '-1', id: 'translator-goal-heading' } });
    const changeSituation = element('a', { className: 'text-link', text: ui ? tr('Neuen Satz übersetzen') : 'Andere Situation beschreiben', attributes: { href: startPath } });
    changeSituation.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      returnToInput();
    });
    output.replaceChildren(...[
      saidBlock(entry.says, entry, situation),
      heading,
      element('div', { className: 'translator-goals', attributes: { role: 'group', 'aria-labelledby': 'translator-goal-heading', 'aria-describedby': 'translator-selected-situation' } }, goals.map((goal) => goalButton(goal, () => {
        track('translator_goal', { goal: goal.id, result_key: entry.key });
        setPage(entry, goal.id);
        render(entry, { ...options, goal: goal.id, preserveViewport: false });
      }))),
      element('p', { className: 'translator-change-situation' }, [changeSituation])
    ].filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    // Keep the one top input available even while choosing a goal.
    form.hidden = true;
    if (!options.preserveViewport) {
      heading.focus({ preventScroll: true });
      output.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
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
          await navigator.share({ text, url: shareLink(result) });
          track('translator_share', { result_key: result.key, method: 'native', step: 'phrase' });
        } catch {
          // Abgebrochen – nichts zu tun.
        }
      }, { 'aria-label': label, title: label });
    }
    const link = element('a', { className: 'translator-phrase-share', attributes: { href: `https://wa.me/?text=${encodeURIComponent(`${text} ${shareLink(result)}`)}`, rel: 'noopener', target: '_blank', 'aria-label': label, title: label } });
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

  // A return overview stays in the input view; opening an item never sends a request.
  if (helpfulCopy) {
    const overview = element('section', { className: 'translator-helpful', attributes: { 'aria-labelledby': 'translator-helpful-title', hidden: '' } });
    const message = element('p', { className: 'translator-helpful-status', attributes: { role: 'status', 'aria-live': 'polite', hidden: '' } });
    formStartParent.insertBefore(overview, formStartNext);
    overview.after(message);
    const announce = (text) => { message.textContent = text; message.hidden = false; };
    const focusList = () => ((!overview.hidden && overview.querySelector('button')) || input).focus({ preventScroll: true });
    const erase = (item) => {
      const ok = item ? helpfulStore.remove(item) : helpfulStore.clear();
      if (!ok) { announce(helpfulCopy.removeFailed); return; }
      renderHelpful();
      announce(item ? helpfulCopy.removed : helpfulCopy.cleared);
      focusList();
    };
    const reopen = (item) => {
      const valid = normalizeHelpful(item);
      if (!valid) return;
      if (valid.kind === 'catalog') {
        const entry = entryByKey.get(valid.key);
        if (!helpfulCatalog(entry)) { announce(helpfulCopy.unavailable); return; }
        setPage(entry,valid.goal);
        render(entry, { goal: valid.goal });
        return;
      }
      setViewState('answer');
      const { node, focus } = aiAnswer(valid.answer, { saved: true });
      output.replaceChildren(node);
      output.hidden = false;
      document.body.classList.add('translator-has-result');
      document.body.classList.remove('translator-answers-seen');
      formBelow();
      focusResult(focus);
      output.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    syncHelpful = () => {
      const state = document.body.dataset.translatorState;
      const current = helpfulStore.read();
      message.hidden = Boolean(state && state !== 'input') || !message.textContent;
      overview.hidden = Boolean(state && state !== 'input') || (current.ok && !current.items.some((item) => item.language === helpfulLanguage));
    };
    renderHelpful = () => {
      const current = helpfulStore.read();
      const items = current.items.filter((item) => item.language === helpfulLanguage);
      overview.replaceChildren(element('h2', { text: helpfulCopy.title, attributes: { id: 'translator-helpful-title' } }),
        ...(!current.ok ? [element('p', { text: helpfulCopy.broken })] : []),
        element('ul', {}, items.map((item) => {
          const entry = item.kind === 'catalog' ? entryByKey.get(item.key) : null;
          const available = item.kind === 'ai' || helpfulCatalog(entry);
          const title = item.kind === 'ai' ? `${helpfulCopy.ai}: ${item.answer.phrases[0]}` : available ? entry.says : helpfulCopy.unavailable;
          return element('li', {}, [
            available ? button(title.length > 160 ? `${title.slice(0, 157)}…` : title, 'translator-copy translator-helpful-open', () => reopen(item), { 'aria-label': `${helpfulCopy.open}: ${title}` }) : element('span', { text: title }),
            button(helpfulCopy.remove, 'translator-copy translator-helpful-remove', () => erase(item), { 'aria-label': `${helpfulCopy.remove}: ${title}` })
          ]);
        })),
        button(helpfulCopy.clear, 'translator-copy translator-helpful-clear', () => erase(null)),
        element('p', { text: helpfulCopy.local }));
      syncHelpful();
      syncChat();
    };
    window.addEventListener('storage', (event) => {
      if (event.key !== helpfulKey && event.key !== null) return;
      const restoreFocus = overview.contains(document.activeElement);
      renderHelpful();
      if (restoreFocus) focusList();
    });
  }

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
  const generalNote = (lead = '') => {
    const note = urgentNote(data.safetySignals.text, lead);
    note.dataset.translatorLocalSafety = 'true';
    return note;
  };

  // KI für Sätze, die die feste Liste nicht kennt. Bekannte Sätze bleiben auf dem Gerät;
  // unbekannte gehen automatisch an die KI (Hinweis unter dem Eingabefeld).
  const ai = window.DemenzTranslatorAI;
  const aiSafetyNote = (result, ungraded = false) => {
    const message = typeof result.safetyMessage === 'string' && result.safetyMessage.trim() ? result.safetyMessage : '';
    if (result.safetyLevel === 'urgent' || ungraded || (result.safetyLevel === 'concern' && !message)) {
      return urgentNote(data.safetySignals.text);
    }
    if (result.safetyLevel === 'concern') {
      return element('aside', { className: 'safety-note', attributes: { role: 'note' } }, [element('span', { text: message })]);
    }
    return null;
  };
  const fixedSafetyNote = (result, localSafetyNote) => {
    if (result.safetyLevel !== 'concern') return urgentNote(data.safetySignals.text);
    // Only the exact provisional warning passed by this request may be replaced.
    // A feedback request for a new draft must preserve the old result's warning.
    if (localSafetyNote?.dataset.translatorLocalSafety === 'true') localSafetyNote.remove();
    const note = aiSafetyNote({ safetyLevel: 'concern', safetyMessage: result.message });
    note.classList.add('translator-fixed-concern');
    return note;
  };
  const aiAnswer = (result, { saved = false, allowHelpful = true, goal } = {}) => {
    const nodes = [];
    // Ohne Stufen (englische Seiten): bei jedem Sicherheitshinweis der KI derselbe feste Hinweis.
    const ungraded = ui?.gradedSafety === false && result.safetyLevel !== 'standard';
    const safetyNote = aiSafetyNote(result, ungraded);
    // A local guard may already show this exact complete warning. Keep the
    // first stable warning and its call links; retry containers are replaced.
    // Never collapse different safety text or reuse a soon-detached warning.
    const safetySignature = note => JSON.stringify([note.textContent.replace(/\s+/g, ' ').trim(),
      [...note.querySelectorAll('a[href]')].map(link => link.getAttribute('href'))]);
    const existingSafetyNote = safetyNote && [...output.querySelectorAll('.safety-note')]
      .find(note => !note.closest('[data-goal-safety-history]') && !note.closest('.translator-ai') && safetySignature(note) === safetySignature(safetyNote));
    if (safetyNote && !existingSafetyNote) nodes.push(safetyNote);
    // Gleich oben sagen, dass das von der KI kommt – nicht erst nach den Sätzen.
    nodes.push(element('p', { className: 'translator-ai-label', text: saved ? helpfulCopy.history : 'Antwort der KI. Prüfe, ob sie zu euch passt.' }));
    if (goal) nodes.push(element('p', { className: 'translator-chosen-ai-goal', text: `${ui?.lang === 'en' ? 'Your goal' : 'Dein Ziel'}: ${goal.label}` }));
    const first = element('h3', { className: 'translator-step', text: 'Das kannst du sagen', attributes: { tabindex: '-1' } });
    nodes.push(first, element('div', { className: 'translator-phrases' }, result.phrases.map((phrase) => element('div', { className: 'translator-phrase' }, [element('q', { text: phrase })]))));
    const context = element('details', { className: 'translator-ai-context' }, [element('summary', { text: 'Was dahintersteckt' }), element('p', { className: 'translator-meaning translator-ai-meaning', text: result.meaning })]);
    if (result.safetyLevel !== 'standard') context.open = true;
    // Runde 198: Wie in der App gibt es einen konkreten nächsten Schritt.
    if (typeof result.nextStep === 'string' && result.nextStep) {
      nodes.push(element('h3', { className: 'translator-step', text: 'Das kannst du tun' }));
      nodes.push(element('p', { className: 'translator-meaning translator-ai-next', text: result.nextStep }));
    }
    nodes.push(context);
    nodes.push(element('p', { className: 'translator-ai-avoid' }, [element('strong', { text: 'Besser nicht: ' }), `„${result.avoid}“`]));
    nodes.push(notesCard(disclaimer(true)));
    // Anonymes Teilen gibt es vorerst nur auf Deutsch (der Server bietet es sonst auch nicht an).
    if (!saved && feedbackCopy && result.safetyLevel === 'standard') {
      nodes.push(feedbackBlock({ key: 'ai', requestID: result.requestID }, null, { allowShare: false, helpfulItem: helpfulCopy && allowHelpful ? helpfulAI(result) : null, onContinue: () => {
        correctionRequestID = result.requestID || '';
        setFollowupOpen(true);
        input.focus();
      } }));
    }
    return { node: element('div', { className: 'translator-ai-answer' }, nodes),
      focus: existingSafetyNote || (nodes[0].tagName === 'ASIDE' ? nodes[0] : first), top: existingSafetyNote || nodes[0] };
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
  let correctionRequestID = '';
  const aiBox = (text, source, onFail = () => {}, { auto = false, localSafetyHit = false, localSafetyNote, allowHelpful = true, goal, requestAnswer, requestState, onRequestState = () => {} } = {}) => {
    if (!ai || !text || text.length < 2) return null;
    if (!goal && !localSafetyHit && !requestState) return aiGoalBox(text, source, onFail, { auto, allowHelpful });
    const status = element('p', { className: 'translator-ai-status', attributes: { role: 'status' } });
    const box = element('div', { className: 'translator-ai' });
    const waiting = aiWaiting();
    let operationID = requestState?.operationID || (window.DemenzKiFreigabe?.enabled() ? window.crypto.randomUUID() : '');
    const correctionOf = requestState ? (requestState.options.correctionOf || '') : correctionRequestID;
    if (!requestState) correctionRequestID = '';
    let requestText = requestState?.text || text;
    let continuation = requestState?.options || null;
    let exactText = requestState?.exactText === true;
    let draft = requestState?.draft || '', draftFor = requestState?.draftFor || '';
    let editDraft = requestState?.editDraft || '', editFor = requestState?.editFor || '';
    let requestPending = false;
    const run = async (manual = false) => {
      if (requestPending) return;
      requestPending = true;
      const replyControls = box.querySelectorAll('.translator-clarification-form textarea, .translator-clarification-form button');
      replyControls.forEach(control => { control.disabled = true; });
      ask.disabled = true;
      ask.hidden = auto;
      // Automatisch: Die Warte-Ansicht sagt schon, dass die Antwort geschrieben wird (kein doppelter Text).
      status.textContent = auto ? '' : tr('Einen Moment, die KI schreibt eine Antwort …');
      if (auto) box.append(waiting);
      track('translator_ai', { step: 'ask', source: auto ? `${source}_auto` : source });
      const options = { ...(continuation || { formal: personal.formal, correctionOf, goal }), requestID: operationID, exactText };
      const remember = () => onRequestState({ text: requestText, options: { formal: options.formal, correctionOf: options.correctionOf || '', goal: options.goal }, exactText, operationID, draft, draftFor, editDraft, editFor });
      remember();
      const result = await (requestAnswer || ai.ask)(requestText, options);
      requestPending = false;
      replyControls.forEach(control => { if (control.isConnected) control.disabled = false; });
      waiting.remove();
      track('translator_ai', { step: result.kind, source });
      if (!box.isConnected) return;
      if (result.kind === 'access') {
        box.replaceChildren(window.DemenzKiFreigabe.offerCard({ sentence: requestText, reason: result.reason, value: result.access, onRetry: () => { if (result.reason === 'answer_recovery_credit') operationID = window.crypto.randomUUID(); box.replaceChildren(ask, status); void run(true); } }));
        return;
      }
      if (result.kind === 'clarification') {
        const en = ui?.lang === 'en';
        window.DemenzKiFreigabe?.accept(result.access);
        const previousText = requestText.normalize('NFC').trim();
        const previousOptions = { formal: options.formal, goal: options.goal, correctionOf: options.correctionOf || '' };
        const title = element('h3', { text: en ? 'A question about your situation' : 'Eine Rückfrage zu deiner Situation', attributes: { tabindex: '-1' } });
        const field = element('textarea', { className: 'translator-clarification-detail', attributes: { rows: '3', autocomplete: 'off', placeholder: en ? 'Add only the detail that is needed.' : 'Ergänze nur die nötige Angabe.' } });
        field.value = draftFor === previousText ? draft : '';
        field.addEventListener('input', () => { draft = field.value; draftFor = previousText; remember(); });
        const send = button(en ? 'Add your detail' : 'Antwort ergänzen', 'button', () => {});
        send.type = 'submit';
        const original = element('textarea', { className: 'translator-clarification-original', attributes: { rows: '3', autocomplete: 'off' } });
        original.value = editFor === previousText ? editDraft : previousText;
        const updateSubmit = () => { send.textContent = original.value.normalize('NFC').trim() !== previousText
          ? (en ? 'Restart with this situation' : 'Mit dieser Situation neu starten')
          : (en ? 'Add your detail' : 'Antwort ergänzen'); };
        original.addEventListener('input', () => { editDraft = original.value; editFor = previousText; remember(); updateSubmit(); });
        updateSubmit();
        const edit = element('details', { className: 'translator-clarification-edit' }, [
          element('summary', { text: en ? 'Edit situation' : 'Situation bearbeiten' }),
          element('label', {}, [element('span', { text: en ? 'Your situation' : 'Deine Situation' }), original]),
          element('p', { text: en ? 'If you change the situation, you choose your goal again. Your additional detail will be included.' : 'Wenn du die Situation änderst, wählst du dein Ziel erneut. Deine Ergänzung wird übernommen.' })
        ]);
        const form = element('form', { className: 'translator-clarification-form' }, [
          edit, element('label', {}, [element('span', { text: en ? 'Your additional detail' : 'Deine Ergänzung' }), field]), send
        ]);
        let submitting = false;
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (submitting || requestPending) return;
          const reply = field.value.normalize('NFC').trim();
          if (!reply) { status.textContent = en ? 'Please add the missing detail first.' : 'Ergänze bitte zuerst die fehlende Angabe.'; field.focus(); return; }
          const situation = original.value.normalize('NFC').trim();
          if (!situation) { status.textContent = en ? 'Please describe the situation first.' : 'Beschreibe bitte zuerst die Situation.'; edit.open = true; original.focus(); return; }
          const combined = `${situation}\n${reply}`;
          const issue = ai.requestIssue(combined, previousOptions);
          if (issue) {
            status.textContent = issue === 'text_too_long'
              ? (en ? 'The situation and your detail can contain up to 200 characters together. Shorten your detail or use “Edit situation” to shorten the situation. Both drafts stay here.' : 'Situation und Ergänzung dürfen zusammen höchstens 200 Zeichen enthalten. Kürze deine Ergänzung oder die Situation über „Situation bearbeiten“. Beide Entwürfe bleiben hier erhalten.')
              : (en ? 'This detail is too long to send. Please shorten it. Your draft stays here.' : 'Diese Ergänzung ist zu lang zum Senden. Bitte kürze sie. Dein Entwurf bleibt hier erhalten.');
            field.focus(); return;
          }
          if (situation !== previousText) {
            // Explicit restart uses the normal original-input safety/goal path.
            // Merely opening/editing leaves the received warnings in place.
            const otherDraft = input.value;
            input.value = combined;
            try { input.form.requestSubmit(); } finally { input.value = otherDraft; grow(); }
            return;
          }
          requestText = combined; continuation = previousOptions; exactText = true;
          operationID = window.DemenzKiFreigabe?.enabled() ? window.crypto.randomUUID() : '';
          submitting = true; field.disabled = true; send.disabled = true;
          try { await run(true); } finally { submitting = false; if (form.isConnected) { field.disabled = false; send.disabled = false; } }
        });
        box.classList.add('translator-ai-clarification');
        status.textContent = ''; ask.hidden = true;
        box.replaceChildren(title,
          element('p', { className: 'translator-clarification-question', text: result.question }),
          element('p', { text: result.meaning }), element('p', { text: result.nextStep }), form, status, ask);
        title.focus({ preventScroll: true });
        return;
      }
      if (result.kind === 'answer' && Array.isArray(result.phrases)) {
        window.DemenzKiFreigabe?.noteAnswer(result);
        const { node, focus, top } = aiAnswer(result, { allowHelpful: allowHelpful && !localSafetyHit, goal });
        // Die allgemeinen Ersatz-Sätze und „Diesen Satz kenne ich noch nicht.“ braucht es neben der KI-Antwort nicht mehr.
        output.querySelector('.translator-fallback')?.remove();
        output.querySelector('.translator-near-group')?.remove();
        // Die KI-Antwort bringt ihren eigenen Hinweis mit („KI-Antworten können Fehler enthalten“).
        output.querySelector('.translator-notes')?.remove();
        if (box.previousElementSibling?.classList.contains('translator-unknown-note')) box.previousElementSibling.remove();
        box.replaceWith(node);
        const accessCard = window.DemenzKiFreigabe?.afterAnswer(result);
        if (accessCard) node.after(accessCard);
        if (window.DemenzKiFreigabe?.enabled() && result.safetyLevel === 'standard') {
          output.querySelectorAll('.translator-plan-cta, .translator-extra-offers, .translator-signup, .translator-app-cta').forEach((offer) => offer.remove());
        }
        if (result.safetyLevel !== 'standard') {
          output.querySelectorAll('.translator-suggest, .translator-plan-cta, .translator-extra-offers, .translator-signup, .translator-app-cta').forEach((offer) => offer.remove());
        }
        // Unbekannte Sätze: erst die fertige KI-Antwort; nie während des Ladens,
        // bei Sicherheitshinweisen oder mit eingegebenem Text im Planlink.
        if (!window.DemenzKiFreigabe?.enabled() && source === 'unknown' && result.safetyLevel === 'standard' && !output.querySelector('.safety-note, .translator-plan-cta')) {
          const invitation = planCTA(null);
          if (invitation) (output.querySelector('.translator-followup') ?? node).after(invitation);
        }
        setFollowupOpen(false);
        document.body.classList.remove('translator-answers-seen');
        if (!auto || manual) {
          focus.setAttribute('tabindex', '-1');
          focus.focus({ preventScroll: true });
          top.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
        return;
      }
      if (result.kind === 'safety') {
        if (result.safetyLevel === 'concern') {
          const note = fixedSafetyNote(result, localSafetyNote);
          box.replaceWith(note);
          output.querySelectorAll('.translator-suggest, .translator-plan-cta, .translator-extra-offers, .translator-signup, .translator-app-cta').forEach(offer => offer.remove());
          setFollowupOpen(false);
          note.tabIndex = -1;
          note.focus({ preventScroll: true });
          return;
        }
        const freshNote = urgentNote(data.safetySignals.text);
        const existing = [...output.querySelectorAll('.safety-urgent')].find((note) => !note.closest('[data-goal-safety-history]') && !box.contains(note) && note.textContent === freshNote.textContent);
        const note = existing ?? freshNote;
        if (existing) box.remove(); else box.replaceWith(note);
        output.querySelectorAll('.translator-suggest, .translator-plan-cta, .translator-extra-offers, .translator-signup, .translator-app-cta').forEach((offer) => offer.remove());
        // Der Dienst liefert hier keine Formulierung. Die Sicherheitsinformation bleibt
        // zuerst stehen; bei einer unbekannten Eingabe braucht es auch einen nächsten Schritt.
        if (source === 'unknown' && !ui && !localSafetyHit) {
          const iceQuestion = /^\s*sie\s+(?:ist|isst)\s+mein\s+eis\s+(?:weg|auf)\s*[.!?]*\s*$/i.test(text);
          note.after(element('section', { className: 'translator-clarify' }, [
            element('h3', { className: 'translator-step', text: 'Was genau ist passiert?' }),
            element('p', { text: iceQuestion ? 'Meinst du „Sie isst mein Eis auf“? Oder meinst du etwas anderes? Schreib bitte kurz dazu, was passiert ist.' : 'Was ist gerade passiert? Beschreibe bitte kurz die Situation.' })
          ]));
          form.hidden = false;
        if (!input.value.trim()) { input.value = text; grow(); }
          setFollowupOpen(true);
        } else {
          setFollowupOpen(false);
        }
        note.setAttribute('tabindex', '-1');
        note.focus({ preventScroll: true });
        return;
      }
      // Sicherheit geht auch bei widersprüchlichen Antworttypen vor: Die
      // Off-topic-Hilfe oder ein Fehler darf den Hinweis nicht verdrängen.
      const safetyNote = aiSafetyNote(result, ui?.gradedSafety === false && result.safetyLevel === 'concern');
      if (safetyNote) {
        box.querySelector('.safety-note')?.remove();
        box.prepend(safetyNote);
      }
      if (result.kind === 'off_topic') {
        status.textContent = ui ? tr('Dazu kann der Übersetzer nicht helfen. Tippe einen Satz ein, den die Person mit Demenz gesagt hat.')
          : 'Dazu kann der Übersetzer nicht helfen. Beschreibe eine Situation im Alltag mit Demenz oder eine Frage als pflegende Person.';
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
    const ask = button('KI fragen', 'button translator-ai-button', () => run(true));
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
  const aiGoalBox = (text, source, onFail, { auto = false, allowHelpful = true } = {}) => {
    const en = ui?.lang === 'en';
    const box = element('section', { className: 'translator-ai translator-ai-goals' });
    const heading = element('h2', { text: en ? 'What would help you right now?' : 'Was möchtest du gerade erreichen?' });
    const status = element('p', { className: 'translator-ai-status', attributes: { role: 'status', 'aria-live': 'polite' } });
    const choices = element('div', { className: 'translator-ai-goal-choices' });
    const changeGoals = element('details', { className: 'translator-change-goal' }, [element('summary', { text: en ? 'Change goal' : 'Ziel ändern' })]);
    let busy = false, selectedKey = '', selectedGoal = null;
    const answerSlot = element('div', { className: 'translator-goal-answer' });
    // These are received warnings for this original situation, not a severity
    // classification of a different goal. Keep their exact nodes and call links.
    const warningHistory = element('div', { attributes: { 'data-goal-safety-history': '', hidden: '' } });
    const receivedWarnings = new Map();
    const warningSignature = note => JSON.stringify([note.textContent.replace(/\s+/g, ' ').trim(),
      [...note.querySelectorAll('a[href]')].map(link => link.getAttribute('href'))]);
    const syncWarningHistory = () => {
      const current = new Set([...answerSlot.querySelectorAll('.safety-note')].map(warningSignature));
      for (const [signature, record] of receivedWarnings) record.item.hidden = current.has(signature);
      warningHistory.hidden = ![...receivedWarnings.values()].some(record => !record.item.hidden);
    };
    const rememberWarning = (note, key, goal) => {
      const signature = warningSignature(note);
      let record = receivedWarnings.get(signature);
      if (!record) {
        const context = element('p');
        const item = element('section', {}, [context, note]);
        record = { item, context, goals: new Map() };
        receivedWarnings.set(signature, record);
        warningHistory.append(item);
      }
      record.goals.set(key, goal.label);
      record.context.textContent = (en ? 'Information from previous answers. Goals: ' : 'Hinweis aus vorherigen Antworten. Ziele: ')
        + [...record.goals.values()].map(label => `„${label}“`).join('; ');
      syncWarningHistory();
    };
    const preserveWarnings = () => {
      if (!selectedGoal) return;
      for (const note of answerSlot.querySelectorAll('.safety-note')) rememberWarning(note, selectedKey, selectedGoal);
      syncWarningHistory();
    };
    new MutationObserver(syncWarningHistory).observe(answerSlot, { childList: true, subtree: true });

    // This cache belongs only to this situation and address mode. Pending promises
    // are shared when A → B → A is chosen; detached views cannot paint stale results.
    const answers = new Map();
    const requestStates = new Map();
    const requestAnswer = (situation, options) => {
      const key = JSON.stringify([situation.normalize('NFC').trim(), options.formal, options.goal, options.correctionOf || '']);
      if (answers.has(key)) return answers.get(key).then(result => { const { access, ...cached } = result; return cached; });
      if (!answers.has(key)) {
        const pending = Promise.resolve().then(() => ai.ask(situation, options)).catch(() => ({ kind: 'error', reason: 'unavailable' }));
        answers.set(key, pending);
        const capturedGoal = { ...options.goal };
        const capturedKey = JSON.stringify([options.formal, capturedGoal]);
        pending.then(result => {
          if (!['answer', 'safety', 'clarification'].includes(result.kind) && answers.get(key) === pending) answers.delete(key);
          // This exact goal section identifies the original flow, even when a new
          // flow later has identical text. A detached response cannot affect it.
          if (!box.isConnected || capturedKey === selectedKey) return;
          const note = result.kind === 'safety' ? fixedSafetyNote(result)
            : aiSafetyNote(result, ui?.gradedSafety === false && result.safetyLevel === 'concern');
          if (note) rememberWarning(note, capturedKey, capturedGoal);
        });
      }
      return answers.get(key);
    };
    const select = (goal) => {
      const key = JSON.stringify([personal.formal, goal]);
      if (!box.isConnected || busy || key === selectedKey) return;
      preserveWarnings();
      selectedKey = key;
      selectedGoal = { ...goal };
      box.classList.add('translator-ai-goals-selected');
      heading.textContent = `${en ? 'Your goal' : 'Dein Ziel'}: ${goal.label}`;
      if (!changeGoals.contains(choices)) { choices.before(changeGoals); changeGoals.append(choices, ownDetails); }
      changeGoals.querySelector('summary').focus({ preventScroll: true });
      changeGoals.open = false;
      status.hidden = true;
      choices.querySelectorAll('button').forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.goalId === goal.id && choice.textContent === goal.label)));
      setViewState('answer');
      ownDetails.open = false;
      answerSlot.replaceChildren(aiBox(text, source, onFail, { auto: true, allowHelpful, goal, requestAnswer, requestState: requestStates.get(key), onRequestState: state => requestStates.set(key, state) }));
      syncWarningHistory();
      // Wait for the choice layout to settle; keep a warning/question's own focus.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const control = changeGoals.querySelector('summary');
        if (!box.isConnected || selectedKey !== key || document.activeElement !== control) return;
        const headerBottom = document.querySelector('.e-header')?.getBoundingClientRect().bottom || 0;
        const top = heading.getBoundingClientRect().top;
        if (top < headerBottom) window.scrollBy({ top: top - headerBottom - 12, behavior: 'instant' });
      }));
    };
    const own = element('input', { attributes: { type: 'text', maxlength: '160', minlength: '3', required: '', placeholder: en ? 'Describe what you need help with' : 'Beschreibe, wobei du Hilfe möchtest' } });
    const ownLabel = element('label', {}, [element('span', { text: en ? 'Or describe your own goal' : 'Oder beschreibe dein eigenes Ziel' }), own]);
    const ownForm = element('form', { className: 'translator-own-goal' }, [ownLabel, button(en ? 'Answer for my goal' : 'Antwort zu meinem Ziel', 'button', () => {})]);
    ownForm.querySelector('button').type = 'submit';
    ownForm.addEventListener('submit', event => {
      event.preventDefault();
      const label = own.value.trim();
      if (label.length < 3) { status.textContent = en ? 'Please describe your goal a little more.' : 'Beschreibe dein Ziel bitte etwas genauer.'; own.focus(); return; }
      if (ownForm.reportValidity()) select({ id: 'custom', label });
    });
    const ownDetails = element('details', { className: 'translator-own-goal-details' }, [element('summary', { text: en ? 'Describe your own goal' : 'Eigenes Ziel beschreiben' }), ownForm]);
    const waiting = aiWaiting();
    waiting.querySelector('.translator-ai-wait-title').lastChild.textContent = en ? 'Finding goals for your situation …' : 'Ziele für deine Situation finden …';
    waiting.querySelectorAll('.translator-ai-steps li').forEach((step,index) => { step.textContent = (en ? ['Understand the situation','Find possible goals','Prepare your choices'] : ['Situation verstehen','Mögliche Ziele finden','Deine Auswahl vorbereiten'])[index]; });
    const load = async () => {
      if (busy) return;
      busy = true; box.dataset.goalState = 'loading'; box.setAttribute('aria-busy', 'true'); retry.disabled = true; retry.hidden = true; choices.replaceChildren(); ownDetails.hidden = true; box.insertBefore(waiting, choices);
      status.textContent = en ? 'The AI is finding goals for your situation …' : 'Die KI formuliert Ziele für deine Situation …';
      let result;
      try { result = typeof ai.askGoals === 'function' ? await ai.askGoals(text, { formal: personal.formal }) : { kind: 'error' }; }
      catch { result = { kind: 'error' }; }
      if (!box.isConnected) return;
      waiting.remove();
      busy = false; box.setAttribute('aria-busy', 'false'); retry.disabled = false;
      if (result.kind === 'safety') {
        const note = fixedSafetyNote(result);
        box.remove(); output.prepend(note); setViewState('answer');
        note.tabIndex = -1; note.focus({ preventScroll: true });
        note.scrollIntoView({ behavior: 'instant', block: 'start' });
        return;
      }
      if (result.kind === 'goals' && result.noSituation) {
        box.dataset.goalState = 'needs-situation';
        status.textContent = en ? 'What happened? Please briefly describe the situation first.' : 'Was ist passiert? Beschreibe bitte zuerst kurz die Situation.';
        retry.hidden = true;
        if (!input.value.trim()) { input.value = text; grow(); }
        return;
      }
      ownDetails.hidden = false;
      if (result.kind === 'goals') {
        box.dataset.goalState = 'ready';
        status.textContent = en ? 'Choose a goal. Your answer will follow your choice.' : 'Wähle ein Ziel. Danach richtet sich deine Antwort.';
        choices.replaceChildren(...result.goals.map(g => button(g.label, 'translator-ai-goal-choice', () => select({ id: g.goal, label: g.label }), { 'aria-pressed': 'false', 'data-goal-id': g.goal })));
        retry.hidden = true;
      } else {
        box.dataset.goalState = 'unavailable';
        status.textContent = en ? 'The AI goals could not be loaded. Try again or describe your goal.' : 'Die KI-Ziele konnten nicht geladen werden. Versuche es erneut oder beschreibe dein Ziel.';
        retry.hidden = false;
      }
    };
    const retry = button(en ? 'Ask the AI for goals' : 'Ziele mit KI klären', 'button translator-ai-goal-retry', () => { void load(); });
    retry.hidden = auto;
    box.append(heading, status, choices, ownDetails, retry, warningHistory, answerSlot);
    ownDetails.hidden = true;
    if (auto) requestAnimationFrame(() => { void load(); });
    return box;
  };

  const renderTypedGoal = (typed, hint) => {
    activePublicRoute = null;
    setViewState('goal');
    const heading = element(homeHeading ? 'h1' : 'h2', { text: `„${typed}“`, attributes: { tabindex: '-1' } });
    output.replaceChildren(saidBlock(typed, hint, heading), aiBox(typed, 'typed_goal', () => {}, { auto: true }));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow({ open: true });
    focusResult(heading);
    output.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  const renderUnknown = ({ safetyHit, typed, hint = null, contextual = false }) => {
    setViewState('answer');
    const nodes = [];
    const localSafetyNote = safetyHit ? generalNote() : null;
    if (localSafetyNote) nodes.push(localSafetyNote);
    // Gleicher Aufbau wie ein Treffer: oben der Satz, dann klar, was jetzt hilft.
    const shown = typed.length > 90 ? `${typed.slice(0, 88).trim()}…` : typed;
    const heading = element(homeHeading ? 'h1' : 'h2', { text: shown ? `„${shown}“` : 'Diesen Satz kenne ich noch nicht.', attributes: { tabindex: '-1' } });
    nodes.push(shown ? saidBlock(shown, hint, heading) : heading);
    if (shown && !(ai && typed.length >= 2)) nodes.push(element('p', { className: 'translator-meaning translator-unknown-note', text: 'Diesen Satz kenne ich noch nicht.' }));
    // Mit KI-Knopf ist die Gefühle-Auswahl ein Weg zu viel. Sie erscheint erst,
    // wenn die KI nicht antworten kann (oder es keinen KI-Knopf gibt).
    const feelings = element('div', { className: 'translator-feelings-step' }, [
      element('h3', { className: 'translator-step', text: 'Was spürst du bei der Person?' }),
      feelingPicker('')
    ]);
    const box = aiBox(typed, contextual ? 'context' : 'unknown', () => {
      if (!contextual) { feelings.hidden = false; if (fallbackBox) fallbackBox.hidden = false; }
      setFollowupOpen(true);
    }, { auto: true, localSafetyHit: safetyHit, localSafetyNote });
    if (box) feelings.hidden = true;
    nodes.push(box);
    // Ähnliche Situationen zuerst: Sie führen am schnellsten zu genauen Sätzen.
    const similar = typed && !contextual ? [...new Set([hint, ...core.near(typed, data)].filter(Boolean))].slice(0, 2) : [];
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
    if (!contextual) nodes.push(fallbackBox);
    nodes.push(notesCard(disclaimer()));
    if (!contextual) {
      nodes.push(suggestLink(typed));
      nodes.push(...offers(null, safetyHit));
    }
    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow({ open: true });
    requestAnimationFrame(() => syncSticky());
    focusResult(heading);
    output.scrollIntoView({ behavior: 'instant', block: 'start' });
  };

  const renderContextQuestion = (typed, context, safetyHit = false) => {
    setViewState('answer');
    const prompts = {
      presence: 'Ist gerade eine Person im Zimmer, oder erzählt die Person mit Demenz davon?',
      repetition: 'Was wiederholt sich – eine Frage, ein Satz oder etwas anderes?',
      speaker: 'Wer fühlt sich wie ein Kind behandelt – du oder die Person, die du begleitest?',
      protection: 'Wer hat Angst, und wer ist gerade betroffen? Beschreibe bitte kurz, was passiert ist.'
    };
    const heading = element(homeHeading ? 'h1' : 'h2', { text: 'Was genau ist passiert?', attributes: { tabindex: '-1' } });
    output.replaceChildren(...[
      safetyHit ? generalNote() : null,
      saidBlock(typed, null, element('p', { text: `„${typed}“` })),
      heading,
      element('p', { className: 'translator-context-question', text: prompts[context] }),
      notesCard(disclaimer())
    ].filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow({ open: true });
    input.value = typed;
    grow();
    focusResult(heading);
    output.scrollIntoView({ behavior: 'instant', block: 'start' });
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

  const render = (entry, { safetyHit = false, alternatives = [], also = [], typed = '', mood = null, goal = '', protection = '', preserveViewport = false } = {}) => {
    if (!entry) {
      renderUnknown({ safetyHit, typed });
      return;
    }
    currentGoal=validGoals.has(goal)?goal:'jetzt';
    setViewState('answer');
    const result = entry;
    const nodes = [];

    if (protection === 'self') nodes.push(generalNote());

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
    const heading = element(homeHeading ? 'h1' : 'h2', { text: result.selfCare ? 'Das ist gerade viel für dich.' : result.feeling ? `Bei ${result.feeling}` : `„${bubbleText(result, typed)}“`, attributes: { tabindex: '-1' } });
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
    if (goals) answerCard.append(element('details', { className: 'translator-change-goal' }, [element('summary', { text: 'Ziel ändern' }), element('div', { className: 'translator-ai-goal-choices', attributes: { role: 'group', 'aria-label': 'Ziel wechseln' } }, goals.map(option => button(option.label, 'translator-ai-goal-choice', () => { setPage(result, option.id); render(entry, { safetyHit, alternatives, also, typed, mood, protection, goal: option.id }); }, { 'aria-pressed': String(option.id === goal) })))]));
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
    const doBlock = [];
    if (result.phrases.length) {
      phraseBlock.push(element('h3', { className: 'translator-step', text: result.phrasesTitle || 'Das kannst du sagen' }));
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
            exampleHint ? element('span', { className: 'translator-example-name', text: '„Anna“ ist ein Beispielname.' }) : null,
            element('q', { text }),
            element('div', { className: 'translator-phrase-actions' }, [saveButton(result, original), phraseShareButton(result, original)])
          ]);
        }));
      };
      paint();
      phraseBlock.push(phraseList);
      // Auf dem Handy muss der erste Satz ohne Scrollen sichtbar sein: Sätze zuerst, Anpassen und Erklärung danach.
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
      nodes.push(alsoWrapper);
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
    // Unter den Sätzen dieselbe Situation, wenn es wieder ruhig ist („Danach“-Zeichnung).
    if (phraseBlock.length && !result.safetyOnly && !result.selfCare && !safetyHit) phraseBlock.push(sceneArt(result.afterImage));
    answerCard.append(...order.flat().filter(Boolean));
    const planPlace = safetyHit || result.feeling || result.selfCare || result.safetyOnly ? '' : typedCount >= 2 ? 'wieder' : goal === 'tipps' ? 'tipps' : 'ergebnis';
    const planUp = planPlace ? planCTA(result, planPlace) : null;
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

    // Continue through the one shared form; its declared layout decides the position.
    if (!moreContent.length && !deeperInList && deeper.length) nodes.push(element('div', { className: 'translator-result-links' }, deeper));
    // Sicherheits- und Haftungshinweis als EINE ruhige Karte (Daniel, 9. Nov: „gestalte disclaimer besser“).
    nodes.push(notesCard(result.safety && !result.safetyOnly && !safetyHit && !safetyFirst ? safetyAside() : null, disclaimer()));

    if (!result.safetyOnly) {
      if (result.feeling) nodes.push(feelingPicker('Anderes Gefühl?'));
      nodes.push(feedbackBlock(result, retry, { askReason: !safetyHit && !safetyFirst, helpfulItem: helpfulCopy && !safetyHit && !safetyFirst && helpfulCatalog(result) ? { kind: 'catalog', language: helpfulLanguage, key: result.key, goal: validGoals.has(goal) ? goal : '' } : null }));
      if (planUp) nodes.push(planUp);
      nodes.push(...offers(result, safetyHit, Boolean(planUp)));
    }

    output.replaceChildren(...nodes.filter(Boolean));
    output.hidden = false;
    document.body.classList.add('translator-has-result');
    document.body.classList.remove('translator-answers-seen');
    formBelow();
    requestAnimationFrame(() => syncSticky());
    if (!preserveViewport) {
      focusResult(heading);
      output.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  };

  const setHash = (key, prefix = phraseHash) => {
    leaveStaticContext();
    const url = new URL(location.href);
    url.pathname = startPath;
    url.search='';
    const known=prefix===feelingHash?feelingEntries.has(key):entryByKey.has(key);
    url.hash=known&&key!=='none'?`${prefix}${key}`:'';
    history.replaceState(staticHistory ? { translator: true, translatorStatic: true } : null, '', url);
  };

  function showFeeling(id, source) {
    const entry = feelingEntries.get(id);
    if (!entry) return;
    render(entry);
    setHash(id, feelingHash);
    track('translator_result', { result_key: entry.key, input_source: source, safety_hint: 'no' });
  }

  function show(entry, source) {
    if (!keepInputAtTop && !input.value.trim()) input.value = entry.says;
    grow();
    render(entry, { goal: ui?.lang === 'en' ? '' : 'jetzt' });
    setPage(entry, ui?.lang === 'en' ? '' : 'jetzt');
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
      emptyHint.textContent = form.dataset.emptyHint || tr('Bitte zuerst einen Satz eintippen – oder unten einen antippen.');
      input.focus();
      return;
    }
    emptyHint.textContent = '';
    // Clear only the submitted text; later goal changes must keep a new draft.
    if (keepInputAtTop) { input.value = ''; grow(); }
    typedCount += 1;
    const { entry, alternatives, safetyHit, feeling, also, mood, context, protection } = core.match(text, data);
    // Every normal typed input gets AI goals, even when a catalog keyword matches.
    // Deliberately opened static pages keep their reviewed fixed goal flow.
    if (ai && !safetyHit && !entry?.safetyOnly && protection !== 'self') {
      const imageMatch = entry && (core.normalize(entry.says) === core.normalize(text)
        || (entry.variants ?? []).some(value => core.normalize(value) === core.normalize(text))
        || (core.rank(text, [entry])[0]?.score ?? 0) >= strongScore) ? entry : null;
      renderTypedGoal(text, imageMatch);
      setHash('');
      track('translator_result', { result_key: 'none', input_source: 'typed', safety_hint: 'no' });
      return;
    }
    if (protection === 'self') {
      render(entry, { safetyHit, typed: text, protection });
      setHash(entry.key);
      track('translator_result', { result_key: entry.key, input_source: 'typed', safety_hint: 'yes' });
      return;
    }
    if (protection === 'clarify' || ['presence', 'repetition', 'speaker'].includes(context)) {
      renderContextQuestion(text, protection ? 'protection' : context, safetyHit);
      setHash('');
      track('translator_result', { result_key: 'none', input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no' });
      return;
    }
    if (context) {
      renderUnknown({ safetyHit, typed: text, contextual: true });
      setHash('');
      track('translator_result', { result_key: 'none', input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no' });
      return;
    }
    const feelingEntry = !entry && feeling ? feelingEntries.get(feeling.id) : null;
    if (feelingEntry) {
      render(feelingEntry, { safetyHit, typed: text });
      setHash(feeling.id, feelingHash);
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
    // Die feste Antwort ist bereits vorhanden; nur echte KI-Anfragen brauchen eine Warte-Ansicht.
    answer();
    if (entry && !entry.safetyOnly) setPage(entry); else setHash(entry?.key);
    track('translator_result', { result_key: entry?.key ?? 'none', input_source: 'typed', safety_hint: safetyHit ? 'yes' : 'no', multiple: also.length ? 'yes' : 'no', mood: mood?.id ?? 'none' });
  });

  document.querySelectorAll('[data-translator-key]').forEach((chip) => {
    chip.addEventListener('click', (event) => {
      // Die vorhandene Fachseitenadresse ist das Ziel, auch mit JavaScript.
      // Native Navigation bewahrt Metadaten, Tastatur, neue Tabs und Browser-Back.
      // Das zentrale Routenmanifest und statische hrefs verwaltet der Website-Owner.
      if (chip.tagName === 'A' && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
      // Nach dem ersten Klick kann das Formular verrutschen. Ein zweiter Klick
      // derselben Mehrfachaktivierung darf dann keine fremde Kachel öffnen.
      if (event.detail > 1) { event.preventDefault(); return; }
      if (chip.tagName === 'A') {
        const route = publicByKey.get(chip.dataset.translatorKey);
        if (route) chip.href = route.path;
        return;
      }
      const entry = entryByKey.get(chip.dataset.translatorKey);
      if (entry) { event.preventDefault(); show(entry, 'chip'); }
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
    setHash(key);
    if (!keepInputAtTop) input.value = entry.says;
    grow();
    render(entry);
    track('translator_result', { result_key: entry.key, input_source: 'link', safety_hint: 'no' });
  };
  const params = new URLSearchParams(location.search);
  const linkedEntry = entryByKey.get(params.get('situation'));
  const hasLegacyState = location.hash.startsWith(`#${phraseHash}`) || location.hash.startsWith(`#${feelingHash}`);
  const legacyKey = location.hash.slice(location.hash.indexOf('-') + 1);
  const validLegacyState = hasLegacyState && (location.hash.startsWith(`#${feelingHash}`)?feelingEntries.has(legacyKey):entryByKey.has(legacyKey));
  if(!validLegacyState&&linkedEntry&&(!linkedEntry.safetyOnly||staticDefault||(linkedEntry.selfCare&&publicByKey.has(linkedEntry.key)))){
    const goal=params.get('ziel')||'';if(!keepInputAtTop)input.value=linkedEntry.says;grow();
    if(linkedEntry.safetyOnly&&!linkedEntry.selfCare)render(linkedEntry,{safetyHit:true});
    else if(validGoals.has(goal)||!goalsFor(linkedEntry))render(linkedEntry,{goal,preserveViewport:keepInputAtTop});
    else askGoal(linkedEntry,{preserveViewport:keepInputAtTop});
    setPage(linkedEntry,goal,false);
    track('translator_result',{result_key:linkedEntry.key,input_source:'link',safety_hint:linkedEntry.safetyOnly&&!linkedEntry.selfCare?'yes':'no'});
  }else if(staticDefault&&!validLegacyState){
    const requestedGoal=pathState?pathState.goal:document.body.dataset.translatorInitialGoal;
    if(pathState&&pathState.route.selectionPath===location.pathname)askGoal(staticDefault,{preserveViewport:keepInputAtTop});
    else{render(staticDefault,{goal:validGoals.has(requestedGoal)?requestedGoal:'',preserveViewport:keepInputAtTop});formBelow({open:true});}
    if(location.search||location.hash){const clean=new URL(location.href);clean.search='';clean.hash='';history.replaceState(history.state,'',clean);}
    document.title=initialTitle;
    track('translator_result',{result_key:staticDefault.key,input_source:'link',safety_hint:'no'});
  }else{
    if(!validLegacyState&&location.search){const clean=new URL(location.href);clean.search='';clean.hash='';history.replaceState(history.state,'',clean);}
    openFromHash();
  }
  window.addEventListener('hashchange', openFromHash);
  renderSaved();
  renderHelpful();

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


  const headerNav = document.querySelector('.e-header nav');
  if (headerNav) {
    const en = ui?.lang === 'en';
    const menu = element('details', { className: 'e-menu' });
    const summary = element('summary', { text: en ? 'Menu' : 'Menü' });
    const items = element('div', { className: 'e-menu-items' });
    items.append(...headerNav.childNodes);
    const account = element('a', { text: en ? 'Sign in / Create account' : 'Anmelden / Konto erstellen', attributes: { href: window.DemenzKiFreigabe?.signInURL || '/abo/konto.html?returnTo=' + encodeURIComponent(en ? '/en/dementia-translator/' : '/de/') } });
    items.append(account); menu.append(summary, items); headerNav.append(menu);
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; summary.focus(); } });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
  }

  // Eingabe immer in Reichweite (Daniel, 9. Nov 03:27 und 04:09): Ist das Feld aus dem Bild gescrollt, erscheint
  // unten rechts ein kleines Chat-Fenster wie bei Support-Chats: die junge Frau aus den Zeichnungen, eine
  // Sprechblase und ein echtes Eingabefeld. Abschicken trägt den Text ins große Feld und schickt es dort ab.
  // Mit × wird es zum runden Bild; ein Tipp darauf öffnet es wieder.
  if (document.body.classList.contains('einfach') && 'IntersectionObserver' in window) {
    const en = ui?.lang === 'en';
    const field = element('input', { className: 'translator-chat-input', attributes: { type: 'text', maxlength: input.maxLength > 0 ? String(input.maxLength) : '200', autocomplete: 'off', enterkeyhint: 'send', placeholder: en ? 'What happened?' : 'Was ist passiert?', 'aria-label': en ? 'Your situation' : 'Deine Situation', 'aria-describedby': 'translator-chat-privacy' } });
    const send = element('button', { className: 'translator-chat-send', text: en ? 'Find an answer' : 'Antwort finden', attributes: { type: 'submit' } });
    const chatForm = element('form', { className: 'translator-chat-form' }, [field, send]);
    const privacy = element('p', { className: 'translator-chat-privacy', attributes: { id: 'translator-chat-privacy' } });
    // The same pre-submit terms/privacy/AI disclosure remains reachable here.
    const originalNotice = document.getElementById('translator-privacy-note');
    if (originalNotice) {
      const links = originalNotice.querySelectorAll('a');
      if (links.length >= 2) {
        const terms = links[0].cloneNode(true), information = links[1].cloneNode(true);
        information.textContent = en ? 'Privacy & AI' : 'Datenschutz & KI';
        privacy.append(en ? 'By submitting you accept the ' : 'Mit Absenden akzeptierst du die ', terms, '. ', information, '.');
      } else privacy.append(...Array.from(originalNotice.childNodes, node => node.cloneNode(true)));
    }
    const panel = element('div', { className: 'translator-chat-panel' }, [chatForm, privacy]);
    const chat = element('aside', { className: 'translator-chat', attributes: { 'aria-label': en ? 'Describe another situation' : 'Andere Situation beschreiben', hidden: '' } }, [panel]);
    let positionFrame = 0;
    // Keep an unsent draft available to the existing feedback/correction flow.
    field.addEventListener('input', () => { input.value = field.value; grow(); });
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
    const updateChatPosition = () => {
      positionFrame = 0;
      const inputRect = input.getBoundingClientRect();
      const entryPoint = inputRect.height > 0 ? input : form.closest('.translator-followup-question')?.querySelector('summary');
      const entryRect = entryPoint?.getBoundingClientRect() ?? inputRect;
      const inputVisible = entryRect.height > 0 && entryRect.bottom > 0 && entryRect.top < innerHeight;
      const wasHidden = chat.hidden;
      const helpfulRect = document.querySelector('.translator-helpful:not([hidden])')?.getBoundingClientRect();
      const helpfulVisible = helpfulRect?.height > 0 && helpfulRect.bottom > 0 && helpfulRect.top < innerHeight;
      // Keep the return list readable without interrupting a deliberately focused chat draft.
      const helpfulInUse = helpfulVisible && !chat.contains(document.activeElement);
      // Auf der Startseite stehen die Beispiele zuerst: ihr noch nicht erreichtes
      // Eingabefeld soll keinen Chat über den auswählbaren Situationen öffnen.
      chat.hidden = inputVisible || helpfulInUse || (document.body.dataset.translatorState === 'input' && form.hasAttribute('data-chat-after-input') && entryRect.top >= 0);
      chat.style.bottom = '';
      const viewport = window.visualViewport;
      const keyboardInset = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
      if (keyboardInset) chat.style.bottom = `${keyboardInset + 8}px`;
      panel.style.maxHeight = '';
      panel.style.overflowY = '';
      if (!chat.hidden) {
        const settings = document.querySelector('.consent-settings');
        const control = settings?.getBoundingClientRect();
        const box = chat.getBoundingClientRect();
        if (control?.height && control.top < innerHeight && control.bottom > 0
          && box.left < control.right && box.right > control.left && box.top < control.bottom && box.bottom > control.top) {
          const available = Math.max(56, control.top - 20);
          if (box.height > available) {
            panel.style.maxHeight = `${available}px`;
            panel.style.overflowY = 'auto';
          }
          // Nur die optionale Hilfe rückt über den sichtbaren Datenschutzcontrol;
          // Text, Fokus, bewusster Minimiertzustand und Einwilligung bleiben erhalten.
          chat.style.bottom = `${Math.max(parseFloat(getComputedStyle(chat).bottom) || 16, innerHeight - control.top + 12)}px`;
        }
      }
      if (wasHidden && !chat.hidden) { chat.classList.remove('translator-chat-in'); void chat.offsetWidth; chat.classList.add('translator-chat-in'); }
    };
    syncChat = () => { if (!positionFrame) positionFrame = requestAnimationFrame(updateChatPosition); };
    new IntersectionObserver(syncChat).observe(input);
    window.visualViewport?.addEventListener('resize', syncChat, { passive: true });
    window.visualViewport?.addEventListener('scroll', syncChat, { passive: true });
    addEventListener('scroll', syncChat, { passive: true });
    addEventListener('resize', syncChat, { passive: true });
    syncChat();
  }
})();
