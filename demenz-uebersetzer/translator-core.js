// Satzerkennung des Demenz-Übersetzers. Läuft im Browser und in Node-Tests.
// Kein Netzwerk, kein Speichern: reine Funktion von Text → Ergebnis-Schlüssel.
(function (root) {
  // BEGIN frozen web-only absence adapter: backend 98527b6, module SHA256 806f04ed233e7f0a3d9b13e6960e1385994e8abc543a1673ba107d15b5483ab3
// Web-only polarity adapter for explicit present-tense absence statements.
// It is not a clinical assessment. Questions about the medical state, bare
// uncertainty, reported text and positive cues stay unmasked for shared guards.
const questionStart = /\b(?:was|wie|warum|wieso|weshalb|wann|wo|wohin|woher|wer|wen|wem|wessen|welch\p{L}*|woran|womit|wozu|wobei|ob|stimmt\s+(?:das|dies|es)|stimmt['’]s|what|how|why|when|where|who|whom|whose|which|whether|(?:kann|könnte|koennte|soll|sollte|darf|dürfte|duerfte|muss|müsste|muesste|ist|bist|bin|seid|sind|war|warst|wart|waren|hat|hast|habt|haben)\s+(?:ich|du|er|sie|wir|ihr|man|das|dies|es|die person)|(?:can|could|should|may|must|is|are|was|were|has|have|do|does|did|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t)\s+(?:i|you|he|she|we|they|it|this|that|the person))\b/iu;
const statementDoubt = /\b(?:vielleicht|womöglich|womoeglich|falls|wenn|ob|glaub\w*|denk\w*|vermut\w*|schein\w*|oder doch|nicht sicher|unsicher|unklar|fraglich|ungewiss|geraten|unbestätigt|unbestaetigt|maybe|perhaps|if|whether|think|unsure|uncertain|unclear|guess\w*|not confirmed|not sure|don['’]?t know|do not know|cannot tell|can['’]?t tell)\b|\b(?:wei(?:ß|ss)|wissen)(?=\s|[.!?,;]|$)/iu;
// A question can refer back to the medical assertion without repeating its cue.
const questionDoubt = /\b(?:unklar|unsicher|fraglich|ungewiss|vielleicht|glaub\w*|denk\w*|vermut\w*|unsure|uncertain|unclear|maybe|perhaps|guess\w*|not sure|stimmt)\b|\b(?:bist|sind|ist|bin)\b.{0,20}\b(?:sicher|gewiss)\b|\b(?:are|is|am|aren['’]?t|isn['’]?t)\b.{0,20}\bsure\b|\b(?:ist|war|wäre|waere)\s+(?:das|dies|es)\s+(?:(?:wirklich|ganz)\s+)?(?:so|richtig|falsch|sicher|klar|zutreffend)\b|\b(?:is|was|could|can)\s+(?:that|this|it)\s+(?:be\s+)?(?:(?:really|actually)\s+)?(?:true|right|wrong|correct|so)\b|\b(?:das|dies|es)\b.{0,25}\b(?:erkenn|seh|merk|feststell|prüf|pruef|beurteil|einschätz|einschaetz|ausschließ|ausschliess|bestätig|bestaetig)\w*|\b(?:erkenn|seh|merk|feststell|prüf|pruef|beurteil|einschätz|einschaetz|ausschließ|ausschliess|bestätig|bestaetig)\w*\b.{0,25}\b(?:das|dies|es)\b|\b(?:confirm|assess|rule out)\b.{0,20}\b(?:that|this|it)\b|^\s*how\s+(?:can|could|do)\s+(?:i|we|you)\s+tell\s*[?!.]*$|^\s*(?:ist|war|sind|is|are|was|were|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t)\s+(?:er|sie|es|das|dies|he|she|they|it|this|that)\s*(?:das|es|wirklich|really|though|actually)?\s*[?!.]*$|^\s*(?:was|wie|what|how)\s*(?:bitte)?\s*[?!.]*$/iu;
const uncertaintyIntro = /^\s*(?:(?:ich|wir)\s+(?:wei(?:ß|ss)|wissen)\s+(?:(?:es|das|gerade|noch|genau|wirklich)\s+)*nicht|(?:ich|wir)\s+(?:bin|sind)\s+unsicher|(?:i|we)\s+(?:do not|don['’]?t)\s+know|(?:i am|i['’]?m|we are|we['’]?re)\s+(?:not sure|unsure))\s*[,:]?\s*$/iu;
const confirmationTag = /^\s*(?:oder(?: doch)?|richtig|stimmt(?: das)?|wirklich|sicher|really|right|correct|sure)\s*[!?.,;]*\s*$/iu;
// Disputed truth is not evidence of absence, including across sentences.
const disputedAssertion = /\b(?:falsch|unwahr|unrichtig|unzutreffend|gelogen|bestreit\w*|widersprech\w*|false|untrue|incorrect|denies|denied|contradict\w*)\b|\b(?:nicht\s+(?:wahr|richtig|korrekt|zutreffend|bestätigt|bestaetigt|so)|not\s+(?:true|right|correct|confirmed|the case)|stimmt\s+nicht|don['’]?t\s+believe|do\s+not\s+believe)\b/iu;
const clausePattern = /[^.!?;\n]+[.!?;\n]?/gu;

// Each match is one direct finite predicate. Only a following coordinated
// predicate with the same implicit subject can extend the validated span.
const deAbsence = /^(?:(?:ist|bin|bist|sind|seid)\s+(?:(?:jetzt|gerade|aktuell)\s+)?nicht\s+(bewusstlos)|(?:hat|habe|hast|haben|habt)\s+(?:(?:jetzt|gerade|aktuell)\s+)?keine\s+(atemnot))\b/iu;
const enAbsence = /^(?:(?:(?:is|am|are)\s+(?:currently\s+)?not|isn['’]?t|aren['’]?t)\s+(unconscious)|(?:(?:has|have)\s+(?:currently\s+)?no|(?:does|do)\s+not\s+have|(?:doesn['’]?t|don['’]?t)\s+have)\s+(shortness\s+of\s+breath))\b/iu;
const deBoundary = /^\s*(?:[.!;\n]|$|,|\bund\b|\baber\b|\bsondern\b|\b(?:er|sie|ich|du|wir|ihr)\s+\p{L}{2,}\b)/iu;
const enBoundary = /^\s*(?:[.!;\n]|$|,|\band\b|\bbut\b|\b(?:he|she|i|you|we|they)\s+\p{L}{2,}\b)/iu;

function maskAssertedAbsence(clause) {
  // Anchor at the first finite predicate. Never search later nested statements
  // or perform replacements outside the exact validated predicate matches.
  // Intentionally bounded syntax: a pronoun or one determiner + known noun.
  // Arbitrary words before a later verb are never treated as a subject. Unknown
  // introductions/names remain raw for the unchanged shared guard.
  const first = /^\s*(?:ich|du|er|sie|es|wir|ihr|i|you|he|she|it|we|they|(?:meine?|unsere?|der|die|das)\s+(?:mutter|vater|frau|mann|partnerin|partner|bruder|schwester|oma|opa|person)|(?:my|our|the)\s+(?:mother|mom|mum|father|dad|wife|husband|partner|brother|sister|grandmother|grandfather|person))\s+(?=(?:ist|bin|bist|sind|seid|hat|habe|hast|haben|habt|is|am|are|has|have|does|do|isn['’]?t|aren['’]?t|doesn['’]?t|don['’]?t)\b\s+)/iu.exec(clause);
  if (!first) return clause;
  const start = first[0].length;
  const pattern = deAbsence.test(clause.slice(start)) ? deAbsence : enAbsence;
  const boundary = pattern === deAbsence ? deBoundary : enBoundary;
  const connector = pattern === deAbsence ? /^\s+und\s+/iu : /^\s+and\s+/iu;
  const spans = [];
  let offset = start;
  for (let count = 0; count < 2; count++) {
    const match = pattern.exec(clause.slice(offset));
    if (!match || !boundary.test(clause.slice(offset + match[0].length))) break;
    const cue = match[1] || match[2];
    spans.push({ start: offset + match[0].length - cue.length, end: offset + match[0].length });
    const end = offset + match[0].length;
    const join = connector.exec(clause.slice(end));
    if (!join) break;
    offset = end + join[0].length;
  }
  let result = clause;
  for (const span of spans.reverse()) result = result.slice(0, span.start) + "[negated cue]" + result.slice(span.end);
  return result;
}

function webSafetyInput(value) {
  const text = String(value), parts = new Map();
  if (disputedAssertion.test(text)) return text;
  let uncertain = false;
  text.replace(clausePattern, (clause, offset) => {
    const index = clause.search(questionStart);
    const statement = index < 0 ? clause : clause.slice(0, index);
    const question = index < 0 ? "" : clause.slice(index);
    if (confirmationTag.test(clause)
      || (statementDoubt.test(statement) && !(question && uncertaintyIntro.test(statement)))
      || ((question || clause.includes("?")) && questionDoubt.test(question || clause))) uncertain = true;
    parts.set(offset, { index, statement, question });
    return clause;
  });
  if (uncertain) return text;
  return text.replace(clausePattern, (clause, offset) => {
    const { index, statement, question } = parts.get(offset);
    // An unseparated question is not a confirmed absence statement.
    if (index < 0) return clause.includes("?") ? clause : maskAssertedAbsence(clause);
    return maskAssertedAbsence(statement) + question;
  });
}
  // END frozen web-only absence adapter
  // Existing backend medical cue, frozen 98527b6 server.mjs:452 (iu); no new cue vocabulary.
  const existingRespiratoryCue = new RegExp("kaum luft\\b", "iu");

  // Sprachprofil P: Ohne Angabe gilt Deutsch. Jede Sprache kann Normalisierung, Füllwörter,
  // Sonderschlüssel und Anrede selbst mitbringen; der Abgleich selbst ist für alle gleich.
  const create = (P = {}) => {
    // Umgangssprache und häufige Kurzformen auf Schriftdeutsch bringen.
    const replacements = P.replacements ?? [
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
      [/\bheeme?\b/g, 'heim'],
      [/\b(?:hasue|huase|hause|hauze)\b/g, 'hause'],
      [/\bpennt\b/g, 'schlaeft'],
      [/\bpennen\b/g, 'schlafen'],
      [/\bschiss\b/g, 'angst'],
      [/\bkohle\b/g, 'geld'],
      [/\bklau\b/g, 'klaue'],
      [/\bschimmer\b/g, 'ahnung'],
      [/\bmitm\b/g, 'mit dem'],
      // „Im Heim“ beschreibt nur den Ort und ist kein Wunsch „heim“ (nach Hause).
      [/\b(im|vom) heim\b/g, '$1 wohnheim'],
      [/\bvoll aus\b/g, 'aus'],
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

    // Ein Name nach der Person („Opa Heinz sagt …“, „Herr Weber will …“) gehört ebenfalls zum Sprecher.
    const speaker = P.speaker ?? /^(?:(?:mein|meine|unser|unsere|die|der) )?(?:vater|mutter|mama|mami|mutti|papa|vati|mann|frau|ehemann|ehefrau|partner|partnerin|oma|opa|omi|opi|schwiegermutter|schwiegervater|tante|onkel|bruder|schwester|patient|patientin|bewohner|bewohnerin|herr|er|sie)(?: [a-z]+)? (?=(?:sagt|meint|behauptet|denkt|glaubt|fragt|erzaehlt|ruft|will|erkennt|haelt|sucht|weiss|schreit|steht|isst|redet|spricht|langweilt|traut|wirft|weint|ist|wird|hat|laeuft|spuckt|sitzt|packt|versteckt|zieht|schlaeft|trinkt|schlaegt|beschimpft|bleibt|liegt|lacht|schimpft|kann|macht|geht|nimmt|klaut|sammelt|raeumt|vergisst|verweigert|beisst|kratzt|haut|tritt|jammert|klagt)\b)/;
    const sayingVerb = P.sayingVerb ?? /^(?:sagt|meint|behauptet|denkt|glaubt|erzaehlt)(?: (?:immer|staendig|dauernd|oft|wieder|jeden tag|abends|nachts))*(?: dass)? /;

    // Klein, Umlaute als ae/oe/ue, ß als ss, alles außer Buchstaben und Ziffern als Leerzeichen.
    const fold = P.fold ?? ((text) => String(text)
      .toLowerCase()
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss'));
    const normalize = (text) => {
      let value = fold(text)
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
    const noFuzzy = P.noFuzzy ?? new Set(['abend', 'nichts', 'betruege', 'schlaeft', 'schreiben', 'schreibt', 'schreibe', 'schreib', 'stimmung', 'schlucken', 'schluckt', 'schluck', 'schluckstoerung', 'schluckbeschwerden', 'schmeckt',
      'kauen', 'kaut', 'schuld', 'schuhe', 'schuhen', 'melden', 'merken', 'sauer', 'allen', 'kennen', 'legen', 'stellen', 'stiller',
      'muster', 'stammen', 'einladen', 'abbauen', 'baden', 'malen', 'spielen', 'singen', 'lesen', 'anrufer']);

    const keywordWeight = (normalized, tokens, rawKeyword) => {
      const wholeWordOnly = rawKeyword.startsWith('=');
      const keyword = wholeWordOnly ? rawKeyword.slice(1) : rawKeyword;
      if (wholeWordOnly) return normalized.includes(` ${keyword} `) ? (1 + keyword.length / 20) * 2 : 0;
      // Ein „^“ vorne heißt: nur am Anfang der Eingabe (nach Sprecher und Pronomen), also „Mama weiß nicht, wer ich bin“, aber nicht „Ich weiß nicht, wer ich bin“.
      if (keyword.startsWith('^')) {
        // „^…$“: genau das und nichts sonst, zum Beispiel nur das Wort „Geld“.
        if (keyword.endsWith('$')) {
          const exact = keyword.slice(1, -1);
          return normalized.trim() === exact ? (exact.split(' ').length + exact.length / 20) * 2 : 0;
        }
        const phrase = keyword.slice(1);
        return normalized.startsWith(` ${phrase} `) ? (phrase.split(' ').length + phrase.length / 20) * 2 : 0;
      }
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
      // Mask validated absence spans only for this lookup; ranking/rendering/API keep the raw input.
      const lookup = webSafetyInput(text);
      if (existingRespiratoryCue.test(lookup.normalize("NFC").trim().replace(/\s+/gu, " "))) return true;
      const normalized = normalize(lookup);
      return keywords.some((keyword) => {
        if (keyword === 'luftnot') {
          return [...normalized.matchAll(/ luftnot/g)].some(match =>
            !/(?:^|\s)(?:kein|keine|keinen|nicht|ohne)\s*$/.test(normalized.slice(0, match.index)));
        }
        return normalized.includes(` ${keyword}${keyword === 'keine luft' ? ' ' : ''}`);
      });
    };

    const moodIds = P.moodIds ?? ['wut', 'trauer', 'angst'];
    // Eigene Lagen ohne Nebenthemen und ohne „Passt eher?“ (Betrug, Sorge um die Pflege).
    const ownSituations = P.ownSituations ?? ['betrug', 'pflegesorge'];
    // Antwortet schon selbst auf Wut („Lass mich in Ruhe“).
    const angerAnswerKey = P.angerAnswerKey ?? 'ruhe';
    const careConcernKey = P.careConcernKey ?? 'pflegesorge';

    // Lange Eingaben mit Vorgeschichte („Mein Vater ist 84 und hat seit zwei Jahren Demenz.
    // Heute hat er …“): Sätze, die nur den Rahmen beschreiben (Alter, Diagnose, Wohnen,
    // Umzug, Pflege), lenken sonst auf falsche Einträge wie „Ich bin doch nicht dement“.
    const contextPatterns = P.contextPatterns ?? [
      / (?:demenz|alzheimer|dement)\b/,
      / diagnose /,
      / ist \d+ /,
      / \d+ jahre alt /,
      / (?:wohnt|wohnen|lebt|leben) (?:bei|zusammen|allein|alleine|im|in einem|seit|mit)\b/,
      / (?:seit|nach) dem umzug /,
      / (?:seit|nach) dem tod /,
      / ich pflege /,
      / pflege (?:meinen|meine|ihn|sie|mama|papa) /,
      / (?:waren|war) beim arzt /,
      / ich rufe jeden tag /,
      / (?:ist|lebt|wohnt) (?:seit [a-z0-9 ]+ )?im (?:pflegeheim|heim) /
    ];
    const contextWish = P.contextWish ?? / (?:will|willst|moechte|muss|sagt|fragt|sucht|ruft nach|schreit|weint|packt|laeuft|isst|trinkt|schlaeft|erkennt|denkt|glaubt|hat angst) /;
    const plain = (value) => ` ${fold(value).replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const negation = P.negation ?? / (?:nicht|kein|keine|nie) /;
    const currentPart = (text) => String(text).match(/\b(?:früher|frueher|damals|zuvor)\b[\s\S]*?(?:[,;.!?]\s*|\s+aber\s+)((?:heute|jetzt|inzwischen|mittlerweile)\b[\s\S]*)/i)?.[1] ?? String(text);
    const focusText = (text) => {
      const current = currentPart(text);
      const sentences = current.split(/[.!?;\n]+/).map((part) => part.trim()).filter(Boolean);
      if (sentences.length < 2) return current;
      const kept = sentences.filter((sentence) => {
        const value = plain(sentence);
        // Verneinung („hat keine Demenz“) oder ein Anliegen im selben Satz („wohnt bei uns und will heim“) bleibt.
        return negation.test(value) || contextWish.test(value) || !contextPatterns.some((pattern) => pattern.test(value));
      });
      return kept.length ? kept.join('. ') : current;
    };

    const ownFeelings = P.ownFeelings ?? [/\bich (?:bin|war|fuehle mich|fühle mich|werde)(?: (?:so|sehr|total|ganz|oft|dann|einfach))* (?:traurig|wütend|wuetend|sauer|ängstlich|aengstlich|verzweifelt)\b[^.!?;\n]*/gi, /\b(?:das )?macht mich(?: so| sehr)? traurig\b/gi];
    const partSplit = P.partSplit ?? /[.!?;\n]+|,\s*(?:(?:und|aber|oder)\s+)?|\s+(?:und|aber|oder)\s+/i;
    const ownQuestion = P.ownQuestion ?? /^ (?:was|wie|darf|soll|kann|muss)(?: [a-z]+)? (?:ich|man)\b/;
    const match = (input, data) => {
      const original = plain(input);
      // Expliziter Gedanke, einer anderen Person etwas anzutun: nie als bloßes
      // Gefühl der erkrankten Person behandeln. Es gelten vorhandene Schutztexte.
      const harm = original.match(/ (ich|sie|er) (?:(?:koennte|kann|will|werde|wird) )?(?:ihr|ihm|mir|dir|sie|ihn|jemandem) (?:(?:etwas|was) (?:antue|antun|antut)|(?:weh ?tue|weh ?tun|weh ?tut)|verletz[a-z]*)\b/);
      if (harm) {
        // Die eigene Befürchtung muss unmittelbar zum drohenden Ich gehören.
        // Hier keine Satz-/Zitatgrenzen wegfalten: fremde direkte Rede ist unklar.
        const ownThought = fold(input).trim().match(/^ich[ \t]+(?:habe[ \t]+angst|fuerchte|befuerchte)[ \t]*,?[ \t]*(?:dass[ \t]+)?(ich[ \t]+[^\r\n]*)/);
        const ownRisk = harm[1] === 'ich' && Boolean(ownThought
          && ownThought[1].replace(/[ \t]+/g, ' ').startsWith(harm[0].trim()));
        const protection = ownRisk ? data.entries.find((entry) => entry.key === 'erschoepft' && entry.safetyOnly && entry.selfCare) : null;
        return { entry: protection ?? null, alternatives: [], also: [], feeling: null, mood: null,
          safetyHit: true, protection: protection ? 'self' : 'clarify' };
      }
      const text = focusText(input);
      let ranked = rank(text, data.entries);
      // Sicherheits- und Entlastungssätze merken, bevor Gefühlswörter entfernt werden:
      // „Ich bin so wütend auf sie“ ist ein Satz über die Angehörigen selbst.
      const initialSafety = (text === String(input) ? ranked : rank(input, data.entries)).find((candidate) => candidate.entry.safetyOnly);
      // Starkes Gefühl in einer beschriebenen Situation („Er ist wütend und will zur Arbeit“):
      // Das Gefühl soll nicht das Thema überdecken. Ohne Gefühlswörter neu suchen und das
      // Gefühl als kurze erste Antwort mitgeben („Erst trösten …“).
      const moodFeelings = (data.feelings ?? []).filter((item) => moodIds.includes(item.id));
      // In längeren Beschreibungen ist „Ich war so traurig“ das Gefühl der Angehörigen,
      // kein Grund für „Erst trösten“ bei der erkrankten Person.
      const moodText = String(text).split(/[.!?;\n]+/).filter((part) => part.trim()).length > 1
        ? ownFeelings.reduce((value, pattern) => value.replace(pattern, ' '), String(text))
        : text;
      let mood = ranked.length ? rank(moodText, moodFeelings)[0]?.entry ?? null : null;
      const withoutMood = (value) => (mood ? mood.keywords.reduce((result, keyword) => result.replace(new RegExp(` ${keyword}\\S*`, 'g'), ' '), normalize(value)) : value);
      if (mood) {
        const topic = rank(withoutMood(text), data.entries);
        // Kennt die Situation selbst eine Wendung mit dem Gefühlswort („schreit nachts“), bleibt sie vorn.
        const normalizedText = normalize(text);
        const tokens = normalizedText.trim().split(' ').filter(Boolean);
        const moodPhrase = ranked[0].entry.keywords.some((keyword) => keyword.includes(' ')
          && mood.keywords.some((word) => keyword.replace(/^[=^]/, '').replace(/\$$/, '').split(' ').includes(word))
          && keywordWeight(normalizedText, tokens, keyword) > 0);
        if (!moodPhrase && topic.length && topic[0].entry.key !== ranked[0].entry.key) {
          // Alternativen ebenfalls ohne Gefühlswörter, sonst steht „Lass mich in Ruhe“ nur wegen „wütend“ daneben.
          ranked = topic;
        }
        // „Lass mich in Ruhe“ beantwortet Wut schon selbst.
        if (mood.id === moodIds[0] && ranked[0].entry.key === angerAnswerKey) mood = null;
      }
      // Lebensmüde Sätze („Lass mich sterben“) gehen immer vor, auch wenn „lass mich“ mehr Punkte hat.
      if (initialSafety && !ranked.some((candidate) => candidate.entry.key === initialSafety.entry.key)) ranked = [initialSafety, ...ranked];
      const safetyFirst = ranked.find((candidate) => candidate.entry.safetyOnly);
      // Schreiben Angehörige über sich selbst, gibt es keinen Beruhigungssatz für die erkrankte Person davor.
      if (safetyFirst?.entry.selfCare || safetyFirst?.entry.key === careConcernKey) mood = null;
      if (safetyFirst && ranked[0] !== safetyFirst) ranked = [safetyFirst, ...ranked.filter((candidate) => candidate !== safetyFirst)];
      const best = ranked[0] ?? null;
      let context = '';
      if (!best?.entry.safetyOnly) {
        if (currentPart(input) !== String(input)) context = 'temporal';
        else if (best?.entry.key === 'wer' && / (?:zimmer|wohnung|haus) /.test(original)
          && / fremd[a-z]* (?:mann|frau|person|leute) /.test(original)
          && !/ (?:erkennt|kennt) (?:mich|uns|seine|ihre)| haelt mich fuer | wer (?:bist|sind) /.test(original)) context = 'presence';
        else if (best?.entry.key === 'uhrzeit' && !/ (?:wann|spaet|uhrzeit|datum|termin|frage|fragen|fragt)| welcher tag | welches datum /.test(original)) {
          context = / (?:ruft|rufen|anruf[a-z]*|telefon[a-z]*) /.test(original) ? 'calls' : 'repetition';
        } else if (best?.entry.key === 'kind' && / (?:sie|er) behandelt mich /.test(original)) context = 'speaker';
        else if (best?.entry.key === 'umziehen' && / muede /.test(original)
          && !/ (?:will|moechte|mag) (?:sich )?nicht (?:umziehen|anziehen)| will keine /.test(original)) context = 'description';
      }
      const exact = best && [best.entry.says, ...(best.entry.variants ?? [])].some((phrase) => normalize(phrase) === normalize(input));
      // Betrug und Sorge um die Pflege sind eine eigene Lage: keine „Passt eher?“-Vorschläge daneben.
      const alternatives = best && !context && !exact && !ownSituations.includes(best.entry.key)
        ? ranked.slice(1).filter((candidate) => candidate.score >= best.score * 0.5 && !candidate.entry.safetyOnly).slice(0, 2)
          .filter((candidate) => ![['allein', 'ruhe'], ['ruhe', 'allein']].some(([first, second]) => best.entry.key === first && candidate.entry.key === second))
        : [];
      // Kein bekannter Satz, aber ein Gefühlswort („Sie hat Angst“)? Dann zum Gefühl.
      const feeling = best ? null : rank(text, (data.feelings ?? []).map((item) => ({ ...item, keywords: item.keywords ?? [] })))[0]?.entry ?? null;
      // Mehrere Anliegen in einer Eingabe („Wo ist Mama? Ich will heim.“): jeden Satzteil
      // einzeln prüfen und weitere Treffer als „Auch in deiner Eingabe“ anbieten.
      const parts = String(text).split(partSplit)
        .map((part) => part.trim())
        .filter((part) => part.split(/\s+/).length >= 2)
        // Fragen der Angehörigen selbst („Was soll ich tun“, „Darf ich lügen“, „Wie erkläre ich Mama“) sind kein weiteres Anliegen.
        .filter((part) => !ownQuestion.test(normalize(part)));
      const shown = new Set([best?.entry.key]);
      const also = [];
      // Ein Betrugsfall oder eine Sorge um die Pflege ist eine Lage, kein zweites Anliegen („Ein Mann am Telefon sagt, er ist der Enkel“).
      if (parts.length > 1 && !ownSituations.includes(best?.entry.key)) {
        parts.forEach((part) => {
          const top = rank(withoutMood(part), data.entries)[0]?.entry;
          if (top && !top.safetyOnly && !shown.has(top.key)) {
            shown.add(top.key);
            also.push(top);
          }
        });
      }
      return {
        context,
        feeling,
        mood,
        also: also.slice(0, 3),
        entry: best?.entry ?? null,
        alternatives: alternatives.map((candidate) => candidate.entry).filter((entry) => !also.includes(entry)),
        safetyHit: hasSafetySignal(input, data.safetySignals.keywords)
      };
    };

    // Persönliche Antwortsätze: du/Sie, wie die Person angesprochen wird, eigener
    // Name und Beziehung. Alles bleibt im Browser; nichts davon wird gespeichert.
    const roles = P.roles ?? {
      Tochter: 'f', Sohn: 'm', Frau: 'f', Mann: 'm', Partnerin: 'f', Partner: 'm',
      Enkelin: 'f', Enkel: 'm', Schwiegertochter: 'f', Schwiegersohn: 'm', Nichte: 'f', Neffe: 'm'
    };
    const keepCapital = /^(Sie|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres|Ihnen|Anna|Peter|Dr\.)$/;
    const clean = (value) => String(value ?? '').replace(/[<>„“"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

    const personalizeGerman = (text, settings = {}, formal = {}) => {
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
      else {
        // Unbestätigte Beispielnamen/-rollen sind keine direkt nutzbaren Tatsachen.
        // Der bereits vorhandene neutrale zweite Satz bzw. die Frage bleibt erhalten.
        if (!role) result = result.replace(/^Ich bin Anna, (?:deine|Ihre) Tochter\.\s*/, '');
        result = result.replace(/^Ich bin Anna\.\s*/, '');
      }
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
    const stopwords = P.stopwords ?? new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'dein', 'deine', 'sein', 'seine', 'ihre', 'ihren', 'das', 'der', 'die', 'und', 'ist', 'bin', 'hat', 'habe', 'nicht', 'will', 'muss', 'kann', 'immer', 'wieder', 'sagt', 'mir', 'mich', 'dir', 'dich', 'sich', 'was', 'wie', 'wo', 'wann', 'warum', 'ein', 'eine', 'einen', 'noch', 'schon', 'so', 'da', 'hier', 'jetzt', 'mal', 'auch', 'doch', 'den', 'dem', 'zu', 'im', 'in', 'mit', 'von', 'auf', 'fuer', 'aber', 'dann', 'denn', 'oder', 'staendig', 'dauernd', 'ganz', 'gar', 'sehr', 'alles', 'nichts', 'heute', 'gerade', 'einfach', 'wird', 'sind', 'haben', 'werden', 'kein', 'keine', 'keinen']);
    const contentWords = (text) => normalize(text).trim().split(' ').filter((word) => word.length >= 4 && !stopwords.has(word));
    const stem = (word) => word.slice(0, word.length >= 8 ? 6 : 5);
    // Für „Meinst du vielleicht“ zählen nur Wörter mit Inhalt: Fürwörter und
    // Allerweltswörter („seinem“, „fragt“, „morgen“) führten zu schiefen Vorschlägen.
    const weakWords = P.weakWords ?? new Set(['ihrem', 'ihrer', 'ihren', 'ihre', 'seinem', 'seiner', 'seinen', 'seine', 'meinem', 'meiner', 'meinen', 'meine',
      'deinem', 'deiner', 'deinen', 'deine', 'nach', 'fragt', 'fragen', 'ganze', 'ganzen', 'zeit', 'weiss', 'zieht', 'immer', 'wieder',
      'dauernd', 'staendig', 'redet', 'reden', 'sagt', 'sagen', 'morgen', 'heute', 'behauptet', 'will', 'wollen', 'macht', 'machen']);
    const near = (text, data, limit = 2) => {
      const words = contentWords(text).filter((word) => !weakWords.has(word));
      if (!words.length) return [];
      const ranked = data.entries
        .filter((entry) => !entry.safetyOnly)
        .map((entry) => {
          const vocab = new Set([entry.says, ...(entry.variants ?? []), ...entry.keywords.map((keyword) => keyword.replace(/^[=^]/, '').replace(/\$$/, ''))].flatMap(contentWords).map(stem));
          return { entry, score: words.filter((word) => vocab.has(stem(word))).length };
        })
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => b.score - a.score);
      // Nur die besten Treffer: Ein Vorschlag mit weniger gemeinsamen Wörtern ist meist Zufall.
      return ranked.filter((candidate) => candidate.score === ranked[0]?.score).slice(0, limit).map((candidate) => candidate.entry);
    };

    // Eine andere Sprache bringt ihre eigene Anrede mit (P.personalize, ohne du/Sie).
    const personalize = P.personalize ? (text, settings = {}) => P.personalize(text, settings, roles) : personalizeGerman;
    return { normalize, rank, match, near, personalize, roles: Object.keys(roles) };
  };

  // Deutsch ist eingebaut. Andere Sprachen (translator-core-en.js) rufen create mit eigenem Profil auf.
  const api = { ...create(), create };
  root.DemenzTranslatorCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
