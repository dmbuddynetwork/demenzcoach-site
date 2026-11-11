// KI-Antwort für Sätze, die der Übersetzer nicht kennt.
// Wird nur für Sätze aufgerufen, die die feste Liste nicht kennt (automatisch, Hinweis unter dem Feld). Gesendet wird
// der eingegebene Satz (höchstens 200 Zeichen) und Sprache/Anrede. Bei aktiviertem
// Web-Zugang prüft der Server zusätzlich das Firebase-Konto und das Antwortkontingent.
// Teilen schickt allein die bereinigte Fassung der KI (mit Sprachkürzel außer Deutsch) zurück.
// Der Server (Demenz Coach, Firebase) prüft Notfälle, fragt OpenAI ohne
// Speicherung (store: false) und gibt nur geprüfte, kurze Antworten zurück.
(function (root) {
  const endpoint = 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web';
  // Englische Seiten (<html lang="en">) bitten um eine englische Antwort. Deutsch schickt kein Sprachfeld.
  const language = typeof document !== 'undefined' && document.documentElement?.lang === 'en' ? 'en' : '';
  const validFixedSafety = value => value?.kind === 'safety' && (value.safetyLevel === 'urgent'
    || value.safetyLevel === 'concern' && typeof value.message === 'string' && value.message.trim().length > 0);

  const ask = async (text, { formal = false, correctionOf = "", requestID = "", goal } = {}) => {
    if (!requestID && root.DemenzKiFreigabe?.enabled()) requestID = root.crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', ...await root.DemenzKiFreigabe?.requestContext({ requestID }), ...(correctionOf ? { 'X-Translator-Correction-Of': correctionOf } : {}) },
        body: JSON.stringify({ text: String(text).trim().slice(0, 200), formal: language === 'en' ? false : formal === true,
          ...(language ? { language } : {}), ...(goal ? { goal } : {}), share: false }),
        signal: controller.signal
      });
      if (response.status === 429) return { kind: 'error', reason: 'busy' };
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if ([401, 402, 409, 410, 503].includes(response.status) && ['signup_required', 'payment_required', 'authentication_required', 'access_unavailable', 'request_in_progress', 'request_completed', 'correction_unavailable', 'answer_recovery_credit', 'answer_unavailable'].includes(error.code)) return { kind: 'access', reason: error.code, access: error.access };
        return { kind: 'error', reason: 'unavailable' };
      }
      const result = await response.json();
      const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
      const invalid = () => ({ kind: 'error', reason: 'unavailable', safetyLevel: result?.safetyLevel,
        safetyMessage: hasText(result?.safetyMessage) ? result.safetyMessage : '' });
      if (!result || typeof result.kind !== 'string') return invalid();
      if (result.kind === 'safety') return validFixedSafety(result) ? result : { kind: 'error', reason: 'unavailable' };
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
      return { ...result, safetyMessage: hasText(result.safetyMessage) ? result.safetyMessage : '' };
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${endpoint}/goals`, { method: 'POST', mode: 'cors', credentials: 'omit',
        referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text).trim().slice(0, 200), formal: language === 'en' ? false : formal === true,
          ...(language ? { language } : {}), share: false }), signal: controller.signal });
      if (!response.ok) return { kind: 'error', reason: response.status === 429 ? 'busy' : 'unavailable' };
      const value = await response.json();
      if (validFixedSafety(value)) return value;
      // Accept both generations during the coordinated Site/API rollout.
      const ids = ['choice_1','choice_2','choice_3','act_now','prepare_talk','rephrase','understand','organize','self_care'];
      if (value?.kind !== 'goals' || !Array.isArray(value.goals)
        || !(value.noSituation === true && value.goals.length === 0 || value.noSituation === false && value.goals.length === 3)
        || value.goals.some(g => !ids.includes(g?.goal) || typeof g.label !== 'string' || !g.label.trim() || g.label.length > 64)
        || new Set(value.goals.map(g => g.goal)).size !== value.goals.length) return { kind: 'error', reason: 'unavailable' };
      return value;
    } catch { return { kind: 'error', reason: 'unavailable' }; }
    finally { clearTimeout(timer); }
  };
  root.DemenzTranslatorAI = { ask, askGoals, share, endpoint };
})(typeof window !== 'undefined' ? window : globalThis);
