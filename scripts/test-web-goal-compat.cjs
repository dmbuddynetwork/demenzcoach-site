// Exact already-shipped parser vs coordinated wire fixtures, not a live API/model test.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const baselineSHA='6e61ac76a9361dfde4e4af16dd34afcd76aa0cdb';
const baseline=execFileSync('git',['show',baselineSHA+':demenz-uebersetzer/translator-ai.js'],{encoding:'utf8'});
const current=fs.readFileSync(require('node:path').join(__dirname,'../demenz-uebersetzer/translator-ai.js'),'utf8');
const labels=['Meinen Anteil freundlich behalten','Verstehen, was sie gerade braucht','Eine andere gemeinsame Tätigkeit finden'];
const slots=['choice_1','choice_2','choice_3'],legacy=['act_now','understand','organize'];
async function check(source,ids){let payload={kind:'goals',noSituation:false,goals:ids.map((goal,i)=>({goal,label:labels[i]}))};const requests=[];
 const context=vm.createContext({AbortController,TextEncoder,setTimeout,clearTimeout,fetch:async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return {ok:true,json:async()=>payload};}});
 vm.runInContext(source,context);const api=context.DemenzTranslatorAI,result=await api.askGoals('Eine persönliche Situation.');
 if(result.kind==='goals'){
  payload={kind:'answer',meaning:'Fixture only.',phrases:['Ein Satz.','Zweiter Satz.','Dritter Satz.'],avoid:'Nicht so.',nextStep:'Ein Schritt.',safetyLevel:'standard'};
  await api.ask('Eine persönliche Situation.',{goal:{id:result.goals[1].goal,label:result.goals[1].label}});
  assert.equal(requests[1].body.goal.label,labels[1]);assert.equal(requests[1].body.goal.id,ids[1]);
 }
 assert.ok(requests.every(r=>r.body.share===false&&r.options.credentials==='omit'&&r.options.referrerPolicy==='no-referrer'));
 return result.kind;
}
(async()=>{
 assert.equal(await check(baseline,slots),'error','An already-open baseline client rejects new technical IDs');
 assert.equal(await check(baseline,legacy),'goals','Opaque legal legacy IDs preserve the exact new labels for old clients');
 assert.equal(await check(current,legacy),'goals');assert.equal(await check(current,slots),'goals');
 console.log(JSON.stringify({passed:true,baselineSHA,cases:4,providerCalls:0,exactLabelPreserved:true,scope:'exact shipped/current client parsers with agreed wire fixtures; backend adapter requires its own integration evidence'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
