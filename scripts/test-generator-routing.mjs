import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker,{generatorRouteTarget,germanSituationTarget} from '../cloudflare-worker.js';
const root=new URL('../',import.meta.url),read=rel=>fs.readFileSync(new URL(rel,root),'utf8');
const active=JSON.parse(read('content/generator-public-routes.json')).routes;
const inventory=JSON.parse(read('content/generator-route-manifest.json')).routes;
const origin='https://dementiacoachapp.com';
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
test('Cloudflare worker-first names every actual canonical, without a full-site SPA catchall',()=>{
 const config=read('wrangler.jsonc');for(const route of active)assert.ok(config.includes(JSON.stringify(route.path)));assert.ok(!config.includes('"/*"'));
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
