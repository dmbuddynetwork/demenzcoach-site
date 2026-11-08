// Sätze merken (Daniel, 8. Nov 2026): Gemerkte Sätze bleiben nur in diesem Browser (localStorage)
// und werden nie gesendet. Gemerkt werden nur Sätze aus den festen, geprüften Antworten: Schlüssel
// der Situation, ihre Überschrift und der Satz im Original. Nie die Eingabe, nie eine KI-Antwort,
// nie Namen aus „Sätze persönlich machen“ (die setzt die Seite erst beim Anzeigen ein).
// Nur auf ausdrücklichen Tipp auf „Merken“ (§ 25 Abs. 2 Nr. 2 TDDDG: vom Nutzer gewünschte Funktion).
(function (root) {
  const storageKey = 'demenzcoach.savedPhrases.v1';
  const limit = 50;
  const listeners = new Set();
  const clean = (item) => ({ key: String(item.key).slice(0, 60), says: String(item.says || '').slice(0, 200), text: String(item.text).slice(0, 400) });
  const read = () => {
    try {
      const value = JSON.parse(root.localStorage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item.key === 'string' && typeof item.text === 'string').map(clean) : [];
    } catch (error) {
      return [];
    }
  };
  const notify = () => listeners.forEach((listener) => { try { listener(); } catch (error) { /* weiter mit den anderen */ } });
  const write = (items) => {
    try {
      if (items.length) root.localStorage.setItem(storageKey, JSON.stringify(items.slice(0, limit)));
      else root.localStorage.removeItem(storageKey);
    } catch (error) {
      return false;
    }
    notify();
    return true;
  };
  const same = (a, b) => a.key === b.key && a.text === b.text;
  root.DemenzSavedPhrases = {
    list: read,
    has: (item) => read().some((saved) => same(saved, item)),
    // Gibt zurück, ob der Satz danach gemerkt ist.
    toggle(item) {
      const items = read();
      const index = items.findIndex((saved) => same(saved, item));
      if (index >= 0) {
        items.splice(index, 1);
        write(items);
        return false;
      }
      return write([clean(item), ...items]);
    },
    remove(item) {
      write(read().filter((saved) => !same(saved, item)));
    },
    onChange(listener) {
      listeners.add(listener);
    }
  };
  // Zweiter Tab derselben Seite: Liste angleichen.
  root.addEventListener('storage', (event) => { if (event.key === storageKey) notify(); });
})(window);
