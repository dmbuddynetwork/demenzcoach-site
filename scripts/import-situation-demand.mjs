import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read an explicitly supplied export of the existing GENERALIZED shared-sentence
// collection. Never use original private prompts, user IDs, emails or sessions.
// This local analysis emits only fixed, already-public catalog keys and counts.
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
const canonical = value => value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}' ]/gu,' ').replace(/\s+/g,' ').trim();
const known = new Map();
const targets = new Map();
for (const lang of ['de','en']) {
  const source = JSON.parse(fs.readFileSync(path.join(root,`content/ready-situations.${lang}.json`),'utf8'));
  const html = fs.readFileSync(path.join(root,`${lang}/index.html`),'utf8');
  const data = JSON.parse(html.match(/<script type="application\/json" id="translator-data">([\s\S]*?)<\/script>/)[1]);
  for (const e of data.entries) {
    const editorial = source.find(s=>s.key===e.key);
    const id = editorial?.page.topicId || `existing-${lang}-${e.key}`;
    if (!targets.has(id)) targets.set(id,{topicId:id,hasStaticPages:Boolean(editorial || (e.href && e.href.endsWith('.html'))),counts:{de:0,en:0}});
    for (const sentence of [e.says,...(e.variants||[])]) known.set(lang+':'+canonical(sentence),id);
  }
}
const chunks = []; let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 2_000_000) { console.error('Export too large; aggregate it before importing.'); process.exit(1); }
  chunks.push(chunk);
}
let records;
try {
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  // A provenance declaration is mandatory; it is not consent or a privacy check.
  if (input.source !== 'translatorSharedSentences' || input.generalizedOnly !== true || !Array.isArray(input.records)) throw new Error();
  records = input.records;
} catch {
  console.error('Expected {source:"translatorSharedSentences",generalizedOnly:true,records:[{language,sentence,count}]}.');
  process.exit(1);
}
const unique = new Map();
for (const record of records) {
  if (!record || Object.keys(record).some(k=>!['language','sentence','count'].includes(k)) || !['de','en'].includes(record.language) || typeof record.sentence!=='string' || record.sentence.length>500 || !Number.isSafeInteger(record.count) || record.count<1 || record.count>1_000_000) {
    console.error('Invalid generalized record. No input text has been logged or persisted.'); process.exit(1);
  }
  const key = record.language+':'+canonical(record.sentence);
  // Repeated lifetime snapshots of the same phrase must not inflate demand.
  unique.set(key,Math.max(unique.get(key)||0,record.count));
}
let heldCount=0, heldDistinct=0;
for (const [key,count] of unique) {
  const id=known.get(key);
  if (!id) { heldCount+=count; heldDistinct++; continue; }
  targets.get(id).counts[key.slice(0,2)]+=count;
}
const topics=[...targets.values()].filter(t=>t.counts.de+t.counts.en>0).sort((a,b)=>a.topicId.localeCompare(b.topicId));
console.log(JSON.stringify({schemaVersion:1,topics,needsEditorialReview:{distinctGeneralizedSentences:heldDistinct,count:heldCount},rawTextIncluded:false,publicationTriggered:false},null,2));
