import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContentPage, readingBoundary } from '../abo/content-scroll-signup.js';
test('public content only; account, checkout, cancellation and legal paths fail closed', () => {
 for (const [path,type] of [['/de/','translator-home'],['/en/','product'],['/de/ratgeber/demenz-fragt-nach-verstorbener-mutter.html','seo-guide'],['/alltagstricks/','translator-tool'],['/de/demenz-alltagstipps.html','']]) assert.equal(publicContentPage(path,type),true,path);
 for (const path of ['/abo/','/abo/konto.html','/abo/kuendigen.html','/abo/kasse.html','/start/','/datenschutz.html','/privacy-en.html','/terms-en.html','/nutzungsbedingungen.html','/impressum.html','/kontakt.html','/404.html','/teller/']) assert.equal(publicContentPage(path,'seo-guide'),false,path);
});
test('three content blocks and a stable six-item boundary, never total page percent', () => {
 const first=Array.from({length:6},(_,i)=>({top:i*300-900,bottom:i*300-700}));
 assert.equal(readingBoundary(first,900),true);
 const extended=[...first,...Array.from({length:6},(_,i)=>({top:3000+i*300,bottom:3200+i*300}))];
 assert.equal(readingBoundary(extended,900),true,'Appending a batch does not move the previous boundary');
 assert.equal(readingBoundary(first.map(r=>({top:r.top+3000,bottom:r.bottom+3000})),900),false);
 assert.equal(readingBoundary([{top:0,bottom:200},{top:200,bottom:400}],900),false);
});
