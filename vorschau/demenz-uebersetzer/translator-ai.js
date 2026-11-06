// KI-Antwort für Sätze, die der Übersetzer nicht kennt.
// Wird nur aufgerufen, wenn jemand ausdrücklich „KI fragen“ tippt. Gesendet wird
// nur der eingegebene Satz (höchstens 200 Zeichen) – ohne Cookies, ohne Kennung.
// Der Server (Demenz Coach, Firebase) prüft Notfälle, fragt OpenAI ohne
// Speicherung (store: false) und gibt nur geprüfte, kurze Antworten zurück.
(function (root) {
  const endpoint = 'https://europe-west1-dementica-df17b.cloudfunctions.net/api/v1/translator-web';

  const ask = async (text) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text).trim().slice(0, 200) }),
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

  root.DemenzTranslatorAI = { ask, endpoint };
})(typeof window !== 'undefined' ? window : globalThis);
