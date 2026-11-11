// Additive wire validation and exact continuation encoding. No network/provider.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../demenz-uebersetzer/translator-ai.js'),'utf8');
const valid={kind:'clarification',question:'Was genau ist passiert?',meaning:'Diese Angabe fehlt noch für eine passende Antwort.',nextStep:'Beschreibe bitte die beobachtete Situation.',safetyLevel:'standard',safetyMessage:null};
const answer={kind:'answer',meaning:'Fixture context.',phrases:['Ein Satz.','Noch ein Satz.','Ein weiterer Satz.'],avoid:'Nicht so.',nextStep:'Ein Schritt.',safetyLevel:'standard',safetyMessage:null};
(async()=>{let checks=0;for(const language of ['de','en','en-US']){
 let response=valid;const requests=[];const box={AbortController,TextEncoder,setTimeout,clearTimeout,document:{documentElement:{lang:language}},fetch:async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>response};}};vm.createContext(box);vm.runInContext(code,box);const api=box.DemenzTranslatorAI;
 assert.equal((await api.ask('Original')).kind,'clarification');checks++;
 for(const patch of [{question:''},{question:'Eine Frage ohne Fragezeichen'},{question:'x'.repeat(180)+'?'},{meaning:'zu kurz'},{nextStep:'kurz'},{safetyMessage:''},{phrases:['Frage?']},{avoid:'Nein'},{share:{}},{publicSentence:'Original'},{requestID:'not-a-clarification-id'}]){
  response={...valid,...patch};assert.equal((await api.ask('Original')).kind,'error',JSON.stringify(patch));checks++;
 }
 response={...valid,safetyLevel:'concern',safetyMessage:'Received warning.'};const invalid=await api.ask('Original');assert.equal(invalid.kind,'error');assert.equal(invalid.safetyLevel,'concern');assert.equal(invalid.safetyMessage,'Received warning.');checks++;
 response=answer;const original='e\u0301'.repeat(90),reply='🙂'.repeat(100),text=original+'\n'+reply,goal={id:'custom',label:'Die gleiche Absicht'};
 assert.equal(api.requestIssue(text,{goal}), '');await api.ask(text,{goal,formal:true,exactText:true});const body=requests.at(-1).body;assert.equal(body.text,original.normalize('NFC')+'\n'+reply);assert.equal([...body.text].length,191);assert.equal(body.goal.label,goal.label);assert.equal(body.formal,language==='de');assert.equal(body.share,false);assert.equal(body.language,language.startsWith('en')?'en':undefined);checks++;
 await api.ask('Original\nNeue Angabe',{exactText:true,correctionOf:'prior-completed-request',requestID:'attempt-2'});assert.equal(requests.at(-1).options.headers['X-Translator-Correction-Of'],'prior-completed-request');checks++;
 assert.equal(api.requestIssue('a'.repeat(198)+'\n '+ 'b'),'text_too_long','Raw bound is intentionally conservative before server whitespace folding');checks++;
 let before=requests.length;assert.equal((await api.ask('🙂'.repeat(201),{exactText:true})).reason,'text_too_long');assert.equal(requests.length,before);checks++;
 assert.equal(api.requestIssue('\u0000'.repeat(200),{goal:{id:'custom',label:'\u0000'.repeat(160)}}),'body_too_large');checks++;
 for(const value of [answer,{kind:'safety',safetyLevel:'concern',message:'Warning.'},{kind:'safety',safetyLevel:'urgent',message:'Warning.'},{kind:'off_topic'}]){response=value;assert.equal((await api.ask('Original')).kind,value.kind);checks++;}
 assert.ok(requests.every(r=>new URL(r.url).search==='?response_contract=clarification-v1'));
 assert.ok(requests.every(r=>r.body.share===false&&r.options.credentials==='omit'&&r.options.referrerPolicy==='no-referrer'));
}console.log(JSON.stringify({passed:true,checks,providerCalls:0}));})().catch(e=>{console.error(e);process.exitCode=1;});
