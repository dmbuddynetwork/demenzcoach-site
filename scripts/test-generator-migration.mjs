import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const pattern=/(<script type="application\/json" id="translator-data">)([\s\S]*?)(<\/script>)/;
const data=h=>JSON.parse(h.match(pattern)[2]);
const read=(dir,rel)=>fs.readFileSync(path.join(dir,rel),'utf8');
const write=(dir,rel,s)=>fs.writeFileSync(path.join(dir,rel),s);
const source=(dir,lang)=>JSON.parse(read(dir,`content/ready-situations.${lang}.json`));
const run=(dir,...args)=>spawnSync(process.execPath,[path.join(root,'scripts/build-ready-situations.mjs'),dir,...args],{encoding:'utf8'});
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dc-generator-migration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(root,dir,{recursive:true,filter:source=>!source.split(path.sep).some(part=>part==='.git'||part==='node_modules')});return dir;
}
function syntheticViews(dir,...flags) {
 const b=run(dir,'--view-bindings','--preview',...flags);assert.equal(b.status,0,b.stderr);const bindings=JSON.parse(b.stdout);
 for(const lang of ['de','en']){const entries=source(dir,lang);for(const e of entries){e.reviewStatus='reviewed';e.view={key:e.key,language:lang,goal:lang==='de'&&!e.selfCare?'jetzt':'',bindings:bindings[lang],html:'<h1>Explicit synthetic unit fixture</h1><p>Compiler contract only.</p>'};}write(dir,`content/ready-situations.${lang}.json`,JSON.stringify(entries));}
}
const homes=['de/index.html','en/index.html','de/demenz-uebersetzer/index.html','en/dementia-translator/index.html'];
const snapshot=dir=>Object.fromEntries(homes.map(p=>[p,read(dir,p)]));
test('Exact84 legacy routes plus4 additions, unique reciprocal pairs, six excluded hash states',()=>{
 const m=JSON.parse(read(root,'content/generator-route-manifest.json'));assert.equal(m.routes.length,88);assert.equal(m.routes.filter(r=>r.legacySourceSHA256).length,84);assert.equal(new Set(m.routes.map(r=>r.path)).size,88);assert.equal(m.excludedHashStates.length,6);
 for(const r of m.routes){assert.ok(m.routes.some(o=>o.language!==r.language&&o.path===r.alternatePath&&o.alternatePath===r.path));assert.ok(!m.excludedHashStates.some(e=>e.language===r.language&&e.key===r.key));}
});
test('Goal paths contain fixed public slugs only; no query, fragment, selfCare or urgent aliases',()=>{
 const m=JSON.parse(read(root,'content/generator-route-manifest.json'));
 for(const r of m.routes) {
  if(r.language==='de'&&!r.selfCare&&!r.safetyOnly){assert.equal(r.goalPaths.jetzt,r.path);assert.ok(r.goalPaths.verstehen.endsWith('/verstehen/'));assert.ok(r.goalPaths.tipps.endsWith('/tipps/'));assert.ok(r.selectionPath.endsWith('/auswahl/'));for(const value of [...Object.values(r.goalPaths),r.selectionPath])assert.ok(!/[?&#]/.test(value));}
  else {assert.equal(r.goalPaths,undefined);assert.equal(r.selectionPath,undefined);}
 }
});
test('Prepare preserves original45 entries and extra LTV fields; adds two choices and44 metadata routes per language',t=>{
 const dir=fixture(t),before=snapshot(dir);
 for(const rel of homes){const h=read(dir,rel),d=data(h);d.entries[0].integrationField='kept';write(dir,rel,h.replace(pattern,(_m,a,_b,c)=>a+JSON.stringify(d)+c));}
 const r=run(dir,'--prepare-views');assert.equal(r.status,0,r.stderr);
 for(const rel of homes){const h=read(dir,rel),d=data(h),old=data(before[rel]);assert.equal(d.entries.length,47);assert.equal(d.generatorRoutes.length,44);assert.equal(d.entries[0].integrationField,'kept');for(const e of old.entries){const actual=d.entries.find(o=>o.key===e.key);assert.deepEqual({...actual,integrationField:undefined},{...e,integrationField:undefined});}const choices=h.match(/<section data-ready-situations="v1"[\s\S]*?<\/section>/)[0];assert.equal((choices.match(/<button /g)||[]).length,2);}
});
test('Pilot scope registers and compiles only four pages; unknown or empty topic rejected',t=>{
 const dir=fixture(t);syntheticViews(dir,'--topics=finding-toilet,sharing-family-care');const r=run(dir,'--topics=finding-toilet,sharing-family-care');assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).staticPages,4);assert.equal(data(read(dir,'de/index.html')).generatorRoutes.length,2);for(const flag of ['--topics=','--topics=unknown'])assert.notEqual(run(dir,flag,'--prepare-views').status,0);
});
test('Clinical mutation fails before writes even during preparation',t=>{
 const dir=fixture(t),before=snapshot(dir),p='content/ready-situations.de.json',entries=source(dir,'de');entries[0].phrases[0]='Changed care advice';write(dir,p,JSON.stringify(entries));const r=run(dir,'--prepare-views');assert.notEqual(r.status,0);assert.match(r.stderr,/Existing clinical data changed/);assert.deepEqual(snapshot(dir),before);
});
test('Edited legacy page and unregistered out-of-prefix path cannot be overwritten',t=>{
 const dir=fixture(t);syntheticViews(dir);const entry=source(dir,'de')[0];write(dir,entry.page.path.slice(1),read(dir,entry.page.path.slice(1)).replace(/ data-situation-topic="[^"]*"/,'')+'\n<!-- foreign edit -->');const before=snapshot(dir),r=run(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/Refusing to replace another page/);assert.deepEqual(snapshot(dir),before);
 const entries=source(dir,'en');entries[0].page.path='/guides/another.html';write(dir,'content/ready-situations.en.json',JSON.stringify(entries));assert.match(run(dir,'--prepare-views').stderr,/Unregistered static path|Non-reciprocal language pair/);
});
test('All88 compile with synthetic fixtures; original URLs/selfCare flags retained, guide body unchanged with reciprocal metadata correction; rerun idempotent',t=>{
 const dir=fixture(t),guide='guides/dementia-wants-to-go-home.html',before=read(dir,guide);syntheticViews(dir);const r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).staticPages,88);const corrected=read(dir,guide);assert.equal(corrected.split('</head>')[1],before.split('</head>')[1]);assert.ok(!corrected.includes('hreflang="de"'));assert.ok(corrected.includes('hreflang="x-default" href="https://dementiacoachapp.com/'+guide+'"'));
 const sitemap=read(dir,'sitemap.xml'),cluster=sitemap.match(/<url>[\s\S]*?<\/url>/g).find(s=>s.includes('<loc>https://dementiacoachapp.com/'+guide+'</loc>'));assert.ok(!cluster.includes('hreflang="de"'));assert.ok(cluster.includes('hreflang="x-default" href="https://dementiacoachapp.com/'+guide+'"'));
 for(const lang of ['de','en'])for(const e of source(dir,lang)){const h=read(dir,e.page.path.slice(1));assert.ok(h.includes(`data-translator-initial-situation="${e.key}"`));assert.equal((h.match(/id="translator-form"/g)||[]).length,1);assert.equal((h.match(/<h1\b/g)||[]).length,1);assert.ok(h.includes('href="https://dementiacoachapp.com'+e.page.alternatePath+'"'));}
 const en=source(dir,'en').find(e=>e.key==='exhausted');assert.ok(en.selfCare&&en.safetyOnly&&en.keywords.length);assert.equal(en.page.path,'/guides/dementia-caregiver-overwhelmed.html');const second=run(dir);assert.equal(second.status,0,second.stderr);assert.equal(JSON.parse(second.stdout).filesChanged,0);
});
test('Actual production sources without browser caches cannot compile or change pages',t=>{
 const dir=fixture(t),before=snapshot(dir);for(const lang of ['de','en']){const entries=source(dir,lang);for(const e of entries){e.reviewStatus='reviewed';delete e.view;}write(dir,`content/ready-situations.${lang}.json`,JSON.stringify(entries));}const r=run(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/Missing\/stale actual app view/);assert.deepEqual(snapshot(dir),before);
});

test('Metadata-only guide correction refuses foreign edits before writing any page',t=>{
 const dir=fixture(t);syntheticViews(dir);const guide='guides/dementia-wants-to-go-home.html';write(dir,guide,read(dir,guide)+'<!-- foreign -->');const before=snapshot(dir),r=run(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/Metadata-only source changed/);assert.deepEqual(snapshot(dir),before);
});
