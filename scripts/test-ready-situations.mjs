import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
const pages=['de/index.html','de/demenz-uebersetzer/index.html','en/index.html','en/dementia-translator/index.html'];
const pattern=/(<script type="application\/json" id="translator-data">)([\s\S]*?)(<\/script>)/;
const data=html=>JSON.parse(html.match(pattern)[2]);
function fixture(t,reviewed=true) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dc-situations-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const copy=rel=>{fs.mkdirSync(path.dirname(path.join(dir,rel)),{recursive:true});fs.copyFileSync(path.join(root,rel),path.join(dir,rel));};
  for(const rel of [...pages,'sitemap.xml','content/generator-route-manifest.json','de/demenz-uebersetzer/ich-muss-nicht-aufs-klo.html','de/ratgeber/pflegende-angehoerige-ueberfordert.html','en/dementia-translator/i-dont-need-the-bathroom.html','guides/dementia-caregiver-overwhelmed.html','demenz-uebersetzer/translator.js','demenz-uebersetzer/translator-core.js','demenz-uebersetzer/translator-core-en.js','demenz-uebersetzer/translator-locale.js'])copy(rel);
  // The app shell is the renderer/helper dependency manifest.
  const js=new Set(['start/situation-context.js','abo/web-auth.js','abo/email-auth.js','abo/email-account.js','abo/email-link-bootstrap.js','abo/google-auth.js','abo/inline-signup.js','abo/signup-offer-view.js','abo/signup-offer-view.css','abo/signup-sheet.js']);
  for(const lang of ['de','en'])for(const m of fs.readFileSync(path.join(root,lang+'/index.html'),'utf8').matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)){const u=new URL(m[1],'https://dementiacoachapp.com/'+lang+'/');if(u.origin==='https://dementiacoachapp.com')js.add(u.pathname.slice(1));}
  for(const rel of ['abo/web-auth.js','abo/email-auth.js','abo/email-account.js','abo/email-link-bootstrap.js','abo/google-auth.js','abo/inline-signup.js','abo/signup-offer-view.js','abo/signup-offer-view.css','abo/signup-sheet.js'])js.add(rel);
  for(const lang of ['de','en'])for(const m of fs.readFileSync(path.join(root,lang+'/index.html'),'utf8').matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)){const u=new URL(m[1],'https://dementiacoachapp.com/'+lang+'/');if(u.origin==='https://dementiacoachapp.com')js.add(u.pathname.slice(1));}
  for(const rel of js)copy(rel);
  for(const lang of ['de','en']) {
    copy(`content/ready-situations.${lang}.json`);
    const p=path.join(dir,`content/ready-situations.${lang}.json`), entries=JSON.parse(fs.readFileSync(p,'utf8')).filter(e=>!e.page.legacySourceSHA256);
    for(const e of entries)e.reviewStatus=reviewed?'reviewed':'pending';
    fs.writeFileSync(p,JSON.stringify(entries));
  }
  // Recreate a baseline with no additions, preserving the surrounding integrated markup.
  for(const rel of pages) {
    const p=path.join(dir,rel),html=fs.readFileSync(p,'utf8'),d=data(html);
    d.entries=d.entries.filter(e=>!['toilettefinden','pflegeaufteilen','findtoilet','sharecare'].includes(e.key));
    fs.writeFileSync(p,html.replace(pattern,(_m,a,_d,c)=>a+JSON.stringify(d)+c).replace(/<section data-ready-situations="v1"[\s\S]*?<\/section>/,''));
  }
  // Unit fixtures exercise compiler behavior with synthetic current bindings.
  // This does NOT refresh or certify any real browser-exported production view.
  {
    const bindingRun=spawnSync(process.execPath,[path.join(root,'scripts/build-ready-situations.mjs'),dir,'--view-bindings','--preview'],{encoding:'utf8'});
    assert.equal(bindingRun.status,0,bindingRun.stderr);const bindings=JSON.parse(bindingRun.stdout);
    for(const lang of ['de','en']) {
      const p=path.join(dir,`content/ready-situations.${lang}.json`),entries=JSON.parse(fs.readFileSync(p,'utf8'));
      for(const e of entries)e.view={key:e.key,language:lang,goal:lang==='de'&&!e.selfCare?'jetzt':'',bindings:bindings[lang],html:'<h1>Unit fixture</h1>'+e.phrases.map(s=>'<p>'+s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</p>').join('')};
      fs.writeFileSync(p,JSON.stringify(entries));
    }
  }
  return dir;
}
const build=(dir,...args)=>spawnSync(process.execPath,[path.join(root,'scripts/build-ready-situations.mjs'),dir,...args],{encoding:'utf8'});
const contents=dir=>Object.fromEntries(pages.map(p=>[p,fs.readFileSync(path.join(dir,p),'utf8')]));
test('Unreviewed content fails before changing any page',t=>{
  const dir=fixture(t,false),before=contents(dir),r=build(dir);
  assert.notEqual(r.status,0);assert.match(r.stderr,/Content review pending/);assert.deepEqual(contents(dir),before);
});
test('Four static generator-app states, one primary input/result, reciprocal languages and additive catalogs',t=>{
  const dir=fixture(t),before=contents(dir),r=build(dir);assert.equal(r.status,0,r.stderr);
  const allUrls=[];
  for(const lang of ['de','en'])for(const e of JSON.parse(fs.readFileSync(path.join(dir,`content/ready-situations.${lang}.json`),'utf8'))) {
    const html=fs.readFileSync(path.join(dir,e.page.path),'utf8');
    assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/<meta name="robots" content="index,follow/);
    assert.ok(html.includes(`rel="canonical" href="https://dementiacoachapp.com${e.page.path}"`));
    assert.ok(html.includes(`href="https://dementiacoachapp.com${e.page.alternatePath}"`));
    assert.ok(html.includes(`data-translator-initial-situation="${e.key}"`));
    assert.ok(html.includes('id="translator-data"'));
    assert.equal((html.match(/id="translator-form"/g)||[]).length,1);
    const originalForm=fs.readFileSync(path.join(dir,`${lang}/index.html`),'utf8').match(/<form\b[^>]*\bid="translator-form"[^>]*>[\s\S]*?<\/form>/)[0];
    assert.ok(html.includes(originalForm),'Original primary form bytes stay in the shared shell');
    assert.ok(html.indexOf(originalForm)<html.indexOf('id="translator-result"'),'Original form position precedes the result, rather than moving to a new sibling');

    assert.equal((html.match(/id="translator-result"/g)||[]).length,1);
    assert.ok(!html.includes('data-ready-situations="v1"'),'Prepared answer omits the home-only example disclosure');
    assert.ok(!html.includes('Open this situation in the web app'));
    assert.ok(!html.includes('Situation in der Web-App öffnen'));
    assert.ok(html.includes(`href="${e.page.alternatePath}" lang="${lang==='de'?'en':'de'}"`));
    assert.ok(data(html).entries.every(e=>!('view'in e)));
    for(const form of html.matchAll(/<form inert class="translator-signup-form"[^>]*>([\s\S]*?)<\/form>/g)) for(const control of form[1].matchAll(/<(?:input|button|select|textarea)\b[^>]*>/g)) assert.match(control[0],/\sdisabled(?:\s|>)/);
    for(const phrase of e.phrases)assert.ok(html.includes(phrase.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')));
    for(const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))assert.equal(JSON.parse(m[1])['@type'],'WebPage');
    allUrls.push('https://dementiacoachapp.com'+e.page.path);
  }
  const sitemap=fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8');
  for(const url of allUrls)assert.equal(sitemap.split(`<loc>${url}</loc>`).length-1,1);
  for(const rel of pages){
    const html=fs.readFileSync(path.join(dir,rel),'utf8'),old=data(before[rel]),d=data(html);
    assert.equal(d.entries.length,old.entries.length+2);assert.deepEqual(d.entries.slice(0,old.entries.length),old.entries);
    for(const[k,v]of Object.entries(old.formal))assert.equal(d.formal[k],v);
    assert.match(html, /data-translator-input-position="top"/);
    assert.match(html, /<label class="translator-form-label" for="translator-input">/);
    assert.match(html, /<textarea[^>]*id="translator-input"[^>]*rows="2"/);
    const expectedIntro=rel.startsWith('de/')?'Passende Worte und praktische Tipps für deine Situation.':'Find the right words and practical tips for your situation.';
    assert.ok(html.includes(`<p class="translator-form-intro" id="translator-form-intro">${expectedIntro}</p>`));
    assert.match(html, /aria-describedby="translator-form-intro translator-empty-hint translator-privacy-note"/);
    const normalizeInputLayout=markup=>markup.replace(/ data-translator-input-position="top"/,'')
      .replace(/<label\b[^>]*for="translator-input"[^>]*>[\s\S]*?<\/label>/,'<label for="translator-input">INPUT_LABEL</label>')
      .replace(/<p\b[^>]*id="translator-form-intro"[^>]*>[\s\S]*?<\/p>/g,'')
      .replace(/(<textarea[^>]*id="translator-input"[^>]*rows=")[^"]*(")/,'$1ROWS$2')
      .replace(/(<textarea[^>]*id="translator-input"[^>]*aria-describedby=")([^"]*)(")/,(_match,a,ids,b)=>a+ids.split(/\s+/).filter(id=>id!=='translator-form-intro').join(' ')+b);
    assert.equal(normalizeInputLayout(html).replace(pattern,'DATA').replace(/<section data-ready-situations="v1"[\s\S]*?<\/section>/,''),normalizeInputLayout(before[rel]).replace(pattern,'DATA'));
    assert.equal(d.entries.find(e=>e.key==='pflegeaufteilen'||e.key==='sharecare').keywords.length,0);
    for(const url of allUrls.filter(u=>u.includes('/'+rel.slice(0,2)+'/')))assert.ok(html.includes(`href="${new URL(url).pathname}"`));
  }
  const first=contents(dir),sitemapBefore=sitemap,r2=build(dir);assert.equal(r2.status,0,r2.stderr);assert.deepEqual(contents(dir),first);assert.equal(fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8'),sitemapBefore);assert.equal(JSON.parse(r2.stdout).filesChanged,0);
});
test('Preview stays noindex and adds no new sitemap URLs',t=>{
  const dir=fixture(t,false),r=build(dir,'--preview');assert.equal(r.status,0,r.stderr);
  const e=JSON.parse(fs.readFileSync(path.join(dir,'content/ready-situations.en.json'),'utf8'))[0];
  assert.match(fs.readFileSync(path.join(dir,e.page.path),'utf8'),/noindex,nofollow/);
  assert.ok(!fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8').includes(`<loc>https://dementiacoachapp.com${e.page.path}</loc>`));
});
test('Broken language pair causes no partial writes',t=>{
  const dir=fixture(t),p=path.join(dir,'content/ready-situations.en.json'),e=JSON.parse(fs.readFileSync(p,'utf8'));e[0].page.alternatePath='/de/wrong.html';fs.writeFileSync(p,JSON.stringify(e));const before=contents(dir),r=build(dir);assert.notEqual(r.status,0);assert.deepEqual(contents(dir),before);
});
test('A new topic requires a fresh actual generator export instead of manufacturing a second UI',t=>{
  const dir=fixture(t),p=path.join(dir,'content/ready-situations.de.json'),entries=JSON.parse(fs.readFileSync(p,'utf8'));
  delete entries[0].view;fs.writeFileSync(p,JSON.stringify(entries));const before=contents(dir),r=build(dir);
  assert.notEqual(r.status,0);assert.match(r.stderr,/Missing\/stale actual app view/);assert.deepEqual(contents(dir),before);
});
test('Changed renderer or locale causes fail-closed stale-view rejection before writes',t=>{
  for(const rel of ['demenz-uebersetzer/translator.js','demenz-uebersetzer/translator-locale.js','demenz-uebersetzer/translator-signup.js','start/situation-context.js','abo/web-auth.js','abo/email-auth.js','abo/email-account.js','abo/email-link-bootstrap.js','abo/google-auth.js','abo/inline-signup.js','abo/signup-offer-view.js','abo/signup-offer-view.css','abo/signup-sheet.js']) {
    const dir=fixture(t),before=contents(dir);fs.appendFileSync(path.join(dir,rel),'\n// synthetic change\n');const r=build(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/Missing\/stale actual app view/);assert.deepEqual(contents(dir),before);
  }
});
test('Changed UI data or an executable cached fragment cannot be silently republished',t=>{
  const dir=fixture(t),p=path.join(dir,'en/index.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('What do I say?', 'Synthetic changed UI')); // This changes shell, not necessarily client data.
  const html=fs.readFileSync(p,'utf8'),d=data(html);d.ui.strings['synthetic-render-label']='Changed';fs.writeFileSync(p,html.replace(pattern,(_m,a,_d,c)=>a+JSON.stringify(d)+c));
  const before=contents(dir),r=build(dir);assert.notEqual(r.status,0);assert.deepEqual(contents(dir),before);
  const other=fixture(t),sourceFile=path.join(other,'content/ready-situations.en.json'),entries=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  entries[0].view.html+='<script>syntheticExecutable()</script>';fs.writeFileSync(sourceFile,JSON.stringify(entries));const otherBefore=contents(other),bad=build(other);assert.notEqual(bad.status,0);assert.match(bad.stderr,/Unsafe or duplicate/);assert.deepEqual(contents(other),otherBefore);
});
const demand=input=>spawnSync(process.execPath,[path.join(root,'scripts/import-situation-demand.mjs'),root],{input:JSON.stringify(input),encoding:'utf8'});
test('Demand import deduplicates snapshots, emits fixed IDs/counts, holds unknown text privately',()=>{
  const privateText='Synthetic unknown PRIVACY_SENTINEL person@example.invalid 12345';
  const r=demand({source:'translatorSharedSentences',generalizedOnly:true,records:[{language:'de',sentence:'Ich finde die Toilette nicht.',count:2},{language:'de',sentence:'Ich finde die Toilette nicht.',count:2},{language:'en',sentence:"My siblings aren't helping with care.",count:1},{language:'de',sentence:privateText,count:3}]});
  assert.equal(r.status,0,r.stderr);const d=JSON.parse(r.stdout);assert.equal(d.topics.find(t=>t.topicId==='finding-toilet').counts.de,2);assert.equal(d.needsEditorialReview.count,3);assert.equal(d.publicationTriggered,false);assert.ok(!r.stdout.includes('PRIVACY_SENTINEL'));assert.ok(!r.stdout.includes('example.invalid'));assert.ok(!r.stderr.includes(privateText));
});
test('Demand import rejects original-prompt source and unexpected identifying fields',()=>{
  for(const input of [{source:'privateUserPrompts',generalizedOnly:true,records:[]},{source:'translatorSharedSentences',generalizedOnly:true,records:[{language:'de',sentence:'test',count:1,email:'secret@example.invalid'}]}]){
    const r=demand(input);assert.notEqual(r.status,0);assert.ok(!r.stderr.includes('secret@example.invalid'));
  }
});

const controller=fs.readFileSync(path.join(root,'demenz-uebersetzer/translator.js'),'utf8');
const init=controller.slice(controller.indexOf('  const params = new URLSearchParams(location.search);'),controller.indexOf("  window.addEventListener('hashchange', openFromHash);"));
assert.ok(init.includes('staticDefault'));
function initialize({query='',hash='',isStatic=true}={}) {
  const def={key:'toilettefinden',says:'Ich finde die Toilette nicht.'},normal={key:'waschen',says:'Ich will nicht duschen.'},safety={key:'sterben',says:'Synthetic urgent public key',safetyOnly:true};
  const calls=[],context={URLSearchParams,location:{search:query,hash},entryByKey:new Map([def,normal,safety].map(e=>[e.key,e])),feelingEntries:new Map([['angst',{}]]),phraseHash:'satz-',feelingHash:'gefuehl-',staticDefault:isStatic?def:null,keepInputAtTop:true,validGoals:new Set(['jetzt','verstehen','tipps']),input:{value:''},document:{body:{dataset:{translatorInitialGoal:'jetzt'}},title:'SEO title'},initialTitle:'SEO title',grow(){},render(e,opts){calls.push(['render',e.key,opts]);},askGoal(e){calls.push(['goal',e.key]);},track(...args){calls.push(['track',...args]);},formBelow(opts){calls.push(['form',opts]);},setPage(...args){calls.push(['page',...args]);},openFromHash(){calls.push(['legacy']);}};
  Object.assign(context,{URL,publicByKey:new Map(),goalsFor:e=>e.safetyOnly?null:['fixed'],pathState:isStatic?{route:{selectionPath:'/de/topic/auswahl/'},goal:'jetzt'}:null,history:{state:null,replaceState(){} }});
  context.location.pathname=isStatic?'/de/topic.html':'/de/';context.location.href='https://dementiacoachapp.com'+context.location.pathname+query+hash;
  vm.runInNewContext(init,context);return {calls,context};
}
test('Actual init block hydrates default once without AI/history and opens one followup form',()=>{
  const {calls,context}=initialize();assert.equal(calls.filter(c=>c[0]==='render').length,1);assert.equal(calls.filter(c=>c[0]==='track').length,1);assert.equal(calls.filter(c=>c[0]==='page').length,0);assert.equal(calls.find(c=>c[0]==='render')[2].goal,'jetzt');assert.equal(calls.find(c=>c[0]==='render')[2].preserveViewport,true);assert.equal(calls.find(c=>c[0]==='form')[1].open,true);assert.equal(context.document.title,'SEO title');
});
test('Actual init honors valid query/hash, hydrates invalid states, and never downgrades an explicit safety key',()=>{
  assert.equal(initialize({query:'?situation=waschen&ziel=jetzt'}).calls.find(c=>c[0]==='render')[1],'waschen');
  assert.equal(initialize({query:'?situation=waschen',hash:'#satz-waschen'}).calls[0][0],'legacy');
  assert.equal(initialize({query:'?situation=unknown',hash:'#satz-unknown'}).calls.find(c=>c[0]==='render')[1],'toilettefinden');
  assert.equal(initialize({query:'?situation=waschen&ziel=jetzt',hash:'#satz-unknown'}).calls.find(c=>c[0]==='render')[1],'waschen');
  const safety=initialize({query:'?situation=sterben'});assert.equal(safety.calls.find(c=>c[0]==='render')[2].safetyHit,true);assert.equal(safety.calls.filter(c=>c[0]==='track').length,1);
  assert.equal(initialize({query:'?situation=unknown',isStatic:false}).calls[0][0],'legacy');
});
const historyCode=controller.slice(controller.indexOf('  const staticHistory ='),controller.indexOf('  // Nach dem Ergebnis rückt'));
const hashCode=controller.slice(controller.indexOf('  const setHash ='),controller.indexOf('\n  function showFeeling'));
function historyFixture({isStatic=false,state=null}={}) {
  const calls=[],listeners={},entry={key:'waschen'},context={URL,staticDefault:isStatic?{}:null,history:{state,pushState(s,_t,url){this.state=s;calls.push(['push',s]);context.location.href=String(url);},replaceState(s,_t,url){this.state=s;calls.push(['replace',s]);context.location.href=String(url);}},location:{href:'https://dementiacoachapp.com/de/',reload(){calls.push(['reload']);}},startPath:'/de/',phraseHash:'satz-',validGoals:new Set(['jetzt']),entryByKey:new Map([['waschen',entry]]),leaveStaticContext(){},window:{addEventListener(event,fn){listeners[event]=fn;}}};
  Object.assign(context,{publicByKey:new Map(),currentGoal:'',feelingHash:'gefuehl-',feelingEntries:new Map(),topicMetadata(route){calls.push(['metadata',route.path]);}});
  const routePathCode=controller.match(/  const routePath =[^\n]+/)[0];
  vm.runInNewContext(routePathCode+'\n'+historyCode+'\n'+hashCode+'\nthis.api={setPage,setHash};',context);return {context,calls,listeners,entry};
}
test('Actual page/hash history helpers keep static origin through reload; ordinary home behavior stays unchanged',()=>{
  const first=historyFixture({isStatic:true});first.context.api.setPage(first.entry);assert.equal(first.context.history.state.translatorStatic,true);first.context.api.setHash('sterben');assert.equal(first.context.history.state.translatorStatic,true);
  const reloaded=historyFixture({state:first.context.history.state});reloaded.listeners.popstate();assert.equal(reloaded.calls[0][0],'reload');
  const ordinary=historyFixture();ordinary.listeners.popstate();assert.equal(ordinary.calls.length,0);ordinary.context.api.setHash('');assert.equal(ordinary.context.history.state,null);
});


test('Actual fallback keeps exactly one hash prefix and excludes unknown private keys',()=>{
 const f=historyFixture();f.context.api.setPage(f.entry);assert.equal(new URL(f.context.location.href).hash,'#satz-waschen');assert.ok(!f.context.location.href.includes('##'));
 f.context.entryByKey.set('sterben',{key:'sterben',safetyOnly:true});f.context.api.setHash('sterben');assert.equal(new URL(f.context.location.href).hash,'#satz-sterben');
 f.context.api.setHash('PRIVATE_INPUT');assert.equal(new URL(f.context.location.href).hash,'');assert.ok(!f.context.location.href.includes('PRIVATE_INPUT'));
});
test('Actual setPage uses registered fixed goal/selection paths without query strings',()=>{
 const f=historyFixture(),route={path:'/de/topic.html',selectionPath:'/de/topic/auswahl/',goalPaths:{jetzt:'/de/topic.html',verstehen:'/de/topic/verstehen/',tipps:'/de/topic/tipps/'}};f.context.publicByKey.set('waschen',route);
 for(const [goal,path]of [['',route.selectionPath],...['__proto__','constructor','toString','invalid'].map(goal=>[goal,route.selectionPath]),...Object.entries(route.goalPaths)]){f.context.api.setPage(f.entry,goal);const url=new URL(f.context.location.href);assert.equal(url.pathname,path);assert.equal(url.search,'');assert.equal(url.hash,'');}
});
test('Actual view-state title retains a fixed public topic and uses generic titles for private output',()=>{
 const block=controller.slice(controller.indexOf('  const setViewState ='),controller.indexOf('  const translatedAttributes'));
 const examples={hidden:false};
 const context={requestAnimationFrame(){},document:{body:{dataset:{}},title:'',querySelector(selector){assert.equal(selector,'[data-ready-situations]');return examples;}},homeHeading:{hidden:false},initialTitle:'Home',ui:null,syncHelpful(){},activePublicRoute:{title:'Fixed public topic'}};
 vm.runInNewContext(block+'\nthis.change=setViewState;',context);
 context.change('answer');assert.equal(context.document.title,'Fixed public topic');assert.equal(examples.hidden,true);context.change('goal');assert.equal(context.document.title,'Fixed public topic');assert.equal(examples.hidden,true);
 context.activePublicRoute=null;context.change('answer');assert.equal(context.document.title,'Deine Antwort | Demenz Coach');context.change('input');assert.equal(context.document.title,'Home');assert.equal(examples.hidden,false);
});
