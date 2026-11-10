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

  const ask = async (text, { formal = false, correctionOf = "", requestID = "" } = {}) => {
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
        body: JSON.stringify(language === 'en'
          ? { text: String(text).trim().slice(0, 200), formal: false, language: 'en' }
          : { text: String(text).trim().slice(0, 200), formal: formal === true }),
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

  root.DemenzTranslatorAI = { ask, share, endpoint };
})(typeof window !== 'undefined' ? window : globalThis);
