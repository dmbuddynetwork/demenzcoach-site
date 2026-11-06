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
    // Umgangssprache und leichter Dialekt, wie man im Moment schnell tippt.
    [/\bnich\b/g, 'nicht'],
    [/\bis\b/g, 'ist'],
    [/\bisch\b/g, 'ich'],
    [/^i\b/, 'ich'],
    [/\bgehts\b/g, 'geht es'],
    [/\bgibts\b/g, 'gibt es'],
    [/\bmei\b/g, 'mein'],
    [/\bhoam\b/g, 'heim'],
    [/\bwill\s+ham\b/g, 'will heim'],
    [/\bwill\s+heim\b/g, 'will nach hause'],
    // So tippen viele Ältere auf dem Handy: nach Gehör, Endungen auf „-a“, einfache Buchstaben.
    [/\bsint\b/g, 'sind'],
    [/\bmus\b/g, 'muss'],
    [/\bire\b/g, 'ihre'],
    [/\bmene\b/g, 'meine'],
    [/\bhir\b/g, 'hier'],
    [/\bbet\b/g, 'bett'],
    [/\bluge\b/g, 'luege'],
    [/\b(kind|mutt|vat|hung|imm|wied|schwest|brud)a\b/g, '$1er'],
    // Runde 126: weitere Kurzformen und Dialekt, wie sie im Stress getippt werden.
    [/\bmudder\b/g, 'mutter'],
    [/\bvadder\b/g, 'vater'],
    [/\bbisn\b/g, 'bist du'],
    [/\bbinn\b/g, 'bin'],
    [/\bgehn\b/g, 'gehen'],
    [/\babhaun\b/g, 'abhauen'],
    [/\bvonner\b/g, 'von der'],
    [/\bgegesen\b/g, 'gegessen'],
    [/\blue(?:chst|gs)\b/g, 'luegst'],
    [/\bzieh mich\b/g, 'ziehe mich'],
    [/\bselber\b/g, 'selbst'],
    [/\bfahr selbst\b/g, 'fahre selbst'],
    [/\bbleib (heute )?im bett\b/g, 'bleibe $1im bett'],
    // Notfälle mit Tippfehlern müssen trotzdem den Sicherheitshinweis auslösen.
    [/\bgestuer?tzt\b/g, 'gestuerzt'],
    [/\bhingefal+en\b/g, 'hingefallen'],
    [/\bbewus+tlos\b/g, 'bewusstlos'],
    [/\bmutti\b/g, 'mama'],
    [/\bvati\b/g, 'papa']
  ];

  const speaker = /^(?:(?:mein|meine|unser|unsere|die|der) )?(?:vater|mutter|mama|mami|mutti|papa|vati|mann|frau|ehemann|ehefrau|partner|partnerin|oma|opa|omi|opi|schwiegermutter|schwiegervater|tante|onkel|bruder|schwester|patient|patientin|bewohner|bewohnerin|er|sie) (?=(?:sagt|meint|behauptet|denkt|glaubt|fragt|erzaehlt|ruft|will|erkennt|haelt|sucht|weiss|schreit|steht|isst|redet|spricht|langweilt|traut|wirft|weint|ist|wird|hat|laeuft|spuckt|sitzt|packt|versteckt|zieht|schlaeft|trinkt|schlaegt|beschimpft|bleibt|liegt|lacht|schimpft|kann|macht|geht|nimmt|klaut|sammelt|raeumt|vergisst|verweigert|beisst|kratzt|haut|tritt|jammert|klagt)\b)/;
  const sayingVerb = /^(?:sagt|meint|behauptet|denkt|glaubt|erzaehlt)(?: (?:immer|staendig|dauernd|oft|wieder|jeden tag|abends|nachts))*(?: dass)? /;

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
    // Beschreibungen aus Sicht der Angehörigen („Mein Vater sagt immer, dass …“):
    // Wer spricht, ist nicht das Thema – sonst würde „Vater“ als Sehnsucht nach
    // den Eltern erkannt. Erst die Person, dann das Redeverb entfernen.
    value = value.replace(speaker, '').replace(sayingVerb, '');
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
  // Ein „=“ vorne heißt: nur als ganzes Wort („=klo“ trifft „Klo“, aber nicht „kloppen“).
  // Richtig geschriebene häufige Wörter sind keine Tippfehler: „Schuhe“ ist nicht „Schule“,
  // „sauer“ nicht „sauber“, „schreiben“ nicht „schreien“, „schlucken“ nicht „Schmuck“.
  const noFuzzy = new Set(['nichts', 'schreiben', 'schreibt', 'schreibe', 'schreib', 'stimmung', 'schlucken', 'schluckt', 'schluck', 'schmeckt',
    'kauen', 'kaut', 'schuld', 'schuhe', 'schuhen', 'melden', 'merken', 'sauer', 'allen', 'kennen', 'legen', 'stellen', 'stiller',
    'muster', 'stammen', 'einladen', 'abbauen', 'baden', 'malen', 'spielen', 'singen', 'lesen', 'anrufer']);

  const keywordWeight = (normalized, tokens, rawKeyword) => {
    const wholeWordOnly = rawKeyword.startsWith('=');
    const keyword = wholeWordOnly ? rawKeyword.slice(1) : rawKeyword;
    if (wholeWordOnly) return normalized.includes(` ${keyword} `) ? (1 + keyword.length / 20) * 2 : 0;
    // Ein „$“ hinten heißt: nur am Ende der Eingabe („Ich kann nicht mehr“, aber nicht „… mehr laufen“).
    if (keyword.endsWith('$')) {
      const phrase = keyword.slice(0, -1);
      return normalized.endsWith(` ${phrase} `) ? (phrase.split(' ').length + phrase.length / 20) * 2 : 0;
    }
    const wordCount = keyword.split(' ').length;
    const base = wordCount + keyword.length / 20;
    if (normalized.includes(` ${keyword} `)) return base * 2;
    if (normalized.includes(` ${keyword}`)) return base * 1.5;
    if (wordCount === 1 && keyword.length >= 6) {
      const fuzzy = tokens.some((token) => token.length >= 5 && !noFuzzy.has(token)
        // Wortanfang mit Tippfehler nur bei längeren Suchwörtern: sonst wird „schlägt“ zu „schlaf“.
        && (distanceAtMostOne(token, keyword) || (keyword.length >= 7 && distanceAtMostOne(token.slice(0, keyword.length), keyword))));
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

  const moodIds = ['wut', 'trauer', 'angst'];

  const match = (text, data) => {
    let ranked = rank(text, data.entries);
    // Sicherheits- und Entlastungssätze merken, bevor Gefühlswörter entfernt werden:
    // „Ich bin so wütend auf sie“ ist ein Satz über die Angehörigen selbst.
    const initialSafety = ranked.find((candidate) => candidate.entry.safetyOnly);
    // Starkes Gefühl in einer beschriebenen Situation („Er ist wütend und will zur Arbeit“):
    // Das Gefühl soll nicht das Thema überdecken. Ohne Gefühlswörter neu suchen und das
    // Gefühl als kurze erste Antwort mitgeben („Erst trösten …“).
    const moodFeelings = (data.feelings ?? []).filter((item) => moodIds.includes(item.id));
    let mood = ranked.length ? rank(text, moodFeelings)[0]?.entry ?? null : null;
    const withoutMood = (value) => (mood ? mood.keywords.reduce((result, keyword) => result.replace(new RegExp(` ${keyword}\\S*`, 'g'), ' '), normalize(value)) : value);
    if (mood) {
      const topic = rank(withoutMood(text), data.entries);
      // Kennt die Situation selbst eine Wendung mit dem Gefühlswort („schreit nachts“), bleibt sie vorn.
      const normalizedText = normalize(text);
      const tokens = normalizedText.trim().split(' ').filter(Boolean);
      const moodPhrase = ranked[0].entry.keywords.some((keyword) => keyword.includes(' ')
        && mood.keywords.some((word) => keyword.replace(/^=/, '').split(' ').includes(word))
        && keywordWeight(normalizedText, tokens, keyword) > 0);
      if (!moodPhrase && topic.length && topic[0].entry.key !== ranked[0].entry.key) {
        // Alternativen ebenfalls ohne Gefühlswörter, sonst steht „Lass mich in Ruhe“ nur wegen „wütend“ daneben.
        ranked = topic;
      }
      // „Lass mich in Ruhe“ beantwortet Wut schon selbst.
      if (mood.id === 'wut' && ranked[0].entry.key === 'ruhe') mood = null;
    }
    // Lebensmüde Sätze („Lass mich sterben“) gehen immer vor, auch wenn „lass mich“ mehr Punkte hat.
    if (initialSafety && !ranked.some((candidate) => candidate.entry.key === initialSafety.entry.key)) ranked = [initialSafety, ...ranked];
    const safetyFirst = ranked.find((candidate) => candidate.entry.safetyOnly);
    // Schreiben Angehörige über sich selbst, gibt es keinen Beruhigungssatz für die erkrankte Person davor.
    if (safetyFirst?.entry.selfCare) mood = null;
    if (safetyFirst && ranked[0] !== safetyFirst) ranked = [safetyFirst, ...ranked.filter((candidate) => candidate !== safetyFirst)];
    const best = ranked[0] ?? null;
    const alternatives = best
      ? ranked.slice(1).filter((candidate) => candidate.score >= best.score * 0.5 && !candidate.entry.safetyOnly).slice(0, 2)
      : [];
    // Kein bekannter Satz, aber ein Gefühlswort („Sie hat Angst“)? Dann zum Gefühl.
    const feeling = best ? null : rank(text, (data.feelings ?? []).map((item) => ({ ...item, keywords: item.keywords ?? [] })))[0]?.entry ?? null;
    // Mehrere Anliegen in einer Eingabe („Wo ist Mama? Ich will heim.“): jeden Satzteil
    // einzeln prüfen und weitere Treffer als „Auch in deiner Eingabe“ anbieten.
    const parts = String(text).split(/[.!?;\n]+|,\s*(?:(?:und|aber|oder)\s+)?|\s+(?:und|aber|oder)\s+/i)
      .map((part) => part.trim())
      .filter((part) => part.split(/\s+/).length >= 2)
      // Fragen der Angehörigen selbst („Was soll ich tun“, „Darf ich lügen“) sind kein weiteres Anliegen.
      .filter((part) => !/^ (?:was|wie|darf|soll|kann|muss)(?: (?:soll|kann|darf|muss))? (?:ich|man)\b/.test(normalize(part)));
    const shown = new Set([best?.entry.key]);
    const also = [];
    if (parts.length > 1) {
      parts.forEach((part) => {
        const top = rank(withoutMood(part), data.entries)[0]?.entry;
        if (top && !top.safetyOnly && !shown.has(top.key)) {
          shown.add(top.key);
          also.push(top);
        }
      });
    }
    return {
      feeling,
      mood,
      also: also.slice(0, 3),
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

  // Kein Treffer? Dann die Situationen mit den meisten gemeinsamen Wortanfängen anbieten
  // („Er versteckt seine Sachen“ → Geld, „Sie zieht sich dauernd aus“ → Umziehen).
  const stopwords = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'dein', 'deine', 'sein', 'seine', 'ihre', 'ihren', 'das', 'der', 'die', 'und', 'ist', 'bin', 'hat', 'habe', 'nicht', 'will', 'muss', 'kann', 'immer', 'wieder', 'sagt', 'mir', 'mich', 'dir', 'dich', 'sich', 'was', 'wie', 'wo', 'wann', 'warum', 'ein', 'eine', 'einen', 'noch', 'schon', 'so', 'da', 'hier', 'jetzt', 'mal', 'auch', 'doch', 'den', 'dem', 'zu', 'im', 'in', 'mit', 'von', 'auf', 'fuer', 'aber', 'dann', 'denn', 'oder', 'staendig', 'dauernd', 'ganz', 'gar', 'sehr', 'alles', 'nichts', 'heute', 'gerade', 'einfach', 'wird', 'sind', 'haben', 'werden', 'kein', 'keine', 'keinen']);
  const contentWords = (text) => normalize(text).trim().split(' ').filter((word) => word.length >= 4 && !stopwords.has(word));
  const stem = (word) => word.slice(0, word.length >= 8 ? 6 : 5);
  // Für „Meinst du vielleicht“ zählen nur Wörter mit Inhalt: Fürwörter und
  // Allerweltswörter („seinem“, „fragt“, „morgen“) führten zu schiefen Vorschlägen.
  const weakWords = new Set(['ihrem', 'ihrer', 'ihren', 'ihre', 'seinem', 'seiner', 'seinen', 'seine', 'meinem', 'meiner', 'meinen', 'meine',
    'deinem', 'deiner', 'deinen', 'deine', 'nach', 'fragt', 'fragen', 'ganze', 'ganzen', 'zeit', 'weiss', 'zieht', 'immer', 'wieder',
    'dauernd', 'staendig', 'redet', 'reden', 'sagt', 'sagen', 'morgen', 'heute', 'behauptet', 'will', 'wollen', 'macht', 'machen']);
  const near = (text, data, limit = 2) => {
    const words = contentWords(text).filter((word) => !weakWords.has(word));
    if (!words.length) return [];
    const ranked = data.entries
      .filter((entry) => !entry.safetyOnly)
      .map((entry) => {
        const vocab = new Set([entry.says, ...(entry.variants ?? []), ...entry.keywords.map((keyword) => keyword.replace(/^=/, ''))].flatMap(contentWords).map(stem));
        return { entry, score: words.filter((word) => vocab.has(stem(word))).length };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
    // Nur die besten Treffer: Ein Vorschlag mit weniger gemeinsamen Wörtern ist meist Zufall.
    return ranked.filter((candidate) => candidate.score === ranked[0]?.score).slice(0, limit).map((candidate) => candidate.entry);
  };

  const api = { normalize, rank, match, near, personalize, roles: Object.keys(roles) };
  root.DemenzTranslatorCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
