// English matching profile for the dementia translator (en/dementia-translator/).
// Same matching as translator-core.js; only normalisation, filler words, special keys and
// personal wording are English. Runs in the browser and in Node tests. No network, no storage.
// Load after translator-core.js: on English pages it replaces window.DemenzTranslatorCore.
(function (root) {
  const base = root.DemenzTranslatorCore?.create
    ? root.DemenzTranslatorCore
    : (typeof require === 'function' ? require('./translator-core.js') : null);
  if (!base?.create) return;

  // Lowercase, curly quotes and apostrophes dropped ("don't" → "dont", "I'm" → "im").
  const fold = (text) => String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, '');

  // Spoken and texting shortcuts, US and UK words brought together.
  const replacements = [
    [/\bu\b/g, 'you'],
    [/\bur\b/g, 'your'],
    [/\bwanna\b/g, 'want to'],
    [/\bgonna\b/g, 'going to'],
    [/\bgotta\b/g, 'got to'],
    [/\bhafta\b/g, 'have to'],
    [/\bdunno\b/g, 'dont know'],
    [/\bcos\b/g, 'because'],
    [/\bcuz\b/g, 'because'],
    [/\bpls\b/g, 'please'],
    [/\bplz\b/g, 'please'],
    [/\bmum+y?\b/g, 'mom'],
    [/\bmom+y\b/g, 'mom'],
    [/\bmummie\b/g, 'mom'],
    [/\bmama\b/g, 'mom'],
    [/\bma\b/g, 'mom'],
    [/\bdaddy\b/g, 'dad'],
    [/\bpapa\b/g, 'dad'],
    [/\bpop\b/g, 'dad'],
    [/\b(?:nan|nana|nanna|nanny|gran|granny|grannie|grandma|grandmom|grandmum|grandmother)\b/g, 'grandma'],
    [/\b(?:grandpa|granddad|grandad|grampa|gramps|grandfather)\b/g, 'grandpa'],
    [/\bneighbour/g, 'neighbor'],
    [/\bcolour/g, 'color'],
    [/\bpyjamas\b/g, 'pajamas'],
    [/\bwallet\b/g, 'purse'],
    [/\bhandbag\b/g, 'purse'],
    [/\btablets?\b/g, 'pills'],
    [/\bmeds\b/g, 'pills'],
    [/\bloo\b/g, 'toilet'],
    [/\bbathroom\b/g, 'toilet'],
    [/\brestroom\b/g, 'toilet'],
    [/\bwashroom\b/g, 'toilet'],
    [/\bcarehome\b/g, 'care home'],
    [/\bnursing home\b/g, 'care home'],
    [/\bold peoples home\b/g, 'care home'],
    [/\bdaycare\b/g, 'day care'],
    [/\bday centre\b/g, 'day care'],
    [/\bday center\b/g, 'day care'],
    [/\bwont\b/g, 'will not'],
    [/\bcant\b/g, 'cannot'],
    [/\bcan not\b/g, 'cannot'],
    [/\bdoesnt\b/g, 'does not'],
    [/\bdont\b/g, 'do not'],
    [/\bdidnt\b/g, 'did not'],
    [/\bisnt\b/g, 'is not'],
    [/\barent\b/g, 'are not'],
    [/\bhasnt\b/g, 'has not'],
    [/\bhavent\b/g, 'have not'],
    [/\bwasnt\b/g, 'was not'],
    [/\bim\b/g, 'i am'],
    [/\bive\b/g, 'i have'],
    [/\bits\b/g, 'it is'],
    [/\bwhats\b/g, 'what is'],
    [/\bwheres\b/g, 'where is'],
    [/\bwhos\b/g, 'who is'],
    [/\btheres\b/g, 'there is'],
    [/\btheyre\b/g, 'they are'],
    [/\byoure\b/g, 'you are'],
    [/\bhes\b/g, 'he is'],
    [/\bshes\b/g, 'she is'],
    [/\bfell over\b/g, 'fell down'],
    // Typos in emergency words still have to show the safety note.
    [/\bunconcious\b/g, 'unconscious'],
    [/\bbreathin\b/g, 'breathing'],
    [/\bbleding\b/g, 'bleeding']
  ];

  // "My mom keeps saying …", "Dad says he …": who is speaking is not the topic.
  const speaker = /^(?:(?:my|our|the) )?(?:mom|mother|dad|father|husband|wife|partner|grandma|grandpa|aunt|uncle|brother|sister|patient|resident|client|mr [a-z]+|mrs [a-z]+|ms [a-z]+|he|she)(?: [a-z]+)? (?=(?:says|keeps|said|thinks|believes|claims|tells|asks|is asking|keeps asking|wants|will|cannot|does|refuses|insists|shouts|screams|yells|cries|calls|accuses|is|was|has|gets|goes|went|tries|seems|looks|sits|stands|walks|wanders|packs|hides|hits|kicks|bites|sleeps|eats|drinks|does not|did not|wont|keeps saying|fell|falls|has fallen|collapsed|cut|bleeds|is bleeding|hurt|hurts|lost|loses|forgot|forgets|refused|took|takes|threw|throws|pushed|pushes|left|leaves|ran|runs|called|calls|phoned|answered|opened|signed|gave|gives|told|asked|woke|wakes|got|gets)\b)/;
  const sayingVerb = /^(?:says|said|keeps saying|keeps telling me|tells me|told me|thinks|believes|claims|insists|is saying|is convinced)(?: (?:again|always|constantly|every day|all the time|at night|in the evening))*(?: that)? /;

  const contextPatterns = [
    / (?:dementia|alzheimer|alzheimers)\b/,
    / diagnos/,
    / is \d+ /,
    / \d+ years old /,
    / (?:lives|live|living) (?:with|alone|in|at|on her own|on his own)\b/,
    / since (?:the|we) move/,
    / i (?:care|look after) /,
    / (?:i am|we are) (?:her|his) (?:carer|caregiver)/,
    / (?:saw|seen|went to) the doctor /,
    / (?:is|lives) in a care home /
  ];
  const contextWish = / (?:wants|will|must|has to|says|asks|looks for|calls for|shouts|cries|packs|walks|eats|drinks|sleeps|thinks|believes|is scared) /;

  const stopwords = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'mine', 'the', 'a', 'an', 'and', 'or', 'but', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'not', 'will', 'want', 'wants', 'must', 'can', 'cannot', 'always', 'again', 'says', 'said', 'what', 'how', 'where', 'when', 'why', 'who', 'this', 'that', 'there', 'here', 'now', 'just', 'also', 'still', 'then', 'than', 'very', 'really', 'all', 'nothing', 'today', 'with', 'from', 'into', 'about', 'for', 'of', 'to', 'in', 'on', 'at', 'so', 'too', 'keeps', 'every', 'time', 'some', 'any', 'more', 'only']);
  const weakWords = new Set(['keeps', 'saying', 'asks', 'asking', 'tells', 'telling', 'thinks', 'always', 'constantly', 'again', 'whole', 'night', 'tomorrow', 'today', 'wants', 'going', 'goes', 'make', 'makes', 'mother', 'father', 'husband', 'wife', 'grandma', 'grandpa']);

  const roles = {
    Daughter: 'daughter', Son: 'son', Wife: 'wife', Husband: 'husband', Partner: 'partner',
    Granddaughter: 'granddaughter', Grandson: 'grandson', 'Daughter-in-law': 'daughter-in-law', 'Son-in-law': 'son-in-law',
    Niece: 'niece', Nephew: 'nephew', Friend: 'friend'
  };
  const keepCapital = /^(?:I|I'm|I’m|I'll|I’ll|I've|I’ve|I'd|I’d|Anna|Mr\.?|Mrs\.?|Ms\.?|Dr\.?)$/;
  const clean = (value) => String(value ?? '').replace(/[<>“”"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

  // Name, relationship and what you call the person. English has no formal "you", so no du/Sie.
  const personalize = (text, settings = {}) => {
    let result = String(text);
    const me = clean(settings.me);
    const role = roles[settings.role] ?? '';
    if (role) {
      result = result.replace(/Anna, your daughter/, me ? `${me}, your ${role}` : `your ${role}`);
    } else if (me) {
      result = result.replace(/Anna, your daughter\./, `${me}.`);
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

  // For the page builder: keywords get the same folding and replacements as typed text,
  // but no speaker stripping (a keyword like "she is cold" must stay whole).
  const normalizeKeyword = (text) => {
    let value = fold(text).replace(/[^a-z0-9]+/g, ' ').trim();
    replacements.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
    return value;
  };

  const matcher = base.create({
    fold,
    replacements,
    speaker,
    sayingVerb,
    noFuzzy: new Set(['things', 'thing', 'shower', 'showers', 'should', 'shout', 'shouts', 'school', 'scared', 'stolen', 'police', 'policy', 'pills', 'bills', 'calls', 'hall', 'wallet', 'walk', 'walks', 'house', 'mouse', 'horse', 'later', 'water', 'waiter', 'dinner', 'diner', 'lunch', 'bunch', 'drive', 'drives', 'driver', 'alive', 'arrive', 'phone', 'alone', 'stone']),
    moodIds: ['anger', 'sadness', 'fear'],
    ownSituations: ['scam', 'carecomplaint'],
    angerAnswerKey: 'leavemealone',
    careConcernKey: 'carecomplaint',
    contextPatterns,
    contextWish,
    negation: / (?:not|no|never|nothing) /,
    ownFeelings: [/\bi (?:am|was|feel|get|got)(?: (?:so|very|really|totally|quite|often|then|just))* (?:sad|angry|upset|mad|scared|frightened|desperate|frustrated)\b[^.!?;\n]*/gi, /\b(?:it )?makes me(?: so| very| really)? (?:sad|angry|upset)\b/gi],
    partSplit: /[.!?;\n]+|,\s*(?:(?:and|but|or)\s+)?|\s+(?:and|but|or)\s+/i,
    ownQuestion: /^ (?:what|how|should|can|do|may|is it ok)(?: [a-z]+)? (?:i|we|you)\b/,
    roles,
    personalize,
    stopwords,
    weakWords
  });
  const api = { ...matcher, normalizeKeyword };

  root.DemenzTranslatorCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
