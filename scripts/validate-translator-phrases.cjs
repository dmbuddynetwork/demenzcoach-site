// Editorial consistency across live tool JSON, formal register, articles and encoded shares.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const routes=JSON.parse(fs.readFileSync(path.join(__dirname,'../german-situation-routes.json'),'utf8'));
const targets=new Map(routes.pages.map(p=>[p.source,p.target]));
const read=f=>fs.readFileSync(path.join(__dirname,'..',targets.get(f)||f),'utf8');
const expected={
 wobin:{slug:'wo-bin-ich',phrases:['Ich bin bei dir. Wir schauen uns gemeinsam um.','Möchtest du dich mit mir umsehen?','Ich bin da. Darf ich bei dir bleiben?'],formal:['Ich bin bei Ihnen. Wir schauen uns gemeinsam um.','Möchten Sie sich mit mir umsehen?','Ich bin da. Darf ich bei Ihnen bleiben?']},
 uhrzeit:{slug:'wann-gehen-wir',phrases:['Du möchtest los. Wohin möchtest du gehen?','Lass uns zusammen schauen, was heute geplant ist.'],formal:['Sie möchten los. Wohin möchten Sie gehen?','Lassen Sie uns zusammen schauen, was heute geplant ist.']},
 umziehen:{slug:'ich-ziehe-mich-nicht-um',phrases:['Magst du dir frische Sachen aussuchen?','Soll ich dir die Kleidung bereitlegen?','Wir können es später noch einmal versuchen.'],formal:['Mögen Sie sich frische Sachen aussuchen?','Soll ich Ihnen die Kleidung bereitlegen?','Wir können es später noch einmal versuchen.']}
};
for(const f of ['de/index.html','demenz-uebersetzer/index.html']){
 const data=JSON.parse(read(f).match(/id="translator-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 for(const [key,e]of Object.entries(expected)){
  assert.deepEqual(data.entries.find(x=>x.key===key).phrases,e.phrases,f+key);
  e.phrases.forEach((p,i)=>assert.equal(data.formal[p],e.formal[i]));
 }
}
for(const e of Object.values(expected))for(const suffix of ['','-was-sagen','-was-dahintersteckt','-tipps']){
 const f=`demenz-uebersetzer/${e.slug}${suffix}.html`,html=read(f),bubbles=[...html.matchAll(/<p class="phrase-bubble">([\s\S]*?)<\/p>/g)].map(m=>m[1]);
 assert.equal(bubbles.length,e.phrases.length,f);
 bubbles.forEach((b,i)=>{assert.ok(b.includes(`„${e.phrases[i]}“`),f);const href=b.match(/href="([^"]+)"/)[1];assert.ok(decodeURIComponent(href).includes(e.phrases[i]),f+' share');});
 for(const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))JSON.parse(m[1]);
 assert.doesNotMatch(html,/Du bist hier in der Küche\. Ich bin bei dir\.|Um drei Uhr fahren wir los\.|Magst du die blaue oder die grüne Bluse/u,f);
}
console.log('14 HTML sources: approved phrases, formal equivalents, exact article/share consistency and JSON-LD passed.');
