import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(process.argv.find((v, i) => i > 1 && !v.startsWith('--')) || fileURLToPath(new URL('../', import.meta.url)));
const preview = process.argv.includes('--preview');
const prepareViews = process.argv.includes('--prepare-views');
const bindingsOnly = process.argv.includes('--view-bindings');
const origin = 'https://dementiacoachapp.com';
const dataPattern = /(<script type="application\/json" id="translator-data">)([\s\S]*?)(<\/script>)/;
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = o => JSON.stringify(o).replaceAll('<', '\\u003c');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const parse = html => {
  const m = html.match(dataPattern);
  if (!m) throw new Error('Missing translator-data');
  return JSON.parse(m[2]);
};
const source = Object.fromEntries(['de', 'en'].map(lang => [lang, JSON.parse(read(`content/ready-situations.${lang}.json`))]));
const registry = JSON.parse(read('content/generator-route-manifest.json'));
if (registry.schemaVersion!==1 || new Set(registry.routes.map(r=>r.path)).size!==registry.routes.length) throw new Error('Invalid route registry');
for (const r of registry.routes) {
  const stem=r.path.replace(/\.html$/,'');
  const expected=r.language==='de'&&!r.selfCare&&!r.safetyOnly?{jetzt:r.path,verstehen:stem+'/verstehen/',tipps:stem+'/tipps/'}:null;
  if (JSON.stringify(r.goalPaths||null)!==JSON.stringify(expected) || (r.selectionPath||null)!==(expected?stem+'/auswahl/':null)) throw new Error('Invalid fixed goal paths');
}
const requested = process.argv.find(v=>v.startsWith('--topics='));
const topicFilter = requested ? new Set(requested.slice(9).split(',')) : null;
if (topicFilter && ([...topicFilter].some(id=>!id || !source.de.some(e=>e.page.topicId===id)))) throw new Error('Unknown or empty selected topic');
const selected = Object.fromEntries(['de','en'].map(lang=>[lang,source[lang].filter(e=>!topicFilter || topicFilter.has(e.page.topicId))]));
const registered = (lang,e) => registry.routes.find(r=>r.language===lang && r.key===e.key && r.topicId===e.page.topicId && r.path===e.page.path && r.alternatePath===e.page.alternatePath && (r.legacySourceSHA256||null)===(e.page.legacySourceSHA256||null) && r.selfCare===!!e.selfCare && r.safetyOnly===!!e.safetyOnly);
const clinicalFields = ['says','variants','keywords','short','meanings','avoid','phrases','next','safety','safetyOnly','safetyFirst','urgentLead','selfCare','meaningTitle','phrasesTitle','safetyTitle','retry','goals'];
const clinicalHash = e => createHash('sha256').update(JSON.stringify({...Object.fromEntries(clinicalFields.filter(k=>k in e).map(k=>[k,e[k]])),trickTexts:(e.tricks||[]).map(t=>Object.fromEntries(['id','title','text'].map(k=>[k,t[k]??null])))})).digest('hex');
const pending = new Map();
const ids = new Set();
for (const lang of ['de', 'en']) {
  for (const e of source[lang]) {
    if (!/^[a-z0-9-]+$/.test(e.page.topicId) || !/^[a-z0-9]+$/.test(e.key)) throw new Error('Invalid fixed topic/key');
    if (!registered(lang,e) || !/^\/[a-z0-9/-]+\.html$/.test(e.page.path)) throw new Error('Unregistered static path');
    if (!e.page.path.startsWith(`/${lang}/`) && !(lang==='en' && e.page.legacySourceSHA256 && e.page.path==='/guides/dementia-caregiver-overwhelmed.html' && /<html[^>]*lang="en(?:-[A-Za-z]+)?"/.test(read(e.page.path.slice(1))))) throw new Error('Invalid static path');
    if (!preview && !prepareViews && !bindingsOnly && selected[lang].includes(e) && e.reviewStatus !== 'reviewed') throw new Error(`Content review pending: ${e.page.topicId}/${lang}`);
    if ((!e.page.legacySourceSHA256 && e.phrases.length < 3) || !e.sources.length) throw new Error('Incomplete situation');
    if (e.page.topicId==='sharing-family-care' && (e.keywords.length || e.meanings.length)) throw new Error('Caregiver situation must remain select-only');
    if (!e.page.legacySourceSHA256 && !['finding-toilet','sharing-family-care'].includes(e.page.topicId) && !e.page.relatedLinks?.length) throw new Error('New topics need explicit related links');
    const other = source[lang === 'de' ? 'en' : 'de'].find(o => o.page.topicId === e.page.topicId);
    if (!other || other.page.path !== e.page.alternatePath || other.page.alternatePath !== e.page.path) throw new Error('Non-reciprocal language pair');
    const id = `${lang}:${e.page.topicId}`;
    if (ids.has(id)) throw new Error(`Duplicate topic: ${id}`);
    ids.add(id);
  }
}
const deData = parse(read('de/index.html'));
const toiletAssets = deData.entries.find(e => e.key === 'toilette');
if (!toiletAssets) throw new Error('Missing existing toilet assets');
const ui = {
  de: {brand:'Demenz Coach', skip:'Zum Inhalt springen', home:'Start', tool:'Alle Situationen', say:'Das kannst du sagen', next:'Das kannst du tun', avoid:'Eher vermeiden', safety:'Wann du weitere Hilfe brauchst', retry:'Wenn es nicht hilft: zweiter Versuch', sources:'Quellen', questions:'Häufige Fragen', open:'Situation in der Web-App öffnen', related:'Weitere passende Hilfe', back:'Alle fertigen Situationen', other:'English', editorial:'Demenz Coach Redaktion', date:'Inhalt geprüft am', note:'Allgemeine Hinweise; kein Ersatz für ärztlichen Rat.', caregiver:'Unterstützung für dich', choices:'Fertige Situationen', disclaimer:'Bei unmittelbarer Gefahr in Deutschland: 112.'},
  en: {brand:'Dementia Coach', skip:'Skip to content', home:'Home', tool:'All situations', say:'What you can say', next:'What you can do', avoid:'What to avoid', safety:'When you need more help', retry:'If it does not help: a second try', sources:'Sources', questions:'Common questions', open:'Open this situation in the web app', related:'More useful help', back:'All ready-to-use situations', other:'Deutsch', editorial:'Dementia Coach editorial team', date:'Content checked on', note:'General guidance; not a substitute for medical advice.', caregiver:'Support for you', choices:'Ready-to-use situations', disclaimer:'If anyone is in immediate danger, call your local emergency number.'}
};
const tool = lang => lang === 'de' ? '/de/demenz-uebersetzer/' : '/en/dementia-translator/';
const toolPath = lang => `${tool(lang)}index.html`.slice(1);
const list = values => `<ul>${values.map(v => `<li>${escape(v)}</li>`).join('')}</ul>`;
const sha = value => createHash('sha256').update(value).digest('hex');
// Include UI helpers too: signup/access/experiment code can change rendered
// controls without changing translator.js. The home shell is the dependency list.
const rendererFiles = new Set(['demenz-uebersetzer/translator.js','demenz-uebersetzer/translator-core.js','demenz-uebersetzer/translator-core-en.js','demenz-uebersetzer/translator-locale.js','start/situation-context.js','abo/web-auth.js','abo/email-auth.js','abo/email-account.js','abo/email-link-bootstrap.js','abo/signup-offer-view.css']);
for (const lang of ['de','en']) for (const match of read(`${lang}/index.html`).matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
  const url = new URL(decodeURI(match[1]),origin+`/${lang}/`);
  if (url.origin===origin) rendererFiles.add(url.pathname.slice(1));
}
// Bind literal local module imports as well as script tags. Authentication controls
// must invalidate a public-view cache when their current implementation changes.
for (const rel of rendererFiles) {
  const script=read(rel);
  const references=[...script.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),...script.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g)];
  for (const match of references) {
    if (!/^(?:\.|\/)/.test(match[1])) continue;
    const url=new URL(match[1],origin+'/'+rel);
    if (url.origin===origin && /\.m?js$/.test(url.pathname)) rendererFiles.add(url.pathname.slice(1));
  }
}
for(const lang of ['de','en'])for(const match of read(`${lang}/index.html`).matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)){
 const url=new URL(match[1],origin+`/${lang}/`);if(url.origin===origin)rendererFiles.add(url.pathname.slice(1));
}
const rendererSources = Object.fromEntries([...rendererFiles].sort().map(rel=>[rel,sha(read(rel))]));
const bindings = lang => ({dataHash:sha(JSON.stringify(parse(pending.get(`${lang}/index.html`) || read(`${lang}/index.html`)))),sources:rendererSources});
const decode = value => value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const attr = (tag,key) => decode(tag.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] || '');
function renderPage(lang, e) {
  const view=e.view, expected=bindings(lang);
  if (!view || view.key!==e.key || view.language!==lang || view.goal!==(lang==='de'&&!e.selfCare?'jetzt':'') || JSON.stringify(view.bindings)!==JSON.stringify(expected)) throw new Error(`Missing/stale actual app view: ${lang}/${e.key}; export from the current generator`);
  const answer=view.html;
  if (!answer || (answer.match(/<h1\b/g)||[]).length!==1 || /<(?:script|iframe)\b|\bon\w+\s*=|id="translator-(?:input|result|form)"|127\.0\.0\.1|localhost/i.test(answer)) throw new Error('Unsafe or duplicate view content');
  for (const tag of answer.match(/<form\b[^>]*>/g)||[]) if (tag !== '<form class="translator-signup-form" novalidate="">') throw new Error('Unexpected cached form');
  // Live signup is created with a submit handler. Its static copy must never
  // fall back to a native GET containing EMAIL before/without hydration.
  const staticAnswer=answer.replace(/<form class="translator-signup-form" novalidate="">[\s\S]*?<\/form>/g, form => form
    .replace('<form ', '<form inert ')
    .replace(/<(input|button|select|textarea)\b([^>]*)>/g, (_m,tag,attrs)=>`<${tag}${attrs} disabled>`));
  let html=pending.get(`${lang}/index.html`) || read(`${lang}/index.html`);
  const originalMeta = (name,kind='name') => attr(html.match(new RegExp(`<meta\\b[^>]*\\b${kind}="${name}"[^>]*>`))?.[0] || '', 'content');
  const appMeta={title:decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]),description:originalMeta('description'),canonical:origin+`/${lang}/`,alternates:[...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)].map(m=>({lang:attr(m[0],'hreflang'),href:attr(m[0],'href')})),structuredData:[...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]))};
  const p=e.page,url=origin+p.path;
  html=html.replace(/<title>[\s\S]*?<\/title>/,()=>`<title>${escape(p.title)}</title>`);
  for (const [name,kind,content] of [['description','name',p.description],['robots','name',preview?'noindex,nofollow':'index,follow,max-image-preview:large'],['og:type','property','website'],['og:title','property',p.title],['og:description','property',p.description],['og:url','property',url],['twitter:title','name',p.title],['twitter:description','name',p.description]]) {
    const pattern=new RegExp(`<meta\\b[^>]*\\b${kind}="${name}"[^>]*>`);
    if (!pattern.test(html)) throw new Error(`Missing shared app metadata: ${name}`);
    html=html.replace(pattern,()=>`<meta ${kind}="${name}" content="${escape(content)}">`);
  }
  html=html.replace(/<link\b[^>]*rel="canonical"[^>]*>/,()=>`<link rel="canonical" href="${url}">`).replace(/<link\b[^>]*rel="alternate"[^>]*>/g,'');
  html=html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,'');
  const dePath=lang==='de'?p.path:p.alternatePath,enPath=lang==='en'?p.path:p.alternatePath;
  const schema={'@context':'https://schema.org','@type':'WebPage','@id':url, url,name:p.title,description:p.description,inLanguage:lang,isPartOf:{'@type':'WebSite',name:ui[lang].brand,url:origin+`/${lang}/`},citation:e.sources};
  html=html.replace('</head>',()=>`<link rel="alternate" hreflang="de" href="${origin+dePath}"><link rel="alternate" hreflang="en" href="${origin+enPath}"><link rel="alternate" hreflang="x-default" href="${origin+dePath}"><script type="application/ld+json" id="translator-situation-schema">${json(schema)}</script><script type="application/json" id="translator-app-meta">${json(appMeta)}</script></head>`);
  html=html.replace(/<body\b([^>]*)>/,(_m,attrs)=>`<body${attrs.replace(/class="([^"]*)"/,(_a,classes)=>`class="${classes} translator-has-result"`)} data-translator-state="answer" data-translator-initial-situation="${e.key}" data-translator-initial-goal="${view.goal}" data-translator-app-path="/${lang}/" data-situation-topic="${p.topicId}">`);
  html=html.replace(/<h1\b([^>]*\bid="home-title"[^>]*)>([\s\S]*?)<\/h1>/,(_m,attrs,text)=>`<h2${attrs} hidden>${text}</h2>`);
  // Ready examples belong to the input home, not between a prepared answer and its form.
  html=html.replace(/<section data-ready-situations="v1"[\s\S]*?<\/section>/g,'');
  const form=html.match(/<form\b[^>]*\bid="translator-form"[^>]*>[\s\S]*?<\/form>/)?.[0];
  if (!form) throw new Error('Missing original app form');
  const output=/<div\b[^>]*\bid="translator-result"[^>]*>\s*<\/div>/;
  if (!output.test(html)) throw new Error('Expected one empty shared result container');
  html=html.replace(output,()=>`<div id="translator-result" class="translator-result">${staticAnswer}</div><noscript><p>${lang==='de'?'Für neue Eingaben aktiviere bitte JavaScript in deinem Browser.':'Please enable JavaScript in your browser to enter another situation.'}</p></noscript><details class="translator-sources"><summary>${ui[lang].sources}</summary><ul>${e.sources.map((href,i)=>`<li><a href="${escape(href)}">${escape(p.sourceLabels[i]||new URL(href).hostname)}</a></li>`).join('')}</ul></details>`);
  const other=lang==='de'?'en':'de';
  let languageLinks=0;
  html=html.replace(new RegExp(`<a([^>]*href="/${other}/"[^>]*)>(English|Deutsch)</a>`),(_m,attrs,label)=>{
    languageLinks++;
    return `<a${attrs.replace(`href="/${other}/"`,`href="${p.alternatePath}"`)}>${label}</a>`;
  });
  if (languageLinks!==1) throw new Error('Expected one existing language switch');
  // The source is the actual language home, so relative assets need its base URL.
  html=html.replace(/\b(href|src|action)="([^"#][^"]*)"/g,(m,key,value)=>{
    if (/^(?:\/|[a-z]+:)/i.test(value)) return m;
    const resolved=new URL(decode(value),origin+`/${lang}/`);
    return `${key}="${escape(resolved.pathname+resolved.search+resolved.hash)}"`;
  });
  return html.replace(/[ \t]+$/gm,'');
}
for (const lang of ['de','en']) {
  const entries = source[lang].map(sourceEntry => {
    if (sourceEntry.page.legacySourceSHA256) {
      const current = parse(read(`${lang}/index.html`)).entries.find(e=>e.key===sourceEntry.key);
      if (!current || clinicalHash(current)!==sourceEntry.page.clinicalSHA256 || clinicalHash(sourceEntry)!==sourceEntry.page.clinicalSHA256) throw new Error(`Existing clinical data changed: ${lang}/${sourceEntry.key}`);
      return structuredClone(current);
    }
    const current = parse(read(`${lang}/index.html`)).entries.find(e=>e.key===sourceEntry.key);
    const e = {...structuredClone(current||{}),...structuredClone(sourceEntry)};
    delete e.page; delete e.sources; delete e.reviewStatus; delete e.reviewedOn; delete e.assetReference; delete e.view;
    const assetRef = sourceEntry.assetReference || (sourceEntry.page.topicId === 'finding-toilet' ? {language:lang,key:lang === 'de' ? 'toilette' : 'toilet'} : null);
    const assets = assetRef ? parse(read(`${assetRef.language}/index.html`)).entries.find(o=>o.key === assetRef.key) : null;
    if (assetRef && !assets) throw new Error('Missing configured asset reference');
    if (!e.selfCare && assets) {
      for (const key of ['image','imageWidth','imageHeight','afterImage']) if (key in assets) e[key] = assets[key];
    }
    if (!e.selfCare) {
      for (const trick of e.tricks ?? []) {
        if (sourceEntry.page.topicId === 'finding-toilet') {
          const asset = toiletAssets.tricks.find(t => t.id === trick.href.split('#').pop());
          if (!asset) throw new Error(`Missing trick: ${trick.id}`);
          for (const key of ['image','imageWidth','imageHeight']) trick[key] = asset[key];

        } else if (!trick.image || !trick.imageWidth || !trick.imageHeight) throw new Error('New topics need explicit trick assets');
      }
    }
    return e;
  });
  const additions = selected[lang].filter(e=>!e.page.legacySourceSHA256);
  const examplesLabel = lang === 'de' ? 'Oder wähle ein Beispiel' : 'Or choose an example';
  const selection = `<section data-ready-situations="v1" class="translator-ready-examples"><details><summary>${examplesLabel}</summary><ul>${additions.map(e=>`<li><a href="${e.page.path}">${escape(e.page.label)}</a></li>`).join('')}</ul></details></section>`;
  for (const rel of [`${lang}/index.html`, toolPath(lang)]) {
    const original = read(rel), data = parse(original);
    for (const e of entries) {
      const index = data.entries.findIndex(old => old.key === e.key);
      const legacy = source[lang].find(s=>s.key===e.key && s.page.legacySourceSHA256);
      if (legacy) {
        if (index<0 || clinicalHash(data.entries[index])!==legacy.page.clinicalSHA256) throw new Error(`Existing clinical data changed: ${rel}/${e.key}`);
        continue;
      }
      if (index < 0) data.entries.push(e);
      else if (data.entries[index].url === e.url) data.entries[index] = e;
      else throw new Error(`Existing key conflict: ${e.key}`);
    }
    data.generatorRoutes = selected[lang].map(e=>({key:e.key,language:lang,path:e.page.path,alternatePath:e.page.alternatePath,topicId:e.page.topicId,title:e.page.title,description:e.page.description,selfCare:!!e.selfCare,safetyOnly:!!e.safetyOnly,...(registered(lang,e).goalPaths?{goalPaths:registered(lang,e).goalPaths,selectionPath:registered(lang,e).selectionPath}:{})}));
    if (lang === 'de') {
      data.formal ??= {};
      Object.assign(data.formal, {'Ich zeige dir gern den Weg zur Toilette.':'Ich zeige Ihnen gern den Weg zur Toilette.','Hier ist die Toilette. Möchtest du allein hineingehen?':'Hier ist die Toilette. Möchten Sie allein hineingehen?','Soll ich in der Nähe bleiben?':'Soll ich in der Nähe bleiben?','Ich brauche Entlastung. Kannst du diese Woche den Einkauf übernehmen?':'Ich brauche Entlastung. Können Sie diese Woche den Einkauf übernehmen?','Welche Aufgabe kannst du verlässlich übernehmen?':'Welche Aufgabe können Sie verlässlich übernehmen?','Lass uns festhalten, wer was bis wann erledigt.':'Lassen Sie uns festhalten, wer was bis wann erledigt.'});
    }
    let html = original.replace(dataPattern, (_m,a,_data,c) => a+json(data)+c);
    html = html.replace(/<body\b([^>]*)>/, (_match, attrs) => `<body${attrs.replace(/\sdata-translator-input-position="[^"]*"/, '')} data-translator-input-position="top">`);
    html = html.replace(/(<form\b[^>]*\bid="translator-form"[^>]*>)([\s\S]*?)(<\/form>)/, (_match, open, content, close) => open + content
      .replace(/<p\b[^>]*\bid="translator-form-intro"[^>]*>[\s\S]*?<\/p>/g, '')
      .replace(/<label\b[^>]*\bfor="translator-input"[^>]*>[\s\S]*?<\/label>/, () => `<label class="translator-form-label" for="translator-input">${lang === 'de' ? 'Was sagen und tun bei Demenz?' : 'What can I say and do?'}</label><p class="translator-form-intro" id="translator-form-intro">${lang === 'de' ? 'Passende Worte und praktische Tipps für deine Situation.' : 'Find the right words and practical tips for your situation.'}</p>`)
      .replace(/(<textarea\b[^>]*\bid="translator-input"[^>]*\baria-describedby=")([^"]*)(")/, (_match, before, ids, after) => before + ['translator-form-intro', ...ids.split(/\s+/).filter(id => id && id !== 'translator-form-intro')].join(' ') + after)
      .replace(/(<textarea\b[^>]*\bid="translator-input"[^>]*\brows=")[^"]*(")/, (_match, before, after) => before + '2' + after) + close);
    if (html.includes('data-ready-situations="v1"')) html = html.replace(/<section data-ready-situations="v1"[\s\S]*?<\/section>/,()=>selection);
    else {
      if (!/<form\b[^>]*\bid="translator-form"/.test(html)) throw new Error(`Missing form: ${rel}`);
      html = html.replace(/(<form\b[^>]*\bid="translator-form"[^>]*>[\s\S]*?<\/form>)/, m=>m+selection);
    }
    pending.set(rel, html);
  }
  if (!prepareViews && !bindingsOnly) for (const e of selected[lang]) {
    const rel = e.page.path.slice(1);
    if (fs.existsSync(path.join(root,rel)) && !read(rel).includes(`data-situation-topic="${e.page.topicId}"`) && !(e.page.legacySourceSHA256 && sha(read(rel))===e.page.legacySourceSHA256)) throw new Error(`Refusing to replace another page: ${rel}`);
    pending.set(rel,renderPage(lang,e));
  }
}
// One explicitly approved metadata-only correction outside the84 migrated pages.
// The old English guide stays intact; its former DE alternate is now paired
// with the English generator and must not point into that separate cluster.
const fixedAlternates = (text,url) => text.replace(/^[ \t]*<(?:link|xhtml:link)\b[^>]*\bhreflang="de"[^>]*>\s*$/gm,'').replace(/<(?:link|xhtml:link)\b[^>]*\bhreflang="x-default"[^>]*>/g,tag=>tag.replace(/href="[^"]*"/,`href="${url}"`));
let sitemap = read('sitemap.xml');
if (!prepareViews && !bindingsOnly) for (const exception of registry.pairingExceptions || []) {
  if (!selected.de.some(e=>origin+e.page.path===exception.de)) continue;
  const correction=exception.metadataOnly;
  if (!correction || correction.path!=='/guides/dementia-wants-to-go-home.html' || origin+correction.path!==exception.previousEnglishAlternate) throw new Error('Unapproved metadata correction');
  const rel=correction.path.slice(1),current=read(rel),hash=sha(current);
  if (![correction.sourceSHA256,correction.resultSHA256].includes(hash)) throw new Error('Metadata-only source changed');
  const updated=fixedAlternates(current,exception.previousEnglishAlternate);
  if (sha(updated)!==correction.resultSHA256) throw new Error('Metadata-only output mismatch');
  pending.set(rel,updated);
  sitemap=sitemap.replace(/<url>[\s\S]*?<\/url>/g,block=>block.includes(`<loc>${exception.previousEnglishAlternate}</loc>`)?fixedAlternates(block,exception.previousEnglishAlternate):block);
}
for (const lang of ['de','en']) for (const e of selected[lang]) {
  const loc = origin+e.page.path;
  const existing = [...sitemap.matchAll(/\s*<url>[\s\S]*?<\/url>/g)].find(m=>m[0].includes(`<loc>${loc}</loc>`));
  if (existing) sitemap = sitemap.replace(existing[0],'');
  if (!preview) sitemap = sitemap.replace('</urlset>',`  <url><loc>${loc}</loc><xhtml:link rel="alternate" hreflang="${lang}" href="${loc}"/><xhtml:link rel="alternate" hreflang="${lang === 'de' ? 'en' : 'de'}" href="${origin+e.page.alternatePath}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin+(lang === 'de' ? e.page.path : e.page.alternatePath)}"/></url>\n</urlset>`);
}
if (!prepareViews && !bindingsOnly) pending.set('sitemap.xml',sitemap);
if (!prepareViews && !bindingsOnly) pending.set('content/generator-public-routes.json',JSON.stringify({schemaVersion:1,routes:['de','en'].flatMap(lang=>parse(pending.get(`${lang}/index.html`)).generatorRoutes)},null,2)+'\n');
if (bindingsOnly) { fs.writeFileSync(1,JSON.stringify({de:bindings('de'),en:bindings('en')})+'\n'); process.exit(0); }
// Full preflight completes before any page is written. No arbitrary user text enters URLs or markup.
let changed = 0;
for (const [rel,html] of pending) {
  const filename = path.join(root,rel);
  if (fs.existsSync(filename) && fs.readFileSync(filename,'utf8') === html) continue;
  fs.mkdirSync(path.dirname(filename),{recursive:true}); fs.writeFileSync(filename,html); changed++;
}
console.log(JSON.stringify({topics:selected.de.length,staticPages:selected.de.length*2,mode:prepareViews?'capture-catalog':preview?'preview-noindex':'reviewed-indexable',filesChanged:changed}));
