// Satzerkennung des Demenz-Übersetzers. Läuft im Browser und in Node-Tests.
// Kein Netzwerk, kein Speichern: reine Funktion von Text → Ergebnis-Schlüssel.
(function (root) {
  // Umgangssprache und häufige Kurzformen auf Schriftdeutsch bringen.
  const replacements = [
    [/\bnix\b/g, 'nichts'],
    [/\bnet\b/g, 'nicht'],
    [/\bned\b/g, 'nicht'],
    [/\bhab\b/g, 'habe'],
    [/\bkenn\b/g, 'kenne'],
    [/\bwill\s+heim\b/g, 'will nach hause'],
    [/\bmutti\b/g, 'mama'],
    [/\bvati\b/g, 'papa']
  ];

  const normalize = (text) => {
    let value = String(text)
      .toLowerCase()
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    replacements.forEach(([pattern, replacement]) => {
      value = value.replace(pattern, replacement);
    });
    return ` ${value} `;
  };

  // Höchstens ein Tippfehler: ersetzt, fehlend, zu viel oder zwei Buchstaben vertauscht.
  const distanceAtMostOne = (a, b) => {
    if (a === b) return true;
    if (a.length === b.length) {
      const diff = [...a].map((char, index) => (char === b[index] ? -1 : index)).filter((index) => index >= 0);
      if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
    }
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i += 1;
        j += 1;
        continue;
      }
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };

  // Treffer zählen am Wortanfang (fängt Beugungen wie „Tabletten“ ab), aber nicht
  // mitten im Wort („erwachsen“ ist kein „wach“). Lange Einzelwörter dürfen einen
  // Tippfehler enthalten.
  const keywordWeight = (normalized, tokens, keyword) => {
    const wordCount = keyword.split(' ').length;
    const base = wordCount + keyword.length / 20;
    if (normalized.includes(` ${keyword} `)) return base * 2;
    if (normalized.includes(` ${keyword}`)) return base * 1.5;
    if (wordCount === 1 && keyword.length >= 6) {
      const fuzzy = tokens.some((token) => token.length >= 5
        && (distanceAtMostOne(token, keyword) || distanceAtMostOne(token.slice(0, keyword.length), keyword)));
      if (fuzzy) return base;
    }
    return 0;
  };

  const rank = (text, entries) => {
    const normalized = normalize(text);
    const tokens = normalized.trim().split(' ').filter(Boolean);
    return entries
      .map((entry) => ({
        entry,
        score: entry.keywords.reduce((total, keyword) => total + keywordWeight(normalized, tokens, keyword), 0)
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
  };

  const hasSafetySignal = (text, keywords) => {
    const normalized = normalize(text);
    return keywords.some((keyword) => normalized.includes(` ${keyword}`));
  };

  const match = (text, data) => {
    const ranked = rank(text, data.entries);
    const best = ranked[0] ?? null;
    const alternatives = best
      ? ranked.slice(1).filter((candidate) => candidate.score >= best.score * 0.5 && !candidate.entry.safetyOnly).slice(0, 2)
      : [];
    // Kein bekannter Satz, aber ein Gefühlswort („Sie hat Angst“)? Dann zum Gefühl.
    const feeling = best ? null : rank(text, (data.feelings ?? []).map((item) => ({ ...item, keywords: item.keywords ?? [] })))[0]?.entry ?? null;
    // Mehrere Anliegen in einer Eingabe („Wo ist Mama? Ich will heim.“): jeden Satzteil
    // einzeln prüfen und weitere Treffer als „Auch in deiner Eingabe“ anbieten.
    const parts = String(text).split(/[.!?;\n]+|,\s*(?:und|aber)\s+|\s+und\s+(?=(?:ich|du|er|sie|wo|wann|wer|das|da|mir|mich|lass|will|muss|kann|sagt|hat|ist|habe)\b)/i)
      .map((part) => part.trim())
      .filter((part) => part.split(/\s+/).length >= 2);
    const shown = new Set([best?.entry.key]);
    const also = [];
    if (parts.length > 1) {
      parts.forEach((part) => {
        const top = rank(part, data.entries)[0]?.entry;
        if (top && !top.safetyOnly && !shown.has(top.key)) {
          shown.add(top.key);
          also.push(top);
        }
      });
    }
    return {
      feeling,
      also: also.slice(0, 2),
      entry: best?.entry ?? null,
      alternatives: alternatives.map((candidate) => candidate.entry).filter((entry) => !also.includes(entry)),
      safetyHit: hasSafetySignal(text, data.safetySignals.keywords)
    };
  };

  // Persönliche Antwortsätze: du/Sie, wie die Person angesprochen wird, eigener
  // Name und Beziehung. Alles bleibt im Browser; nichts davon wird gespeichert.
  const roles = {
    Tochter: 'f', Sohn: 'm', Frau: 'f', Mann: 'm', Partnerin: 'f', Partner: 'm',
    Enkelin: 'f', Enkel: 'm', Schwiegertochter: 'f', Schwiegersohn: 'm', Nichte: 'f', Neffe: 'm'
  };
  const keepCapital = /^(Sie|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres|Ihnen|Anna|Peter|Dr\.)$/;
  const clean = (value) => String(value ?? '').replace(/[<>„“"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

  const personalize = (text, settings = {}, formal = {}) => {
    let result = settings.formal && formal[text] ? formal[text] : text;
    const me = clean(settings.me);
    const role = roles[settings.role] ? settings.role : '';
    if (role) {
      const owner = settings.formal ? (roles[role] === 'f' ? 'Ihre' : 'Ihr') : (roles[role] === 'f' ? 'deine' : 'dein');
      result = result.replace(/Anna, (deine|Ihre) Tochter/, me ? `${me}, ${owner} ${role}` : `${owner} ${role}`);
    } else if (me) {
      result = result.replace(/Anna, (deine|Ihre) Tochter\./, `${me}.`);
    }
    if (me) result = result.replace(/\bAnna\b/g, me);
    const callName = clean(settings.callName);
    if (callName) {
      const [first, ...rest] = result.split(' ');
      const word = keepCapital.test(first) || first === me ? first : first.charAt(0).toLowerCase() + first.slice(1);
      result = `${callName}, ${[word, ...rest].join(' ')}`;
    }
    return result;
  };

  const api = { normalize, rank, match, personalize, roles: Object.keys(roles) };
  root.DemenzTranslatorCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
