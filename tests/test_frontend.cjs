const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../static/app.js'),'utf8').replace(/const params=new URLSearchParams\(location\.search\);[\s\S]*$/,'' );
// Render templates in isolation without booting a browser or sending network requests.
const context=vm.createContext({console,document:{},setTimeout,clearTimeout});
vm.runInContext(script,context);
vm.runInContext(`state.data={agents:[{id:'intake',name:'梳理',version:1,duty:'整理',products:['qianxin'],tools:['collect'],enabled:true},{id:'analysis',name:'分析',version:1,duty:'核对',products:['qianxin'],tools:['search','rules'],enabled:true},{id:'service',name:'服务',version:1,duty:'说明',products:['qianxin'],tools:['search','materials'],enabled:true}],flows:[{id:'coverage',name:'保障分析',version:1,steps:['intake','analysis']},{id:'claim',name:'理赔准备',version:1,steps:['intake','analysis','service']}],documents:[{id:'abc',product:'qianxin',version:1,title:'演示资料',kind:'design',source:'本地',status:'published',created:'2026-10-06T00:00:00Z'}],kinds:{design:'产品设计草案'},scenarios:{medical:'医疗',living:'生活',recovery:'康复'},outcomes:{limited:'限制'},tools:{intake:['collect'],analysis:['search','rules'],service:['search','materials']}};`,context);
const service=vm.runInContext('servicePage()',context);
vm.runInContext("state.role='builder'",context);
vm.runInContext(`state.data.design={current:{name:'骑安心',version:1,parameters:{daily:100,waiting:30,deductible:3,per_stay:30,annual:60},notes:'未审定'},parameter_labels:{daily:'每日津贴',waiting:'等待期',deductible:'免给付天数',per_stay:'单次上限',annual:'年度上限'},boundaries:[{title:'研究',text:'<script>不执行</script>'}],gates:[],history:[{version:1}]};`,context);
assert(!/<\/\w+\s+\w+=/.test(service),'Closing tags must not contain attributes');
assert(service.includes('<option value="hospital">因病住院</option>'));
assert(service.includes('<option value="yes">案例设定为相关</option>'));
assert.equal((service.match(/<select\b/g)||[]).length,(service.match(/<\/select>/g)||[]).length);
for(const page of ['service','product','knowledge','agents','runs','evaluation']) {
  const html=vm.runInContext(`state.page='${page}';page()`,context);
  assert(html.includes('<h1>'),page+' has a heading');
  assert(!/<\/\w+\s+\w+=/.test(html),page+' has valid closing tags');
}
assert.equal(vm.runInContext(`esc('<script>alert("x")</script>')`,context),'&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
assert(vm.runInContext('productPage()',context).includes('&lt;script&gt;不执行&lt;/script&gt;'));
assert(vm.runInContext('designReport()',context).includes('非在售保险'));
vm.runInContext(`state.data.clause_board={document:{title:'骑安心',version:1,kind:'design'},slots:[{code:'dispute',title:'争议处理',status:'missing',status_label:'尚未写入',expect:'<b>需要约定</b>',excerpt:''}],counts:{stated:1,research:0,mentioned:1,missing:1},notice:'这不是某家公司的正式条款'};state.data.catalog=[{code:'incidence',category:'外部证据',name:'住院发生情况',definition:'没有统计',source:'待提供',sensitivity:'研究数字',status:'gap',status_label:'证据缺口',gap:'不要编造',owner:'精算'}];state.data.dispositions={needs_specialist:'待保险成员确认',continue_demo:'演示路径可继续'};state.data.review_checks={citation:'结论能都有据可循',hypertension:'没有把高血压自动认定成可赔'};state.knowledgeView='clauses';`,context);
const clauses=vm.runInContext('knowledgePage()',context);
assert(clauses.includes('尚未写入'));
assert(clauses.includes('&lt;b&gt;需要约定&lt;/b&gt;'));
assert(!clauses.includes('<b>需要约定</b>'));
vm.runInContext(`state.knowledgeView='data';`,context);
assert(vm.runInContext('knowledgePage()',context).includes('证据缺口'));
vm.runInContext(`state.page='runs';state.role='reviewer';state.focusRun={id:'r1',created:'2026-10-06T00:00:00Z',ms:3,mode:'local',question_card:{question:'住院后生活支出怎么办',event:'hospital',insured:'unknown',related:'yes'},flow:{name:'保障分析',version:1},documents:[],cards:[],evidence:[],materials:[],missing:[],issues:[],limitations:['限制'],traces:[],reviews:[],clause_attention:[{product:'骑安心',title:'争议处理',status:'missing',status_label:'尚未写入',expect:'还没有这一条'}]};`,context);
const desk=vm.runInContext('runsPage()',context);
assert(desk.includes('逐项核对，再留下处置'));
assert(desk.includes('待保险成员确认'));
assert(desk.includes('没有把高血压自动认定成可赔'));
assert(desk.includes('不能出单、核保或支付赔款'));
vm.runInContext("state.role='viewer'",context);
assert(!vm.runInContext('runsPage()',context).includes('住院后生活支出怎么办'),'role guard protects already-focused run');
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(allowedPages())',context)),['lobby','talk','service']);
const viewerShell=vm.runInContext("state.page='service';shell()",context);
assert(!viewerShell.includes('data-page="runs"'));
assert(!viewerShell.includes('data-page="product"'));
vm.runInContext("state.role='builder';state.page='home'",context);
assert(vm.runInContext('shell()',context).includes('维护工作的三个入口'));
vm.runInContext("state.role='reviewer';state.page='runs'",context);
const reviewerShell=vm.runInContext('shell()',context);
assert(!reviewerShell.includes('data-page="product"'));
assert(!reviewerShell.includes('data-page="agents"'));
assert(!reviewerShell.includes('data-page="studio"'));
vm.runInContext(`state.data.gap_actions={checked_original:'已核对原文',return_materials:'退回补资料',insurance_member:'交给保险成员'};state.result={...state.focusRun,model:{status:'not_requested'},cards:[{scenario:'living',product:'骑安心',kind:'design',version:1,note:'有拟议津贴',status:'存在限制',outcome:'limited',evidence:'a-2',evidence_excerpt:'拟提供生活津贴。',evidence_position:2},{scenario:'living',product:'虚构样本',kind:'mock',version:1,note:'没有生活津贴',outcome:'outside',status:'未约定',evidence:'b-3',evidence_excerpt:'没有设置生活津贴。',evidence_position:3}],evidence:[{id:'a-2',position:2,content:'拟提供生活津贴。'},{id:'b-3',position:3,content:'没有设置生活津贴。'}],missing:['保障期间未核实']};`,context);
const result=vm.runInContext('resultHtml()',context);
assert(result.includes('comparison-grid'));
assert(result.includes('段落 2')&&result.includes('段落 3'));
assert(result.includes('没有设置生活津贴。'));
assert(result.indexOf('还缺哪些个人信息')<result.indexOf('还有 1 项没写成约定'));
assert(result.includes('<details class="panel disclosure clause-disclosure">'));
assert(!result.includes('clause-disclosure" open'));
const dynamic=vm.runInContext('reviewWorkstation(state.focusRun)',context);
assert(dynamic.includes('退回补资料')&&dynamic.includes('交给保险成员'));
assert(dynamic.includes('data-gap-id='));
const params=vm.runInContext('clauseHtml()',context);
for(const str of ['100','30','3','60','教学参数，不是保险金额','研究方案 v1'])assert(params.includes(str),str);
vm.runInContext(`state.role='viewer';state.page='lobby';state.portal={needs:[{id:'living',group:'问答',title:'住院后生活费怎么办',text:'先分清事件'}],products:[{id:'abc',product:'qianxin',version:1,title:'骑安心',kind:'design',focus:'生活津贴',limit:'<b>不是在售</b>'}],agents:[{id:'advisor',name:'保障需求顾问',group:'问答',accent:'violet',skills:['原文检索'],duty:'听问题',boundary:'不能报价',starters:['怎么问']}],benches:[],skills:[]};`,context);
const lobby=vm.runInContext('lobbyPage()',context);
assert(lobby.includes('住院后生活费怎么办'));
assert(lobby.includes('&lt;b&gt;不是在售&lt;/b&gt;'));
assert(!lobby.includes('<b>不是在售</b>'));
vm.runInContext(`state.company={org:{name:'示意保险（虚构）',seed:20261011,note:'虚构'},counts:{staff:18,customers:40,policies:40,calls:20},products:[{id:'card-01',title:'产品卡片-01',mark:'虚构句子',sentence:'这张卡片还没有条款句子。'}],policies:[{id:'DEMO-01',customer_id:'客户-01',status:'演示保单'},{id:'DEMO-02',customer_id:'客户-02',status:'演示保单'}],customers:[{id:'客户-01'},{id:'客户-02'}],staff:[{id:'展业-01',duty:'sales'},{id:'外呼-01',duty:'outreach'},{id:'坐席-01',duty:'seat'},{id:'质检-01',duty:'quality'}],duties:[]};state.portal={agents:[{id:'advisor',name:'保障需求顾问',boundary:'不能报价',starters:[]},{id:'desk',name:'条款客服',boundary:'不能承诺',starters:[]}],products:[{product:'qianxin',title:'骑安心'}],needs:[],benches:[],skills:[]};state.data.version='0.6.0';state.data.model_ready=false;state.channelResult=null;state.jobMessages=[];state.jobAgent='underwrite';state.handoffs={items:[{customer_id:'客户-03',status:'待处理',text:'请转给客服',call_id:'fc',fictional:1}]};state.calls={calls:[{id:'fc1',channel_name:'展业',duty_name:'营销展业',answer:'摘录仍在',operator_id:'展业-01',context_id:'客户-01',status:'unavailable',fictional:1,handoff:0}],scope:'全量调用只给平台与知识运营'};`,context);
vm.runInContext("state.role='sales';state.page='channel'",context);
const sales=vm.runInContext('channelPage()',context);
assert(sales.includes('示意保险（虚构）'));
assert(sales.includes('交给中台'));
assert(sales.includes('data-customer="客户-01"'));
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(allowedPages())',context)),['channel','library']);
const salesShell=vm.runInContext('shell()',context);
assert(!salesShell.includes('data-page="platform"'));
assert(!salesShell.includes('data-page="inbox"'));
vm.runInContext("state.role='customer';state.page='channel'",context);
assert(vm.runInContext('channelPage()',context).includes('转人工')===false);
assert(vm.runInContext('entryForm()',context).includes('客户编号'));
vm.runInContext("state.role='seat';state.page='channel'",context);
const phone=vm.runInContext('channelPage()',context);
assert(phone.includes('坐席区')&&!phone.includes('外呼区')&&!phone.includes('质检区'),'only the authorized active seat form is rendered');
assert(phone.includes('没有拨号'));
for(const [role,label] of [['seat','坐席区'],['outreach','外呼区'],['quality','质检区']]) {
  vm.runInContext(`state.role='${role}'`,context);
  const zone=vm.runInContext('phoneZones()',context);
  assert.equal((zone.match(/<form data-zone=/g)||[]).length,1,'only one active form per seat');
  assert(zone.includes(`data-zone="${role}"`)&&zone.includes(label));
}
vm.runInContext("state.role='service';state.page='inbox'",context);
assert(vm.runInContext('inboxPage()',context).includes('客户-03'));
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(allowedPages())',context)),['inbox','job','library']);
vm.runInContext("state.role='underwrite';state.page='job';state.portal.agents=[{id:'underwrite',name:'核保辅助',boundary:'不下承保结论',starters:[]}]",context);
assert(vm.runInContext('jobPage()',context).includes('不下承保通过或拒保'));
vm.runInContext("state.role='platform';state.page='platform'",context);
const platform=vm.runInContext('platformPage()',context);
assert(platform.includes('新建智能体'));
assert(platform.includes('fc1'));
assert(platform.includes('全量调用只给平台与知识运营'));
vm.runInContext("state.page='library'",context);
assert(vm.runInContext('libraryPage()',context).includes('虚构句子'));
vm.runInContext("state.desk='gate';state.page='gate'",context);
const gateFallback=vm.runInContext('shell()',context);
assert(gateFallback.includes('data-page='),'gate desk falls back to workbench shell');
// 展示页改为独立静态页："/" 由 app.py 提供 static/showcase.html，SPA 经 ?desk= 进入工位
const showcase=fs.readFileSync(path.join(__dirname,'../static/showcase.html'),'utf8');
for(const str of ['保溯','把专业判断','带到客户面前','走对处理路径','答案和证据','四类话术','你可能想知道','不代表原公司承保','等待期 = 90 天','architecture-stage','系统集成层','平台能力层','基础能力层','product-tab-0','product-panel-3','data-tone="light"','/experience.js?v=049','/architecture.js?v=060','/architecture.css?v=060','architecture-play','核心 · 智能体中台','演示接入 · 三个业务端','arch-bracket','应用能力层','mega-menu','/refinement.js?v=050','/index.html?desk=sales','/index.html?desk=wechat','/index.html?desk=phone','/index.html?desk=platform','/index.html?desk=platform&page=sample','/showcase-v2.css','/showcase-v2.js'])assert(showcase.includes(str),'showcase has '+str);
assert(!showcase.includes('116/150')&&!showcase.includes('46/50')&&!showcase.includes('id="scores"')&&!showcase.includes('id="entries"')&&!showcase.includes('fact-strip'),'showcase hides benchmark numbers and entry stat cards');
assert(!showcase.includes('五分钟演示路径'),'showcase drops demo-script hints');
assert(!/\sstyle="/.test(showcase),'showcase avoids inline style attributes blocked by CSP');
const archJs=fs.readFileSync(path.join(__dirname,'../static/architecture.js'),'utf8');
for(const str of ['千问','豆包','DeepSeek','预留','智能体开发','知识库管理','插件集成','对话管理','效果分析','智能问答类','客服类','培训类','外呼类','代理人展业','客户自助','电话中心','prefers-reduced-motion','IntersectionObserver'])assert(archJs.includes(str),'architecture describes '+str);
assert(!archJs.includes('style="'),'architecture sets CSS variables through CSSOM, not inline style markup');
const archCss=fs.readFileSync(path.join(__dirname,'../static/architecture.css'),'utf8');
assert(archCss.includes('data-phase="scatter"')&&archCss.includes('data-phase="exploded"')&&archCss.includes('prefers-reduced-motion'),'architecture has scatter/exploded phases and honors reduced motion');
const deskCss=fs.readFileSync(path.join(__dirname,'../static/desk-polish.css'),'utf8');
assert(deskCss.includes('.desk-switch')&&deskCss.includes('.journey')&&deskCss.includes('.platform-flow')&&deskCss.includes('prefers-reduced-motion'),'desk polish covers switcher, journey loop and platform flow');
assert(!showcase.includes('现在就打开一个入口'),'showcase drops retired meta demo copy');
const showcaseCss=fs.readFileSync(path.join(__dirname,'../static/showcase-v2.css'),'utf8');
assert(showcaseCss.includes('--paper:#F3F0E9'),'showcase reuses project paper tone');
assert(showcaseCss.includes('prefers-reduced-motion'),'showcase honors reduced motion');
const showcaseJs=fs.readFileSync(path.join(__dirname,'../static/showcase-v2.js'),'utf8');
assert(showcaseJs.includes('revealInView'),'showcase reveal has in-view fallback');
assert(showcaseJs.includes('mascotLines'),'mascot explains four business jobs');
assert(showcaseJs.includes('direction=-1')&&showcaseJs.includes('direction=1'),'entry rail reverses at both ends');
assert(showcaseJs.includes('setRailPaused')&&showcaseJs.includes('prefers-reduced-motion'),'entry rail can pause and honors reduced motion');
const indexHtml=fs.readFileSync(path.join(__dirname,'../static/index.html'),'utf8');
assert(!indexHtml.includes('showcase.css'),'index no longer loads retired gate css');
assert(indexHtml.includes('/workbench-motion.css')&&indexHtml.includes('/motion.js'),'index loads the workbench motion layer');
const appJs=fs.readFileSync(path.join(__dirname,'../static/app.js'),'utf8');
assert(appJs.includes(".filter(key=>key!=='talk')"),'agent chat is not a standalone sidebar item');
const motionJs=fs.readFileSync(path.join(__dirname,'../static/motion.js'),'utf8');
const motionCss=fs.readFileSync(path.join(__dirname,'../static/workbench-motion.css'),'utf8');
assert(appJs.includes('await enterDesk(entryDesk,entryPage)'),'boot enters desk and optional permitted page from query params');
assert(appJs.includes("requestedPage&&allowedPages().includes(requestedPage)?requestedPage:fallback"),'deep links are limited to pages allowed for the selected desk role');
assert(!appJs.includes('gateHtml'),'retired gate renderer is gone');
assert(!appJs.includes('plat-tiles'),'platform overview drops tiles that duplicate the sidebar');
assert(appJs.includes('empty-invite'),'empty result state offers an invitation');
assert(appJs.includes('agent-summary-grid'),'platform agents use grouped summary grids');
assert(motionCss.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'platform metrics keep a compact three-column layout');
assert(motionCss.includes('.mv-detail-swap'),'review record switches use a short detail transition');
assert(!motionJs.includes('dx * 3')&&!motionCss.includes('mv-magnet'),'workbench buttons stay spatially stable');
assert(motionJs.includes('seatInk(root);')&&motionJs.includes('spotIn(root);'),'same-page renders restore seat ink and card enhancement');
const appPy=fs.readFileSync(path.join(__dirname,'../app.py'),'utf8');
assert(indexHtml.includes('/desk-polish.css?v=049'),'index loads desk polish');
assert(appJs.includes('function deskSwitch()')&&appJs.includes('journeyLoop()')&&appJs.includes('platformFlow()')&&appJs.includes('非实时数据'),'workspaces share the switcher, empty journey and labelled flow sketch');
for(const asset of ['"/architecture.css"','"/architecture.js"','"/desk-polish.css"','"/showcase.html"','"/showcase-v2.css"','"/showcase-v2.js"','"/susu-agent.svg"','"/index.html"','"/motion.js"','"/workbench-motion.css"'])assert(appPy.includes(asset),'server whitelists '+asset);
assert(vm.runInContext("state.desk='sales';state.role='sales';state.page='channel';state.company={org:{name:'示意保险（虚构）'},customers:[{id:'客户-01'}],staff:[{id:'展业-01',duty:'sales'}],policies:[]};state.portal={agents:[{id:'advisor',name:'保障需求顾问'}]}",context)||true);
assert(vm.runInContext('salesShell()',context).includes('带着出处，谈这张保单。'));
assert(vm.runInContext("state.desk='phone';state.role='seat'",context)||true);
assert(vm.runInContext('phoneShell()',context).includes('沟通有依据，交接有记录。'));
vm.runInContext("state.desk='legacy';state.role='builder';state.page='knowledge';state.knowledgeView='docs';state.data.kinds.imported='外部资料待专业核实';state.data.kinds.mock='虚构演示条款';state.data.documents.push({id:'zj',product:'zijin-hospital-allowance',version:1,title:'紫金保险附加个人意外伤害住院日额津贴保险条款',kind:'imported',source:'公开条款',status:'published',created:'2026-10-08T00:00:00Z'},{id:'qx2',product:'qianxin',version:1,title:'骑安心住院津贴保险设计构想',kind:'design',source:'早期研究',status:'published',created:'2026-10-06T00:00:00Z'});",context);
const shelves=vm.runInContext('knowledgePage()',context);
assert(shelves.includes('外部对照'));
assert(shelves.includes('早期研究'));
assert(shelves.indexOf('外部对照')<shelves.indexOf('早期研究'));
assert(shelves.indexOf('紫金保险')<shelves.indexOf('骑安心住院津贴'));
vm.runInContext("state.knowledgeView='structure'",context);
assert(vm.runInContext('knowledgePage()',context).includes('按岗授权'));
const plazaAgents=[
 {id:'advisor',name:'保障需求顾问',group:'问答',accent:'violet',lane:'sales',layer:'channel',note:'平台预置 · 给展业用',duty:'听用户描述遇到的事。',boundary:'不能报价',origin:'平台预置',calls:11,starters:['怎么问']},
 {id:'compare',name:'产品对照助手',group:'问答',accent:'blue',lane:'sales',layer:'channel',note:'平台预置 · 给展业用',duty:'比较差异。',boundary:'不给价格',origin:'平台预置',calls:0,starters:[]},
 {id:'desk',name:'条款客服',group:'客服',accent:'teal',lane:'service',layer:'channel',note:'平台预置 · 给客户自助和坐席用',duty:'解释条款。',boundary:'不能补写',origin:'平台预置',calls:7,starters:[]},
 {id:'claimguide',name:'理赔引导',group:'客服',accent:'amber',lane:'uwclaim',layer:'channel',note:'平台预置 · 给客服和理赔用',duty:'说明材料。',boundary:'不算赔付',origin:'平台预置',calls:0,starters:[]},
 {id:'coach',name:'培训陪练',group:'培训',accent:'violet',lane:'sales',layer:'channel',note:'平台预置 · 给培训和展业陪练用',duty:'陪练。',boundary:'不承诺',origin:'平台预置',calls:0,starters:[]},
 {id:'outreach',name:'外呼话术助手',group:'外呼',accent:'amber',lane:'phone',layer:'channel',note:'平台预置 · 只出草稿，不拨号',duty:'写草稿。',boundary:'不拨号',origin:'平台预置',calls:1,starters:[]},
 {id:'underwrite',name:'核保辅助',group:'中台辅助',accent:'teal',lane:'uwclaim',layer:'channel',note:'平台预置 · 只列缺项',duty:'列缺项。',boundary:'不下结论',origin:'平台预置',calls:1,starters:[]},
 {id:'quality',name:'会话质检',group:'治理',accent:'blue',lane:'phone',layer:'channel',note:'平台预置 · 看话术风险，不改原回答',duty:'查话术。',boundary:'不改写',origin:'平台预置',calls:1,starters:[]},
 {id:'ops-knowledge',name:'知识治理',group:'中台',accent:'violet',layer:'platform',note:'中台专用 · 看条款如何分架',duty:'看知识结构。',boundary:'不编保费',origin:'平台预置',calls:0,starters:[]},
 {id:'ops-observe',name:'运行观测',group:'中台',accent:'blue',layer:'platform',note:'中台专用 · 看三个入口的调用',duty:'汇总调用。',boundary:'不说成绩',origin:'平台预置',calls:0,starters:[]},
 {id:'ops-sample',name:'抽检研判',group:'中台',accent:'amber',layer:'platform',note:'中台专用 · 建议处置，不改原回答',duty:'建议处置。',boundary:'只建议',origin:'平台预置',calls:0,starters:[]},
 {id:'ops-grant',name:'授权编排',group:'中台',accent:'teal',layer:'platform',note:'中台专用 · 看职责与授权',duty:'说明授权。',boundary:'不越权',origin:'平台预置',calls:0,starters:[]},
 {id:'ops-voice',name:'口径中枢',group:'中台',accent:'violet',layer:'platform',note:'中台专用 · 三个入口共用同一字段',duty:'统一字段。',boundary:'不另写数字',origin:'平台预置',calls:0,starters:['三个入口问减保时，应该共用哪一句？']},
 {id:'hr-policy',name:'人事制度助手',group:'综合职能',accent:'violet',lane:'office',layer:'channel',note:'内勤 · 查虚构制度与假期口径',duty:'说明请假口径。',boundary:'不接真实 OA/HR 系统',origin:'平台预置',calls:0,starters:['病假要提前多久登记？']},
 {id:'admin-guide',name:'行政办事指引',group:'综合职能',accent:'teal',lane:'office',layer:'channel',note:'内勤 · 会议室、用印、差旅流程说明',duty:'说明办事步骤。',boundary:'不连接真实办公系统',origin:'平台预置',calls:0,starters:[]},
 {id:'it-helpdesk',name:'IT 报障与账号',group:'综合职能',accent:'blue',lane:'office',layer:'channel',note:'内勤 · 常见故障与权限申请步骤',duty:'说明报障步骤。',boundary:'不创建工单',origin:'平台预置',calls:0,starters:[]},
 {id:'custom-01',name:'<script>alert(1)</script>自定义助手',group:'问答',accent:'teal',lane:'',layer:'channel',note:'工作人员新建 · 授权给：营销展业',duty:'新建智能体。',boundary:'不能越权',origin:'工作人员新建',calls:2,starters:[]}];
vm.runInContext('var __plazaTeamStore="";var localStorage={getItem:function(k){return k==="baozhi.plaza.team.v1"?__plazaTeamStore:null},setItem:function(k,v){if(k==="baozhi.plaza.team.v1")__plazaTeamStore=v}};',context);
vm.runInContext(`state.role='platform';state.page='plaza';state.portal={agents:${JSON.stringify(plazaAgents).replace(/</g,'\\u003c')},needs:[],benches:[],skills:[],products:[]};state.data.version='0.9.1';state.data.model_ready=false;state.plazaFilter='explore';state.plazaQuery='';state.plazaPick='';state.plazaBanner=true;`,context);
const plaza=vm.runInContext('plazaPage()',context);
assert(plaza.includes('<b>欢迎新同事。</b>')&&plaza.includes('人、条款和智能体接在一处，回答要能回到出处。'),'plaza banner text');
assert(plaza.includes('/illustrations/banner-wave.png'),'plaza banner illustration');
assert(plaza.includes('/illustrations/avatar-advisor.png'),'plaza explore card uses portrait avatar');
assert(plaza.includes('知识库负责条款字段和出处；内勤制度单独成架「制度演示架」。'),'plaza rail final copy');
assert(plaza.includes('收起说明'),'plaza banner collapse');
assert(!plaza.includes('欢迎你的新同事'),'plaza avoids exaggerated welcome');
for(const label of ['探索','我的团队','全部','中台','展业','客服','核保理赔','质检外呼','综合职能'])assert(plaza.includes('>'+label),'plaza filter '+label);
for(const name of ['保障需求顾问','条款客服','外呼话术助手','核保辅助','知识治理','运行观测','抽检研判','口径中枢'])assert(plaza.includes(name),'plaza explore shows '+name);
assert(!plaza.includes('人事制度助手'),'plaza explore hides office agents');
assert(!plaza.includes('产品对照助手'),'plaza explore keeps eight cards');
assert(plaza.includes('暂无留存'),'plaza shows no-record label');
assert(plaza.includes('本机留存 11 次'),'plaza shows real channel call count');
assert(plaza.includes('没有真实微信和电话，没有多人同时编辑'),'plaza rail scope');
assert(!/<\/\w+\s+\w+=/.test(plaza),'plaza valid closing tags');
assert(!plaza.includes('<script>alert(1)</script>'),'plaza escapes agent names');
vm.runInContext("state.plazaFilter='office'",context);
const office=vm.runInContext('plazaPage()',context);
assert(office.includes('人事制度助手')&&office.includes('行政办事指引')&&office.includes('IT 报障与账号'),'office lane shows three cards');
assert(office.includes('不接真实 OA，只读本机演示制度摘录'),'office cards carry OA boundary');
assert(!office.includes('保障需求顾问'),'office lane hides insurance agents');
vm.runInContext("state.plazaFilter='team';__plazaTeamStore=JSON.stringify(['ops-voice']);state.plazaTeam=['ops-voice']",context);
const team=vm.runInContext('plazaPage()',context);
assert(team.includes('口径中枢')&&!team.includes('保障需求顾问'),'team filter shows joined cards only');
vm.runInContext("state.plazaFilter='all';__plazaTeamStore='';state.plazaTeam=[];state.plazaPick='ops-voice'",context);
const picked=vm.runInContext('plazaPage()',context);
assert(picked.includes('data-plaza-talk="ops-voice"'),'picked card offers talk action');
assert(picked.includes('data-plaza-team="ops-voice"'),'picked card offers team action');
assert(picked.includes('加入团队'),'team action label');
vm.runInContext("state.plazaPick='';state.plazaQuery='条款'",context);
const searched=vm.runInContext('plazaPage()',context);
assert(searched.includes('条款客服')&&!searched.includes('核保辅助'),'search filters by name');
vm.runInContext("state.plazaQuery='';state.plazaBanner=false",context);
const collapsed=vm.runInContext('plazaPage()',context);
assert(collapsed.includes('展开说明'),'collapsed banner can expand again');
assert(!collapsed.includes('收起说明'),'collapsed banner hides full text');
vm.runInContext("state.plazaBanner=true",context);
assert(vm.runInContext('plazaPage()',context).includes('收起说明'),'expanded banner can collapse');
vm.runInContext("state.page='plaza'",context);
const platformShell=vm.runInContext('shell()',context);
assert(platformShell.includes('data-page="plaza"'),'platform nav includes plaza');
vm.runInContext("state.role='sales';state.page='channel'",context);
const salesNav=vm.runInContext('shell()',context);
assert(!salesNav.includes('data-page="plaza"'),'sales nav hides plaza');
console.log('Front-end template checks passed: pages, clause board, review desk, portal lobby, duty menus, channels, form options, closing tags, HTML escaping, and agent plaza.');



assert(!showcase.includes('href="/index.html?desk=legacy"'));assert(showcase.includes('尚未接入豆包、DeepSeek'));assert(showcase.includes('没有厂商合作'));

// REQ-066: English landing at "/"
const home=fs.readFileSync(path.join(__dirname,'../static/home.html'),'utf8');
const homeJs=fs.readFileSync(path.join(__dirname,'../static/home.js'),'utf8');
assert(appPy.includes('"/": "home.html"')&&['"/home.html"','"/home.css"','"/home.js"'].every(a=>appPy.includes(a)),'server maps / to the English landing');
assert(!/[\u4e00-\u9fff]/.test(home),'landing copy is English only');
assert(!/\sstyle="/.test(home)&&!/<script>(?!<)/.test(home),'landing avoids inline style and inline script');
assert(home.includes('lang="en"')&&home.split('class="chapter').length-1===8,'landing has eight scroll chapters');
for(const href of ['/index.html?desk=sales','/index.html?desk=wechat','/index.html?desk=phone','/index.html?desk=platform'])assert(home.includes(href),'landing links '+href);
assert(home.includes('Fictional data'),'landing keeps the concise fictional-data boundary');
for(const s of ['Demo integrations','Doubao and DeepSeek are not connected','no vendor partnership','Not connected to live sales apps','Local competition prototype'])assert(!home.includes(s),'landing removes superseded copy: '+s);
assert(!/\d+\/50|116\/150/.test(home),'landing shows no benchmark numbers');
assert(homeJs.includes('prefers-reduced-motion')&&homeJs.includes('no-webgl'),'landing honors reduced motion and has a WebGL fallback');
console.log('REQ-066 landing checks passed.');
