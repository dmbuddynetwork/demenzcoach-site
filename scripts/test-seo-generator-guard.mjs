import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectGeneratorPage, generatorResultFragment} from './seo-generator-guard.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const routes=JSON.parse(read('content/generator-public-routes.json')).routes;
const inventory=JSON.parse(read('content/generator-route-manifest.json')).routes;
const sources=Object.fromEntries(['de','en'].map(lang=>[lang,JSON.parse(read(`content/ready-situations.${lang}.json`))]));
const route=routes.find(r=>r.language==='en'&&r.key==='exhausted');
const fixture=()=>({pathname:route.path,html:read(route.path.slice(1)),routes,inventory,sources});
const inspect=(html,extra={})=>inspectGeneratorPage({...fixture(),html,...extra});
const has=(result,pattern)=>assert.ok(result.errors.some(error=>pattern.test(error)),result.errors.join('\n'));

test('All88 compiled source-bound app routes satisfy the new contract without article CTA requirements',()=>{
 assert.equal(routes.length,88);
 for(const r of routes)assert.deepEqual(inspectGeneratorPage({pathname:r.path,html:read(r.path.slice(1)),routes,inventory,sources}),{registered:true,errors:[]},r.path);
});
test('Missing, wrong and duplicate canonicals cannot receive a generator exemption',()=>{
 const html=fixture().html;
 has(inspect(html.replace(/<link\b[^>]*rel="canonical"[^>]*>/,'')),/canonical mismatch/);
 has(inspect(html.replace(`rel="canonical" href="https://dementiacoachapp.com${route.path}"`,'rel="canonical" href="https://dementiacoachapp.com/en/"')),/canonical mismatch/);
 has(inspect(html.replace('</head>',`<link rel="canonical" href="https://dementiacoachapp.com${route.path}"></head>`)),/canonical mismatch/);
});
test('A spoofed marker on an unregistered article never selects the app contract',()=>{
 const result=inspect(fixture().html,{pathname:'/guides/unregistered.html'});
 assert.equal(result.registered,false);has(result,/unregistered generator marker/);
});
test('Missing inventory, mismatched keys and duplicate public routes fail closed',()=>{
 const html=fixture().html;
 has(inspect(html,{inventory:[]}),/missing unique inventory/);
 has(inspect(html,{inventory:inventory.map(r=>r.path===route.path?{...r,key:'forged'}:r)}),/inventory mismatch: key/);
 has(inspect(html,{routes:[...routes,route]}),/duplicate public generator route/);
});
test('A malformed app marker, missing or duplicated form, empty result and changed heading fail',()=>{
 const html=fixture().html;
 has(inspect(html.replace(`data-translator-initial-situation="${route.key}"`,'data-translator-initial-situation="forged"')),/app marker mismatch/);
 has(inspect(html.replace('id="translator-form"','id="removed-form"')),/one primary form/);
 has(inspect(html.replace('</body>','<form id="translator-form"></form></body>')),/one primary form/);
 has(inspect(html.replace('id="translator-result"','id="removed-result"')),/one result container/);
 has(inspect(html.replace('class="translator-answer"','class="empty-answer"')),/one rendered answer/);
 has(inspect(html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/,'<h1>Unreviewed heading</h1>')),/heading differs/);
});
test('An empty answer cannot pass with the original heading, answer marker and unchanged client data',()=>{
 const html=fixture().html,fragment=generatorResultFragment(html),heading=fragment.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)[0];
 const changed=html.replace(fragment,heading+'<div class="translator-answer"></div>');
 assert.ok(changed.includes(heading));assert.equal(changed.match(/<script\b[^>]*id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1],html.match(/<script\b[^>]*id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 has(inspect(changed),/result differs from reviewed view/);
});
test('Changed phrases and removed safety content fail while original heading and client data remain intact',()=>{
 const html=fixture().html,fragment=generatorResultFragment(html),entry=sources.en.find(e=>e.key===route.key);
 const phrase=entry.phrases[0].replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');assert.ok(fragment.includes(phrase));
 has(inspect(html.replace(fragment,fragment.replace(phrase,'Unreviewed replacement sentence.'))),/result differs from reviewed view/);
 const withoutSafety=fragment.replace(/<aside\b[^>]*class="safety-note translator-selfcare"[\s\S]*?<\/aside>/,'');assert.notEqual(withoutSafety,fragment);
 has(inspect(html.replace(fragment,withoutSafety)),/result differs from reviewed view/);
});
test('The reviewed view copied elsewhere cannot disguise an empty actual result container',()=>{
 const html=fixture().html,fragment=generatorResultFragment(html);
 const changed=html.replace(fragment,'<div class="translator-answer"></div>').replace('</body>',fragment+'</body>');
 assert.ok(changed.includes(fragment));has(inspect(changed),/result differs from reviewed view/);
 const misleading=html.replace(fragment,'').replace(/<div\b[^>]*id="translator-result"[^>]*>/,match=>'<div data-id="translator-result">'+fragment+'</div>'+match);
 has(inspect(misleading),/result differs from reviewed view/);
});
test('App JSON is bound to the reviewed source view; safety flags are independently checked',()=>{
 const html=fixture().html,pattern=/(<script\b[^>]*id="translator-data"[^>]*>)([\s\S]*?)(<\/script>)/;
 has(inspect(html.replace(pattern,(_m,a,_d,c)=>a+'{invalid'+c)),/app data differs/);
 const data=JSON.parse(html.match(pattern)[2]);data.entries.find(e=>e.key===route.key).selfCare=false;
 const updated=JSON.stringify(data),changed=html.replace(pattern,(_m,a,_d,c)=>a+updated+c),copy=structuredClone(sources);
 copy.en.find(e=>e.key===route.key).view.bindings.dataHash=createHash('sha256').update(updated).digest('hex');
 has(inspect(changed,{sources:copy}),/client entry safety mismatch/);
});
test('Source-less cache and hash-only urgent entry cannot masquerade as public caregiver support',()=>{
 const html=fixture().html;
 has(inspect(html,{sources:{de:[],en:[]}}),/unique reviewed source/);
 const copy=structuredClone(routes);copy.find(r=>r.path===route.path).selfCare=false;
 has(inspect(html,{routes:copy}),/urgent hash-only state/);
});
test('Real crawlable links to other compiled topics replace old article link classes',()=>{
 const html=fixture().html;assert.deepEqual(inspect(html).errors,[]);
 has(inspect(html.replace(/<a\b[^>]*>/g,'<span>').replaceAll('</a>','</span>')),/crawlable links to two other public topics/);
});
test('Marketing page changes are confined to the head, with noindex and their own canonical',()=>{
 for(const rel of ['begleitung/index.html','kommunikation/index.html']){
  const html=read(rel);assert.match(html,/<meta name="robots" content="noindex,follow">/);
  assert.ok(html.includes(`rel="canonical" href="https://dementiacoachapp.com/${rel.slice(0,-10)}"`));
  assert.ok(html.includes('href="/einfach.css"'));assert.equal((html.match(/<h1\b/g)||[]).length,1);
 }
});
test('Actual validator retains unmapped article campaign guards and rejects a registered page missing canonical',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dc-seo-guard-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(root,dir,{recursive:true,mode:fs.constants.COPYFILE_FICLONE,filter:p=>path.basename(p)!=='.git'});
 const run=()=>spawnSync(process.execPath,[path.join(root,'scripts/validate-seo.mjs'),dir],{encoding:'utf8'});
 const canonicalPage=path.join(dir,route.path),original=fs.readFileSync(canonicalPage,'utf8');
 fs.writeFileSync(canonicalPage,original.replace(/<link\b[^>]*rel="canonical"[^>]*>/,''));
 const missing=run();assert.notEqual(missing.status,0);assert.match(missing.stdout+missing.stderr,/generator canonical mismatch/);
 fs.writeFileSync(canonicalPage,original);
 const legacy=JSON.parse(read('seo-campaigns.json')).campaigns.find(c=>!routes.some(r=>new URL(c.page_url).pathname===r.path));assert.ok(legacy);
 const file=path.join(dir,new URL(legacy.page_url).pathname),article=fs.readFileSync(file,'utf8');
 fs.writeFileSync(file,article.replaceAll(`ct=${legacy.campaign_token}&amp;mt=8`,'ct=wrong&amp;mt=8'));
 const changed=run();assert.notEqual(changed.status,0);assert.match(changed.stdout+changed.stderr,/missing mapped campaign token/);
 fs.writeFileSync(file,article);const clean=run();assert.equal(clean.status,0,clean.stdout+clean.stderr);
});
