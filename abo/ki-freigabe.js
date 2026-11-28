// Presentation only. Quota and payment authority live on the server.
(function (root) {
  'use strict';
  const config = root.DEMENZ_ABO_CONFIG || {};
  const enabled = () => config.translatorGate?.enabled === true;
  const endpoint = config.translatorGate?.endpoint || 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web';
  const pendingKey = 'demenzCoachKiOffen';
  const en = /^en(?:-|$)/i.test(root.document?.documentElement?.lang || '');
  let access, signupCopyStatus, accessContractReady = false, headerPromise, authModule, mountGeneration = 0, invitationShown = false;
  let authGeneration = 0, observedAuth, observedIdentity;
  const requestGenerations = new WeakMap(), resultGenerations = new WeakMap(), accessGenerations = new WeakMap();
  const exp = () => root.DemenzWebExperiments;
  const node = (doc, tag, text = '') => { const item = doc.createElement(tag); item.textContent = text; return item; };
  const returnPath = () => en ? '/en/dementia-translator/' : '/de/';
  const accountURL = () => `/abo/konto.html?returnTo=${encodeURIComponent(returnPath())}`;
  const offerURL = '/abo/?src=web_translator';
  const validAccess = value => value?.enabled === true && typeof value.verified === 'boolean' && typeof value.paid === 'boolean'
    && Number.isInteger(value.remaining) && value.remaining >= 0
    && Number.isInteger(value.registeredAdditional) && value.registeredAdditional >= 0 && value.registeredAdditional <= 5;
  function clearCreditOffers() {
    for (const view of root.document?.querySelectorAll?.('.dc-signup[data-signup-copy]') || []) {
      delete view.dataset.signupCopy;
      view.querySelector('h3').textContent = en ? 'Your DemenzCoach account.' : 'Dein Konto für DemenzCoach.';
      view.querySelector('.lead').textContent = en ? 'Checking your access …' : 'Dein Zugang wird geprüft …';
      view.querySelector('.primary').textContent = en ? 'Continue with email' : 'Mit E-Mail fortfahren';
    }
    for (const view of root.document?.querySelectorAll?.('[data-signup-credit-offer]') || []) {
      delete view.dataset.signupCreditOffer;
      view.querySelector('p').textContent = en ? 'Checking your access …' : 'Dein Zugang wird geprüft …';
    }
  }
  const identityOf = auth => {
    const user = auth?.currentUser;
    return user ? `${user.uid}:${user.isAnonymous}:${user.emailVerified}` : '';
  };
  function observeAuth(auth) {
    observedAuth = auth;
    const identity = identityOf(auth);
    if (observedIdentity !== undefined && identity !== observedIdentity) {
      authGeneration++;
      access = undefined; signupCopyStatus = undefined; accessContractReady = false; headerPromise = null;
      clearCreditOffers();
      const notice = root.document?.getElementById?.('web-access-notice');
      if (notice) notice.textContent = en ? 'Checking your access …' : 'Dein Zugang wird geprüft …';
    }
    observedIdentity = identity;
    return authGeneration;
  }
  const currentGeneration = () => observedAuth ? observeAuth(observedAuth) : authGeneration;
  function createAccessContext() {
    const context = Object.freeze({});
    requestGenerations.set(context, currentGeneration());
    return context;
  }
  function bindAccessResult(result, context) {
    const generation = requestGenerations.get(context);
    if (!result || typeof result !== 'object' || generation === undefined) return result;
    resultGenerations.set(result, generation);
    if (result.access && typeof result.access === 'object') accessGenerations.set(result.access, generation);
    if (generation === currentGeneration()) return result;
    // Preserve all care/question/warning fields; only stale optional account
    // metadata is withheld. No provenance or identity is put in the wire DTO.
    const { access: ignored, ...care } = result;
    if (care.kind === 'access') care.reason = 'access_unavailable';
    resultGenerations.set(care, generation);
    return care;
  }
  const currentAccess = value => value && accessGenerations.get(value) === currentGeneration();
  function accept(value, fromStatus = false) {
    if (!validAccess(value)) return;
    if (!fromStatus && !currentAccess(value)) return;
    if (fromStatus) {
      accessContractReady = value.contract === 'signup-bonus-v1';
      signupCopyStatus = accessContractReady ? value.signupCopy : undefined;
    } else if (accessContractReady && access?.verified === true && value.verified === false) {
      void refresh().catch(() => {});
      return;
    }
    access = { ...value, ...(accessContractReady ? { contract: 'signup-bonus-v1', signupCopy: signupCopyStatus } : {}) };
    if (typeof exp()?.acceptAccess === 'function') exp().acceptAccess(access);
    else exp()?.accept(value.exposure);
  }
  // 28. Nov 2026 (Daniel, erster Test auf dem iPhone): Die Anmeldung im Hintergrund (Firebase laden, anonym anmelden, Token holen)
  // dauert auf dem Handy oft länger als 1,5 Sekunden. Dann ging die Frage ohne Ausweis raus, der Server sagte 401 und die Seite
  // zeigte „Der Zugang konnte gerade nicht geprüft werden“. Darum warten wir bis zu 10 Sekunden und starten die Anmeldung früher (warm).
  const authWaitMs = 10000;
  async function requestContext({ requestID, anonymous = true, accessContext, fresh = false } = {}) {
    if (!enabled()) return {};
    // Always negotiate the new contract, even if authentication is temporarily
    // unavailable. Omitting it would silently select the legacy free path.
    const operation = { 'X-Translator-Access-Contract': 'signup-bonus-v1', ...(requestID ? { 'X-Translator-Request-ID': requestID } : {}) };
    const origin = requestGenerations.get(accessContext) ?? currentGeneration();
    try {
      const readHeaders = async () => {
        authModule ||= await import('/abo/web-auth.js');
        const { auth } = await authModule.webAuth({ anonymous: false });
        observeAuth(auth);
        if (origin !== authGeneration) throw new Error('auth_changed');
        let user = auth.currentUser;
        if (!user && anonymous) {
          await authModule.webAuth({ anonymous: true });
          observeAuth(auth); user = auth.currentUser;
          // An initial shared anonymous session may be established by this
          // lookup. A concurrently signed-in account must never be adopted.
          if (!user?.isAnonymous || user.emailVerified) throw new Error('auth_changed');
        }
        const generation = authGeneration;
        if (!user) return { headers: {}, origin, generation };
        const signature = identityOf(auth);
        const token = await user.getIdToken(fresh === true);
        observeAuth(auth);
        if (identityOf(auth) !== signature || generation !== authGeneration) throw new Error('auth_changed');
        return { headers: { Authorization: `Bearer ${token}` }, origin, generation };
      };
      let pending;
      if (anonymous && !fresh) {
        headerPromise ||= readHeaders().finally(() => { if (headerPromise === pending) headerPromise = null; });
        pending = headerPromise;
      } else pending = readHeaders();
      let timer;
      const resolved = await Promise.race([pending, new Promise((resolve) => { timer = setTimeout(() => resolve(null), authWaitMs); })]).finally(() => clearTimeout(timer));
      if (!resolved) { if (headerPromise === pending) headerPromise = null; return operation; }
      if (resolved.origin !== origin || resolved.generation !== currentGeneration()) throw new Error('auth_changed');
      if (accessContext && requestGenerations.has(accessContext)) requestGenerations.set(accessContext, resolved.generation);
      return { ...resolved.headers, ...exp()?.headers(), ...operation };
    } catch { return operation; } // Still call the server, so its free safety path runs.
  }
  // Startet die anonyme Anmeldung, sobald jemand eine Situation abschickt. Bis das Ziel gewählt ist, liegt der Ausweis bereit.
  function warm() {
    if (!enabled()) return;
    void requestContext({}).catch(() => {});
  }
  async function refresh() {
    if (!enabled()) return null;
    const generation = mountGeneration;
    const context = createAccessContext();
    const response = await root.fetch(`${endpoint}/access`, { headers: await requestContext({ anonymous: false, accessContext: context }), credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('access_unavailable');
    const value = await response.json();
    if (generation !== mountGeneration || requestGenerations.get(context) !== currentGeneration()) throw new Error('access_superseded');
    if (value.enabled !== true || value.needsSession === true || value.contract !== 'signup-bonus-v1') {
      access = undefined; signupCopyStatus = undefined; accessContractReady = false; clearCreditOffers();
      return value.enabled === true && value.needsSession === true && value.contract === 'signup-bonus-v1'
        ? { enabled: true, needsSession: true, contract: 'signup-bonus-v1' } : { enabled: false, mode: 'legacy' };
    }
    if (!validAccess(value)) {
      access = undefined; signupCopyStatus = undefined; accessContractReady = false; clearCreditOffers();
      throw new Error('invalid_access');
    }
    accept(value, true); return access;
  }
  function remember(sentence) {
    try { root.sessionStorage.setItem(pendingKey, JSON.stringify({ text: String(sentence || '').slice(0, 200), until: Date.now() + 900000 })); } catch {}
  }
  function takePending() {
    try {
      const raw = root.sessionStorage.getItem(pendingKey); root.sessionStorage.removeItem(pendingKey);
      const value = JSON.parse(raw || 'null'); return value?.until > Date.now() && typeof value.text === 'string' ? value.text.slice(0, 200) : '';
    } catch { return ''; }
  }
  const signupDelay = 6000;
  function offerCard({ sentence = '', reason = 'payment_required', doc = root.document, value, onRetry, delay = 0 } = {}) {
    if (value && !currentAccess(value)) { value = undefined; reason = 'access_unavailable'; }
    accept(value);
    const card = node(doc, 'section'); card.className = 'ki-angebot';
    card.setAttribute('aria-label', en ? 'Continue using DemenzCoach' : 'DemenzCoach weiter nutzen');
    if (['answer_unavailable', 'request_completed', 'correction_unavailable'].includes(reason)) {
      card.append(node(doc, 'h3', en ? 'This answer cannot be recovered here' : 'Diese Antwort kann hier nicht wiederhergestellt werden'), node(doc, 'p', en ? 'Repeating the same request will not help. Please contact us if an answer was lost.' : 'Dieselbe Anfrage erneut zu senden hilft hier nicht. Bitte kontaktiere uns, wenn eine Antwort verloren gegangen ist.'));
      const help = node(doc, 'a', en ? 'Contact support' : 'Support kontaktieren'); help.href = en ? '/contact-en.html' : '/kontakt.html'; card.append(help); return card;
    }
    if (reason === 'answer_recovery_credit') card.append(node(doc, 'p', en ? 'One free replacement attempt has been granted for this account. It will not use an additional introductory answer.' : 'Für dieses Konto ist einmalig ein kostenloser Wiederholungsversuch freigegeben. Er verbraucht keine zusätzliche Antwort deines Einstiegskontingents.'));
    if (!['signup_required', 'payment_required'].includes(reason)) {
      card.append(node(doc, 'h3', en ? 'Access could not be checked' : 'Der Zugang konnte gerade nicht geprüft werden'), node(doc, 'p', en ? 'Please try again. Your previous answers remain available.' : 'Bitte versuche es erneut. Deine bisherigen Antworten bleiben erhalten.'));
      const retry = node(doc, 'button', en ? 'Try again' : 'Erneut versuchen'); retry.type = 'button';
      retry.addEventListener('click', () => {
        retry.disabled = true;
        if (typeof onRetry === 'function') { card.remove(); onRetry(); return; }
        const input = root.document?.querySelector('#translator-input'); if (input) input.value = sentence;
        card.remove(); root.document?.querySelector('#translator-form')?.requestSubmit();
      }); card.append(retry); return card;
    }
    const signup = reason === 'signup_required';
    const creditEligible = signup && enabled() && accessContractReady && access?.enabled === true && access.verified === false && access.paid === false
      && Number.isInteger(access.registeredAdditional) && access.registeredAdditional >= 3 && access.registeredAdditional <= 5;
    const bonus = creditEligible ? access.registeredAdditional : 3;
    if (creditEligible) card.dataset.signupCreditOffer = 'true';
    const accountFirst = signup && access?.signupBeforePaywall === true;
    card.append(node(doc, 'h3', signup ? (accountFirst ? (en ? 'Create your free account' : 'Kostenloses Konto anlegen') : en ? 'Continue with an account' : 'Mit Konto weiter ausprobieren') : (en ? 'More answers for everyday care' : 'Weitere Antworten für deinen Pflegealltag')));
    card.append(node(doc, 'p', signup
      ? creditEligible
        ? (en ? `With a verified account you receive ${bonus} additional introductory answers. No payment details required.` : `Mit verifiziertem Konto erhältst du ${bonus} weitere Antworten zum Ausprobieren. Ohne Zahlungsdaten.`)
        : (en ? 'Sign in with Google or email. No payment details required.' : 'Mit Google oder E-Mail anmelden. Ohne Zahlungsdaten.')
      : (en ? 'Your free introduction is used. Choose a paid membership for new situations. Saved helpful answers remain readable.' : 'Dein kostenloser Einstieg ist aufgebraucht. Wähle eine kostenpflichtige Mitgliedschaft für neue Situationen. Gespeicherte hilfreiche Antworten bleiben lesbar.')));
    if (signup && access?.remaining > 0) card.append(node(doc, 'p', en ? `${access.remaining} answer(s) are still available without signing in.` : `Ohne Anmeldung sind noch ${access.remaining} Antwort(en) verfügbar.`));
    const link = node(doc, 'a', signup ? (en ? 'Create or sign in to an account' : 'Konto erstellen oder anmelden') : (en ? 'View membership' : 'Mitgliedschaft ansehen'));
    link.className = 'ki-angebot-knopf'; link.href = signup ? accountURL() : `/abo/?src=${encodeURIComponent(exp()?.campaign() || 'web_translator')}`;
    link.addEventListener('click', () => { remember(sentence); exp()?.track(signup ? 'web_signup_shown' : 'web_checkout_clicked'); }); card.append(link);
    if (!signup) { const login = node(doc, 'a', en ? 'Already a member? Sign in' : 'Schon Mitglied? Anmelden'); login.href = accountURL(); login.addEventListener('click', () => remember(sentence)); card.append(login); }
    card.append(node(doc, 'p', en ? 'Safety information and public guides remain free.' : 'Sicherheitshinweise und öffentliche Ratgeber bleiben kostenlos.'));
    if (signup && config.signIn?.emailLink === true) {
      // Daniel, 28. Nov 2026: Man soll zuerst sehen, dass es funktioniert. Nach einer Antwort kommt die Anmeldung darum erst
      // nach 6 Sekunden als Layer über der Antwort (delay aus afterAnswer). Bis dahin steht die Karte mit dem Link „Kostenloses Konto einrichten“ unter der Antwort.
      root.setTimeout(() => import('/abo/inline-signup.js').then(({ mountInlineSignup }) => {
        if (card.isConnected) return mountInlineSignup(card, { bonus, en, purpose: enabled() ? 'intro' : 'invitation', signupCopy: access?.signupCopy, creditActive: creditEligible, returnTo: returnPath(), onBegin: () => remember(sentence) });
      }).catch(() => { /* The existing accessible account link remains usable. */ }), delay);
    }
    exp()?.track(signup ? 'web_signup_shown' : 'web_paywall_shown'); return card;
  }
  // Daniel, 27. Nov 2026: nach der Anmeldung unbegrenzt fragen. Die Paywall kommt trotzdem, lässt sich aber wegklicken.
  // Frequency Capping wie bei den Layern (content-invitation-policy.js): 30 Min. Pause, höchstens 3 pro 24 Std.
  const softKey = 'demenzcoach.kiPaywallCadence.v1', softCooldown = 30 * 60000, softWindow = 24 * 3600000, softMax = 3;
  function softCadence(now = Date.now()) {
    try {
      const value = JSON.parse(root.localStorage.getItem(softKey) || 'null');
      if (value && Number.isFinite(value.startedAt) && Number.isFinite(value.lastAt) && Number.isInteger(value.count)
        && value.startedAt <= now && value.startedAt + softWindow > now && value.lastAt <= now) return value;
    } catch {}
    return { startedAt: now, lastAt: 0, count: 0 };
  }
  function softAllowed(now = Date.now()) {
    const value = softCadence(now);
    return value.count < softMax && (value.lastAt === 0 || now - value.lastAt >= softCooldown);
  }
  function softShown(now = Date.now()) {
    const value = softCadence(now);
    try { root.localStorage.setItem(softKey, JSON.stringify({ startedAt: value.startedAt, lastAt: now, count: value.count + 1 })); } catch {}
  }
  // Daniel, 27. Nov 2026 („das ist nicht sales optimiert, nimm das raus“): keine eigene Karte, sondern unsere
  // Angebotsseite als Layer (/start/?src=layer&embed=1&angebot=1). Schließen nur über das ×. Kurz warten, damit die Antwort zuerst sichtbar ist.
  const softDelay = 6000;
  function softPaywall(doc = root.document) {
    if (en || !softAllowed()) return null;
    root.setTimeout(async () => {
      try {
        if (doc.hidden || doc.querySelector('dialog[open]') || !softAllowed()) return;
        const { openFunnelLayer } = await import('/abo/funnel-layer.js');
        if (doc.querySelector('dialog[open]') || !softAllowed()) return;
        const layer = openFunnelLayer({ doc, paywall: true, onClose: () => exp()?.track('web_paywall_dismissed') });
        if (!layer) return;
        softShown(); exp()?.track('web_paywall_shown');
      } catch { /* Ohne Layer bleibt die Antwort einfach stehen. */ }
    }, softDelay);
    return null;
  }
  function afterAnswer(result, doc = root.document, { sentence = '' } = {}) {
    if (!enabled()) {
      if (config.signIn?.offerAfterAnswer !== true || config.signIn?.emailLink !== true || invitationShown || result?.safetyLevel !== 'standard' || result?.safetyMessage) return null;
      invitationShown = true;
      const card = offerCard({ reason: 'signup_required', doc, sentence });
      card.querySelector('h3').textContent = en ? 'Your free account' : 'Dein kostenloser Zugang';
      card.querySelector('p').textContent = en ? 'Continue with Google or email. No password or payment details required.' : 'Mit Google oder E-Mail weiter. Ohne Passwort und ohne Zahlungsdaten.';
      card.querySelector('a').textContent = en ? 'Create or sign in to an account' : 'Kostenloses Konto einrichten';
      return card;
    }
    if (resultGenerations.has(result) && resultGenerations.get(result) !== currentGeneration()
      || result.access && !currentAccess(result.access)) return null;
    accept(result.access);
    if (!access || result.safetyLevel !== 'standard' || result.safetyMessage) return null;
    exp()?.track('web_answer_completed');
    if (!access.verified && !access.paid && (access.registeredAdditional > 0 || access.signupBeforePaywall === true) && (access.signupPlacement === 'after-first' || !access.remaining)) return offerCard({ reason: 'signup_required', doc, sentence, delay: signupDelay });
    if (access.unlimited === true && access.verified && !access.paid) return softPaywall(doc);
    if (!access.paid && !access.remaining) return offerCard({ reason: 'payment_required', doc });
    const notice = node(doc, 'p', access.paid ? (en ? 'Your membership is active.' : 'Deine Mitgliedschaft ist aktiv.') : (en ? `${access.remaining} introductory answers remaining.` : `Noch ${access.remaining} Antworten zum Ausprobieren.`)); notice.className = 'ki-angebot-klein'; return notice;
  }
  function supporterCard(doc = root.document) {
    const supporter = config.translatorGate?.supporter;
    // Payment stays hidden until an actual reviewed one-off product exists.
    if (!enabled() || access?.supporterPrompt !== 'after-helpful' || supporter?.enabled !== true || supporter?.reviewed !== true || supporter?.kind !== 'one-time') return null;
    const url = String(supporter.url || ''); if (!/^\/unterstuetzen\/[A-Za-z0-9/_-]*$/u.test(url)) return null;
    const card = node(doc, 'aside'); card.className = 'ki-angebot ki-supporter';
    const photo = doc.createElement('img'); photo.src = '/teller/debby-avatar.webp'; photo.alt = 'Debby Frey'; photo.width = 64; photo.height = 64;
    card.append(photo, node(doc, 'p', en ? 'Has DemenzCoach helped you? You can support its development with a voluntary, one-off contribution.' : 'Hat dir DemenzCoach geholfen? Mit einem freiwilligen, einmaligen Beitrag kannst du die Weiterentwicklung unterstützen.'));
    const link = node(doc, 'a', en ? 'Support voluntarily' : 'Freiwillig unterstützen'); link.href = url; link.addEventListener('click', () => exp()?.track('web_supporter_clicked'));
    card.append(link, node(doc, 'p', en ? 'No additional answers are included. — Debby Frey' : 'Damit sind keine zusätzlichen Antworten verbunden. — Debby Frey')); exp()?.track('web_supporter_shown'); return card;
  }
  async function mount() {
    signupCopyStatus = undefined;
    if (access) access = { ...access, signupCopy: undefined };
    if (!enabled()) return;
    const form = root.document?.querySelector('#translator-form'); if (!form) return;
    const generation = ++mountGeneration;
    const notice = root.document.getElementById('web-access-notice') || node(root.document, 'p', en ? 'Checking your introductory allowance …' : 'Dein kostenloser Einstieg wird geprüft …');
    notice.hidden = true; // Kontingent-Text bleibt unsichtbar (Daniel, 26. Nov); nur der Fehlerhinweis wird gezeigt.
    notice.id = 'web-access-notice'; notice.className = 'ki-angebot-klein'; notice.setAttribute('role', 'status'); form.prepend(notice);
    try {
      const value = await refresh();
      if (generation !== mountGeneration) return;
      if (value?.enabled !== true || value.needsSession === true) {
        notice.textContent = en ? 'Describe your situation to get started.' : 'Beschreibe deine Situation, um zu starten.';
        return;
      }
      notice.textContent = value.paid ? (en ? 'Your membership is active.' : 'Deine Mitgliedschaft ist aktiv.')
        : value.verified && value.unlimited === true ? (en ? 'You can keep asking for free.' : 'Du kannst weiter kostenlos fragen.')
        : value.verified ? (en ? `${value.remaining} introductory answers left, then paid membership.` : `Noch ${value.remaining} Antworten zum Ausprobieren, danach kostenpflichtige Mitgliedschaft.`)
        : value.signupBeforePaywall === true ? (en ? `${value.remaining} introductory answer(s) remaining without an account. Then a free account and paid membership.` : `${value.remaining} Antwort(en) noch ohne Konto ausprobieren. Danach kostenloses Konto und Mitgliedschaft.`)
        : (en ? `${value.remaining} introductory answer(s) remaining without an account. ${value.registeredAdditional} more with a verified account, then paid membership.` : `${value.remaining} Antwort(en) noch ohne Konto ausprobieren. ${value.registeredAdditional} weitere mit verifiziertem Konto, danach kostenpflichtige Mitgliedschaft.`);
      exp()?.track('web_access_viewed');
    } catch {
      if (generation !== mountGeneration) return;
      notice.hidden = false;
      notice.textContent = en ? 'Access is temporarily unavailable. Safety information remains available.' : 'Der Zugang ist gerade nicht verfügbar. Sicherheitshinweise bleiben erreichbar.';
    }
  }
  root.DemenzKiFreigabe = Object.freeze({ enabled, warm, createAccessContext, bindAccessResult, requestContext, refresh, accept, afterAnswer, supporterCard, offerCard, takePending, mount, accountURL,
    check: async () => ({ allowed: true, reason: 'server_enforced' }), noteAnswer(result) { accept(result?.access); }, returnPath, offerURL, signInURL: accountURL() });
  root.addEventListener?.('demenz-auth-changed', () => {
    if (observedAuth) observeAuth(observedAuth); else authGeneration++;
    mountGeneration++;
    access = undefined; signupCopyStatus = undefined; accessContractReady = false; headerPromise = null;
    clearCreditOffers(); void mount();
  });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true }); else void mount();
})(typeof window !== 'undefined' ? window : globalThis);
