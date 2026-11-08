// KI-Antwort für Sätze, die der Übersetzer nicht kennt.
// Wird nur für Sätze aufgerufen, die die feste Liste nicht kennt (automatisch, Hinweis unter dem Feld). Gesendet wird
// nur der eingegebene Satz (höchstens 200 Zeichen) und ob du oder Sie – ohne Cookies, ohne Kennung.
// Teilen (nur auf Knopfdruck) schickt allein die bereinigte Fassung der KI zurück.
// Der Server (Demenz Coach, Firebase) prüft Notfälle, fragt OpenAI ohne
// Speicherung (store: false) und gibt nur geprüfte, kurze Antworten zurück.
(function (root) {
  const endpoint = 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web';
  // Englische Seiten (<html lang="en">) bitten um eine englische Antwort. Deutsch schickt kein Sprachfeld.
  const language = typeof document !== 'undefined' && document.documentElement?.lang === 'en' ? 'en' : '';

  const ask = async (text, { formal = false } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(language === 'en'
          ? { text: String(text).trim().slice(0, 200), formal: false, language: 'en' }
          : { text: String(text).trim().slice(0, 200), formal: formal === true }),
        signal: controller.signal
      });
      if (response.status === 429) return { kind: 'error', reason: 'busy' };
      if (!response.ok) return { kind: 'error', reason: 'unavailable' };
      const result = await response.json();
      return result && typeof result.kind === 'string' ? result : { kind: 'error', reason: 'unavailable' };
    } catch {
      return { kind: 'error', reason: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  };

  // Freiwillig und erst nach Antippen von „Anonym teilen“: Zurück geht nur die von der KI
  // bereinigte Fassung samt Server-Prüfzeichen, nie der eingegebene Satz.
  const share = async ({ sentence, token, undo = false } = {}) => {
    if (typeof sentence !== 'string' || typeof token !== 'string') return false;
    try {
      const response = await fetch(`${endpoint}/share`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(undo === true ? { sentence, token, undo: true } : { sentence, token })
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  root.DemenzTranslatorAI = { ask, share, endpoint };
})(typeof window !== 'undefined' ? window : globalThis);
