import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContentPage, readingBoundary } from '../abo/content-scroll-signup.js';
test('public content only; account, checkout, cancellation and legal paths fail closed', () => {
 for (const [path,type] of [['/de/','translator-home'],['/en/','product'],['/de/ratgeber/demenz-fragt-nach-verstorbener-mutter.html','seo-guide'],['/alltagstricks/','translator-tool'],['/de/demenz-alltagstipps.html','']]) assert.equal(publicContentPage(path,type),true,path);
 for (const path of ['/abo/','/abo/konto.html','/abo/kuendigen.html','/abo/kasse.html','/start/','/datenschutz.html','/privacy-en.html','/terms-en.html','/nutzungsbedingungen.html','/impressum.html','/kontakt.html','/404.html','/teller/']) assert.equal(publicContentPage(path,'seo-guide'),false,path);
});
test('reading opportunity no longer depends on a six-card end boundary', () => {
 const first=Array.from({length:6},(_,i)=>({top:i*300-900,bottom:i*300-700}));
 assert.equal(readingBoundary(first,900),true);
 const extended=[...first,...Array.from({length:6},(_,i)=>({top:3000+i*300,bottom:3200+i*300}))];
 assert.equal(readingBoundary(extended,900),true,'Appending a batch does not move the previous boundary');
 assert.equal(readingBoundary(first.map(r=>({top:r.top+3000,bottom:r.bottom+3000})),900),false);
 assert.equal(readingBoundary([{top:0,bottom:200},{top:200,bottom:400}],900),true);
 assert.equal(readingBoundary([{top:0,bottom:400}],900,1),true,'Short tip detail is eligible after genuine reading');
 assert.equal(readingBoundary([{top:0,bottom:1200}],900,1),false,'Full tip and its safeguards must reach the viewport before the invitation');
 assert.equal(readingBoundary([{top:0,bottom:400}],900),false,'Feed still requires two read cards');
});

import { contentInvitationPolicy as policy, readInvitationCadence, invitationCadenceAllows, nextInvitationCadence } from '../abo/content-invitation-policy.js';
test('functional cadence repeats after cooldown, caps three invitations and resets after the window',()=>{
 const at=100000;let value=readInvitationCadence(null,at);assert.equal(invitationCadenceAllows(value,at),true);
 for(let i=0;i<3;i++){const now=at+i*policy.cooldownMS;assert.equal(invitationCadenceAllows(value,now),true);value=nextInvitationCadence(value,now);assert.equal(invitationCadenceAllows(value,now+policy.cooldownMS-1),false);}
 assert.equal(invitationCadenceAllows(value,at+4*policy.cooldownMS),false);
 const reset=readInvitationCadence(JSON.stringify(value),value.expiresAt);assert.equal(reset.count,0);assert.equal(invitationCadenceAllows(reset,value.expiresAt),true);
 assert.deepEqual(Object.keys(value),['version','startedAt','expiresAt','count','lastAt','pendingUntil']);
});
test('pending lock, malformed state and unavailable storage cannot amplify invitations',()=>{
 const at=100000,value=readInvitationCadence(null,at);value.pendingUntil=at+10000;
 assert.equal(invitationCadenceAllows(value,at),false);assert.equal(invitationCadenceAllows(value,at,policy,value.pendingUntil),true);
 for(const raw of ['shown','{}','null','[]',JSON.stringify({...value,count:99}),JSON.stringify({...value,startedAt:at+1})])assert.equal(readInvitationCadence(raw,at),null);
 assert.equal(invitationCadenceAllows(null,at),false);
});
