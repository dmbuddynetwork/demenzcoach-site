import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectPrintListLayout} from './seo-print-list-guard.mjs';
const fixture = {pathname:'/de/demenz-alltagstipps.html', html:fs.readFileSync(new URL('../de/demenz-alltagstipps.html',import.meta.url),'utf8'), css:fs.readFileSync(new URL('../teller/liste.css',import.meta.url),'utf8')};
const rejects = (delta, pattern) => assert.ok(inspectPrintListLayout({...fixture,...delta}).errors.some(error=>pattern.test(error)));
test('actual approved fixed print page satisfies its layout contract',()=>assert.deepEqual(inspectPrintListLayout(fixture),{registered:true,errors:[]}));
test('other routes never receive this local-layout acceptance',()=>assert.deepEqual(inspectPrintListLayout({...fixture,pathname:'/de/other.html'}),{registered:false,errors:[]}));
test('removing local CSS or print script fails',()=>{
 rejects({html:fixture.html.replace('href="/teller/liste.css"','href="/other.css"')},/local stylesheet/);
 rejects({html:fixture.html.replace('src="/teller/liste.js"','src="/other.js"')},/local navigation/);
});
test('removing brand, native menu, text-size semantics or print button fails',()=>{
 rejects({html:fixture.html.replace('class="brand"','class="removed"')},/branded home/);
 rejects({html:fixture.html.replace('<summary>Menü</summary>','<span>Menü</span>')},/native accessible menu/);
 rejects({html:fixture.html.replace('aria-pressed="false"','')},/text-size/);
 rejects({html:fixture.html.replace('data-print-list','data-removed')},/print action/);
});
test('missing sticky or print-specific A4, static header and hidden menu fails',()=>{
 rejects({css:fixture.css.replace('position:sticky','position:relative')},/sticky header/);
 rejects({css:fixture.css.replace('size:A4','size:auto')},/A4/);
 rejects({css:fixture.css.replace('position:static','position:sticky')},/unstick/);
 rejects({css:fixture.css.replace('.actions,.skip,.site-menu,footer nav','.actions,.skip,footer nav')},/hide navigation/);
});
