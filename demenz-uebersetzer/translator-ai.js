// KI-Zielklärung und Antwort für eingetippte Situationen. Bewusst geöffnete
// vorbereitete Situationsseiten bleiben lokal. Gesendet wird
// der eingegebene Satz (höchstens 200 Zeichen) und Sprache/Anrede. Bei aktiviertem
// Web-Zugang prüft der Server zusätzlich das Firebase-Konto und das Antwortkontingent.
// Teilen schickt allein die bereinigte Fassung der KI (mit Sprachkürzel außer Deutsch) zurück.
// Der Server (Demenz Coach, Firebase) prüft Notfälle, fragt OpenAI ohne
// Speicherung (store: false) und gibt nur geprüfte, kurze Antworten zurück.
(function (root) {
  const endpoint = 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web';
  const outcomesContract = 'outcomes-v1';
  // Englische Seiten (<html lang="en">) bitten um eine englische Antwort. Deutsch schickt kein Sprachfeld.
  const language = typeof document !== 'undefined' && /^en(?:-|$)/i.test(document.documentElement?.lang || '') ? 'en' : '';
  // Exact server templates approved independently; arbitrary medical text is not
  // promoted to a trusted general-information panel.
  const generalSafetyTexts = Object.freeze({
    de: 'Allgemeine Warnzeichen bei Schluckproblemen sind Husten oder Verschlucken beim Essen oder Trinken sowie eine feucht oder gurgelnd klingende Stimme oder Atemprobleme nach dem Essen oder Trinken. Schluckprobleme gehören ärztlich oder durch entsprechend qualifiziertes Fachpersonal abgeklärt. Bei schwerer Atemnot, fehlender Atmung oder Bewusstlosigkeit ruf sofort den örtlichen Notruf.',
    en: 'General warning signs of swallowing difficulties include coughing or choking when eating or drinking, or a wet or gurgly voice or breathing problems after eating or drinking. Swallowing difficulties need assessment by a doctor or appropriately qualified professional. If the person has severe trouble breathing, is not breathing or becomes unconscious, call the local emergency number immediately.'
  });
  const generalSafetyInfo = value => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === 'text,topic' && value.topic === 'swallowing'
    && value.text === generalSafetyTexts[language || 'de'] ? { topic: 'swallowing', text: value.text } : null;
  const validFixedSafety = value => value?.kind === 'safety' && (value.safetyLevel === 'urgent'
    || value.safetyLevel === 'concern' && typeof value.message === 'string' && value.message.trim().length > 0);

  const normalizedText = text => String(text).normalize('NFC').trim();
  const bodyFor = (text, { formal = false, goal } = {}) => ({ text,
    formal: language === 'en' ? false : formal === true, ...(language ? { language } : {}), ...(goal ? { goal } : {}), share: false });
  // Shared by goals and answers: transmit the complete normalized text or reject it.
  const requestIssue = (text, options = {}) => {
    const value = normalizedText(text);
    if (Array.from(value).length > 200) return 'text_too_long';
    if (new TextEncoder().encode(JSON.stringify(bodyFor(value, options))).byteLength > 2048) return 'body_too_large';
    return '';
  };
  const ask = async (text, { formal = false, correctionOf = "", requestID = "", goal } = {}) => {
    const accessContext = root.DemenzKiFreigabe?.createAccessContext?.();
    const finish = result => root.DemenzKiFreigabe?.bindAccessResult?.(result, accessContext) || result;
    const value = normalizedText(text);
    const issue = requestIssue(value, { formal, goal });
    if (issue) return { kind: 'error', reason: issue };
    const payload = bodyFor(value, { formal, goal });
    if (!requestID && root.DemenzKiFreigabe?.enabled()) requestID = root.crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint + '?response_contract=clarification-v1&goal_contract=' + outcomesContract, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', ...await root.DemenzKiFreigabe?.requestContext({ requestID, accessContext }), ...(correctionOf ? { 'X-Translator-Correction-Of': correctionOf } : {}) },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (response.status === 429) return { kind: 'error', reason: 'busy' };
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if ([401, 402, 409, 410, 503].includes(response.status) && ['signup_required', 'payment_required', 'authentication_required', 'access_unavailable', 'request_in_progress', 'request_completed', 'correction_unavailable', 'answer_recovery_credit', 'answer_unavailable'].includes(error.code)) return finish({ kind: 'access', reason: error.code, access: error.access });
        return { kind: 'error', reason: 'unavailable' };
      }
      const result = await response.json();
      const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
      const invalid = () => ({ kind: 'error', reason: 'unavailable', safetyLevel: result?.safetyLevel,
        safetyMessage: hasText(result?.safetyMessage) ? result.safetyMessage : '' });
      if (!result || typeof result.kind !== 'string') return invalid();
      if (result.kind === 'safety') return validFixedSafety(result) ? result : { kind: 'error', reason: 'unavailable' };
      if (Object.hasOwn(result, 'generalSafetyInfo') && !generalSafetyInfo(result.generalSafetyInfo)) return invalid();
      if (result.kind === 'clarification') {
        const within = (value, min, max) => hasText(value) && Array.from(value.normalize('NFC').trim()).length >= min && Array.from(value.normalize('NFC').trim()).length <= max;
        if (!within(result.question, 3, 180) || !result.question.trim().endsWith('?')
          || !within(result.meaning, 12, 420) || !within(result.nextStep, 8, 300)
          || result.safetyLevel !== 'standard' || result.safetyMessage !== null
          || ['phrases', 'avoid', 'share', 'publicSentence', 'requestID'].some(key => Object.hasOwn(result, key))) return invalid();
        return finish({ ...result, question: normalizedText(result.question), meaning: normalizedText(result.meaning), nextStep: normalizedText(result.nextStep) });
      }
      if (result.kind === 'self_support') {
        if (!hasText(result.meaning) || !hasText(result.avoid) || !hasText(result.nextStep)
          || !Array.isArray(result.steps) || result.steps.length < 1 || result.steps.length > 3 || !result.steps.every(hasText)
          || Object.hasOwn(result, 'phrases') || result.safetyLevel !== 'standard' || result.safetyMessage !== null) return invalid();
        return finish(result);
      }
      if (result.kind === 'answer') {
        const usable = hasText(result.meaning) && hasText(result.avoid)
          && Array.isArray(result.phrases) && result.phrases.length > 0 && result.phrases.every(hasText)
          && (result.nextStep == null || typeof result.nextStep === 'string')
          && (result.safetyMessage == null || typeof result.safetyMessage === 'string')
          && (result.safetyLevel == null || ['standard', 'concern', 'urgent'].includes(result.safetyLevel));
        // Eine beschädigte Antwort ist kein Erfolg. Bereits empfangene Sicherheitssignale
        // bleiben für die Fehleransicht erhalten; fehlende Beratung wird nicht ergänzt.
        if (!usable) return invalid();
      }
      // Alle Antworttypen benutzen denselben Textvertrag, auch error/off_topic
      // oder unbekannte Typen mit einem bereits empfangenen Sicherheitssignal.
      return finish({ ...result, safetyMessage: hasText(result.safetyMessage) ? result.safetyMessage : '' });
    } catch {
      return { kind: 'error', reason: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  };

  // Freiwillig und erst nach Antippen von „Anonym teilen“: Zurück geht nur die von der KI
  // bereinigte Fassung samt Server-Prüfzeichen, nie der eingegebene Satz.
  // Andere Sprachen als Deutsch schicken ihr Kürzel mit (der Server prüft es mit dem Prüfzeichen).
  const share = async ({ sentence, token, language: shareLanguage, undo = false } = {}) => {
    if (typeof sentence !== 'string' || typeof token !== 'string') return false;
    const payload = { sentence, token };
    if (typeof shareLanguage === 'string' && shareLanguage !== 'de') payload.language = shareLanguage;
    if (undo === true) payload.undo = true;
    try {
      const response = await fetch(`${endpoint}/share`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const askGoals = async (text, { formal = false } = {}) => {
    const textValue = normalizedText(text);
    const issue = requestIssue(textValue, { formal });
    if (issue) return { kind: 'error', reason: issue };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${endpoint}/goals?goal_contract=${outcomesContract}`, { method: 'POST', mode: 'cors', credentials: 'omit',
        referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFor(textValue, { formal })), signal: controller.signal });
      if (!response.ok) return { kind: 'error', reason: response.status === 429 ? 'busy' : 'unavailable' };
      const value = await response.json();
      if (validFixedSafety(value)) return value;
      if (value && Object.hasOwn(value, 'generalSafetyInfo') && !generalSafetyInfo(value.generalSafetyInfo)) return { kind: 'error', reason: 'unavailable' };
      // Accept both generations during the coordinated Site/API rollout.
      const ids = ['choice_1','choice_2','choice_3','act_now','prepare_talk','rephrase','understand','organize','self_care'];
      if (value?.contract === outcomesContract) {
        if (value.kind === 'off_topic') return value;
        if (value.kind === 'goal_clarification') return typeof value.question === 'string' && value.question.trim().endsWith('?')
          && Array.from(value.question.normalize('NFC').trim()).length >= 3 && Array.from(value.question.normalize('NFC').trim()).length <= 200 && Array.isArray(value.goals) && value.goals.length === 0
          ? value : { kind: 'error', reason: 'unavailable' };
        if (value.kind !== 'goals' || !['explicit','guessed'].includes(value.selectionMode) || !Array.isArray(value.goals)
          || value.goals.length < 1 || value.goals.length > (value.selectionMode === 'explicit' ? 1 : 3)
          || value.goals.some(g => !ids.includes(g?.goal) || typeof g.label !== 'string' || !g.label.trim() || Array.from(g.label.normalize('NFC').trim()).length > 64)
          || new Set(value.goals.map(g => g.goal)).size !== value.goals.length
          || new Set(value.goals.map(g => g.label.normalize('NFC').trim().toLocaleLowerCase())).size !== value.goals.length) return { kind: 'error', reason: 'unavailable' };
        return value;
      }
      if (value?.contract != null) return { kind: 'error', reason: 'unavailable' };
      if (value?.kind !== 'goals' || !Array.isArray(value.goals)
        || !(value.noSituation === true && value.goals.length === 0 || value.noSituation === false && value.goals.length === 3)
        || value.goals.some(g => !ids.includes(g?.goal) || typeof g.label !== 'string' || !g.label.trim() || g.label.length > 64)
        || new Set(value.goals.map(g => g.goal)).size !== value.goals.length) return { kind: 'error', reason: 'unavailable' };
      return value;
    } catch { return { kind: 'error', reason: 'unavailable' }; }
    finally { clearTimeout(timer); }
  };
  root.DemenzTranslatorAI = { ask, askGoals, share, requestIssue, generalSafetyInfo, endpoint };
})(typeof window !== 'undefined' ? window : globalThis);
