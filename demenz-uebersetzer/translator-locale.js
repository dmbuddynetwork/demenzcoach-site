// Oberflächen-Texte des Demenz-Übersetzers in anderen Sprachen (zuerst Englisch).
// translator.js schreibt seine Texte auf Deutsch; steht in den Seitendaten eine Tabelle
// (data.ui), übersetzt diese Funktion jeden Text, bevor er auf der Seite erscheint:
// 1. genau dieser Text steht in ui.strings, 2. ein Muster aus ui.patterns passt
// (Texte mit eingesetzten Teilen), 3. sonst bleibt der Text, nur „…“ wird zu ui.quotes.
// Keine Netzwerk- oder Speicherzugriffe.
(function (root) {
  const create = (ui) => {
    if (!ui || typeof ui.strings !== 'object' || ui.strings === null) return (text) => text;
    const strings = ui.strings;
    const patterns = (ui.patterns ?? []).map(([source, replacement]) => [new RegExp(source, 'u'), replacement]);
    const [open, close] = Array.isArray(ui.quotes) && ui.quotes.length === 2 ? ui.quotes : ['„', '“'];
    return (text) => {
      if (typeof text !== 'string' || !text) return text;
      if (Object.prototype.hasOwnProperty.call(strings, text)) return strings[text];
      const pattern = patterns.find(([regex]) => regex.test(text));
      if (pattern) return text.replace(pattern[0], pattern[1]);
      return text.replace(/„([^„“]*)“/gu, `${open}$1${close}`);
    };
  };

  const api = { create };
  root.DemenzTranslatorLocale = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
