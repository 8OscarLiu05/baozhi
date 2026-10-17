const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../static/app.js'),'utf8').replace(/const params=new URLSearchParams\(location\.search\);[\s\S]*$/,'');
const context=vm.createContext({console,document:{},setTimeout,clearTimeout});
vm.runInContext(code,context);
const run=script=>vm.runInContext(script,context);
run(`state.page='sample';state.role='platform';state.calls={calls:[
 {id:'normal',text:'等待期',answer:'90天',status:'rejected',adopted:0,trace:{matched_fact:[{label:'等待期',text:'90天',exception:'意外除外',product_id:'p',cite:'2.3.1'}]},excerpts:[{id:'field-p-等待期',title:'公开产品',excerpt:'等待期：90天。出处：2.3.1。'}]},
 {id:'blocked',text:'保证赔付',answer:'不能承诺',rule_category:'promise_pay',adopted:0},
 {id:'reviewed',text:'已处置',status:'error',review:{note:'需补知识'}}]};state.samplePick='normal';state.sampleFilter='promise_pay';`);
assert.equal(run('reviewSelection().pick.id'),'blocked','selection follows the filtered collection');
run("state.sampleFilter='disparage'");
assert.equal(run('reviewSelection().pick'),null,'empty filter must never fall back to an unrelated call');
assert(!run('samplePage()').includes('data-sample='),'no disposition controls without a selected call');
run("state.sampleFilter='';state.sampleMode='pending'");
assert(!run('reviewSelection().shown.some(c=>c.id==="reviewed")'),'reviewed records leave pending queue');
run("state.sampleMode='all';state.sampleQuery='normal'");
assert.equal(run('reviewSelection().shown.length'),1,'search includes call IDs');
assert.equal(run('callPresentation(state.calls.calls[0]).label'),'Structured field answer','non-adopted field answers are not reported as model failures');
const html=run('evidenceSheet(state.calls.calls[0])');
assert(html.includes('href="#source-normal-0"'),'fact links to its own evidence');
assert(html.includes('Exceptions')&&html.includes('意外除外'));
assert(html.includes('not recorded for this excerpt'),'missing version is explicit, never invented');
run(`state.calls.calls[0].trace.matched_fact[0].label='<img src=x onerror=alert(1)>';state.calls.calls[0].excerpts[0].excerpt='<script>alert(1)</script>';`);
const escaped=run('evidenceSheet(state.calls.calls[0])');
assert(!escaped.includes('<script>')&&!escaped.includes('<img src=x'),'fact and evidence text are escaped');
run("state.channelPending=true;state.askText='等待期'");
assert(run('evidenceSheet(null)').includes('aria-busy="true"'));
run("state.channelPending=false;state.channelError='模拟服务失败'");
assert(run('evidenceSheet(null)').includes('Your question and customer selection are kept'));
console.log('Workbench behavior: filter isolation, empty selection, pending queue, search, source linkage, field status, version honesty, escaping, loading and failure states passed.');
// REQ-044: operations summary exposes actual records and preserves safe rendering.
run(`state.page='overview';state.data={documents:[{status:'draft'}]};state.life={products:[{name:'one'}]};state.calls={metrics:{calls:7},calls:[{id:'older',created:'2026-10-10',text:'older',channel:'self',status:'error',review:{note:'done'}},{id:'newer',created:'2026-10-15',text:'<img src=x onerror=alert(1)>',channel:'sales',status:'error'}]};`);
const overview=run('overviewPage()');
assert(overview.indexOf('data-ops-call="newer"')<overview.indexOf('data-ops-call="older"'),'latest activity first');
assert(!overview.includes('<img src=x'),'operations feed escapes questions');
assert(overview.includes('data-ops-review="pending"')&&overview.includes('data-ops-review="all"'),'distinct queue entry actions');
assert(overview.includes('>7</strong>'),'uses API call metric');
assert.equal(run('reviewSelection().pending.length'),1,'completed reviews excluded');
run('state.calls={calls:[]};');
assert(run('overviewPage()').includes('暂无调用'),'empty activity state');
console.log('Operations dashboard: actual metrics, date ordering, escaping, review entry points and empty state passed.');
