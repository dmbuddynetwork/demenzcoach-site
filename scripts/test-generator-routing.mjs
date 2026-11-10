import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import worker,{generatorRouteTarget,germanSituationTarget} from '../cloudflare-worker.js';
const {createPreviewServer}=createRequire(import.meta.url)('./generator-preview.cjs');
const root=new URL('../',import.meta.url),read=rel=>fs.readFileSync(new URL(rel,root),'utf8');
const active=JSON.parse(read('content/generator-public-routes.json')).routes;
const inventory=JSON.parse(read('content/generator-route-manifest.json')).routes;
const origin='https://dementiacoachapp.com';
const workerFirst=JSON.parse(read('wrangler.jsonc').match(/"run_worker_first"\s*:\s*(\[[\s\S]*?\])/)[1].replace(/^\s*\/\/.*$/gm,''));
const legacyWorkerFirst=[
 '/teller','/teller/','/teller/index.html','/de/','/de/index.html',
 '/en/','/en/index.html','/en/dementia-translator/','/en/dementia-translator/index.html',
 '/demenz-uebersetzer','/demenz-uebersetzer/*','/ratgeber','/ratgeber/*',
 '/de/demenz-uebersetzer/','/de/demenz-uebersetzer/index.html','/de/ratgeber/','/de/ratgeber/index.html',
 '/','/index.html','/index-en.html','/index-pl.html','/index-ro.html','/index-bg.html',
 '/index-hr.html','/index-sk.html','/index-hu.html','/index-cs.html','/index-uk.html',
 '/index-bs.html','/index-sr.html','/index-lt.html','/index-sl.html','/index-lv.html','/index-et.html',
 '/index-ru.html','/index-tr.html','/index-ar.html','/index-fr.html','/index-it.html','/index-es.html',
 '/index-pt.html','/index-nl.html','/index-el.html','/index-sq.html','/index-fa.html','/index-th.html',
 '/index-da.html','/index-fi.html','/index-ga.html','/index-mt.html','/index-sv.html'
];
const generatorWorkerFirst=[
 '/de/demenz-uebersetzer/*','/de/ratgeber/*','/de/angehoerige/*',
 '/en/dementia-translator/*','/en/caregivers/*','/guides/dementia-caregiver-overwhelmed.html'
];
// Cloudflare also rejects exact hub/index entries already covered by a prefix rule.
const redundantLegacyWorkerFirst=legacyWorkerFirst.filter(path=>generatorWorkerFirst.some(pattern=>pattern.endsWith('*')&&path.startsWith(pattern.slice(0,-1))));
const retainedLegacyWorkerFirst=legacyWorkerFirst.filter(path=>!redundantLegacyWorkerFirst.includes(path));
const matchesWorkerFirst=path=>workerFirst.some(pattern=>pattern.endsWith('*')?path.startsWith(pattern.slice(0,-1)):path===pattern);
const routePaths=route=>[...new Set([route.path,...Object.values(route.goalPaths||{}),...(route.selectionPath?[route.selectionPath]:[])])];
test('Public registry enables exactly88 compiled assets, not inventory-only aliases',()=>{
 assert.equal(active.length,88);for(const route of active){assert.ok(inventory.some(item=>item.path===route.path&&item.key===route.key));const html=read(route.path.slice(1));assert.ok(html.includes(`data-translator-initial-situation="${route.key}"`));assert.equal((html.match(/id="translator-form"/g)||[]).length,1);assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.ok(!html.includes('class="seo-article"'));}
 const pilot=active.filter(route=>['finding-toilet','sharing-family-care'].includes(route.topicId));assert.equal(pilot.length,4);assert.equal(generatorRouteTarget(new Request(origin+'/de/demenz-uebersetzer/wo-ist-meine-mutter/verstehen/'),pilot),null);
});
test('Every registered goal/selection is an exact200 asset alias; unknown/private/Safety routes are not invented',()=>{
 for(const route of active){for(const path of [route.path,...Object.values(route.goalPaths||{}),...(route.selectionPath?[route.selectionPath]:[])]){const target=generatorRouteTarget(new Request(origin+path));assert.equal(target.assetPath,route.path);assert.equal(target.canonicalPath,route.path);assert.ok(!/[?&#]/.test(path));}}
 for(const path of ['/de/private-person/verstehen/','/de/demenz-uebersetzer/sterben/tipps/','/en/dementia-translator/i-cant-find-the-toilet/tipps/'])assert.equal(generatorRouteTarget(new Request(origin+path)),null);
 assert.equal(generatorRouteTarget(new Request(origin+active[0].path,{method:'POST'})),null);
});
test('Old known queries become fixed clean paths and never carry unrelated/free-text parameters',()=>{
 for(const route of active){const hub='/'+route.language+'/',url=new URL(hub,origin);url.searchParams.set('situation',route.key);url.searchParams.set('ziel','verstehen');url.searchParams.set('text','PRIVATE_SENTINEL');const result=generatorRouteTarget(new Request(url));assert.equal(result.redirect,new URL(route.goalPaths?.verstehen||route.path,origin).href);assert.ok(!result.redirect.includes('?'));assert.ok(!result.redirect.includes('PRIVATE_SENTINEL'));}
 assert.equal(generatorRouteTarget(new Request(origin+'/de/?situation=PRIVATE_SENTINEL')),null);
});
test('Existing static assets with query and goal reload use the real worker before German legacy mapping',async()=>{
 const route=active.find(item=>item.key==='toilettefinden'),calls=[];
 const env={ASSETS:{async fetch(url,request){calls.push(new URL(url).pathname);try{return new Response(read(new URL(url).pathname.slice(1)),{headers:{'Content-Type':'text/html'}});}catch{return new Response('missing',{status:404});}}}};
 const redirect=await worker.fetch(new Request(origin+route.path+'?situation=toilettefinden&ziel=verstehen&text=PRIVATE_SENTINEL'),env);assert.equal(redirect.status,301);assert.equal(redirect.headers.get('Location'),origin+route.goalPaths.verstehen);
 const answer=await worker.fetch(new Request(origin+route.goalPaths.verstehen),env);assert.equal(answer.status,200);assert.ok((await answer.text()).includes('data-translator-initial-situation="toilettefinden"'));assert.deepEqual(calls,[route.path]);
 assert.equal(germanSituationTarget(new Request(origin+'/de/?situation=unknown')),null);
});
test('Missing registered assets fail closed instead of returning the language home',async()=>{
 const route=active.find(item=>item.key==='toilettefinden');const result=await worker.fetch(new Request(origin+route.goalPaths.tipps),{ASSETS:{async fetch(){return new Response('missing',{status:404});}}});assert.equal(result.status,404);
});
test('Cloudflare worker-first stays within100 rules and preserves legacy routing with bounded generator groups',()=>{
 assert.ok(workerFirst.length<=100,`${workerFirst.length} exceeds Cloudflare limit100`);
 assert.equal(workerFirst.length,new Set(workerFirst).size,'no duplicate rules');
 assert.equal(redundantLegacyWorkerFirst.length,6,'only the six fully covered old hub/index entries are removed');
 assert.deepEqual(workerFirst.slice(0,retainedLegacyWorkerFirst.length),retainedLegacyWorkerFirst,'all other legacy rules remain in order');
 for(const path of legacyWorkerFirst)assert.ok(path.endsWith('*')?workerFirst.includes(path):matchesWorkerFirst(path),'legacy coverage '+path);
 assert.deepEqual(workerFirst.slice(retainedLegacyWorkerFirst.length),generatorWorkerFirst,'only the bounded groups and exact guide are added');
 for(const pattern of workerFirst.filter(path=>path.endsWith('*')))for(const other of workerFirst){
  if(other!==pattern)assert.ok(!other.startsWith(pattern.slice(0,-1)),`${other} is redundant under ${pattern}`);
 }
 for(const route of active)for(const path of routePaths(route))assert.ok(matchesWorkerFirst(path),path);
 for(const path of ['/unrelated.html','/guides/unregistered.html','/en/unregistered.html'])assert.equal(matchesWorkerFirst(path),false,path);
});

test('Actual asset-first preview serves all88 registered canonicals and goal paths through the worker, including old queries',async()=>{
 const preview=await createPreviewServer();
 try{
  for(const route of active){
   const bytes=fs.readFileSync(new URL(route.path.slice(1),root));
   for(const path of routePaths(route))for(const method of ['GET','HEAD']){
    const response=await fetch(preview.origin+path,{method,redirect:'manual'});
    assert.equal(response.status,200,`${method} ${path}`);
    assert.ok(preview.stats.worker.includes(path),'worker-first '+path);
    if(method==='GET')assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,path);
   }
   const query=new URL(route.path,preview.origin);query.searchParams.set('situation',route.key);query.searchParams.set('ziel','verstehen');query.searchParams.set('text','PRIVATE_SENTINEL');
   const response=await fetch(query,{redirect:'manual'});
   assert.equal(response.status,301,route.path+' query');
   assert.equal(response.headers.get('location'),preview.origin+(route.goalPaths?.verstehen||route.path));
  }
 }finally{await preview.close();}
});

test('DE and EN index/hub queries still normalize to registered clean paths',async()=>{
 const preview=await createPreviewServer();
 try{
  for(const language of ['de','en']){
   const route=active.find(item=>item.language===language&&!item.selfCare);
   const hub=language==='de'?'demenz-uebersetzer':'dementia-translator';
   for(const path of [`/${language}/`,`/${language}/index.html`,`/${language}/${hub}/`,`/${language}/${hub}/index.html`])for(const method of ['GET','HEAD']){
    assert.ok(matchesWorkerFirst(path),path);
    const response=await fetch(`${preview.origin}${path}?situation=${encodeURIComponent(route.key)}&ziel=tipps&text=PRIVATE_SENTINEL`,{method,redirect:'manual'});
    assert.equal(response.status,301,`${method} ${path}`);
    assert.equal(response.headers.get('location'),preview.origin+(route.goalPaths?.tipps||route.path));
   }
  }
 }finally{await preview.close();}
});

test('Bounded prefixes do not invent app aliases; unmapped original assets stay byte-identical',async()=>{
 const preview=await createPreviewServer();
 try{
  for(const prefix of generatorWorkerFirst.filter(path=>path.endsWith('*'))){
   for(const suffix of ['unregistered-page.html','unregistered-page/tipps/']){
    const path=prefix.slice(0,-1)+suffix;
    assert.equal(generatorRouteTarget(new Request(origin+path)),null,path);
    for(const method of ['GET','HEAD']){
     const response=await fetch(preview.origin+path,{method,redirect:'manual'});
     assert.equal(response.status,404,`${method} ${path}`);
    }
   }
  }
  const guide='/guides/'+fs.readdirSync(new URL('guides/',root)).find(name=>name.endsWith('.html')&&!active.some(route=>route.path==='/guides/'+name));
  assert.equal(matchesWorkerFirst(guide),false,'unmapped guide stays asset-first');
  for(const path of [guide,'/de/ratgeber/redaktion.html']){
   assert.equal(generatorRouteTarget(new Request(origin+path)),null,path);
   const response=await fetch(preview.origin+path,{redirect:'manual'});
   assert.equal(response.status,200,path);
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(new URL(path.slice(1),root)),path);
  }
  assert.equal(preview.stats.worker.includes(guide),false,'unmapped guide was not intercepted');
 }finally{await preview.close();}
});

test('Prototype and unknown goal values use only the fixed selection path',async()=>{
 const route=active.find(item=>item.language==='de'&&item.key==='mutter');
 for(const goal of ['__proto__','constructor','toString','invalid']){
 const url=origin+'/de/?situation=mutter&ziel='+goal;
 assert.equal(generatorRouteTarget(new Request(url)).redirect,origin+route.selectionPath);
 const response=await worker.fetch(new Request(url),{ASSETS:{async fetch(){throw Error('redirect needs no asset');}}});
 assert.equal(response.status,301);assert.equal(response.headers.get('location'),origin+route.selectionPath);
 }
 const inherited={...route,goalPaths:Object.create({jetzt:route.path})};
 assert.equal(generatorRouteTarget(new Request(origin+'/de/?situation=mutter&ziel=jetzt'),[inherited]).redirect,origin+route.selectionPath);
});
