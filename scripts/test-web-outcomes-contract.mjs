import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
const source = await readFile(new URL('../demenz-uebersetzer/translator-ai.js', import.meta.url), 'utf8');
const goal = { goal: 'act_now', label: 'Meine eigene Grenze verständlich machen' };
const support = { kind: 'self_support', meaning: 'Ein kontrollierter Testtext zur Entlastung.', steps: ['Ein kontrollierter erster Schritt.'], avoid: 'Kontrollierter Testtext.', nextStep: 'Ein kontrollierter nächster Schritt.', safetyLevel: 'standard', safetyMessage: null };
// Independent golden copy approved by Root/Safety, not extracted from the client.
const generalCopy = {
  de: 'Allgemeine Warnzeichen bei Schluckproblemen sind Husten oder Verschlucken beim Essen oder Trinken sowie eine feucht oder gurgelnd klingende Stimme oder Atemprobleme nach dem Essen oder Trinken. Schluckprobleme gehören ärztlich oder durch entsprechend qualifiziertes Fachpersonal abgeklärt. Bei schwerer Atemnot, fehlender Atmung oder Bewusstlosigkeit ruf sofort den örtlichen Notruf.',
  en: 'General warning signs of swallowing difficulties include coughing or choking when eating or drinking, or a wet or gurgly voice or breathing problems after eating or drinking. Swallowing difficulties need assessment by a doctor or appropriately qualified professional. If the person has severe trouble breathing, is not breathing or becomes unconscious, call the local emergency number immediately.'
};
function fixture(payload, language = 'de') {
  const requests = [], bound = [], context = {};
  const host = { document: { documentElement: { lang: language } }, DemenzKiFreigabe: {
    createAccessContext: () => context, requestContext: async options => { assert.equal(options.accessContext, context); return { 'X-Translator-Access-Contract': 'signup-bonus-v1' }; },
    bindAccessResult: (result, identity) => { assert.equal(identity, context); bound.push(result); return result; }, enabled: () => false
  } };
  runInContext(source, createContext({ window: host, document: host.document, AbortController, TextEncoder, setTimeout, clearTimeout,
    fetch: async (url, options) => { requests.push({ url: String(url), options, body: JSON.parse(options.body) }); return { ok: true, json: async () => structuredClone(payload) }; }
  }));
  return { api: host.DemenzTranslatorAI, requests, bound };
}
for (const [mode, count] of [['explicit', 1], ['guessed', 1], ['guessed', 2], ['guessed', 3]]) {
  test(`${mode} accepts ${count} distinct goals and negotiates the version`, async () => {
    const goals = Array.from({ length: count }, (_, i) => ({ goal: ['act_now', 'understand', 'organize'][i], label: `Eigenständiges Testanliegen ${i + 1}` }));
    const f = fixture({ kind: 'goals', contract: 'outcomes-v1', selectionMode: mode, goals });
    assert.equal((await f.api.askGoals('Eine gewöhnliche Testsituation.')).selectionMode, mode);
    assert.equal(new URL(f.requests[0].url).searchParams.get('goal_contract'), 'outcomes-v1');
    assert.equal(f.requests[0].body.share, false);
  });
}
for (const [name, delta] of [
  ['explicit two', { selectionMode: 'explicit', goals: [goal, { goal: 'understand', label: 'Zweites Anliegen' }] }],
  ['empty', { goals: [] }], ['four', { goals: [goal, goal, goal, goal] }],
  ['duplicate id', { goals: [goal, { ...goal, label: 'Anderes Anliegen' }] }],
  ['duplicate label', { goals: [goal, { ...goal, goal: 'understand' }] }],
  ['unknown mode', { selectionMode: 'automatic' }], ['unknown contract', { contract: 'other-v1', noSituation: false }]
]) test(`rejects malformed goals: ${name}`, async () => {
  const f = fixture({ kind: 'goals', contract: 'outcomes-v1', selectionMode: 'guessed', goals: [goal], ...delta });
  assert.equal((await f.api.askGoals('Eine Testsituation.')).kind, 'error');
});
test('Unicode goal limits use normalized code points', async () => {
  for (const [label, expected] of [['🫶'.repeat(64), 'goals'], ['🫶'.repeat(65), 'error'], ['e\u0301'.repeat(64), 'goals']]) {
    assert.equal((await fixture({ kind: 'goals', contract: 'outcomes-v1', selectionMode: 'guessed', goals: [{ ...goal, label }] }).api.askGoals('Eine Testsituation.')).kind, expected);
  }
});
test('planning clarification is separate from an answer or a goal choice', async () => {
  const payload = { kind: 'goal_clarification', contract: 'outcomes-v1', question: 'Was ist konkret anders?', goals: [] };
  assert.equal((await fixture(payload).api.askGoals('Eine Testsituation.')).kind, 'goal_clarification');
  for (const delta of [{ question: '?' }, { question: 'Keine Frage' }, { question: 'x'.repeat(200) + '?' }, { goals: [goal] }]) {
    assert.equal((await fixture({ ...payload, ...delta }).api.askGoals('Eine Testsituation.')).kind, 'error');
  }
});
for (const size of [1, 2, 3]) test(`self support accepts ${size} caregiver steps with auth provenance`, async () => {
  const f = fixture({ ...support, steps: Array(size).fill('Ein konkreter Testschritt.') });
  assert.equal((await f.api.ask('Eine Testsituation.', { goal: { id: goal.goal, label: goal.label } })).kind, 'self_support');
  assert.equal(f.bound.length, 1);
  assert.equal(new URL(f.requests[0].url).searchParams.get('goal_contract'), 'outcomes-v1');
  assert.equal(new URL(f.requests[0].url).searchParams.get('response_contract'), 'clarification-v1');
  assert.equal(f.requests[0].options.headers['X-Translator-Access-Contract'], 'signup-bonus-v1');
  assert.deepEqual(f.requests[0].body.goal, { id: goal.goal, label: goal.label });
});
test('self support cannot silently replace warnings or become patient phrases', async () => {
  for (const delta of [{ steps: [] }, { steps: Array(4).fill('Schritt') }, { phrases: ['Patientensatz'] }, { meaning: '' }, { avoid: '' }, { nextStep: '' }, { safetyMessage: '' }]) {
    assert.equal((await fixture({ ...support, ...delta }).api.ask('Eine Testsituation.')).kind, 'error');
  }
  const value = await fixture({ ...support, safetyLevel: 'concern', safetyMessage: 'Vorhandener konkreter Hinweis.' }).api.ask('Eine Testsituation.');
  assert.equal(value.kind, 'error'); assert.equal(value.safetyMessage, 'Vorhandener konkreter Hinweis.'); assert.equal(value.safetyLevel, 'concern');
});
test('fixed safety and legacy goal responses retain compatibility', async () => {
  const safety = { kind: 'safety', safetyLevel: 'concern', message: 'Vorhandener konkreter Hinweis.' };
  assert.equal((await fixture(safety).api.askGoals('Eine Testsituation.')).kind, 'safety');
  const legacy = { kind: 'goals', noSituation: false, goals: ['act_now','understand','organize'].map((goal, i) => ({ goal, label: `Altes Testanliegen ${i}` })) };
  assert.equal((await fixture(legacy).api.askGoals('Eine Testsituation.')).kind, 'goals');
});
test('full original text, custom intent and English body survive the contract', async () => {
  const f = fixture(support, 'en-US'); const text = 'Original situation.\nAdditional observed detail.';
  await f.api.ask(text, { goal: { id: 'custom', label: 'A goal actually written by the user' } });
  assert.equal(f.requests[0].body.text, text); assert.equal(f.requests[0].body.language, 'en'); assert.equal(f.requests[0].body.goal.id, 'custom');
  assert.equal(f.requests[0].options.credentials, 'omit'); assert.equal(f.requests[0].options.referrerPolicy, 'no-referrer');
});
for (const language of ['de', 'en']) test(`complete canonical general information survives ${language} self support and normal clarification`, async () => {
  const info = { topic: 'swallowing', text: generalCopy[language] };
  const f = fixture({ ...support, generalSafetyInfo: info }, language);
  const result = await f.api.ask('A controlled situation.');
  assert.equal(result.kind, 'self_support'); assert.deepEqual(result.generalSafetyInfo, info);
  assert.deepEqual(JSON.parse(JSON.stringify(f.api.generalSafetyInfo(info))), info);
  const question = fixture({ kind: 'clarification', question: 'What is different?', meaning: 'A controlled explanation.', nextStep: 'Please add the relevant detail.', safetyLevel: 'standard', safetyMessage: null, generalSafetyInfo: info }, language);
  assert.equal((await question.api.ask('A controlled situation.')).generalSafetyInfo.text, generalCopy[language]);
  for (const invalid of [{ ...info, topic: 'other' }, { ...info, text: 'Arbitrary medical warning' }, { ...info, text: generalCopy[language === 'de' ? 'en' : 'de'] }, { ...info, risk: 'urgent' }]) {
    assert.equal((await fixture({ ...support, generalSafetyInfo: invalid }, language).api.ask('A controlled situation.')).kind, 'error');
  }
});
for (const language of ['de', 'en']) test(`canonical ${language} general information survives malformed remaining fields without changing risk`, async () => {
  const info = { topic: 'swallowing', text: generalCopy[language] };
  for (const broken of [{ ...support, meaning: '' }, { ...support, steps: [] }, { kind: 'answer', meaning: 'Controlled normal explanation.', phrases: [], avoid: 'Controlled avoid.', nextStep: 'Controlled next step.', safetyLevel: 'concern', safetyMessage: 'An existing actual concern warning.' }]) {
    const result = await fixture({ ...broken, generalSafetyInfo: info }, language).api.ask('A controlled situation.');
    assert.equal(result.kind, 'error'); assert.equal(result.generalSafetyInfo.text, generalCopy[language]);
    assert.equal(result.safetyLevel, broken.safetyLevel); assert.equal(result.safetyMessage, broken.safetyMessage || '');
  }
  const foreign = await fixture({ ...support, meaning: '', generalSafetyInfo: { topic: 'swallowing', text: 'Arbitrary medical advice.' } }, language).api.ask('A controlled situation.');
  assert.equal(foreign.kind, 'error'); assert.equal(Object.hasOwn(foreign, 'generalSafetyInfo'), false);
});
test('fixed acute warning takes priority even over unrecognized optional information', async () => {
  const result = await fixture({ kind: 'safety', safetyLevel: 'urgent', message: 'Existing actual warning.', generalSafetyInfo: { topic: 'unknown', text: 'Unknown' } }).api.ask('A controlled situation.');
  assert.equal(result.kind, 'safety'); assert.equal(result.message, 'Existing actual warning.');
});
test('captured real backend wire results pass the actual client parser', { skip: !process.env.OUTCOMES_REPLAY_FILE }, async () => {
  const recorded = JSON.parse(await readFile(process.env.OUTCOMES_REPLAY_FILE, 'utf8'));
  assert.equal(recorded.cases.length, 50);
  for (const item of recorded.cases) for (const request of item.requests) {
    const f = fixture(request.response, item.input.language);
    const value = request.stage === 'goals' ? await f.api.askGoals(item.input.text) : await f.api.ask(item.input.text, { goal: request.selectedGoal });
    assert.equal(value.kind, request.response.kind, `${item.id}/${request.stage}`);
  }
});
