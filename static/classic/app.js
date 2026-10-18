'use strict';

const $ = (s, el=document) => el.querySelector(s);

const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = {page:'lobby',role:'viewer',token:'',data:null,result:null,form:null,scenario:'living',busy:false,runs:[],evaluation:null,knowledgeView:'structure',runFilter:'all',focusRun:null,portal:null,chatAgent:null,conversation:null,messages:[],draft:'',governance:null,scene:0,company:null,channelResult:null,handoffs:null,calls:null,callChannel:'',callQuery:'',jobAgent:'',jobMessages:[],jobConversation:'',lastCall:'',desk:'legacy',plazaFilter:'explore',plazaQuery:'',plazaPick:'',plazaTeam:[],plazaBanner:true,samplePick:'',askText:'',channelPending:false,consultMode:'professional',consultTopic:'clause',consultOptions:null,consultProfile:{},consultKnowledge:null};

const names={home:'工作概览',lobby:'需求咨询',talk:'智能体对话',studio:'职能工作台',governance:'调用治理',service:'智能服务',product:'产品设计与测算',knowledge:'资料与条款',agents:'智能体与流程',runs:'运行与复核',evaluation:'测试中心',channel:'渠道入口',job:'岗位作业',inbox:'转人工',platform:'智能体授权',library:'虚构公司库',overview:'中台总览',process:'处理流程',verification:'验证与证据',hub:'中台智能体',sample:'抽检留存',gate:'四个入口',plaza:'智能体广场'};

const glyphs={home:'⌂',lobby:'◈',talk:'问',studio:'▦',governance:'◷',service:'◎',product:'▱',knowledge:'▤',agents:'⬡',runs:'☰',evaluation:'核',channel:'⇢',job:'✎',inbox:'转',platform:'权',library:'库',overview:'览',hub:'台',sample:'检',plaza:'场'};

const roleNames={sales:'营销展业',service:'客户服务',outreach:'电话外呼',seat:'电话坐席',quality:'通话质检',underwrite:'核保作业',claim:'理赔作业',training:'培训',platform:'平台与知识运营',customer:'客户自助',viewer:'用户咨询空间',builder:'工作人员中台',reviewer:'证据复核空间'};

const toolNames={collect:'整理问题卡',search:'检索原文',rules:'条件规则核对',materials:'查询材料提示'};

const kindTag=k=>`<span class="tag ${k==='design'?'amber':k==='mock'?'blue':''}">${esc(state.data.kinds[k])}</span>`;

const timeFmt=s=>new Date(s).toLocaleString('zh-CN',{hour12:false});

let toastTimer;

function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',5000);}

async function api(path,body){const response=await fetch('/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(state.token?{'Authorization':'Bearer '+state.token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');return data;}

async function session(role){const data=await api('/session',{role});state.token=data.token;state.role=role;}

async function refresh(){state.data=await api('/state');if(state.data.build!=='REQ073-20261018'){document.getElementById('app').innerHTML='<div class="loading"><h1>此端口仍是旧服务</h1><p>请双击项目中的“启动保智协同.cmd”，启动器会打开本轮新版本，并保留原数据库。</p><p>请使用启动器显示的新地址；只刷新旧端口不会升级后台接口。</p></div>';throw Error('检测到旧服务，请使用启动器打开新版。');}state.portal=await api('/portal');}

function uiIcon(name){

  const paths={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',talk:'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z M7 9h9 M7 13h6',hub:'M4 5h16v14H4z M8 9h8 M8 13h5',plaza:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 13v8 M13 17h8',sample:'M8 3h8v4H8z M8 5H5v16h14V5h-3 M8 13l3 3 5-6',platform:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7L12 3Z M8 12l3 3 5-6',knowledge:'M4 3h12l4 4v14H4z M15 3v5h5 M8 12h8 M8 16h6',library:'M4 4h16v5H4z M4 12h16v8H4z M8 6h1 M8 15h1'};

  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.knowledge}"/></svg>`;

}

function header(title,desc,action=''){return `<div class="heading"><div><div class="eyebrow">工作台 / ${esc(pageName(state.page))}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;}

function shell(){

  if(state.desk==='sales')return salesShell();

  if(state.desk==='wechat')return wechatShell();

  if(state.desk==='phone')return phoneShell();

  const nav=allowedPages().filter(key=>key!=='talk');

  const platformDesk=state.desk==='platform';

  return `<a class="skip-workbench" href="#content">跳到工作区内容</a><div class="shell"><aside class="sidebar"><div class="brand"><img src="/classic/logo.svg" alt="保溯"><div><strong>${platformDesk?'保溯平台':'保溯'}</strong><small>${platformDesk?'条款可溯源寿险辅助平台':'条款可溯源辅助'}</small></div></div>${workspaceSwitch()}<div class="nav-caption">${roleLabel()}</div><nav class="nav" aria-label="工作区导航">${nav.map(key=>`${state.role==='platform'?({knowledge:'<div class="nav-section">资料准备</div>',process:'<div class="nav-section">业务使用</div>',sample:'<div class="nav-section">留存与验证</div>'}[key]||''):''}<button data-page="${key}" class="${state.page===key?'active':''}"><span class="icon">${uiIcon(key)}</span>${key==='service'?(state.role==='viewer'?'条款对照':'服务预览'):pageName(key)}</button>`).join('')}</nav><div class="sidebar-bottom">${platformDesk?'<p>展业、客户自助、电话中心<br>都把记录交回这个平台</p>':['viewer','builder','reviewer'].includes(state.role)?'<p>按需求进入不同智能体<br>工作人员另有分类工作台</p>':'<p>按职责打开菜单<br>三个入口走同一个中台接口</p>'}<small>比赛原型 / 非在售保险</small></div></aside><div class="main"><header class="topbar"><div class="crumb">${roleLabel()} <span>/</span> <b>${esc(pageName(state.page))}</b></div><div class="top-right">${platformDesk?deskSwitch():''}<button type="button" class="btn" data-gate>返回首页</button><span class="status"><span class="dot"></span>${state.data.model_ready?'千问已配置 · 调用按需开启':'本地规则已就绪'}</span><label class="subtle" for="role">演示职责</label>${roleOptions()}</div></header><main class="content" id="content" tabindex="-1">${page()}</main></div></div>`;

}

function page(){if(!allowedPages().includes(state.page))return header('当前工作区不提供此功能','请使用左侧导航。服务使用者不能查看全局运行记录。');return ({home:homePage,lobby:lobbyPage,talk:talkPage,studio:studioPage,governance:governancePage,service:servicePage,product:productPage,knowledge:knowledgePage,agents:agentsPage,runs:runsPage,evaluation:evaluationPage,channel:channelPage,job:jobPage,inbox:inboxPage,platform:platformPage,library:libraryPage,overview:overviewPage,process:processPage,verification:verificationPage,hub:hubPage,sample:samplePage,plaza:plazaPage})[state.page]();}

function published(){return state.data.documents.filter(d=>d.status==='published');}

function latest(){const seen=new Set();return published().filter(d=>{if(seen.has(d.product))return false;seen.add(d.product);return true;});}

function servicePage(){

  return header('住院以后，生活支出怎么办？','用虚拟骑手案例，比较资料里写了什么、哪些条件还需确认。','<span class="tag amber">研究草案 / 虚构样本</span>')+`<div class="workspace service-workspace"><section class="panel service-input"><div class="panel-head"><h2>本次服务</h2><span class="tag">01 / 输入</span></div><button class="example" id="fill-example">↗ 加载高血压骑手住院案例</button><form id="service-form"><label class="field" for="question">想了解什么</label><textarea id="question" required maxlength="1500" placeholder="因病住院后不能接单，生活支出有什么保障？"></textarea><div class="two"><div><label class="field" for="flow">服务流程</label><select id="flow">${state.data.flows.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div><div><label class="field" for="event">事件类型</label><select id="event"><option value="unknown">尚未确认</option><option value="hospital">因病住院</option><option value="outpatient">门诊就医</option><option value="accident">交通意外</option></select></div></div><div class="two"><div><label class="field" for="related">与高血压相关</label><select id="related"><option value="unknown">需要核实</option><option value="yes">案例设定为相关</option><option value="no">案例设定为无关</option></select></div><div><label class="field" for="insured">是否持有对应保障</label><select id="insured"><option value="unknown">尚未核实</option><option value="yes">案例设定为持有</option><option value="no">尚未持有</option></select></div></div><label class="field">资料版本</label>${published().map(d=>`<label class="check-card"><input name="documents" type="checkbox" value="${d.id}" ${latest().some(x=>x.id===d.id)?'checked':''}><span>${esc(d.title)}<small>v${d.version} · ${esc(state.data.kinds[d.kind])}</small></span></label>`).join('')}<label class="inline-check"><input type="checkbox" id="use-model" ${state.data.model_ready?'':'disabled'}><span>使用模型辅助解释（末尾一次）</span></label><label class="inline-check hidden" id="external-label"><input type="checkbox" id="allow-external"><span>确认将本次虚拟案例与引用资料发送到本机配置的模型服务。</span></label><button class="btn primary wide" id="run-button">开始分析 →</button><p class="subtle">仅使用虚拟案例，请勿输入真实病历、保单号或联系方式。</p></form></section><div id="result-area" aria-live="polite">${resultHtml()}</div></div>`;

}

function resultHtml(){

  const r=state.result;

  if(!r)return `<section class="panel empty service-empty"><div class="empty-orbit"><span>保</span></div><div class="eyebrow">ONE QUESTION · TRACEABLE ANSWERS</div><h2>把一个问题，拆成三个保障情景</h2><p>加载左侧案例，比较骑安心草案与虚构医疗样本。<br>依据来自本地原文和已登记规则。</p><div class="scenario-preview"><span>01 医疗费用</span><span>02 生活支出</span><span>03 出院后停工</span></div><div class="mini-pipeline"><b>整理问题</b><i>→</i><b>核对原文与规则</b><i>→</i><b>提示下一步</b></div><small>按所选流程执行任务助手 · 可选一次模型解释</small></section>`;

  return `<section class="panel result-primary"><div class="panel-head"><h2>先看这次问题的答案</h2><button class="btn text" id="export-result">下载说明 ↓</button></div><div class="question-summary"><small>本次问题 · ${esc(r.id)}</small><p>${esc(r.question_card.question)}</p></div><p class="scope-line">以下只解释资料约定；骑安心仍是研究草案，不能据此申请投保或认定可赔。</p><div class="scenario-tabs">${Object.entries(state.data.scenarios).map(([key,name])=>`<button data-scenario="${key}" class="${state.scenario===key?'active':''}">${esc(name)}</button>`).join('')}</div>${comparisonHtml(r,state.scenario,true)}<div class="personal-missing"><h3>还缺哪些个人信息</h3>${r.missing.length?`<ul class="bullet-list">${r.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>本次表单已填写；真实保障期间与完整合同仍需核实。</p>'}</div>${r.issues.length?`<div class="notice"><b>本次流程异常</b>${r.issues.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}</section>${clauseAttentionHtml(r)}${r.model.status==='ok'?`<section class="panel"><div class="panel-head"><h2>模型辅助说明</h2><span class="tag">末尾一次解释</span></div><p class="subtle">${esc(r.model.model)} · 解释供复核，以上规则结果保持不变</p><div class="model-note">${esc(r.model.text)}</div></section>`:r.model.status!=='not_requested'?`<div class="notice">${esc(r.model.message)}</div>`:''}${r.materials.length?`<details class="panel disclosure"><summary>申请准备提示 · ${r.materials.length} 段</summary>${r.materials.map(m=>`<p><b>${esc(m.label)}</b> ${esc(m.content)}</p>`).join('')}</details>`:''}<details class="panel disclosure"><summary>限制与提醒 · 不是投保或赔付决定</summary><ul class="bullet-list">${r.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details><details class="panel disclosure"><summary>追溯运行与原文 · ${esc(r.flow?.name||'')} · ${r.ms} ms</summary>${traceHtml(r)}${r.evidence.map(sourceHtml).join('')}</details>`;

}

function sourceHtml(e){return `<details class="source" id="e-${esc(e.id)}"><summary>${esc(e.title)} · v${e.version} · 段落${e.position}</summary><p class="subtle">${esc(state.data.kinds[e.kind])} / ${esc(e.source)}</p><blockquote>${esc(e.content)}</blockquote><small>引用编号 ${esc(e.id)}</small></details>`;}

function traceHtml(r){return `<div class="trace">${(r.traces||[]).map(t=>`<div class="trace-step"><div class="row between"><h3>${esc(t.agent)} <span class="tag ${t.status==='completed'?'green':'red'}">${t.status==='completed'?'已执行':'已阻止'}</span></h3><small class="muted">v${t.version} · ${t.ms} ms</small></div><p>${esc(t.detail)}</p><code>${(t.tools||[]).map(x=>esc(toolNames[x]||x)).join(' / ')}</code></div>`).join('')}</div>`;}

function clauseAttentionHtml(r){const items=r.clause_attention||[];if(!items.length)return '';return `<details class="panel disclosure clause-disclosure"><summary>还有 ${items.length} 项没写成约定 <span class="tag amber">条款待完善</span></summary><p class="subtle">${esc(r.clause_attention_note||'这是所选资料的结构缺口，不是个人赔付结论；核对原文不代表条款已获审定。')}</p>${items.map(s=>`<article class="gap-detail"><div class="row between"><h3>${esc(s.product)} · ${esc(s.title)}</h3><span class="tag amber">${esc(s.status_label)}</span></div><p>${esc(s.expect)}</p>${gapEvidence(s)}</article>`).join('')}</details>`;}

function clauseListHtml(d){const items=d.clauses||[];if(!items.length)return '';const labels=state.data.elements||{};return `<h3>条款条目</h3>${items.map(c=>`<div class="coverage-card"><div class="row between"><strong>${esc(c.heading)}</strong><span class="tag">${esc(labels[c.element]||c.element)}</span></div><p>${esc(c.content)}</p></div>`).join('')}`;}

function productPage(){const d=state.data.design, c=d.current, p=c.parameters;return header('骑安心：把产品设计变成可验证的方案','产品草案 → 参数比较 → 入库核对 → 服务解释；每一步都保留边界。', '<span class="tag amber">研究方案 v'+c.version+' · 非在售保险</span>')+`

<div class="product-card"><span class="tag">聚焦因病住院期间的生活支出</span><h2>${esc(c.name)}</h2><p>面向新市民慢病骑手，研究有条件纳入高血压相关住院的定额津贴。先验证需求、责任和成本，再讨论落地。</p><div class="chips"><span class="tag">产品提供约定经济给付</span><span class="tag">中台帮助理解与准备</span><span class="tag">当前均为研究演示</span></div></div>

<div class="grid2">${d.boundaries.map(b=>`<section class="panel"><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p></section>`).join('')}</div>

<div class="step-strip research-flow"><span>① 调整研究假设</span><b>→</b><span>② 比较虚拟情景</span><b>→</b><span>③ 生成待审核资料</span><b>→</b><span>④ 登记依据后进入服务</span></div>

<div class="grid2"><section class="panel"><div class="panel-head"><h2>产品假设工作台</h2><span class="tag">持久保存 · 保留旧版本</span></div><p class="subtle">下列数字是演示起点，没有真实精算依据，不是推荐保障或保费。</p><form id="design-form"><div class="two">${Object.entries(d.parameter_labels).map(([key,label])=>`<div><label class="field" for="design-${key}">${esc(label)}</label><input id="design-${key}" type="number" min="${['waiting','deductible'].includes(key)?0:1}" max="${({daily:1000,waiting:180,deductible:30,per_stay:180,annual:365})[key]}" step="1" value="${p[key]}" required ${state.role!=='builder'?'disabled':''}></div>`).join('')}</div><label class="field" for="design-notes">研究范围与尚未解决的问题</label><textarea id="design-notes" maxlength="2000" required ${state.role!=='builder'?'disabled':''}>${esc(c.notes)}</textarea><button class="btn primary wide" ${state.role!=='builder'?'disabled':''}>保存新的研究版本</button></form><div class="row product-actions"><button class="btn" id="export-design">下载产品设计说明</button><button class="btn" id="design-document" ${state.role!=='builder'?'disabled':''}>生成待审核资料 →</button></div><p class="subtle">最近版本：${d.history.map(h=>'v'+h.version).join(' / ')}。保存参数不会修改既有知识库资料；生成草案后仍须登记规则和演示复核。</p></section>

<section class="panel"><h2>如果这样约定，会给付多少</h2><p class="subtle">使用已保存的 v${c.version} 参数。先明确条件，再展示公式；不确定时不给出金额。</p><form id="benefit-form"><label class="field" for="benefit-eligibility">疾病、医院等责任条件</label><select id="benefit-eligibility"><option value="unknown">尚未确认（默认）</option><option value="assumed_yes">虚拟案例假设全部满足</option><option value="assumed_no">虚拟案例假设不满足</option></select><div class="two">${[['start','假设保障起始日','2026-01-01'],['end','假设保障终止日','2026-12-31'],['admission','假设入院日','2026-03-01'],['discharge','假设出院日','2026-03-08']].map(([key,label,value])=>`<div><label class="field" for="benefit-${key}">${label}</label><input id="benefit-${key}" type="date" value="${value}" required></div>`).join('')}</div><label class="field" for="benefit-used">本年度已给付天数</label><input id="benefit-used" type="number" value="0" min="0" max="${p.annual}" step="1" required><button class="btn primary wide">测算虚拟情景</button></form><div id="benefit-result" aria-live="polite"></div><p class="notice">住院天数按出院日减入院日；等待期按起保日至入院日的间隔。本次不处理跨期责任、同次住院合并和真实理赔认定。</p></section></div>

<section class="panel"><h2>从三个角度验收项目</h2><div class="grid3"><div><h3>评委看证据</h3><p>是否解决真实问题？能否复用组件？用独立案例和操作记录证明，不能把三个聊天窗口当创新。</p></div><div><h3>保险公司看可行性</h3><p>责任能否界定？成本数据从哪来？能否核保、控风险和复核？待解决事项应可追踪。</p></div><div><h3>用户看能否看懂</h3><p>什么情况可能相关？什么还不知道？下一步核对什么？必须分清投保、责任条件和最终赔付。</p></div></div></section>

<section class="panel"><h2>从研究到落地，还有哪些证据缺口</h2>${d.gates.map(g=>`<div class="list-item"><div><h3>${esc(g.owner)} · ${esc(g.question)}</h3><p>${esc(g.evidence)}</p></div><span class="tag amber">待完成</span></div>`).join('')}<p class="subtle">这不是完成率仪表盘，也不是专业审批记录。按实际调研和复核结果逐项补齐交付物。</p></section>

<div class="grid2"><section class="panel"><h2>给付成本假设计算器</h2><p class="subtle">先理解参数怎样影响成本。默认数字仅是教学假设。</p><form id="cost-form"><div class="two"><div><label class="field" for="probability">年度一次给付事件概率</label><input id="probability" type="number" min="0" max="1" step="0.001" value="0.05" required></div><div><label class="field" for="days">事件发生后平均给付天数</label><input id="days" type="number" min="0" max="365" step="0.1" value="7" required></div><div><label class="field" for="daily">假设每日津贴 元</label><input id="daily" type="number" min="0" max="10000" step="1" value="100" required></div><div><label class="field" for="expense">假设费用占比</label><input id="expense" type="number" min="0" max="0.8" step="0.01" value="0.2" required></div></div><button class="btn primary wide">计算教学成本假设</button></form><div id="cost-result"></div><p class="notice">没有真实精算数据支撑，不提供建议保费，不把模型输出当作产品定价。</p></section><section class="panel"><h2>当前真正实现了什么</h2><p>三个任务助手使用同一套资料、规则与运行记录。当前按确定性流程执行工具；可选的大模型在流程末尾生成一次辅助解释。</p><p>三个助手可以共用同一个模型接口，但当前不能宣称已实现三个自主大模型智能体，也未进行模型训练。</p><p class="notice green">新增产品时，先加入独立条款和规则，再复用工具与流程。不能把骑安心参数直接套到其他产品。</p></section></div>`;}

function designReport(){const d=state.data.design,c=d.current;return '# '+c.name+'\n\n研究方案 v'+c.version+'，非在售保险。\n\n'+d.boundaries.map(b=>'## '+b.title+'\n'+b.text).join('\n\n')+'\n\n## 教学参数（未经专业审定）\n'+Object.entries(c.parameters).map(([k,v])=>d.parameter_labels[k]+'：'+v).join('\n')+'\n\n## 研究备注\n'+c.notes+'\n\n## 待取得的证据\n'+d.gates.map(g=>g.owner+'：'+g.evidence).join('\n\n');}

function serviceReport(r){return '# 保溯服务说明\n\n虚拟案例演示，不是投保或赔付结论。\n任务：'+r.id+'\n问题：'+r.question_card.question+'\n\n## 保障情景\n'+r.cards.map(c=>state.data.scenarios[c.scenario]+' / '+c.product+' v'+c.version+' / '+c.status+'\n'+c.note+'\n引用：'+(c.evidence||'无，需补充资料')).join('\n\n')+'\n\n## 下一步先做什么\n'+(r.missing.length?r.missing.join('\n'):'核对完整条款与个人保障状态，再联系正式服务渠道确认。')+'\n\n## 限制与提醒\n'+r.limitations.concat(r.issues).join('\n')+'\n\n## 条款结构对照\n'+((r.clause_attention||[]).map(s=>s.product+' / '+s.title+' / '+s.status_label+'：'+s.expect).join('\n')||'本次没有额外的结构缺口。')+'\n\n## 原文依据\n'+r.evidence.map(e=>'['+e.id+'] '+e.title+' v'+e.version+' 段落'+e.position+'\n出处：'+e.source+'\n'+e.content).join('\n\n')+'\n\n## 申请准备提示\n'+r.materials.map(m=>m.label+'：'+m.content).join('\n');}

function bindDesign(){

$('#design-form').onsubmit=e=>{e.preventDefault();guard(async()=>{await api('/design',{version:state.data.design.current.version,parameters:Object.fromEntries(Object.keys(state.data.design.current.parameters).map(k=>[k,$('#design-'+k).value])),notes:$('#design-notes').value});await refresh();render();toast('新研究版本已保存；资料库中的旧版本保持不变');});};

$('#export-design').onclick=()=>download('骑安心产品研究-v'+state.data.design.current.version+'.md',designReport(),'text/markdown;charset=utf-8');

$('#design-document').onclick=()=>guard(async()=>{const d=await api('/design/document',{version:state.data.design.current.version});await refresh();await navigate('knowledge');await showDoc(d.id);toast('已生成待审核草案；请登记带依据的规则');});

$('#benefit-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const r=await api('/design/simulate',{version:state.data.design.current.version,...Object.fromEntries(['start','end','admission','discharge','used','eligibility'].map(k=>[k,$('#benefit-'+k).value]))});$('#benefit-result').innerHTML=`<div class="notice ${r.amount===null?'':'green'}"><h3>${r.amount===null?'条件待确认，暂不计算':`虚拟情景给付 ¥${r.amount}`}</h3><p>${esc(r.reason)}</p><p>${esc(r.notice)}</p><small>保存记录 ${r.record_id} · 方案 v${r.design_version}</small></div><button class="btn wide" id="export-benefit">下载测算说明</button>`;$('#export-benefit').onclick=()=>download('骑安心虚拟测算-'+r.record_id+'.txt',r.notice+'\n方案版本：'+r.design_version+'\n参数：'+JSON.stringify(r.parameters)+'\n情景：'+JSON.stringify(r.inputs)+'\n'+r.reason+'\n'+r.convention,'text/plain;charset=utf-8');});};

}

function clauseHtml(){

  const board=state.data.clause_board||{slots:[],counts:{},document:null},doc=board.document;

  const current=board.research||state.data.design?.current, selected=state.clauseResearch||current;

  return `<section class="panel research-link"><div class="panel-head"><div><h2>研究参数 × 条款缺口</h2><p class="subtle">当前研究方案 v${esc(current?.version||'—')}；资料对照基准 v${esc(doc?.version||'—')}。两种版本独立保存。</p></div><span class="tag amber">教学参数，不是保险金额</span></div><label class="field" for="research-version">查看研究版本（旧版本可追溯）</label><select id="research-version">${(state.data.design?.history||[]).map(h=>`<option value="${h.version}" ${h.version===selected?.version?'selected':''}>研究方案 v${h.version}${h.version===current?.version?' · 当前':' · 历史'}${h.created?' · '+timeFmt(h.created):''}</option>`).join('')}</select><p class="subtle">当前展示：研究方案 v${esc(selected?.version||'—')}。切换只查看保存的数字，不改动原文或当前方案。</p>${parameterStrip(selected)}</section><div class="notice">${esc(board.notice||'条款结构尚未生成')} 每项按关键词选择一句原文；同一段被多项使用时标为证据偏粗，不能据此认定写清。需要保险成员逐条核对。</div><section class="panel"><div class="panel-head"><div><h2>${doc?esc(doc.title):'还没有骑安心资料'}</h2><small>固定资料 v${esc(doc?.version||'—')} · 已有表述也不代表责任成立</small></div><span class="tag">${board.slots.length} 项结构对照</span></div><div class="slot-grid">${board.slots.map(slot=>`<article class="coverage-card clause-slot" data-slot="${esc(slot.code)}"><div class="row between"><strong>${esc(slot.title)}</strong><span class="tag ${slot.status==='stated'?'green':'amber'}">${esc(slot.status_label)}</span></div><p class="gap-expect">${esc(slot.expect)}</p>${gapEvidence({...slot,version:doc?.version})}${selected&&['waiting','amount','benefit'].includes(slot.code)?`<div class="slot-parameters"><small>研究方案 v${esc(selected.version)} · 教学参数，不是保险金额</small>${parameterStrip(selected,slot.code==='waiting'?['waiting']:slot.code==='benefit'?['daily']:['daily','deductible','per_stay','annual'])}<small>参数不补写条款；起算日、责任条件和适用口径仍须核对。</small></div>`:''}${slot.status==='coarse'?`<small>句子本身：${esc(slot.content_status_label||'需核对')}；不可按完整约定使用。</small>`:''}</article>`).join('')}</div></section>`;

}

function catalogHtml(){const items=state.data.catalog||[];const groups=[...new Set(items.map(item=>item.category))];return `<div class="notice">信息目录只说明三类事实：系统已经采集的、只能当研究参数的、还没有证据的。缺口不能在页面上改成已核实数据。</div>${groups.map(group=>`<section class="panel"><h2>${esc(group)}</h2>${items.filter(item=>item.category===group).map(item=>`<div class="list-item"><div><h3>${esc(item.name)}</h3><p>${esc(item.definition)}</p><p>来源：${esc(item.source)} · ${esc(item.sensitivity)} · ${esc(item.owner)}${item.gap?` · ${esc(item.gap)}`:''}</p></div><span class="tag ${item.status==='ready'?'green':item.status==='gap'?'amber':'blue'}">${esc(item.status_label||item.status)}</span></div>`).join('')}</section>`).join('')}`;}

function knowledgeShelf(doc){if(['qianxin','sample-medical','ride-accident','clinic-gap','zijin-hospital-allowance'].includes(doc.product))return 'research';if(['life-zhongying-xinyue','annuity-haigang-jincai','ci-zhonghong-shuangxing'].includes(doc.product))return 'clause';if(doc.product==='medical-picc-2024')return 'compare';if(String(doc.product||'').startsWith('demo-'))return 'structured';if(doc.product==='zijin-hospital-allowance'||doc.kind==='imported')return 'external';return 'research';}

function lifeStepsHtml(){const products=state.life?.products||[];if(!products.length)return '';const sample=products[0];return `<section class="panel"><h2>公开条款怎么走进知识库</h2><p class="subtle">${esc(state.life.notice||'')}</p><div class="step-strip">${(sample.steps||[]).map(s=>`<span>${esc(s.position)} ${esc(s.name)}</span>`).join('<b>→</b>')}</div>${products.map(p=>`<article class="list-item"><h3>${esc(p.short)} · ${esc(p.shelf)}</h3>${(p.steps||[]).map(s=>`<p>${esc(s.name)}：${esc(s.detail)}</p>`).join('')}</article>`).join('')}</section>`;}

function lifeTablesHtml(){const products=state.life?.products||[];return products.map(p=>`<section class="panel"><h2>${esc(p.name)}</h2><p class="subtle">${esc(p.company)} · ${esc(p.category)} · ${esc(p.shelf)} · ${esc(p.source_file)}</p><h3>产品信息</h3><table class="life-table"><tr><th>字段</th><th>内容</th><th>出处</th></tr>${p.info.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(f.value)}</td><td>${esc(f.cite)}</td></tr>`).join('')}</table><h3>保险责任</h3><table class="life-table"><tr><th>责任</th><th>说明</th><th>出处</th></tr>${p.duties.map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(d.summary)}</td><td>${esc(d.cite)}</td></tr>`).join('')}</table><h3>责任免除</h3>${p.exclusions.map(e=>`<p><b>${esc(e.scope)}</b> · 条款 ${esc(e.cite)}</p><p>${esc(e.body)}</p>`).join('')}</section>`).join('');}

function money(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:0}):'—';}

function benefitChart(table){const rows=table.chart||[],values=rows.flatMap(r=>[r.premium,r.cash,r.death]).filter(v=>Number.isFinite(Number(v))),max=Math.max(...values,1),w=620,h=250,left=48,top=24,bottom=42,right=18,iw=w-left-right,ih=h-top-bottom;const point=(r,i,key)=>`${left+(rows.length===1?0:i/(rows.length-1))*iw},${top+ih-(Number(r[key])||0)/max*ih}`;const line=key=>rows.map((r,i)=>point(r,i,key)).join(' ');const ticks=[0,.5,1].map(v=>`<g><line x1="${left}" y1="${top+ih-v*ih}" x2="${w-right}" y2="${top+ih-v*ih}"/><text x="${left-8}" y="${top+ih-v*ih+4}" text-anchor="end">${money(max*v)}</text></g>`).join('');return `<div class="benefit-visual"><div class="benefit-legend"><span class="paid">累计保费</span><span class="cash">现金价值</span><span class="death">身故保险金</span></div><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="累计保费、现金价值与身故保险金按保单年度对照图"><g class="chart-grid">${ticks}</g><polyline class="chart-line paid" points="${line('premium')}"/><polyline class="chart-line cash" points="${line('cash')}"/><polyline class="chart-line death" points="${line('death')}"/>${rows.filter((r,i)=>i===0||r.year%5===0).map((r,i)=>`<text class="chart-year" x="${left+(rows.length===1?0:(r.year-rows[0].year)/(rows.at(-1).year-rows[0].year))*iw}" y="${h-15}" text-anchor="middle">${r.year}年</text>`).join('')}</svg></div>`;}

function illustrationHtml(){if(state.role!=='sales')return '';const t=state.simulation;if(!t)return '<section class="panel"><h2>讲清投入与退出</h2><p>正在读取讲解方案。</p></section>';const selected=t.chart[Math.min(29,Math.max(0,(state.simYear||10)-1))];return `<section class="panel illu-panel"><div class="illu-head"><div><span class="tag amber">自编教学数据</span><h2>讲清投入与退出</h2></div><span>方案 A · 不对应真实产品</span></div><p class="notice">${esc(t.notice)}</p><form id="illu-form" class="illu-picker"><label class="field">起始年龄<input id="illu-age" type="number" min="18" max="65" value="${t.age}" required></label><label class="field">投入年数<select id="illu-pay">${[3,5,10].map(n=>`<option ${n===t.pay?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">每年假设投入<input id="illu-annual" type="number" min="1000" max="100000" step="1000" value="${t.annual}" required></label><button class="btn primary">更新讲解</button></form><label class="sim-slider">查看第 <b>${selected.year}</b> 年 · ${selected.age}岁<input type="range" id="sim-year" min="1" max="30" value="${selected.year}"></label><div class="benefit-kpis"><article><small>累计投入</small><strong>${money(selected.premium)}</strong></article><article><small>退出金额示例</small><strong>${money(selected.cash)}</strong></article><article><small>责任金额示例</small><strong>${money(selected.death)}</strong></article></div>${benefitChart(t).replaceAll('累计保费','累计投入').replaceAll('现金价值','退出金额示例').replaceAll('身故保险金','责任金额示例').replaceAll('保单年度','演示年度')}<p class="sim-takeaway">第${selected.year}年退出时，示例金额${selected.cash<selected.premium?'少于':'不低于'}累计投入。真实产品需另查合同和利益表。</p><details class="benefit-table"><summary>查看计算依据与完整年度表</summary><p>${esc(t.formula)}</p><div class="table-scroll"><table class="life-table"><tr><th>年度 / 年龄</th><th>累计投入</th><th>退出金额示例</th><th>责任金额示例</th></tr>${t.chart.map(r=>`<tr><td>${r.year} / ${r.age}</td><td>${money(r.premium)}</td><td>${money(r.cash)}</td><td>${money(r.death)}</td></tr>`).join('')}</table></div></details></section>`;}



function knowledgeCallers(product){return { 'life-zhongying-xinyue':'展业问答、产品对照、外呼','annuity-haigang-jincai':'展业、外呼、培训','ci-zhonghong-shuangxing':'客户自助、核保、理赔','medical-picc-2024':'只作对照','demo-product':'展业问答、产品对照、外呼话术、培训陪练','demo-service':'客户自助、条款客服、理赔引导','demo-underwrite':'核保辅助','demo-ban':'通话质检、外呼、培训','zijin-hospital-allowance':'早期外部对照','qianxin':'早期演示','sample-medical':'早期演示','ride-accident':'早期演示','clinic-gap':'早期演示' }[product]||'按资料授权';}

function knowledgeCard(d){return `<section class="panel doc-card"><div class="row between">${kindTag(d.kind)}<span class="tag ${d.status==='published'?'green':'amber'}">${d.status==='published'?'可调用':'待审核'}</span></div><h3>${esc(d.title)}</h3><div class="doc-meta"><div>调用：${esc(knowledgeCallers(d.product))}</div><div>出处 ${esc(d.source)}</div><div>v${d.version} · ${timeFmt(d.created)}</div></div><button class="btn" data-doc="${d.id}">查看原文与规则 ↗</button></section>`;}

function structureHtml(){return dataClasses()+`<section class="panel intake-map"><h2>同一份资料，保留两条线</h2><p>登记来源、识别产品与版本，再分别整理事实和原文。</p><div class="knowledge-dual"><article><span>事实层</span><h3>能查的约定</h3><p>产品信息、责任、免责，以及关联条件和例外。</p><button class="btn" data-knowledge="clauses">查看已整理字段</button></article><div class="dual-link">关联同一份资料<br>与版本</div><article><span>证据层</span><h3>能回看的出处</h3><p>正文、片段、来源和位置；摘要不能冒充正式原文。</p><button class="btn" data-knowledge="docs">查看资料版本</button></article></div><div class="publication-strip"><b>核对 → 发布 → 按岗授权</b><button class="btn" data-page="platform">检查授权</button></div><p class="notice">上传文件会提取正文与片段，不会自动补全产品字段。公开样例的“已发布”仅表示演示可用，仍需专业核实。</p><details><summary>接入真实机构时还需要什么</summary><p>正式账号、资料授权、字段复核、业务接口，以及按合同生效时间选择适用条款版本。当前并未实现自动匹配历史保单条款。</p></details></section>`;}



function knowledgePage(){const view=state.knowledgeView||'structure';const tabs=[['structure','数据分工'],['docs','资料与版本'],['clauses','事实与出处'],['data','来源处理']].map(([key,label])=>`<button type="button" data-knowledge="${key}" class="${view===key?'active':''}">${label}</button>`).join('');const shelves=[['clause','公开寿险条款','整理的公开条款。保留真实公司名，不是示意保险的在售产品。'],['compare','住院医疗对照','只用来对照，不写进示意公司的产品。'],['structured','示意公司知识','清洗、分类之后授权给对应智能体。全部虚构，不是在售产品。'],['external','外部对照','公开文件。不写成示意公司的产品。'],['research','早期研究','骑安心和教学样本留在这里，默认不进新的渠道问答。']];const docs=shelves.filter(x=>state.desk==='legacy'||x[0]!=='research').map(([id,title,note])=>{const rows=(state.data.documents||[]).filter(d=>knowledgeShelf(d)===id);return `<section class="shelf-block"><div class="section-title"><h2>${title}</h2><span>${rows.length} 份</span></div><p class="subtle">${note}</p><div class="grid3">${rows.map(knowledgeCard).join('')||'<p class="notice">这一架还没有资料。</p>'}</div></section>`;}).join('');return header('知识与依据','查看资料从哪里来、谁能查，以及每个产品的条款出处。',(state.role==='builder'||state.role==='platform'?'<button class="btn primary" id="new-doc">＋ 导入新资料</button>':''))+`<div class="subnav">${tabs}</div>${view==='clauses'?(state.desk==='legacy'?clauseHtml():lifeTablesHtml()):view==='data'?(state.desk==='legacy'?catalogHtml():lifeStepsHtml()):view==='docs'?docs:structureHtml()}`;}

function runTag(r){const names=state.data.dispositions||{};if(r.disposition&&names[r.disposition])return `<span class="tag ${r.disposition==='continue_demo'?'green':r.disposition==='dispute'?'red':'amber'}">${esc(names[r.disposition])}</span>`;if(r.review_count)return '<span class="tag">已有补充意见</span>';if((r.issues||[]).length)return '<span class="tag amber">待处理异常</span>';return '<span class="tag amber">待复核</span>';}

function reviewHistory(r){const dispositions=state.data.dispositions||{};if(!(r.reviews||[]).length)return '<p class="subtle">尚无复核处置。新意见只追加，不改当时结论。</p>';return `<details class="review-history"><summary>历史处置（${r.reviews.length}）· 只追加</summary>${r.reviews.map(item=>`<div class="notice"><b>${esc(dispositions[item.disposition]||'补充意见')}</b><p>${esc(item.note)}</p><small>${timeFmt(item.created)}</small>${(item.gap_actions||[]).map(g=>`<p class="review-action-history">${esc(g.product)} v${esc(g.version)} / ${esc(g.title)}：${esc(g.label)}</p>`).join('')}${Object.entries(item.checks||{}).map(([key,v])=>`<small class="review-action-history">${esc(state.data.review_checks?.[key]||key)}：${v?'通过':'未通过'}</small>`).join('')}</div>`).join('')}</details>`;}

function reviewWorkstation(r){

  const checks=state.data.review_checks||{}, gaps=r.clause_attention||[], actions=state.data.gap_actions||{}, dispositions=state.data.dispositions||{};

  return header('逐项核对，再留下处置','本次结论与引用已固定；每次处置都单独保存。','<button class="btn" id="back-runs">← 返回队列</button>')+`<div class="workbench"><div><section class="panel"><div class="panel-head"><h2>本次问题</h2><span class="tag">${esc(r.id)}</span></div><p>${esc(r.question_card.question)}</p><div class="chips"><span class="tag">${esc(r.flow?.name||'')} v${esc(r.flow?.version||'')}</span><span class="tag">${timeFmt(r.created)}</span><span class="tag amber">${gaps.length} 项条款缺口</span></div></section><section class="panel"><h2>情景对照与原文</h2>${Object.entries(state.data.scenarios).map(([key,name])=>`<h3 class="scenario-heading">${esc(name)}</h3>${comparisonHtml(r,key)}`).join('')}</section>${r.missing?.length?`<section class="panel"><h2>当时缺少的个人信息</h2>${r.missing.map(s=>`<p>${esc(s)}</p>`).join('')}</section>`:''}${r.issues?.length?`<div class="notice">${r.issues.map(esc).join('<br>')}</div>`:''}${clauseAttentionHtml(r)}${r.research_snapshot?`<section class="panel"><h2>当次研究方案 v${r.research_snapshot.version}</h2><p class="subtle">教学参数，不是保险金额；保留当时数字，不随新方案改变。</p>${parameterStrip(r.research_snapshot)}</section>`:''}<details class="panel disclosure"><summary>全部原文与执行步骤</summary>${(r.evidence||[]).map(sourceHtml).join('')}${traceHtml(r)}</details></div><aside class="panel review-rail"><h2>本次复核处置</h2><p class="subtle">先处理 ${gaps.length} 项实际缺口，再完成五项总检查。核对过原文不等于填补了专业证据。</p>${reviewHistory(r)}${state.role==='reviewer'?`<form id="review-form"><div class="review-gap-list">${gaps.map((s,i)=>`<div class="review-gap"><label class="field" for="gap-${i}">${i+1}. ${esc(s.title)}<small>${esc(s.product)} · v${esc(s.version)}</small></label><details><summary>查看这一项缺什么</summary><p>${esc(s.expect)}</p>${gapEvidence(s)}</details><select id="gap-${i}" data-gap-id="${esc(s.gap_id)}" aria-label="${esc(s.product)} ${esc(s.title)}处置"><option value="">请选择这一项的处理</option>${Object.entries(actions).map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></div>`).join('')||'<p>本次没有额外条款缺口。</p>'}</div><h3>五项总检查</h3>${Object.entries(checks).map(([key,label])=>`<label class="inline-check"><input type="checkbox" name="review-check" value="${esc(key)}"><span>${esc(label)}</span></label>`).join('')}<label class="field" for="review-disposition">整体处置</label><select id="review-disposition">${Object.entries(dispositions).map(([key,label])=>`<option value="${key}" ${key==='needs_specialist'?'selected':''}>${esc(label)}</option>`).join('')}</select><label class="field" for="review-note">处置意见</label><textarea id="review-note" required maxlength="2000" placeholder="说明核对过哪些原文、需谁补充哪些证据。"></textarea><p id="review-error" class="form-error" role="alert"></p><button class="btn primary wide" id="save-review">保存处置</button><p class="subtle">漏掉任何缺口都不能保存处置；存在转交或退回项时不能标记演示路径可继续。</p></form>`:'<div class="notice">维护者只能查看；追加处置请切换演示复核者。</div>'}<button class="btn wide" id="export-run">导出任务与复核记录</button><p class="subtle">本机演示，不能出单、核保或支付赔款。</p></aside></div>`;

}

function runsPage(){

  if(state.role==='viewer')return header('服务使用者不能查看全局运行记录','请回到智能服务查看本次分析。');

  if(state.focusRun)return reviewWorkstation(state.focusRun);

  const runs=state.runs||[], filter=state.runFilter||'all';

  const filters=[['all','全部'],['open','待复核'],['reviewed','已处置'],['gap','有条款缺口'],['issue','有异常']];

  const visible=runs.filter(r=>filter==='all'||filter==='open'&&!r.review_count||filter==='reviewed'&&r.review_count||filter==='gap'&&r.gap_count||filter==='issue'&&r.issues?.length);

  return header(state.role==='reviewer'?'证据复核队列':'运行记录','按流程、资料版本和最新处置分清任务。最多展示匹配的最近 100 条，编号搜索覆盖全部历史。','<button class="btn" id="reload-runs">刷新队列 ↻</button>')+`<div class="queue-toolbar"><div class="subnav">${filters.map(([key,label])=>`<button data-run-filter="${key}" class="${filter===key?'active':''}">${label}</button>`).join('')}</div><form id="run-search" class="search-form"><input id="task-search" aria-label="按任务编号搜索" placeholder="输入完整或部分任务编号" maxlength="64" value="${esc(state.runQuery||'')}"><button class="btn" type="submit">搜索</button></form></div><div class="queue-caption">本次显示 ${visible.length} 条 · 待复核 ${runs.filter(r=>!r.review_count).length} 条 · 有条款缺口 ${runs.filter(r=>r.gap_count).length} 条</div><section class="panel queue-panel">${visible.map(r=>`<article class="queue-item"><div class="queue-main"><div class="row"><span class="flow-badge">${esc(r.flow_name||'旧任务未记录流程')}</span><code>${esc(r.id)}</code><small>${timeFmt(r.created)}</small></div><h3>${esc(r.question_card.question)}</h3><div class="chips">${(r.documents||[]).map(d=>`<span class="tag">${esc(d.title)} · v${esc(d.version)}</span>`).join('')}</div><p class="subtle">${r.gap_count?`有 ${r.gap_count} 项条款缺口`:'未标出条款缺口'}${r.gap_basis==='current_recheck'?'（旧任务按当前规则补充对照）':''} · ${r.mode==='local'?'本地规则':'模型辅助'} · ${r.ms} ms</p></div><div class="queue-disposition"><small>最新处置</small>${runTag(r)}<p>${esc(r.latest_note||'尚无复核意见')}</p><small>${r.latest_reviewed?timeFmt(r.latest_reviewed):'等待逐项核对'}</small><button class="btn" data-run="${esc(r.id)}">${state.role==='reviewer'?'进入复核':'查看任务'} →</button></div></article>`).join('')||'<div class="empty"><h2>没有匹配的任务</h2><p>清空编号搜索，或先在智能服务中创建一次分析。</p></div>'}</section>`;

}

function agentsPage(){const products=[...new Map(state.data.documents.map(d=>[d.product,d.title])).entries()];return header('让助手各司其职','配置职责、工具权限与资料范围；流程负责安排顺序。')+`<div class="notice green">当前为确定性工具流程。职责配置会记录到任务快照，并在选择模型辅助时传入解释要求；本地规则不会因为提示词而改变。</div><div class="grid3">${state.data.agents.map((a,i)=>`<form class="panel agent-card" data-agent-form="${a.id}"><div class="row between"><div class="agent-icon">${['▤','⬡','↗'][i]}</div><span class="tag">配置 v${a.version}</span></div><h3>${esc(a.name)}</h3><label class="field" for="duty-${a.id}">职责说明</label><textarea id="duty-${a.id}" name="duty" maxlength="800" required>${esc(a.duty)}</textarea><label class="field">可调用工具</label>${state.data.tools[a.id].map(t=>`<label class="inline-check"><input type="checkbox" name="tools" value="${t}" ${a.tools.includes(t)?'checked':''}><span>${toolNames[t]}</span></label>`).join('')}<label class="field">可访问产品资料</label>${products.map(([id,title])=>`<label class="inline-check"><input type="checkbox" name="products" value="${esc(id)}" ${a.products.includes(id)?'checked':''}><span>${esc(title)}</span></label>`).join('')}<div class="divider"></div><label class="inline-check"><input type="checkbox" name="enabled" ${a.enabled?'checked':''}><span>启用此助手</span></label><button class="btn wide" ${state.role!=='builder'?'disabled':''}>保存配置</button></form>`).join('')}</div><h2>两条共享流程</h2><div class="grid2">${state.data.flows.map(f=>`<section class="panel"><div class="panel-head"><h3>${esc(f.name)}</h3><span class="tag">流程 v${f.version}</span></div><div class="step-strip">${f.steps.map((s,i)=>`${i?'<b>→</b>':''}<span>${esc(state.data.agents.find(a=>a.id===s).name)}</span>`).join('')}</div><label class="inline-check"><input type="checkbox" data-flow-toggle="${f.id}" ${f.id==='coverage'?(f.steps.includes('service')?'checked':''):(f.steps.includes('analysis')?'checked':'')} ${state.role!=='builder'?'disabled':''}><span>${f.id==='coverage'?'在保障分析后附加申请准备提示':'理赔准备时同时进行保障分析'}</span></label><p class="subtle">切换会保存新配置版本，下次任务按新流程运行；历史记录保留原配置。</p></section>`).join('')}</div>`;}

function evaluationPage(){const e=state.evaluation;return header('先检验边界，再讨论效果','这里执行真实的技术冒烟测试，不冒充保险专业准确率评测。',`<button class="btn primary" id="evaluate" ${state.role==='viewer'?'disabled':''}>运行6项检查 →</button>`)+`<div class="grid2"><section class="panel"><h2>本轮检查结果</h2>${e?`<div class="metric">${e.passed} / ${e.total}</div><p class="subtle">${timeFmt(e.created)} · ${esc(e.scope)}</p>${e.tests.map(t=>`<div class="list-item"><h3>${esc(t.name)}</h3><span class="tag ${t.passed?'green':'red'}">${t.passed?'通过':'未通过'}</span></div>`).join('')}`:'<p class="muted">尚未运行测试。点击右上方按钮，检查当前资料和助手配置。</p>'}</section><section class="panel"><h2>后续需要专业验证</h2><ul class="bullet-list"><li>资料是否完整，关键责任和限制是否被正确理解。</li><li>人工核对的规则是否覆盖真实情景，是否遗漏例外。</li><li>用户能否区分可申请投保、责任条件和最终赔付。</li><li>与分别搭建两个应用相比，共享组件能减少多少维护工作。</li><li>新增产品后能复用哪些工具，哪些规则必须重新核对。</li></ul><div class="notice">当前示例和自动检查只证明技术路径可运行。请保留失败案例，后续由保险成员建立独立测试集。</div></section></div>`;}

function render(){document.getElementById('app').innerHTML=shell();bind();document.getElementById('app').dataset.interactive='ready';}

function modal(title,body){$('#dialog-body').innerHTML=`<div class="modal-head"><h2>${title}</h2><button id="close-dialog" aria-label="关闭">×</button></div><div class="modal-body">${body}</div>`;$('#close-dialog').onclick=()=>$('#dialog').close();if(!$('#dialog').open)$('#dialog').showModal();}

function download(name,content,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

async function guard(fn){try{await fn();}catch(e){toast(e.message);}}

async function navigate(p){if(p==='talk'&&!state.chatAgent)p=allowedPages().includes('overview')?'overview':allowedPages().includes('lobby')?'lobby':allowedPages().find(key=>key!=='talk');if(p!=='gate'&&!allowedPages().includes(p))p=allowedPages()[0];state.page=p;if(p==='channel'&&['sales','customer'].includes(state.role))state.consultOptions=await api('/consultation/options');if(p==='library'&&state.role==='platform')state.consultKnowledge=await api('/consultation/knowledge');if(p==='runs'){state.focusRun=null;state.runs=await api('/runs?q='+encodeURIComponent(state.runQuery||''));}if(p==='knowledge'){await refresh();state.life=await api('/life');state.clauseResearch=null;if(!state.knowledgeView)state.knowledgeView='structure';}if(['overview','process','verification'].includes(p))state.life=await api('/life');if(p==='governance')state.governance=await api('/governance');if(['channel','job','inbox','platform','library','knowledge','overview','sample'].includes(p))state.company=await api('/company');if(p==='channel'&&state.role==='sales'){state.illustrations=await api('/illustrations');if(!state.simulation)state.simulation=await api('/simulation');}if(p==='inbox')state.handoffs=await api('/handoffs');if(['platform','overview','sample','process','verification'].includes(p)){state.calls=await api('/channel/calls?channel='+encodeURIComponent(['process','verification'].includes(p)?'':state.callChannel||'')+'&q='+encodeURIComponent(['process','verification'].includes(p)?'':state.callQuery||''));state.callsLoadedAt=new Date().toISOString();}render();window.scrollTo(0,0);}

function bind(){

$$('[data-route]').forEach(b=>b.onclick=()=>{state.processRoute=b.dataset.route;render();});

$$('[data-validation-group]').forEach(b=>b.onclick=()=>{state.validationGroup=b.dataset.validationGroup;render();});

if($('#export-evidence'))$('#export-evidence').onclick=()=>exportEvidence();

if($('#export-plan'))$('#export-plan').onclick=()=>exportPlan();



if($('#library-filter'))$('#library-filter').oninput=e=>$$('#library-filter ~ .list-item').forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(e.target.value.toLowerCase()));

$$('[data-jump-answer]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#answer-heading')?.focus();});

$$('[data-source-target]').forEach(link=>link.onclick=e=>{e.preventDefault();const target=document.getElementById(link.dataset.sourceTarget);if(target){target.open=true;target.scrollIntoView({block:'nearest',behavior:'instant'});target.querySelector('summary').focus({preventScroll:true});}});



$$('[data-data-link]').forEach(b=>b.onclick=()=>{if(b.dataset.page==='knowledge')state.knowledgeView=b.dataset.dataLink==='0'?'clauses':'docs';});

$$('[data-page]').forEach(b=>b.addEventListener('click',()=>guard(()=>navigate(b.dataset.page))));

$$('[data-ops-review]').forEach(b=>b.onclick=()=>guard(()=>{state.sampleMode=b.dataset.opsReview;state.sampleQuery='';state.sampleFilter='';state.samplePick='';return navigate('sample');}));

$$('[data-ops-call]').forEach(b=>b.onclick=()=>guard(()=>{state.sampleMode='all';state.sampleQuery='';state.sampleFilter='';state.samplePick=b.dataset.opsCall;return navigate('sample');}));

if($('#role'))$('#role').onchange=e=>guard(async()=>{await session(e.target.value);const desks={sales:'sales',customer:'wechat',outreach:'phone',seat:'phone',quality:'phone',platform:'platform',service:'platform',underwrite:'platform',claim:'platform',training:'platform'};state.desk=desks[e.target.value]||'legacy';state.runs=[];state.focusRun=null;state.result=null;state.form=null;state.evaluation=null;state.clauseResearch=null;state.runQuery='';state.runFilter='all';state.chatAgent=null;state.conversation=null;state.messages=[];state.draft='';state.governance=null;state.company=null;state.channelResult=null;state.channelPending=false;state.channelDraft=null;state.phoneDraft=null;state.channelError='';state.handoffs=null;state.calls=null;state.jobMessages=[];state.jobConversation='';state.lastCall='';state.plazaFilter='explore';state.plazaQuery='';state.plazaPick='';if($('#dialog')&&$('#dialog').open)$('#dialog').close();await refresh();await navigate(allowedPages()[0]);toast('已切换本地演示职责');});

$$('[data-desk]').forEach(b=>b.addEventListener('click',()=>guard(async()=>{if(b.getAttribute('aria-current')==='page')return;await enterDesk(b.dataset.desk);history.replaceState(null,'','/classic/index.html?desk='+b.dataset.desk);})));

$$('[data-gate]').forEach(b=>b.addEventListener('click',()=>{location.href='/';}));

$$('[data-seat-role]').forEach(b=>b.addEventListener('click',()=>guard(async()=>{await session(b.dataset.seatRole);state.desk='phone';state.channelResult=null;state.channelPending=false;state.phoneDraft=null;state.channelError='';state.lastCall='';await refresh();await navigate('channel');})));

if(state.page==='service'){

if(state.form){for(const key of ['question','flow','event','related','insured'])$('#'+key).value=state.form[key];$$('input[name=documents]').forEach(x=>x.checked=state.form.documents.includes(x.value));}

$('#fill-example').addEventListener('click',()=>{$('#question').value='我是外卖骑手，有高血压。假设因病住院后暂时不能接单，我的生活支出有哪些保障？骑安心草案可以补充什么？';$('#event').value='hospital';$('#related').value='yes';$('#insured').value='unknown';});

$('#use-model').onchange=e=>$('#external-label').classList.toggle('hidden',!e.target.checked);

$('#service-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const button=$('#run-button'), taskToken=state.token;button.disabled=true;button.textContent='正在检索与核对…';try{state.form={question:$('#question').value,flow:$('#flow').value,event:$('#event').value,related:$('#related').value,insured:$('#insured').value,documents:$$('input[name=documents]:checked').map(x=>x.value)};const completed=await api('/run',{...state.form,use_model:$('#use-model').checked,allow_external:$('#allow-external').checked});if(taskToken!==state.token||state.page!=='service')return;state.result=completed;state.scenario='living';$('#result-area').innerHTML=resultHtml();bindResult();$('#result-area').scrollIntoView({behavior:'instant',block:'start'});toast('任务已完成，依据和运行记录已保存');}finally{button.disabled=false;button.textContent='开始分析 →';}});};bindResult();}

if(state.page==='product')bindDesign();

if(state.page==='product')$('#cost-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const r=await api('/cost',Object.fromEntries(['probability','days','daily','expense'].map(k=>[k,$('#'+k).value])));$('#cost-result').innerHTML=`<div class="divider"></div><div class="two"><div><span class="subtle">人均年度预期给付</span><div class="metric">¥${r.expected.toFixed(2)}</div></div><div><span class="subtle">计入假设费用后</span><div class="metric">¥${r.with_expense.toFixed(2)}</div></div></div><p class="subtle">${esc(r.note)}</p>`;});};

if(state.page==='knowledge'){if($('#flow-expand'))$('#flow-expand').onclick=()=>{const compact=$('.knowledge-flow').classList.toggle('compact');$('#flow-expand').setAttribute('aria-expanded',String(!compact));$('#flow-expand').textContent=compact?'展开流程':'收拢层板';};if($('#flow-pause'))$('#flow-pause').onclick=()=>{const el=$('.knowledge-flow');el.classList.toggle('paused');$('#flow-pause').textContent=el.classList.contains('paused')?'播放动画':'暂停动画';};if($('#research-version'))$('#research-version').onchange=e=>guard(async()=>{state.clauseResearch=await api('/design/versions/'+e.target.value);render();});$$('[data-knowledge]').forEach(b=>b.onclick=()=>{state.knowledgeView=b.dataset.knowledge;render();});if($('#new-doc'))$('#new-doc').onclick=()=>newDoc();$$('[data-doc]').forEach(b=>b.onclick=()=>guard(()=>showDoc(b.dataset.doc)));}

if(state.page==='agents'){$$('[data-agent-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();guard(async()=>{const a=state.data.agents.find(a=>a.id===form.dataset.agentForm);await api('/agents/'+a.id,{version:a.version,duty:$('[name=duty]',form).value,tools:$$('[name=tools]:checked',form).map(x=>x.value),products:$$('[name=products]:checked',form).map(x=>x.value),enabled:$('[name=enabled]',form).checked});await refresh();render();toast('助手配置已保存；新任务使用新版本');});});$$('[data-flow-toggle]').forEach(input=>input.onchange=()=>guard(async()=>{const f=state.data.flows.find(f=>f.id===input.dataset.flowToggle);const steps=f.id==='coverage'?['intake','analysis',...(input.checked?['service']:[])]:['intake',...(input.checked?['analysis']:[]),'service'];try{await api('/flows/'+f.id,{version:f.version,steps});await refresh();render();toast('流程版本已更新');}catch(e){input.checked=!input.checked;throw e;}}));}

if(state.page==='runs'){if($('#run-search'))$('#run-search').onsubmit=e=>{e.preventDefault();state.runQuery=$('#task-search').value.trim();guard(()=>navigate('runs'));};if($('#reload-runs'))$('#reload-runs').onclick=()=>guard(()=>navigate('runs'));$$('[data-run-filter]').forEach(b=>b.onclick=()=>{state.runFilter=b.dataset.runFilter;render();});$$('[data-run]').forEach(b=>b.onclick=()=>guard(async()=>{state.focusRun=await api('/runs/'+b.dataset.run);render();window.scrollTo(0,0);}));if($('#back-runs'))$('#back-runs').onclick=()=>guard(async()=>{state.focusRun=null;if(state.role!=='viewer')state.runs=await api('/runs?q='+encodeURIComponent(state.runQuery||''));render();window.scrollTo(0,0);});if($('#export-run'))$('#export-run').onclick=()=>download('保溯-'+state.focusRun.id+'.json',JSON.stringify(state.focusRun,null,2));if($('#review-form'))$('#review-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const checks={};$$('[name=review-check]').forEach(box=>{checks[box.value]=box.checked;});const gap_actions={};$$('[data-gap-id]').forEach(s=>{if(s.value)gap_actions[s.dataset.gapId]=s.value;});$('#save-review').disabled=true;try{state.focusRun=await api('/runs/'+state.focusRun.id+'/review',{note:$('#review-note').value,disposition:$('#review-disposition').value,checks,gap_actions});render();toast('复核处置已保存，原始结论保持不变');}catch(err){$('#review-error').textContent=err.message;throw err;}finally{if($('#save-review'))$('#save-review').disabled=false;}});};}

if(state.page==='evaluation')$('#evaluate').onclick=()=>guard(async()=>{$('#evaluate').disabled=true;try{state.evaluation=await api('/evaluate',{});render();}finally{if($('#evaluate'))$('#evaluate').disabled=state.role==='viewer';}});

if(state.page==='lobby'){$$('[data-scene]').forEach(b=>b.onclick=()=>{const total=state.portal.needs.length;state.scene=(state.scene+Number(b.dataset.scene)+total)%total;render();});$$('[data-need]').forEach(b=>b.onclick=()=>{const need=state.portal.needs.find(n=>n.id===b.dataset.need);state.chatAgent=need.agent;state.conversation=null;state.messages=[];state.draft=need.starter;guard(()=>navigate('talk'));});}

if(state.page==='studio'){$$('[data-bench]').forEach(b=>b.onclick=()=>{const bench=state.portal.benches.find(n=>n.id===b.dataset.bench);state.chatAgent=bench.agent;state.conversation=null;state.messages=[];state.draft=(state.portal.agents.find(a=>a.id===bench.agent)?.starters||[''])[0];guard(()=>navigate('talk'));});if($('#new-agent'))$('#new-agent').onsubmit=e=>{e.preventDefault();guard(async()=>{const products=$$('[name=agent-product]:checked').map(x=>x.value);state.portal=await api('/dialog-agents',{name:$('#agent-name').value,duty:$('#agent-duty').value,audience:$('#agent-audience').value,products});render();toast('新的对话智能体已保存，可以按它的使用对象进入对话');});};}

if(state.page==='talk')bindTalk();

if(['channel','library'].includes(state.page))bindChannel();

if(state.page==='sample')bindSample();

if(state.page==='job')bindJob();

if(state.page==='hub')bindHub();

if(state.page==='plaza')bindPlaza();

if(state.page==='platform')bindPlatform();

}

function bindResult(){$$('[data-scenario]').forEach(b=>b.onclick=()=>{state.scenario=b.dataset.scenario;$('#result-area').innerHTML=resultHtml();bindResult();});$$('[data-evidence]').forEach(b=>b.onclick=()=>{const ev=state.result.evidence.find(e=>e.id===b.dataset.evidence);modal('引用原文',`<p>${kindTag(ev.kind)} <span class="tag">v${ev.version}</span></p>${sourceHtml(ev)}`);$('details',$('#dialog')).open=true;});if($('#export-result'))$('#export-result').onclick=()=>download('保溯服务说明-'+state.result.id+'.md',serviceReport(state.result),'text/markdown;charset=utf-8');}

function newDoc(existing=null){modal(existing?'基于原资料创建新版本':'导入产品资料',`<form id="doc-form"><div class="two"><div><label class="field" for="doc-title">标题</label><input id="doc-title" type="text" required maxlength="100" value="${esc(existing?.title||'')}"></div><div><label class="field" for="doc-product">产品标识 小写英文</label><input id="doc-product" type="text" required pattern="[a-z0-9-]+" maxlength="60" value="${esc(existing?.product||'')}"></div></div><label class="field" for="doc-kind">资料身份</label><select id="doc-kind">${Object.entries(state.data.kinds).map(([k,v])=>`<option value="${k}" ${(existing?.kind||'imported')===k?'selected':''}>${v}</option>`).join('')}</select><label class="field" for="doc-source">出处或原始文件说明</label><input id="doc-source" type="text" required maxlength="500" value="${esc(existing?.source||'')}"><label class="field" for="doc-file">选择文件 可选</label><input id="doc-file" type="file" accept=".txt,.md,.docx,.pdf"><p class="upload-note">最多8MB；支持文字型PDF、Word和UTF-8文本。文件与解析内容保存在本机。选择文件后优先使用文件正文。</p><label class="field" for="doc-content">或粘贴正文 段落之间空一行</label><textarea id="doc-content" rows="8">${esc(existing?.content||'')}</textarea><p class="notice">新资料先进入待审核区；创建新版本不会自动复制旧规则，须重新核对依据。</p><button class="btn primary wide">保存待审核版本</button></form>`);$('#doc-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const button=$('button[type=submit]',e.target)||$('button',e.target);button.disabled=true;try{const file=$('#doc-file').files[0];let encoded;if(file){if(file.size>8*1024*1024)throw Error('文件不能超过8MB');encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('读取文件失败'));reader.readAsDataURL(file);});}const d=await api('/documents',{title:$('#doc-title').value,product:$('#doc-product').value,kind:$('#doc-kind').value,source:$('#doc-source').value,content:$('#doc-content').value,...(file?{filename:file.name,file:encoded}:{})});await refresh();render();await showDoc(d.id);toast('资料已导入，请登记规则后交演示复核');}finally{button.disabled=false;}});};}

async function showDoc(id){const d=await api('/documents/'+id);modal(esc(d.title),`<div class="chips">${kindTag(d.kind)}<span class="tag">v${d.version}</span><span class="tag ${d.status==='published'?'green':'amber'}">${d.status==='published'?'演示已发布':'待审核'}</span></div><p class="subtle">出处：${esc(d.source)}</p>${clauseListHtml(d)}<h3>已登记情景规则</h3>${d.rules.map(r=>`<div class="coverage-card"><div class="row between"><strong>${state.data.scenarios[r.scenario]}</strong><span class="tag">${state.data.outcomes[r.outcome]}</span></div><p>${esc(r.note)}</p><small>依据 ${esc(r.evidence_id)}</small></div>`).join('')||'<p class="subtle">尚未登记规则。</p>'}${d.status==='draft'&&(state.role==='builder'||state.role==='platform')?`<form id="rule-form"><h3>登记一条规则</h3><div class="two"><select id="rule-scenario" aria-label="规则情景">${Object.entries(state.data.scenarios).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select id="rule-outcome" aria-label="规则结论">${Object.entries(state.data.outcomes).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><label class="field" for="rule-evidence">对应的原文段落</label><select id="rule-evidence">${d.chunks.map(c=>`<option value="${c.id}">段落${c.position} ${esc(c.content.slice(0,55))}</option>`).join('')}</select><label class="field" for="rule-note">通俗说明</label><textarea id="rule-note" required maxlength="500"></textarea><button class="btn wide">保存带依据的规则</button></form>`:''}<div class="divider"></div><h3>可追溯原文</h3>${d.chunks.map(c=>sourceHtml({...c,title:d.title,version:d.version,kind:d.kind,source:d.source})).join('')}${d.status==='draft'&&state.role==='reviewer'?`<form id="publish-form"><label class="field" for="publish-note">演示复核说明</label><textarea id="publish-note" required maxlength="1000" placeholder="说明检查了哪些规则与原文，以及仍未完成的专业核验。"></textarea><button class="btn primary wide">发布到本机演示流程</button></form>`:''}${d.status==='published'&&(state.role==='builder'||state.role==='platform')?'<button class="btn wide" id="copy-doc">基于此资料创建新版本</button>':''}${d.review?`<div class="notice green">演示复核说明：${esc(d.review)}</div>`:''}`);

if($('#rule-form'))$('#rule-form').onsubmit=e=>{e.preventDefault();guard(async()=>{await api(`/documents/${id}/rules`,{scenario:$('#rule-scenario').value,outcome:$('#rule-outcome').value,evidence_id:$('#rule-evidence').value,note:$('#rule-note').value});await showDoc(id);toast('规则已保存');});};if($('#publish-form'))$('#publish-form').onsubmit=e=>{e.preventDefault();guard(async()=>{await api(`/documents/${id}/publish`,{note:$('#publish-note').value});await refresh();render();await showDoc(id);toast('演示版本已发布，原文和规则已固定');});};if($('#copy-doc'))$('#copy-doc').onclick=()=>newDoc(d);}

function allowedPages(){const duty={sales:['channel','library'],service:['inbox','job','library'],outreach:['channel','library'],seat:['channel','library'],quality:['channel','library'],underwrite:['job','library'],claim:['job','library'],training:['job','library'],platform:['overview','knowledge','library','process','platform','hub','plaza','sample','verification','talk'],customer:['channel','library']};if(duty[state.role])return duty[state.role];return state.role==='viewer'?['lobby','talk','service']:state.role==='reviewer'?['runs','lobby','talk','governance','knowledge','service','evaluation']:['home','lobby','talk','studio','governance','product','knowledge','agents','runs','service','evaluation'];}

function roleLabel(){return roleNames[state.role]||state.role;}

function pageName(key){if(key==='channel')return {sales:'展业入口',customer:'客户自助',outreach:'电话中心',seat:'电话中心',quality:'电话中心'}[state.role]||'渠道入口';return names[key]||key;}

function workspaceSwitch(){const legacy=['viewer','builder','reviewer'].includes(state.role);return `<div class="workspace-switch"><span class="workspace-avatar">${legacy?'骑':'示'}</span><div><b>${legacy?'骑安心研究项目':'示意保险（虚构）'}</b><small>${legacy?'早期演示':'虚构公司'} · v${esc(state.data.version||'')}</small></div></div>`;}

function roleOptions(){const opt=(id,label)=>`<option value="${id}" ${state.role===id?'selected':''}>${label}</option>`;const duties=['sales','service','outreach','seat','quality','underwrite','claim','training','platform'];return `<select id="role" class="role"><optgroup label="岗位职责">${duties.map(id=>opt(id,roleNames[id])).join('')}</optgroup><optgroup label="客户">${opt('customer','客户自助')}</optgroup>${state.desk==='legacy'?`<optgroup label="早期演示">${opt('viewer','服务使用者')}${opt('builder','中台维护者')}${opt('reviewer','演示复核者')}</optgroup>`:''}</select>`;}

function homePage(){

  const d=state.data, board=d.clause_board, count=(board?.slots||[]).filter(s=>s.status!=='stated').length;

  return header('从产品研究，到有依据的服务','维护共同使用的资料、规则和流程，让每次服务都能回到当时的依据。','<button class="btn primary" data-page="service">预览一次服务 ↗</button>')+`<section class="console-hero"><div><span class="eyebrow">RESEARCH WORKSPACE</span><h2>骑安心 · 慢病骑手住院津贴</h2><p>产品仍是研究草案。把拟议责任、教学参数和条款缺口放在一起核对，<br>再将固定版本交给服务流程使用。</p><div class="row"><button class="btn primary" data-page="product">继续产品研究 →</button><button class="btn" data-page="knowledge">查看条款证据</button></div></div><div class="hero-stack"><div>01 研究方案 <b>v${d.design.current.version}</b></div><div>02 条款与规则 <b>${published().length} 份已发布</b></div><div>03 服务与复核 <b>原文可追溯</b></div></div></section><div class="stats"><div class="stat"><div><strong>${d.documents.length}</strong><span>资料版本 / 全部保留</span></div></div><div class="stat"><div><strong>${d.documents.filter(x=>x.status==='draft').length}</strong><span>资料版本 / 待演示审核</span></div></div><div class="stat"><div><strong>${count}</strong><span>骑安心条款 / 待逐项核对</span></div></div><div class="stat"><div><strong>${d.flows.length}</strong><span>确定性流程 / 共享组件</span></div></div></div><div class="section-title"><h2>中台的五层，本轮做到哪里</h2><span>基础设施不做容器和算力调度</span></div><div class="layer-row"><div><b>应用层</b><span>已接入</span><p>用户需求台和工作人员工作台。</p></div><div><b>编排层</b><span>已接入</span><p>按需求交给指定智能体；原有两条流程仍按固定顺序执行。</p></div><div><b>运行层</b><span>已接入</span><p>对话、摘录和调用状态会留下记录。</p></div><div><b>能力底座</b><span>已接入</span><p>对话共用千问，并用关键词检索已发布资料。</p></div><div><b>基础设施</b><span>本轮不做</span><p>只在本机运行，没有集群部署。</p></div></div><div class="section-title"><h2>维护工作的三个入口</h2><span>数据来自当前本机资料库</span></div><div class="grid3">${[['knowledge','01','维护资料与依据','导入真实来源，按段登记情景规则；已发布资料不原地修改。'],['agents','02','配置助手与流程','维护工具和资料范围，保存版本。这里配置的是确定性任务助手。'],['runs','03','查看运行与移交','按任务编号追溯问题、引用与异常；处置由演示复核者追加。']].map(([p,n,t,b])=>`<section class="panel entry-card"><span class="entry-number">${n}</span><h3>${t}</h3><p>${b}</p><button class="btn text" data-page="${p}">进入工作区 →</button></section>`).join('')}</div><section class="panel role-guide"><h2>谁在这里做什么</h2><div class="grid3"><div><b>服务使用者</b><p>先选问题，再和对应智能体对话；也可以打开条款对照。</p></div><div><b>中台维护者</b><p>维护资料和流程，并使用展业、客服、培训、外呼等工作人员工作台。</p></div><div><b>演示复核者</b><p>查看证据，逐项处理缺口并追加意见；不修改研究参数。</p></div></div><small>角色切换用于本机演示，并非生产身份认证。</small></section>`;

}

function comparisonHtml(r, scenario, clickable=false){

  const cards=(r.cards||[]).filter(c=>c.scenario===scenario);

  return `<div class="comparison-grid">${cards.map(c=>{const e=(r.evidence||[]).find(e=>e.id===c.evidence);return `<article class="comparison-card"><div class="row between">${kindTag(c.kind)}<small>资料 v${esc(c.version)}</small></div><h3>${esc(c.product)}</h3><span class="tag ${c.outcome==='limited'?'amber':c.outcome==='related'?'green':''}">${esc(c.status)}</span><p class="answer-note">${esc(c.note)}</p><div class="inline-evidence"><small>${e?`段落 ${esc(c.evidence_position||e.position)} · ${esc(c.evidence_heading||'原文依据')}`:'缺少可定位原文'}</small><blockquote>${esc(c.evidence_excerpt||e?.content||'本次没有对应引用，需要补充资料。')}</blockquote>${e?`<small>引用 ${esc(e.id)}</small>`:''}</div>${e&&clickable?`<button class="evidence-link" data-evidence="${esc(e.id)}">查看完整段落 ↗</button>`:''}</article>`;}).join('')||'<p class="notice">本流程未输出这个情景的规则结果，请核对流程和资料。</p>'}</div>`;

}

function gapEvidence(s){return s.excerpt?`<blockquote class="excerpt">${esc(s.excerpt)}</blockquote><small>资料 v${esc(s.version||'')} · 段落 ${esc(s.position||'旧快照未记录')} · ${esc(s.heading||'')}<br>引用 ${esc(s.chunk_id||s.clause_id||'旧快照未记录')}</small>${s.shared_count>1?`<p class="shared-warning">这段被 ${s.shared_count} 项同时用到 · 证据偏粗<br><small>${esc((s.shared_with||[]).join('、'))}</small></p>`:''}`:'<p class="subtle">未找到对应原文句子；请补充可定位资料。</p>';}

function parameterStrip(research, keys=['daily','waiting','deductible','per_stay','annual']){if(!research)return '<p class="subtle">此快照未记录研究参数。</p>';const labels={daily:'日额',waiting:'等待期',deductible:'免给付天数',per_stay:'单次上限',annual:'年度上限'};return `<div class="parameter-strip">${keys.map(k=>`<div><small>${labels[k]}</small><b>${esc(research.parameters[k])}<em>${k==='daily'?'元/日':'天'}</em></b></div>`).join('')}</div>`;}

function currentAgent(){return (state.portal?.agents||[]).find(a=>a.id===state.chatAgent);}

function lobbyPage(){

  const portal=state.portal;

  if(!portal)return header('需求咨询','正在读取咨询入口。');

  const need=portal.needs[(state.scene||0)%portal.needs.length];

  const side=(step)=>portal.needs[(state.scene+step+portal.needs.length)%portal.needs.length].title;

  return header('应用场景','左右切换想办的事。点立即咨询后，由对应智能体按已发布资料回答。','<span class="tag amber">研究草案 / 外部条款对照</span>')+`<section class="scene-stage"><button type="button" class="scene-arrow" data-scene="-1" aria-label="上一个场景">‹</button><div class="scene-copy"><small>${esc(need.group)}</small><h2>${esc(need.title)}</h2><p>${esc(need.text)}</p><button type="button" class="btn primary" data-need="${esc(need.id)}">立即咨询 →</button></div><button type="button" class="scene-arrow" data-scene="1" aria-label="下一个场景">›</button></section><div class="scene-neighbors"><span>${esc(side(-1))}</span><b>${esc(need.title)}</b><span>${esc(side(1))}</span></div><div class="section-title"><h2>当前可以对照的资料</h2><span>外部条款不是骑安心</span></div><div class="shelf">${portal.products.map(p=>`<article class="shelf-card"><div class="row between">${kindTag(p.kind)}<small>v${esc(p.version)}</small></div><h3>${esc(p.title)}</h3><p>${esc(p.focus)}</p><small>${esc(p.limit)}</small></article>`).join('')}</div><div class="notice">请不要输入真实姓名、病历、保单号或联系方式。紫金等外部条款只用于对照，不能当成骑安心已经承保。</div>`;

}

function talkPage(){

  const agent=currentAgent();

  if(!agent)return header('请先选择一个问题','回到需求咨询后，选择要对话的智能体。','<button class="btn" data-page="lobby">返回需求咨询</button>');

  const thread=state.messages.length?state.messages.map(m=>`<article class="bubble ${m.speaker==='user'?'mine':''}"><small>${m.speaker==='user'?'你':esc(agent.name)}</small><p>${esc(m.content)}</p>${m.reading?`<div class="confirm-card"><b>本次理解</b><span>事件：${esc(m.reading.event)}</span><span>原因：${esc(m.reading.cause)}</span><small>${esc(m.reading.note)}</small></div>`:''}${m.evidence?.length?`<div class="quotes">${m.evidence.map(e=>`<blockquote><b>${esc(e.title)}${e.position?` · 段落${esc(e.position)}`:''}</b>${esc(e.excerpt)}</blockquote>`).join('')}</div>`:''}${m.flags?.length?`<p class="flag">已标记不当承诺：${esc(m.flags.join('、'))}</p>`:''}${m.handoff?`<button type="button" class="btn" data-handoff="${esc(m.handoff.agent)}">${esc(m.handoff.text)}</button>`:''}${m.speaker==='assistant'&&m.model?.status?`<small>${m.model.status==='ok'?'这次由模型生成，请对照摘录':esc(m.model.message||'已改用资料摘录')}</small>`:''}</article>`).join(''):`<div class="starters">${agent.starters.map(s=>`<button type="button" data-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;

  return header(agent.name,agent.duty,`<span class="tag">${esc(agent.group)}</span>`)+`<section class="chat-shell accent-${esc(agent.accent)}"><div class="chat-side"><p>${esc(agent.boundary)}</p><div class="chips">${agent.skills.map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</div><small>${state.data.model_ready?'模型已配置。每次发送调用一次，失败时仍显示资料摘录。':'模型未配置，回答只使用资料摘录。'}</small></div><div class="chat-main"><div class="thread" id="thread">${thread}</div><form id="chat-form"><textarea id="chat-input" required maxlength="1500" placeholder="用一句话描述想问的事">${esc(state.draft||'')}</textarea><button class="btn primary" id="chat-send">发送</button></form></div></section>`;

}

function studioPage(){

  const portal=state.portal;

  if(!portal)return header('职能工作台','正在读取工作台。');

  const rows=portal.agents.map(a=>`<tr><td>${esc(a.name)}</td><td><span class="tag green">已启用</span></td><td>${esc(a.origin||'平台预置')}</td><td>对话型</td><td>${a.audience==='staff'?'工作人员':'用户'}</td></tr>`).join('');

  const form=state.role==='builder'?`<form id="new-agent" class="panel"><h2>新建对话智能体</h2><p class="subtle">新建后和现有智能体共用同一个模型与资料检索。它不会自己核保或赔付。</p><div class="two"><div><label class="field" for="agent-name">名称</label><input id="agent-name" required maxlength="40" placeholder="例如：骑手顾问"></div><div><label class="field" for="agent-audience">谁可以使用</label><select id="agent-audience"><option value="user">用户咨询</option><option value="staff">仅工作人员</option></select></div></div><label class="field" for="agent-duty">职责</label><textarea id="agent-duty" required maxlength="400" placeholder="说明它回答哪一类问题，以及必须引用已发布资料。"></textarea><label class="field">可检索的资料</label>${portal.products.map(p=>`<label class="inline-check"><input type="checkbox" name="agent-product" value="${esc(p.product)}" checked><span>${esc(p.title)}</span></label>`).join('')}<button class="btn primary">保存智能体</button></form>`:'';

  return header('工作人员按职能进入不同智能体','名字和工作台不同，对话都走已配置的同一个模型，并带上各自的职责和资料范围。')+`<div class="bench-grid">${portal.benches.map(b=>`<button type="button" class="bench-card" data-bench="${esc(b.id)}"><small>${esc(b.group)}</small><strong>${esc(b.title)}</strong><span>${esc(b.text)}</span></button>`).join('')}</div><section class="panel"><h2>智能体名录</h2><table class="agent-table"><thead><tr><th>名称</th><th>状态</th><th>来源</th><th>类型</th><th>面向</th></tr></thead><tbody>${rows}</tbody></table></section>${form}<div class="section-title"><h2>可复用技能</h2><span>不是各自重做一套系统</span></div><div class="skill-grid">${portal.skills.map(s=>`<article class="panel"><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p></article>`).join('')}</div><div class="notice">培训和外呼只生成演示草稿，不拨打电话。核保辅助只列缺项，不下承保结论。智慧审计和智慧财务不在本轮。</div>`;

}

function governancePage(){

  const g=state.governance;

  if(!g)return header('调用治理','正在读取调用记录。');

  return header('每次对话留下调用记录','记录智能体、结果和耗时。这里没有密钥，也不能当成保险准确率。')+`<div class="stats"><div class="stat"><div><strong>${g.summary.conversations}</strong><span>对话</span></div></div><div class="stat"><div><strong>${g.summary.calls}</strong><span>调用</span></div></div><div class="stat"><div><strong>${g.summary.model_ok}</strong><span>模型成功返回</span></div></div><div class="stat"><div><strong>${g.summary.fallback}</strong><span>改用资料摘录</span></div></div></div><section class="panel"><h2>最近调用</h2>${g.calls.length?g.calls.map(c=>`<div class="list-item"><h3>${esc(c.agent_name)}</h3><span class="tag ${c.status==='ok'?'green':'amber'}">${esc(c.status)}</span><small>${esc(c.conversation_id)} · ${esc(c.ms)} ms · ${timeFmt(c.created)}</small></div>`).join(''):'<p class="subtle">还没有对话调用。</p>'}</section><p class="subtle">${esc(g.scope)}</p>`;

}

function citeOf(excerpt){const text=String(excerpt||'');const cite=(text.match(/出处：([^。\n]+)/)||[])[1]||'';const label=(text.match(/^([^：\n]{1,16})：/)||[])[1]||'';return {cite,label};}

function skillStrip(agent){

  if(!agent||!agent.name)return '';

  const skills=(agent.skills||[]).slice(0,4);

  return `<aside class="skill-strip"><b>${esc(agent.name)}</b><p>${esc(agent.boundary||agent.duty||'只按已授权资料回答。')}</p>${skills.length?`<p>${skills.map(esc).join(' · ')}</p>`:''}</aside>`;

}

function callPresentation(item){

  const facts=item.trace?.matched_fact||[];

  if(item.rule_category||(Array.isArray(item.rules)&&item.rules.length))return {label:'规则拦截',tone:'risk',note:'保留提示与证据，需人工复核'};

  if(item.adopted===true||item.adopted===1)return {label:'模型辅助回答',tone:'ready',note:'已采用模型句子，请核对条款'};

  if(facts.length)return {label:'结构化字段回答',tone:'ready',note:'依据字段生成 · 未采用模型正文'};

  if(item.status==='error')return {label:'模型调用失败',tone:'risk',note:'保留已有摘录，等待人工核对'};

  return {label:'待核对回答',tone:'muted',note:'未采用模型正文，请核实证据是否充分'};

}

function modelCallStrip(item){

  const call=item.trace?.model_call;

  if(!call)return `<div class="model-call-strip is-muted"><span class="model-orb"></span><div><b>模型调用状态</b><small>旧记录未保存调用次数；以当时回答与证据为准。</small></div></div>`;

  if(!call.count)return `<div class="model-call-strip is-muted"><span class="model-orb"></span><div><b>本次未调用千问</b><small>规则或结构化字段已完成处理 · ${esc(call.ms||0)} ms</small></div></div>`;

  return `<div class="model-call-strip ${call.status==='ok'||call.status==='rejected'?'is-ready':'is-risk'}"><span class="model-orb"></span><div><b>${esc(call.model||'千问')} · 调用 ${esc(call.count)} 次</b><small>${esc(call.ms||0)} ms · ${call.status==='ok'||call.status==='rejected'?'接口返回成功':'接口返回异常'} · ${call.adopted?'采用模型解释':item.trace?.consultation?.mode==='general'?'未生成可用解释，请重试':call.status==='rejected'&&item.trace?.consultation?.mode==='professional'?'模型解释未通过核对，只用字段回答':'规则/字段优先，未采用模型正文'}</small></div></div>`;

}

function runTrail(item){

  const count=(item.excerpts||[]).length, check=item.trace?.number_check, status=callPresentation(item);

  const steps=[['接收问题',item.channel_name||'业务入口'],['检索证据',count?`${count} 条留存摘录`:'未找到可用摘录'],['核对数字',check?.checked?(check.ok?'数字检查通过':'数字检查未通过'):'本次未执行'],['输出回答',status.label]];

  return `<ol class="run-trail" aria-label="本次处理路径">${steps.map(([label,text],i)=>`<li><span class="trail-index">${i+1}</span><div><b>${label}</b><span>${esc(text)}</span></div></li>`).join('')}</ol>`;

}

function evidenceSheet(item){

  if(item?.trace?.consultation&&!(item.trace.matched_fact||[]).length)return consultationResult(item);

  if(state.channelPending&&!item)return `<section class="clause-sheet sheet-empty" aria-live="polite" aria-busy="true"><div class="thinking-dots" aria-label="智能体正在处理"><i></i><i></i><i></i></div><h2>保溯正在核对</h2><p>${state.consultMode==='general'?'正在请求千问，请稍候…':'正在核对授权范围与资料…'}</p><p class="subtle">${esc(state.askText||'')}</p></section>`;

  if(!item&&!state.channelError&&typeof window!=='undefined'&&window.baosuPreview)return `<section class="clause-sheet sheet-empty">${window.baosuPreview(state.desk)}</section>`;

  if(!item){const canFill=state.desk==='sales'||state.desk==='wechat';const invite=(!state.channelError&&canFill)?`<button type="button" class="prompt-chip empty-invite" data-fill="这款什么时候能减保、最多减多少？">试一个：减保时点与限额</button>`:'';return `<section class="clause-sheet sheet-empty" aria-live="polite">${state.channelError?`<span class="empty-emblem">${uiIcon('knowledge')}</span>`:journeyLoop()}<h2>${state.channelError?'核对未完成':'回答与证据'}</h2><p>${state.channelError?esc(state.channelError):'提交产品问题后，这里显示回答、事实字段和条款出处。'}</p><small>${state.channelError?'问题与客户选择已保留，可重新提交。':'示例：这款什么时候能减保、最多减多少？'}</small>${invite}</section>`;}

  const status=callPresentation(item), excerpts=Array.isArray(item.excerpts)?item.excerpts:[], facts=item.trace?.matched_fact||[];

  const question=item.text||item.question||state.askText||'本次回答', id=item.call_id||item.id||'';

  const anchor=i=>`source-${String(id).replace(/[^a-zA-Z0-9_-]/g,'')}-${i}`;

  const factHtml=facts.length?`<section class="fact-section" aria-label="事实字段与适用条件"><h3>事实字段 <span>证据对照</span></h3>${facts.map(f=>{const index=excerpts.findIndex(e=>(e.id||'')===`field-${f.product_id}-${f.label}`);return `<div class="fact-row"><div class="row between"><b>${esc(f.label)}</b>${index>=0?`<a class="citation-link" href="#${anchor(index)}" data-source-target="${anchor(index)}">条款 ${esc(f.cite||'位置未提供')} ↗</a>`:`<span class="subtle">条款 ${esc(f.cite||'位置未提供')}</span>`}</div><p>${esc(f.text)}</p>${f.exception?`<p class="fact-exception"><b>适用例外</b> ${esc(f.exception)}</p>`:''}</div>`;}).join('')}</section>`:'';

  const evidence=excerpts.map((e,i)=>{const bit=citeOf(e.excerpt),field=String(e.id||'').startsWith('field-'),demo=e.kind==='mock'||/虚构保单|虚构句子/.test(e.excerpt||'');return `<details class="evidence-note" id="${anchor(i)}" ${!['wechat','phone'].includes(state.desk)&&(field||i===0)?'open':''}><summary><span class="source-number">${String(i+1).padStart(2,'0')}</span><span><b>${esc(e.title||'未命名资料')}</b><small>${demo?'演示背景 · 不作条款依据':field?'结构化字段摘录':'留存资料摘录'}${e.position?` · 段落 ${esc(e.position)}`:''}${bit.cite?` · 条款 ${esc(bit.cite)}`:''}</small></span></summary><div class="evidence-content">${bit.label?`<span class="evidence-field">${esc(bit.label)}</span>`:''}<p class="evidence-body">${esc(e.excerpt||'未提供摘录正文')}</p><p class="evidence-source">${esc(e.source||'未登记来源')}<br>资料版本：${e.version?`v${esc(e.version)}`:'本条摘录未登记'}</p></div></details>`;}).join('');

  return `<article class="clause-sheet" aria-label="回答与条款核对"><header class="sheet-head"><div class="sheet-status-row"><span class="result-badge ${status.tone}">${status.label}</span><span class="subtle">${item.fictional?'虚构样例':'本机调用'}${item.created?' · '+esc(timeFmt(item.created)):''}</span></div><h2 tabindex="-1" id="answer-heading">${esc(question)}</h2><p class="sheet-status-note">${status.note}</p></header>${modelCallStrip(item)}${state.desk==='wechat'?`<details class="customer-process"><summary>本次处理路径</summary>${runTrail(item)}</details>`:runTrail(item)}<div class="sheet-split"><section class="sheet-answer" aria-label="回答"><div class="assistant-label"><span>溯</span><b>保溯智能助手</b></div><h3>回答 <span>含适用条件与例外</span></h3><p class="answer-copy">${esc(item.answer||'没有可展示的回答。')}</p>${state.desk==='wechat'&&factHtml?`<details class="customer-facts"><summary>查看事实字段与适用条件</summary>${factHtml}</details>`:factHtml}<p class="answer-boundary">公开条款样例仅供核对，不作为承保或赔付结论。</p></section><section class="sheet-evidence" aria-label="条款出处"><div class="row between"><h3>条款出处</h3><span class="subtle">${excerpts.length} 条</span></div><p class="source-help">以下为调用时留存的摘录；完整合同以来源文件为准。</p>${evidence||'<div class="evidence-missing"><b>暂无可定位证据</b><p>请补充产品名称或资料；没有出处的内容不能作为条款事实。</p></div>'}</section></div><footer class="sheet-meta"><span>调用编号 <code>${esc(id||'未提供')}</code></span><span>渠道 ${esc(item.channel_name||item.channel||'未登记')}</span><span>记录版本 ${esc(item.trace?.version_label||'未登记')}</span>${item.handoff?'<span>已转人工</span>':''}</footer>${item.trace?`<details class="trace-details"><summary>处理记录与模型原文</summary><p>采用模型正文：${item.adopted?'是':'否'}。数字检查：${esc(item.trace.number_check?.detail||'未执行')}。</p><p>以下是调用时留存的模型文本，不作为最终回答。</p><pre>${esc(item.trace.model_output||'没有留存模型输出。')}</pre></details>`:''}${state.role==='customer'&&state.lastCall?'<div class="sheet-actions"><button type="button" class="btn" id="channel-handoff">转人工</button><p>提交后由客户服务岗处理。</p></div>':''}</article>`;

}



function journeyLoop(){const steps=['接收问题','识别产品','查条款字段','核对数字','留痕回平台'];return `<div class="journey" aria-hidden="true"><div class="journey-track"><i class="journey-light"></i></div><ol>${steps.map((s,i)=>`<li class="j${i}"><span>${String(i+1).padStart(2,'0')}</span><b>${s}</b></li>`).join('')}</ol></div>`;}

function platformFlow(){const flows=['M64 36 C110 36 120 90 154 90','M64 90 L154 90','M64 144 C110 144 120 90 154 90','M206 90 C240 90 250 54 290 54','M206 90 C240 90 250 126 290 126'];const node=(x,y,label)=>`<rect class="pf-node" x="${x}" y="${y}" width="56" height="28" rx="14"/><text x="${x+28}" y="${y+18}" text-anchor="middle">${label}</text>`;return `<svg class="platform-flow" viewBox="0 0 360 184" role="img" aria-label="示意：展业、自助、电话三个业务端的调用汇入保溯平台，形成证据与留痕"><g>${flows.map(d=>`<path d="${d}"/>`).join('')}</g>${node(8,22,'展业')}${node(8,76,'自助')}${node(8,130,'电话')}${node(292,40,'证据')}${node(292,112,'留痕')}<circle class="pf-ring" cx="180" cy="90" r="26"/><circle class="pf-hub" cx="180" cy="90" r="26"/><text class="pf-hub-text" x="180" y="94" text-anchor="middle">保溯</text>${flows.map((d,i)=>`<circle class="pf-dot" r="3"><animateMotion dur="2.4s" begin="-${i<3?i*.8:1.2+(i-3)*.6}s" repeatCount="indefinite" path="${d}"/></circle>`).join('')}<text class="pf-note" x="180" y="180" text-anchor="middle">流程示意 · 非实时数据</text></svg>`;}

function channelResultHtml(){return evidenceSheet(state.channelPending?null:state.channelResult);}

function consultationControls(){

  const o=state.consultOptions||{},general=state.consultMode==='general';

  const selects=[['topic','关心的问题',o.topics],['age','年龄',o.ages],['gender','性别',o.genders],['health','健康情况',o.health],['pay','缴费偏好',o.pay]];

  return `<section class="consult-controls"><div class="consult-tabs" aria-label="咨询方式">${[['general','普通咨询'],['professional','专业咨询']].map(([v,t])=>`<button type="button" data-consult-mode="${v}" aria-pressed="${state.consultMode===v}">${t}</button>`).join('')}</div>${general?'':`<label class="field" for="consult-topic">这次想做什么</label><select id="consult-topic"><option value="clause" ${state.consultTopic==='clause'?'selected':''}>核对具体条款</option><option value="needs" ${state.consultTopic==='needs'?'selected':''}>梳理保障需求</option></select>${state.consultTopic==='needs'?`<div class="consult-profile">${selects.map(([k,t,values])=>`<div><label class="field" for="profile-${k}">${t}</label><select id="profile-${k}">${(values||[]).map(v=>`<option value="${esc(v)}" ${state.consultProfile[k]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div><button type="button" class="btn" id="compose-profile">用这些选项生成问题</button><small>自编情景用于梳理需求，不判断能否购买保险。</small>`:''}`}</section>`;

}

function consultationResult(item){

  const c=item.trace.consultation,question=item.text||state.askText||'本次问题';

  return `<article class="clause-sheet consult-result" aria-label="咨询回答"><header class="sheet-head"><span class="result-badge">${esc(c.label||'专业咨询')}</span><h2 tabindex="-1" id="answer-heading">${esc(question)}</h2></header>${modelCallStrip(item)}<div class="consult-question">${esc(question)}</div><div class="assistant-label"><span>溯</span><b>保溯智能助手</b></div><p class="answer-copy">${esc(item.answer)}</p>${c.checks?`<ol class="consult-checks">${c.checks.map((t,i)=>`<li><span>${i+1}</span><b>${esc(t)}</b><small>待核对</small></li>`).join('')}</ol>`:''}<p class="source-help">${esc(c.source||'未匹配到授权资料')}</p>${(item.excerpts||[]).map(e=>`<details class="evidence-note"><summary>${esc(e.title)} · ${esc(e.position||e.id)}</summary><div class="evidence-content"><p>${esc(e.excerpt)}</p><small>${esc(e.source)} · ${esc(e.version||'')}</small></div></details>`).join('')}<footer class="sheet-meta"><span>调用编号 <code>${esc(item.call_id||item.id)}</code></span><span>${esc(item.status)}</span></footer>${state.role==='customer'&&state.lastCall?'<button type="button" class="btn" id="channel-handoff">转人工</button>':''}</article>`;

}

function consultationLibrary(){const k=state.consultKnowledge;if(!k)return '';return `<section class="panel consult-library"><h2>需求情景库</h2><p>${esc(k.notice)}</p><div class="stats"><div class="stat"><strong>${k.count}</strong><span>合成情景</span></div><div class="stat"><strong>${k.templates}</strong><span>自编基础模板</span></div><div class="stat"><strong>${esc(k.version)}</strong><span>资料版本</span></div></div><label class="field" for="scenario-search">查找情景</label><input id="scenario-search" placeholder="输入编号、年龄、疾病或主题"><div id="scenario-list">${scenarioRows(k.items.slice(0,12))}</div><small>默认显示12条，搜索可查全部。展业顾问与条款客服可查询；新建智能体不会自动获得此库。</small></section>`;}

function scenarioRows(rows){return rows.map(r=>`<details class="evidence-note"><summary>${esc(r.id)} · ${esc(r.topic)} · ${esc(r.age)} · ${esc(r.health)}</summary><p>${esc(r.answer)}</p><small>${esc(r.note)} 访问职责：${r.roles.map(x=>esc(roleNames[x]||x)).join('、')}</small></details>`).join('')||'<p>没有匹配情景。</p>';}

function entryForm(){

  const customer=state.role==='customer';

  const people=customer?state.company.customers:(state.company.staff||[]).filter(s=>s.duty===state.role);

  const agents=state.portal?.agents||[];

  const modelReady=!!state.data?.model_ready;

  return `<form id="channel-form" class="panel agent-composer"><header class="agent-composer-head"><span class="agent-avatar">溯</span><div><b>${customer?'条款客服':'保障需求顾问'}</b><small>${customer?'问概念，或核对自己的演示保单':'梳理需求，或核对产品事实'}</small></div><span class="model-chip ${modelReady?'online':'local'}"><i></i>${modelReady?'千问已接入':'规则模式'}</span></header>${consultationControls()}<details class="conversation-context"><summary>${customer?'选择客户与保单':'选择客户与产品'} <span>设置</span></summary><div class="two"><div><label class="field" for="channel-operator">${customer?'客户编号':'操作者编号'}</label><select id="channel-operator">${people.map(p=>`<option value="${esc(p.id)}">${esc(p.id)}</option>`).join('')}</select></div>${customer?'':`<div><label class="field" for="channel-context">客户编号</label><select id="channel-context">${state.company.customers.map(p=>`<option value="${esc(p.id)}">${esc(p.id)}</option>`).join('')}</select></div>`}</div><label class="field" for="channel-policy">演示保单，可以不选</label><select id="channel-policy"><option value="">不附带保单</option>${state.company.policies.map(p=>`<option value="${esc(p.id)}" data-customer="${esc(p.customer_id)}" data-catalog="${esc(p.catalog_id||'')}">${esc(p.id)} · ${esc(p.catalog_name||p.status)}</option>`).join('')}</select><label class="field" for="channel-agent">智能体</label><select id="channel-agent">${agents.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></details>${fillChips(state.consultMode==='general'?[['等待期和犹豫期有什么区别？','等待期与犹豫期'],['医疗险与重疾险有什么区别？','保障类型'],['健康告知是什么意思？','健康告知']]:customer?[['重疾等待期内确诊怎么办？','等待期'],['海港金彩颐年女性从几岁开始领养老年金？','起领年龄'],['一定能赔吗？','承诺拦截']]:[['这款什么时候能减保、最多减多少？','减保限额'],['中宏健康双星等待期多少天？','等待期'],['红利肯定有，比存银行划算','收益拦截']])}<div class="composer-box"><label class="sr-only" for="channel-text">${customer?'你的问题':'本次核对的问题'}</label><textarea id="channel-text" required maxlength="1500" placeholder="${customer?'输入你想核对的保障问题…':'输入需要核对的产品问题…'}"></textarea><div class="composer-actions"><button type="button" class="btn composer-example" id="fill-channel">填入示例</button><button class="btn primary composer-send" aria-label="${customer?'查看条款解释':'核对产品事实'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div></div><p class="composer-boundary">仅使用虚构编号 · 回答附可展开出处 · 不作承保或赔付结论</p></form>`;

}

function phoneZones(){

  const zones=[['seat','坐席区','贴入三四十字的转写。旁边的提示来自中台。','通话-01','客户问中宏健康双星等待期多少天','等待期转写'],['outreach','外呼区','选择一条虚构名单，生成话术草稿。这里没有拨号。','名单-01','请给海港金彩颐年写一段年金开场白，不要报收益率','年金开场'],['quality','质检区','把一段通话文本送去检查。结果另记一条，不改写坐席当时看到的回答。','通话-02','红利肯定有，比存银行划算','收益话术']];

  return `<div class="zone-grid">${zones.filter(([id])=>id===state.role).map(([id,title,text,context,sample,chip])=>{const on=state.role===id;const staff=(state.company.staff||[]).filter(s=>s.duty===id);return `<section class="panel ${on?'zone-on':'zone-off'}"><h2>${title}</h2><p>${text}</p><form data-zone="${id}"><label class="field" for="zone-${id}-operator">操作者编号</label><select id="zone-${id}-operator" ${on?'':'disabled'}>${staff.map(s=>`<option value="${esc(s.id)}">${esc(s.id)}</option>`).join('')}</select><label class="field" for="zone-${id}-context">${id==='outreach'?'名单编号':'通话编号'}</label><input id="zone-${id}-context" value="${context}" maxlength="40" ${on?'':'disabled'}><label class="field" for="zone-${id}-text">${id==='outreach'?'话术要求':id==='quality'?'待检文本':'通话转写'}</label><textarea id="zone-${id}-text" maxlength="1500" placeholder="${esc(sample)}" ${on?'required':'disabled'}></textarea>${fillChips([[sample,chip]])}<button class="btn primary" ${on?'':'disabled'}>${id==='outreach'?'生成话术草稿':'交给中台'}</button></form></section>`;}).join('')}</div><p class="notice">三个区在同一页。当前职责只能提交自己那一区。没有拨号，也不做语音识别。</p>`;

}

function channelPage(){

  if(!state.company)return header('渠道入口','正在读取虚构公司库。');

  const phone=['outreach','seat','quality'].includes(state.role);

  return header(pageName('channel'),phone?'电话中心的三个区共用这一页。外呼没有拨号，坐席使用贴入的转写，质检不改写原回答。':'请求交给中台。页面不直接调用大模型。','<span class="tag amber">演示</span>')+`<div class="notice">${esc(state.company.org.name)}：虚构保单引用公开条款做演示，不代表该公司承保，也不能当成赔付结论。</div>${phone?phoneZones():entryForm()}${illustrationHtml()}${['sales','wechat'].includes(state.desk)?'':channelResultHtml()}`;

}

function jobPage(){

  const samples={underwrite:['核保讨论前，中宏健康双星要核对投保年龄、等待期和如实告知。不要给承保结论。','核保沟通一般要注意什么？'],claim:['中宏健康双星首次重大疾病保险金怎么给付？请带出处，不要计算赔款。','理赔服务一般应该怎么向客户说明下一步？'],training:['展业有哪些可以说，哪些不可以说？','如何纠正“这个产品肯定能赔”的说法？','请扮演客户，问海港金彩颐年女性从几岁开始领养老年金。']};

  const sample=(samples[state.role]||[])[0]||'';

  const copy={service:'核对条款和流程。不能承诺赔付，也不能代替客户改保单。',underwrite:'只列出核保讨论前还缺的信息。不下承保通过或拒保。',claim:'列出材料并说明下一步。不支付赔款，也不认定必赔。',training:'陪练只用于练习。这段记录不是考核成绩。'}[state.role]||'按当前职责提问。';

  const agents=state.portal?.agents||[];

  const agent=agents.find(a=>a.id===state.jobAgent)||agents[0];

  if(!agent)return header(roleLabel(),'当前职责没有可调用的智能体。');

  const thread=state.jobMessages.length?state.jobMessages.map(m=>`<article class="bubble ${m.speaker==='user'?'mine':''}"><p>${esc(m.content)}</p>${m.evidence?.length?`<div class="quotes">${m.evidence.map(e=>`<blockquote><b>${esc(e.title)}${e.position?` · 段落${esc(e.position)}`:''}</b>${esc(e.excerpt)}</blockquote>`).join('')}</div>`:''}${agentModelStatus(m)}${m.manual?'<small>未采用模型正文，保留资料摘录或人工提示。</small>':''}</article>`).join(''):'<p class="subtle">还没有提问。</p>';

  const starters=[...(samples[state.role]||[]),...(agent.starters||[])].filter((v,i,a)=>a.indexOf(v)===i).slice(0,5);

  return header(roleLabel(),copy)+(agents.length>1?`<div class="chips">${agents.map(a=>`<button type="button" data-job-agent="${esc(a.id)}" class="${a.id===agent.id?'btn primary':'btn'}">${esc(a.name)}</button>`).join('')}</div>`:'')+`<section class="panel job-console"><div class="row between"><p>${esc(agent.boundary||'')}</p><span class="model-chip ${state.data?.model_ready?'online':'local'}"><i></i>${state.data?.model_ready?'千问已接入':'规则模式'}</span></div><div class="job-starters">${starters.map(s=>`<button type="button" data-job-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="thread">${thread}</div><form id="job-form"><textarea id="job-text" required maxlength="1500" placeholder="可问一般工作方法；具体产品问题会核对授权资料"></textarea><div class="row"><button class="btn primary">发送</button>${sample?'<button type="button" class="btn" id="fill-job">填入示例</button>':''}</div></form></section>`;

}

function inboxPage(){

  const items=state.handoffs?.items||[];

  return header('转人工','客户自助点转人工后，记录出现在这里。不打开微信，也不连接公众号。')+`<section class="panel">${items.length?items.map(item=>`<article class="list-item"><h3>${esc(item.customer_id)} · ${esc(item.status)}</h3><p>${esc(item.text)}</p><small>${esc(item.call_id)}${item.fictional?' · 虚构样例':''}</small></article>`).join(''):'<p>还没有待处理记录。</p>'}</section>`;

}

function platformPage(){

  const company=state.company;

  if(!company)return header('中台管理','正在读取虚构公司库和调用记录。');

  const calls=state.calls?.calls||[];

  const grants=[...company.duties.map(d=>[d.id,d.name]),['customer','客户自助']];

  const products=(state.portal?.products||[]).filter(p=>!['qianxin','sample-medical','ride-accident','clinic-gap'].includes(p.product));

  const channelOption=(id,label)=>`<option value="${id}" ${state.callChannel===id?'selected':''}>${label}</option>`;

  if(state.grantTab==='edit')return permissionEditor(grants,products);

  return header('智能体授权','查找调用记录，或为岗位添加一个智能体。')+`<div class="access-tabs" role="tablist" aria-label="授权页面"><button type="button" role="tab" id="access-query" aria-controls="access-query-panel" data-access-tab="query" aria-selected="${state.grantTab!=='create'}">查询记录</button><button type="button" role="tab" id="access-create" aria-controls="access-create-panel" data-access-tab="create" aria-selected="${state.grantTab==='create'}">新建智能体</button><button type="button" data-access-tab="edit" role="tab" aria-selected="false">已有授权</button></div><section id="access-query-panel" role="tabpanel" aria-labelledby="access-query" ${state.grantTab==='create'?'hidden':''}><form id="call-search" class="search-form"><select id="call-channel" aria-label="渠道">${channelOption('','全部渠道')}${channelOption('sales','展业')}${channelOption('self','客户自助')}${channelOption('phone','电话中心')}</select><input id="call-query" aria-label="调用编号" placeholder="调用编号、操作者或上下文" maxlength="40" value="${esc(state.callQuery||'')}"><button class="btn">查找</button></form>${callSummary(calls)}<section class="panel">${calls.length?calls.map(c=>`<article class="list-item"><h3>${esc(c.channel_name)} · ${esc(c.duty_name)}</h3><p>${esc(c.text||'')}</p><p class="call-brief">${esc((c.answer||'').slice(0,110))}${(c.answer||'').length>110?'…':''}</p><details><summary>展开完整回答</summary><p>${esc(c.answer)}</p></details><small><code>${esc(c.id)}</code> · ${esc(c.operator_id)} · ${esc(c.context_id)} · ${esc(c.status)}${c.fictional?' · 虚构':''}${c.handoff?' · 已转人工':''}</small></article>`).join(''):'<p>没有匹配的调用。</p>'}</section><p class="subtle">${esc(state.calls?.scope||'')}</p></section><section id="access-create-panel" role="tabpanel" aria-labelledby="access-create" ${state.grantTab!=='create'?'hidden':''}><form id="grant-agent" class="panel"><h2>新建智能体</h2><p class="subtle">新智能体仍使用已配置的千问，并且只检索勾选的已发布资料。</p><label class="field" for="grant-name">名称</label><input id="grant-name" required maxlength="40"><label class="field" for="grant-duty">职责说明</label><textarea id="grant-duty" required maxlength="400" placeholder="说明它回答哪一类问题，以及必须引用已发布资料。"></textarea><fieldset class="grant-fieldset"><legend>谁可以用</legend><div class="grant-tools"><button type="button" data-grant-all="grant-duty">全选</button><button type="button" data-grant-clear="grant-duty">清空</button></div><div class="grant-pills">${grants.map(([id,name])=>`<label class="grant-pill"><input type="checkbox" name="grant-duty" value="${id}"><span>${esc(name)}</span></label>`).join('')}</div></fieldset><fieldset class="grant-fieldset"><legend>可以查阅的资料</legend><div class="grant-tools"><button type="button" data-grant-all="grant-product">全选</button><button type="button" data-grant-clear="grant-product">清空</button></div><div class="grant-pills">${products.map(p=>`<label class="grant-pill"><input type="checkbox" name="grant-product" value="${esc(p.product)}"><span>${esc(p.title)}</span></label>`).join('')}</div></fieldset><button class="btn primary">保存智能体</button></form></section>`;

}

function libraryPage(){

  const company=state.company;

  if(!company)return header('虚构公司库','正在读取。');

  const counts=company.counts||{};

  return header(company.org.name,`种子 ${company.org.seed}。同一段生成代码每次得到同一批编号。`,'<span class="tag amber">虚构</span>')+`<p>${esc(company.org.note)}</p><div class="stats"><div class="stat"><div><strong>${counts.staff||0}</strong><span>员工 / 九条职责各 2 人</span></div></div><div class="stat"><div><strong>${counts.customers||0}</strong><span>客户编号</span></div></div><div class="stat"><div><strong>${counts.policies||0}</strong><span>演示保单</span></div></div><div class="stat"><div><strong>${counts.calls||0}</strong><span>会话与调用样例</span></div></div></div><div class="grid2">${company.products.map(p=>`<section class="panel"><span class="tag amber">${esc(p.mark)}</span><h2>${esc(p.title)}</h2><p>${esc(p.sentence)}</p></section>`).join('')}</div><section class="panel"><h2>客户与保单关联</h2><p>用编号找到同一位客户的演示保单，再核对所引用的资料。编号与关联均为虚构。</p><input id="library-filter" placeholder="筛选客户或保单编号" aria-label="筛选客户或保单编号">${company.policies.map(p=>`<div class="list-item"><h3>${esc(p.id)}</h3><small>${esc(p.customer_id)} · ${esc(p.status)} · 虚构</small><p>${esc(p.catalog_name||p.product_id||'未绑定公开条款')}</p></div>`).join('')}</section><details class="panel"><summary>员工职责与可用智能体</summary>${(company.staff||[]).map(person=>`<div class="list-item"><b>${esc(person.id)} · ${esc(person.duty_name||person.duty)}</b><p>${(state.portal?.agents||[]).filter(a=>(a.duties||[]).includes(person.duty)).map(a=>esc(a.name)).join('、')||'未授权智能体'}</p></div>`).join('')}</details><details class="panel"><summary>查看合成咨询情景</summary>${consultationLibrary()}</details>`;

}

function syncChannelPolicies(){const box=$('#channel-policy');if(!box)return;const customer=state.role==='customer';const context=customer?$('#channel-operator').value:$('#channel-context').value;$$('option',box).forEach(opt=>{if(!opt.value){opt.hidden=false;return;}opt.hidden=opt.dataset.customer!==context;if(opt.hidden&&opt.selected)box.value='';});if(!box.value){const preferred=[...box.options].find(opt=>!opt.hidden&&opt.dataset.catalog);if(preferred)box.value=preferred.value;}}

function markIcon(path){return `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;}

function fillChips(items){return `<div class="prompt-row" role="group" aria-label="可填入的演示问题">${items.map(([q,label])=>`<button type="button" class="prompt-chip" data-fill="${esc(q)}">${esc(label)}</button>`).join('')}</div>`;}

function deskSwitch(){return `<nav class="desk-switch" aria-label="切换业务端">${[['sales','展业端'],['wechat','客户自助'],['phone','电话中心'],['platform','保溯平台']].map(([id,label])=>`<button type="button" data-desk="${id}" aria-current="${state.desk===id?'page':'false'}">${label}</button>`).join('')}</nav>`;}

function deskBar(title,note){return `<div class="desk-toolbar"><button type="button" class="desk-brand" data-gate aria-label="返回保溯首页"><img src="/classic/logo.svg" alt=""><b>保溯</b></button><div class="desk-title"><b>${title}</b><small>${note}</small></div>${deskSwitch()}</div>`;}

async function enterDesk(desk,requestedPage=''){const role={sales:'sales',wechat:'customer',phone:'seat',platform:'platform',legacy:'builder'}[desk]||'builder';await session(role);state.desk=desk==='legacy'?'legacy':desk;state.company=null;state.channelResult=null;state.channelPending=false;state.channelDraft=null;state.phoneDraft=null;state.channelError='';state.calls=null;state.handoffs=null;state.lastCall='';await refresh();const fallback={sales:'channel',wechat:'channel',phone:'channel',platform:'overview',legacy:'home'}[desk]||'home';await navigate(requestedPage&&allowedPages().includes(requestedPage)?requestedPage:fallback);}

function deskStory(kind){

  const copy={

    sales:{kicker:'移动展业',title:'带着出处谈这张保单',lead:'手机框里的页面是演示，不是安装包。选虚构客户后，问题仍交给中台。',items:[['先问事实','减保时点、等待期、给付次数优先读字段。'],['利益演示','只在这一页查看。分红不保证，对话里不报收益率。'],['越界话术','「红利肯定有，比存银行划算」会留下摘录，不当作结论。']]},

    wechat:{kicker:'客户自助',title:'客户自己问，答不出就转人工',lead:'看起来像服务会话，但没有打开微信，也没有公众号。',items:[['用编号','只使用客户-01 这类虚构编号，不填写姓名和证件号。'],['看摘录','引用公开条款时，页面写明不代表该公司承保。'],['转人工','记录交给客户服务岗。这里不连接真实客服系统。']]},

    phone:{kicker:'电话中心',title:'一页三个席位，记录回到平台',lead:'外呼、坐席、质检共用这一页。当前职责只能提交自己那一区。',items:[['外呼','生成话术草稿。没有拨号，也不外呼真实号码。'],['坐席','贴入已经写好的转写。提示来自中台，不是语音识别。'],['质检','另记一条检查结果，不改写坐席当时看到的回答。']]}

  }[kind];

  return `<aside class="desk-story"><p class="eyebrow">${copy.kicker}</p><h2>${copy.title}</h2><p>${copy.lead}</p><ol>${copy.items.map(([t,d])=>`<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol></aside>`;

}

function workspaceIntro(label,title,copy){return `<header class="workspace-intro"><div><small>${label}</small><h1>${title}</h1><p>${copy}</p></div><div class="workspace-steps"><span>01 提问</span><span>02 核对</span><span>03 留痕</span></div></header>`;}

function salesShell(){return `<div class="desk-app desk-sales">${deskBar('代理人展业工作区','核对产品，查看出处')}${workspaceIntro('','带着出处，谈这张保单。','核对产品事实与适用条件，让每一次介绍有据可查。')}<div class="sales-workspace"><section class="sales-input" aria-label="保障需求顾问">${state.company?entryForm():'<p>正在读取演示资料…</p>'}</section><div class="sales-output"><div class="subnav sales-tabs"><button data-sales-view="answer" class="${state.salesView!=='benefit'?'active':''}">回答与出处</button><button data-sales-view="benefit" class="${state.salesView==='benefit'?'active':''}">利益讲解</button></div><div class="sales-result" aria-label="核对结果" ${state.salesView==='benefit'?'hidden':''}>${channelResultHtml()}</div><div class="sales-benefit" aria-label="利益数据可视化" ${state.salesView!=='benefit'?'hidden':''}>${illustrationHtml()}</div></div></div></div>`;}

function wechatShell(){return `<div class="desk-app desk-wechat">${deskBar('客户自助服务','提问，查看条款解释')}<div class="self-layout"><section class="self-input"><h1>先选咨询方式，<br>再说你的问题。</h1><p>普通咨询解释保险概念；专业咨询核对已授权的条款资料。</p>${state.company?entryForm():'<p>正在读取演示资料…</p>'}</section><div class="phone-frame wechat-frame"><header class="mobile-service-head"><img src="/classic/logo.svg" alt=""><div><b>保溯 · 客户服务</b><small>条款解释与问题核对</small></div></header><div class="mobile-chat-scroll"><div class="self-welcome">你好，想了解哪一项保障？<small>回答会留在这部演示设备里滚动查看。</small></div>${(state.channelPending||state.channelResult||state.channelError)?channelResultHtml():`<div class="mobile-empty-chat"><span>溯</span><p>提交左侧的问题后，这里会显示回答、处理状态和条款出处。</p></div>`}</div><div class="mobile-home-bar" aria-hidden="true"></div></div></div></div>`;}

function phoneShell(){const seats=[['outreach','外呼准备','生成话术草稿'],['seat','坐席辅助','核对转写问题'],['quality','话术质检','识别承诺风险']];return `<div class="desk-app desk-phone">${deskBar('电话中心工作区','外呼、坐席与质检')}${workspaceIntro('CONTACT CENTER','沟通有依据，交接有记录。','按席位进入任务；提示、原文和处理记录集中核对。')}<div class="contact-layout"><aside class="contact-nav"><small>选择工作席位</small><div class="seat-switch">${seats.map(([id,label,note])=>`<button type="button" data-seat-role="${id}" aria-pressed="${state.role===id}" class="${state.role===id?'active':''}"><b>${label}</b><span>${note}</span></button>`).join('')}</div><p>切换席位将切换演示职责。只有当前席位可以提交任务，历史记录仍留在平台。</p></aside><section aria-label="当前席位任务">${state.company?phoneZones():'<p>正在读取演示资料…</p>'}</section><div class="contact-result" aria-label="当前任务结果">${channelResultHtml()}</div></div></div>`;}

function agentGroupsHtml(){

  const agents=state.portal?.agents||[],hub=agents.filter(a=>a.layer==='platform'),edge=agents.filter(a=>a.layer!=='platform');

  const card=(a,note)=>`<article class="agent-summary"><div class="row between"><h3>${esc(a.name)}</h3><span>${esc(a.group||'')}</span></div><p>${esc(a.duty||'')}</p><small>${note}</small></article>`;

  const group=(title,note,items,empty)=>`<section class="agent-group"><header><h3>${title}</h3><p>${note}</p></header><div class="agent-summary-grid">${items.map(a=>card(a,title==='中台使用'?'仅平台与知识运营':'业务入口')).join('')||`<p class="subtle">${empty}</p>`}</div></section>`;

  return group('中台使用','知识治理、运行观测、抽检、授权与口径管理。',hub,'暂无中台智能体。')+group('业务入口使用','展业、客户自助和电话中心按职责调用。',edge,'暂无入口智能体。');

}

function agentModelStatus(m){if(m.speaker!=='assistant'||!m.model)return '';return `<small class="agent-model-status">${esc(m.model.model||'千问')} · 调用 ${m.model.count||0} 次 · ${m.model.ms||0} ms · ${m.model.adopted?'模型解释，待核对':m.model.count?'保留规则结果':'未调用模型'}</small>`;}

function hubPage(){const agents=(state.portal?.agents||[]).filter(a=>a.layer==='platform');const agent=agents.find(a=>a.id===state.hubAgent)||agents[0];if(!agent)return header('中台智能体','平台还没有自己的智能体。');const thread=(state.hubMessages||[]).map(m=>`<article class="bubble ${m.speaker==='user'?'mine':''}"><p>${esc(m.content)}</p>${agentModelStatus(m)}${m.evidence?.length?`<details><summary>查看本次依据</summary>${m.evidence.map(e=>`<blockquote>${esc(e.excerpt)}</blockquote>`).join('')}</details>`:''}</article>`).join('')||'<p class="subtle">还没有提问。这些智能体看的是知识和留存，不办理展业。</p>';return header('中台自己使用的智能体','知识治理、运行观测、抽检研判、授权编排和口径中枢不授权给三个入口。')+`<section class="guide-grid"><article><b>知识治理</b><p>看四份公开条款怎么分架，不向客户介绍产品。</p></article><article><b>运行观测</b><p>汇总三个入口的调用、拦截和转人工，不说成成绩。</p></article><article><b>抽检研判</b><p>只建议确认、误报或需补知识，不改原来的回答。</p></article><article><b>授权编排</b><p>看职责和资料授权。业务岗不能新建智能体。</p></article><article><b>口径中枢</b><p>三个入口对同一条款用同一字段和出处。</p></article></section>`+`<div class="chips">${agents.map(a=>`<button type="button" data-hub-agent="${esc(a.id)}" class="${a.id===agent.id?'btn primary':'btn'}">${esc(a.name)}</button>`).join('')}</div><section class="panel"><p>${esc(agent.duty||'')}</p><p class="subtle">${esc(agent.boundary||'')}</p><div class="chips">${(agent.starters||[]).map(s=>`<button type="button" class="btn" data-hub-starter="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="thread">${thread}</div><form id="hub-form"><textarea id="hub-text" required maxlength="1500" placeholder="问中台自己的事，例如知识结构、调用数量、抽检和授权"></textarea><button class="btn primary">交给这名中台智能体</button></form></section>`;}

function bindHub(){$$('[data-hub-agent]').forEach(b=>b.onclick=()=>{state.hubAgent=b.dataset.hubAgent;state.hubMessages=[];state.hubConversation='';render();});$$('[data-hub-starter]').forEach(b=>b.onclick=()=>{$('#hub-text').value=b.dataset.hubStarter;});if($('#hub-form'))$('#hub-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const agents=(state.portal.agents||[]).filter(a=>a.layer==='platform');const agent=(agents.find(a=>a.id===state.hubAgent)||agents[0]).id;const text=$('#hub-text').value.trim();const submit=$('#hub-form button');submit.disabled=true;submit.textContent='正在核对并生成…';let reply;try{reply=await api('/chat',{agent,message:text,conversation:state.hubConversation||undefined});}finally{submit.disabled=false;submit.textContent='交给这名中台智能体';}const last=reply.messages[reply.messages.length-1];state.hubAgent=agent;state.hubConversation=reply.conversation;state.hubMessages=(state.hubMessages||[]).concat([{speaker:'user',content:text},{speaker:'assistant',content:last.content,model:last.model,evidence:last.evidence}]);render();});};}

function layerBoard(){const layers=[['01','基础能力','已接通的千问。业务页面不直接调用。'],['02','平台能力','知识、授权、调用和抽检留在中台。'],['03','应用能力','展业、客服、核保、理赔、培训、外呼按职责打开。'],['04','系统集成','三个演示入口把身份、上下文和问题交给中台。']];return `<section class="layer-board" aria-label="四层结构">${layers.map(([n,t,d])=>`<article><small>${n}</small><b>${t}</b><p>${d}</p></article>`).join('')}</section>`;}

function dutyBoard(){const duties=['营销展业','客户服务','电话外呼','电话坐席','通话质检','核保作业','理赔作业','培训','平台与知识运营'];return `<section class="duty-board"><div><b>九条职责</b><p>菜单按职责打开。新建智能体和全量调用只给平台与知识运营。客户只走自助入口。</p></div><ul>${duties.map(name=>`<li>${name}</li>`).join('')}</ul></section>`;}

function overviewCallIsPrivate(c){const value=[c?.text,c?.operator_id,c?.context_id].filter(Boolean).join(' ');return /(?:姓名|学号|身份证|手机号|联系方式|邮箱|中央财经大学|保险学院|老师|同学|认识.{0,8}(?:吗|么)|\b1[3-9]\d{9}\b|student\s*id|id\s*number|phone\s*number|e-?mail|university|college|professor|teacher|my\s+name|name\s+is)/i.test(value);}
function overviewPage(){

  const calls=state.calls?.calls||[],metrics=state.calls?.metrics||{};

  const pending=reviewSelection().pending;

  const products=state.life?.products||[];

  const recent=[...calls].filter(c=>!overviewCallIsPrivate(c)).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||''))).slice(0,5);

  const drafts=(state.data.documents||[]).filter(d=>d.status==='draft');

  return `<header class="platform-command"><div><small>中台工作顺序</small><h1>先有依据，再回答问题。</h1><p>先整理资料并配置范围，再接收业务问题；回答留存后，由人核对和验证。</p></div>${workflowRoadmap()}<div class="platform-command-actions"><button class="btn primary" data-ops-review="pending">处理待复核 →</button><button class="btn" data-page="knowledge">维护条款资料</button></div></header>`+`

  <div class="ops-metrics" aria-label="本机运行概况">

    <article><span>调用总数</span><strong>${esc(metrics.calls??calls.length)}</strong><small>以当前接口统计为准</small></article>

    <article><span>待人工复核</span><strong>${pending.length}</strong><small>当前载入记录 · 包含虚构样例</small></article>

    <article><span>公开产品样例</span><strong>${products.length}</strong><small>条款结构化资料</small></article>

    <article><span>资料草稿版本</span><strong>${drafts.length}</strong><small>未发布，不等于专业审核进度</small></article>

  </div>

  <div class="ops-layout"><section class="ops-activity"><div class="ops-section-head"><div><h2>最近业务调用</h2></div><button class="btn" data-ops-review="all">查看全部 →</button></div>

  <div class="ops-table-head"><span>业务问题 / 调用编号</span><span>处理状态</span><span>复核</span></div>

  ${recent.map(c=>{const status=callPresentation(c);return `<button type="button" class="ops-call" data-ops-call="${esc(c.id)}"><span><small>${esc(c.channel_name||c.channel)} · ${c.fictional?'虚构样例':'本机调用'}</small><b>已留存业务问题</b><code>${esc(c.id)} · ${esc(c.created?timeFmt(c.created):'时间未登记')}</code></span><span class="queue-state ${status.tone}">${esc(status.label)}</span><span>${c.review?'已处置':'查看依据'} ↗</span></button>`;}).join('')||'<div class="ops-empty">暂无调用。从业务入口提交问题后，在这里查看回答和依据。</div>'}

  </section><aside class="ops-aside"><section class="ops-next"><h2>需要处理的工作</h2><button data-ops-review="pending"><span><b>复核业务回答</b><small>核对拦截、异常与人工移交</small></span><strong>${pending.length} →</strong></button><button data-page="knowledge"><span><b>维护条款资料</b><small>登记来源、版本和证据段落</small></span><strong>↗</strong></button><button data-page="platform"><span><b>检查职责授权</b><small>管理各岗位可调用的能力</small></span><strong>↗</strong></button></section><section class="ops-boundary"><h3>平台负责留痕与复核</h3><p>业务人员查看本岗位回答与证据；平台维护者查看全局记录、资料版本和授权。</p><small>演示职责切换 · 非生产登录</small></section></aside></div>

  <section class="ops-channels"><div class="ops-section-head"><div><h2>业务工作区</h2></div><span>本机演示接入</span></div><div class="gate-grid gate-grid-tight">${[['sales','01','代理人展业','核对减保、等待期与产品条件'],['wechat','02','客户自助','解释条款、查看出处、转人工'],['phone','03','电话中心','外呼草稿、坐席辅助、话术质检']].map(([desk,n,title,desc])=>`<button class="gate-card" data-desk="${desk}"><small>${n}</small><strong>${title} ↗</strong><span>${desc}</span></button>`).join('')}</div></section>

  <details class="ops-details"><summary>查看中台机制与智能体名录</summary>${layerBoard()}${dutyBoard()}<section class="panel agent-directory">${agentGroupsHtml()}</section></details>`;

}



function reviewSelection(){

  const calls=state.calls?.calls||[], mode=state.sampleMode||'all', filter=state.sampleFilter||'', query=(state.sampleQuery||'').trim().toLowerCase();

  const pending=calls.filter(c=>!c.review&&(c.duty==='quality'||['rejected','error','guarded'].includes(c.status)||c.handoff||c.rule_category||c.adopted===0||c.adopted===false));

  const shown=(mode==='pending'?pending:calls).filter(c=>(!filter||(filter==='rules'?!!c.rule_category:filter==='handoff'?c.handoff:filter==='error'?c.status==='error':(c.rule_category||'').includes(filter)))&&(!query||[c.id,c.text,c.answer,c.channel_name,c.context_id].join(' ').toLowerCase().includes(query)));

  return {calls,pending,shown,pick:shown.find(c=>c.id===state.samplePick)||shown[0]||null};

}

function reviewProcess(pick){

  if(!pick)return '';

  const evidence=(pick.excerpts||[]).length, reviewed=!!pick.review, model=pick.trace?.model_call;

  const steps=[['01','接收留存','入口、职责与问题进入队列','done'],['02','自动分流',pick.rule_category?'发现合规规则命中':pick.handoff?'发现转人工标记':pick.status==='error'?'发现模型异常':'进入常规抽检','done'],['03','证据复核',evidence?`已留存 ${evidence} 条摘录`:'缺少可定位摘录',evidence?'done':'warn'],['04','追加处置',reviewed?'已留存意见，原回答未改':'等待复核者选择处置',reviewed?'done':'current']];

  return `<section class="review-process" aria-label="抽检留存可视化流程"><div class="review-process-head"><div><small>REVIEW TRACE</small><h2>这条记录怎样被复核</h2></div><span>${reviewed?'处置已追加':'等待人工处置'}</span></div><ol>${steps.map(([n,title,text,status])=>`<li class="${status}"><span>${n}</span><div><b>${title}</b><small>${esc(text)}</small></div></li>`).join('')}</ol><div class="review-format-cards"><details><summary><span>调用身份</span><b>${esc(pick.channel_name||pick.channel)} ↗</b></summary><p>${esc(pick.duty_name||pick.duty)} · ${esc(pick.context_id||'未登记上下文')}</p></details><details><summary><span>模型状态</span><b>${model?.count?`${esc(model.model||'千问')} / ${esc(model.count)} 次`:'未调用或旧记录'} ↗</b></summary><p>${model?`${esc(model.status)} · ${esc(model.ms||0)} ms · ${model.adopted?'采用解释':'未采用正文'}`:'该历史记录尚未保存精确模型调用次数。'}</p></details><details><summary><span>证据留存</span><b>${evidence} 条 ↗</b></summary><p>${evidence?'可在下方逐条展开来源、段落与版本。':'缺少出处时不能把回答视为已核对。'}</p></details><details><summary><span>人工处置</span><b>${reviewed?'已追加':'待选择'} ↗</b></summary><p>${reviewed?esc(pick.review.note||'处置已留存'):'确认违规、误报或需补知识；处置不会改写原回答。'}</p></details></div></section>`;

}

function samplePage(){

  const {calls,pending,shown,pick}=reviewSelection(), mode=state.sampleMode||'all', filter=state.sampleFilter||'';

  const filters=[['','全部类型'],['rules','全部合规拦截'],['promise_pay','承诺赔付'],['yield_guarantee','收益保证'],['deposit_compare','存款理财比较'],['disparage','夸大贬低'],['handoff','转人工'],['error','模型失败']];

  const filterCards=[['','全部记录',calls.length,'来自三个业务入口'],['rules','合规拦截',calls.filter(c=>c.rule_category).length,'承诺与不当话术'],['handoff','转人工',calls.filter(c=>c.handoff).length,'客户服务衔接'],['error','模型异常',calls.filter(c=>c.status==='error').length,'保留规则与证据']];

  const queue=shown.map(c=>{const status=callPresentation(c);return `<button type="button" class="replay-item ${pick?.id===c.id?'is-open':''}" data-open-call="${esc(c.id)}" aria-current="${pick?.id===c.id?'true':'false'}"><span class="queue-item-top"><span>${esc(c.channel_name||c.channel)} · ${esc(c.duty_name||c.duty)}</span><span>${c.review?'已处置':'未处置'}</span></span><b>${esc(c.text||c.answer||'未提供问题')}</b><span class="queue-item-bottom"><span class="queue-state ${status.tone}">${status.label}</span>${c.fictional?'<span>虚构样例</span>':''}</span><small>${esc(c.id)}${c.created?' · '+esc(timeFmt(c.created)):''}</small></button>`;}).join('');

  const actions=pick?`<section class="review-actions" aria-label="抽检处置"><div><h3>复核处置 <code>${esc(pick.id)}</code></h3><p>${pick.review?'处置已留存，原回答没有改。':'核对证据后追加处置，原回答保持不变。'}</p></div>${pick.review?`<span class="result-badge ready">${esc(pick.review.note||'已处置')}</span>`:`<div class="action-buttons">${[['confirm','确认违规'],['false_positive','误报'],['need_knowledge','需补知识']].map(([id,label])=>`<button type="button" class="btn ${id==='confirm'?'danger-outline':''}" data-sample="${id}" data-call="${esc(pick.id)}" ${state.reviewPending?'disabled':''}>${label}</button>`).join('')}</div>`}${state.reviewError?`<p role="alert" class="inline-error">${esc(state.reviewError)}</p>`:''}</section>`:'';

  return header('条款复核工作台','核对调用回答、事实字段和留存证据。','<span class="workspace-label">本机留存</span>')+`<section class="review-type-cards" aria-label="按记录形式查看">${filterCards.map(([id,label,note,desc])=>`<button type="button" data-review-filter="${id}" aria-pressed="${filter===id}"><span>${esc(label)}</span><strong>${note}</strong><small>${esc(desc)}</small></button>`).join('')}</section><section class="review-toolbar" aria-label="调用筛选"><div class="review-modes" aria-label="记录范围">${[['all','全部留存',calls.length],['pending','待复核',pending.length]].map(([id,label,n])=>`<button type="button" data-review-mode="${id}" aria-pressed="${mode===id}">${label}<span>${n}</span></button>`).join('')}</div><form id="review-search" class="review-search"><label class="sr-only" for="review-query">搜索问题、客户或调用编号</label><input id="review-query" type="search" value="${esc(state.sampleQuery||'')}" placeholder="搜索问题 / 客户 / 调用编号"><button class="btn" type="submit">搜索</button></form><label class="sr-only" for="review-type">记录类型</label><select id="review-type">${filters.map(([id,label])=>`<option value="${id}" ${filter===id?'selected':''}>${label}</option>`).join('')}</select></section><div class="review-desk"><section class="review-queue" aria-label="调用队列"><div class="queue-heading"><h2>调用记录</h2><a href="#answer-heading" class="queue-jump" data-jump-answer>查看详情 ↓</a><span aria-live="polite">${shown.length} 条</span></div><div class="queue-scroll">${queue||'<div class="queue-empty"><h3>没有匹配记录</h3><p>请调整关键词或记录类型。</p><button type="button" class="btn" id="clear-review">清除筛选</button></div>'}</div><p class="queue-footnote">虚构样例与本机调用</p></section><div class="review-detail">${reviewProcess(pick)}${pick?evidenceSheet(pick):`<section class="clause-sheet sheet-empty"><span class="empty-emblem">${uiIcon('sample')}</span><h2>${calls.length?'当前筛选下没有调用':'尚无调用记录'}</h2><p>${calls.length?'清除筛选后选择记录，查看回答、证据与处置。':'从展业、自助或电话中心提交问题后，在此核对。'}</p></section>`}${actions}</div></div><p class="scope-note">${esc(state.calls?.scope||'本机演示记录，不代表生产业务。')}</p>`;

}

function bindChannel(){

  $$('[data-consult-mode]').forEach(b=>b.onclick=()=>{if(state.channelPending)return;state.consultMode=b.dataset.consultMode;state.channelResult=null;state.channelDraft=null;render();});

  if($('#consult-topic'))$('#consult-topic').onchange=e=>{state.consultTopic=e.target.value;render();};

  if($('#compose-profile'))$('#compose-profile').onclick=()=>{const p=Object.fromEntries(['topic','age','gender','health','pay'].map(k=>[k,$('#profile-'+k).value]));state.consultProfile=p;$('#channel-text').value=`${p.age}，${p.gender}，健康情况：${p.health}，缴费偏好：${p.pay}。想了解${p.topic}，应该先核对什么？`;};

  if($('#scenario-search'))$('#scenario-search').oninput=e=>{const q=e.target.value.trim();$('#scenario-list').innerHTML=scenarioRows(state.consultKnowledge.items.filter(r=>[r.id,r.age,r.health,r.topic,r.gender].join(' ').includes(q)).slice(0,30));};

  syncChannelPolicies();

  if($('#channel-operator'))$('#channel-operator').onchange=syncChannelPolicies;

  if($('#channel-context'))$('#channel-context').onchange=syncChannelPolicies;

  if($('#channel-form')){

    if(state.channelDraft?.role===state.role){for(const [key,value] of Object.entries(state.channelDraft.values)){const el=$('#channel-'+key);if(el)el.value=value;}syncChannelPolicies();if(state.channelDraft.values.policy==='')$('#channel-policy').value='';}

    $('#channel-form').onsubmit=e=>{e.preventDefault();guard(async()=>{

      if(state.channelPending)return;

      const customer=state.role==='customer',operator=$('#channel-operator').value,context=customer?operator:$('#channel-context').value;

      const policyEl=$('#channel-policy'),policy=policyEl.selectedOptions[0],policyValue=policyEl.value,agent=$('#channel-agent').value;

      if(policy&&policy.hidden)throw Error('这张演示保单不属于当前客户');

      if(state.consultMode==='professional'&&state.consultTopic==='needs')$('#compose-profile').click();

      const profile=state.consultMode==='professional'&&state.consultTopic==='needs'?{...state.consultProfile}:null;

      const text=$('#channel-text').value.trim();if(!text){$('#channel-text').focus();return;}

      const taskToken=state.token,taskDesk=state.desk;

      state.channelDraft={role:state.role,values:{operator,context,policy:policyValue,agent,text}};

      state.askText=text;state.channelPending=true;state.channelError='';state.channelResult=null;render();

      try{const result=await api('/channel',{channel:customer?'self':'sales',duty:customer?'customer':state.role,operator,context,policy:state.consultMode==='general'?'':policyValue,text,agent,consult_mode:state.consultMode,profile});

        if(taskToken!==state.token||taskDesk!==state.desk)return;

        state.channelResult=result;state.lastCall=result.call_id;

      }catch(e){if(taskToken===state.token&&taskDesk===state.desk)state.channelError=e.message;}

      finally{if(taskToken===state.token&&taskDesk===state.desk){state.channelPending=false;render();const target=$('#answer-heading')||$('#channel-text');target?.focus({preventScroll:true});if(state.desk==='wechat'&&target?.id==='answer-heading')target.scrollIntoView({block:'start',behavior:'auto'});}}

    });};

    if(state.channelPending)$$('input,select,textarea,button',$('#channel-form')).forEach(el=>el.disabled=true);

  }

  $$('[data-zone]').forEach(form=>{

    const fields=$$('select,input,textarea',form);

    if(state.phoneDraft?.role===state.role&&form.dataset.zone===state.role)fields.forEach((el,i)=>el.value=state.phoneDraft.values[i]);

    if(state.channelPending)$$('select,input,textarea,button',form).forEach(el=>el.disabled=true);

    form.onsubmit=e=>{e.preventDefault();guard(async()=>{

      if(form.dataset.zone!==state.role||state.channelPending)return;

      const text=fields[2].value.trim();if(!text){fields[2].focus();return;}

      const token=state.token,desk=state.desk;

      state.phoneDraft={role:state.role,values:fields.map(el=>el.value)};

      state.askText=text;state.channelPending=true;state.channelError='';state.channelResult=null;render();

      try{const result=await api('/channel',{channel:'phone',duty:state.role,operator:fields[0].value,context:fields[1].value,text});if(token!==state.token||desk!==state.desk)return;state.channelResult=result;state.lastCall=result.call_id;}

      catch(e){if(token===state.token&&desk===state.desk)state.channelError=e.message;}

      finally{if(token===state.token&&desk===state.desk){state.channelPending=false;render();($('#answer-heading')||$(`[id="zone-${state.role}-text"]`))?.focus({preventScroll:true});}}

    });};

  });

  if($('#channel-handoff'))$('#channel-handoff').onclick=()=>guard(async()=>{const saved=await api('/channel/handoff',{call_id:state.lastCall});toast(saved.notice);});

  if($('#fill-channel'))$('#fill-channel').onclick=()=>{$('#channel-text').value=state.consultMode==='general'?'等待期和犹豫期有什么区别？':state.role==='customer'?'重疾等待期内确诊怎么办？':'这款什么时候能减保、最多减多少？';};

  $$('[data-fill]').forEach(b=>b.onclick=()=>{const form=b.closest('form');const box=form?form.querySelector('textarea'):$('#channel-text');if(box&&!box.disabled)box.value=b.dataset.fill;});

  if($('#illu-form'))$('#illu-form').onsubmit=e=>{e.preventDefault();guard(async()=>{state.simulation=await api('/simulation?age='+encodeURIComponent($('#illu-age').value)+'&pay='+encodeURIComponent($('#illu-pay').value)+'&annual='+encodeURIComponent($('#illu-annual').value));render();});};

  if($('#sim-year'))$('#sim-year').onchange=e=>{state.simYear=Number(e.target.value);render();};

  $$('[data-sales-view]').forEach(b=>b.onclick=()=>{state.salesView=b.dataset.salesView;render();});

}

function bindSample(){

  const focusQueue=()=>{const selected=$('.replay-item.is-open');if(selected)selected.focus({preventScroll:true});};

  $$('[data-open-call]').forEach(b=>b.onclick=()=>{const offset=$('.queue-scroll')?.scrollTop||0;state.samplePick=b.dataset.openCall;state.reviewError='';render();$('.queue-scroll').scrollTop=offset;focusQueue();});

  $$('[data-review-mode]').forEach(b=>b.onclick=()=>{state.sampleMode=b.dataset.reviewMode;state.samplePick='';state.reviewError='';render();$(`[data-review-mode="${state.sampleMode}"]`).focus({preventScroll:true});});

  $$('[data-review-filter]').forEach(b=>b.onclick=()=>{state.sampleFilter=b.dataset.reviewFilter;state.samplePick='';state.reviewError='';render();$(`[data-review-filter="${state.sampleFilter}"]`)?.focus({preventScroll:true});});

  if($('#review-type'))$('#review-type').onchange=e=>{state.sampleFilter=e.target.value;state.samplePick='';render();$('#review-type').focus();};

  if($('#review-search'))$('#review-search').onsubmit=e=>{e.preventDefault();state.sampleQuery=$('#review-query').value;state.samplePick='';render();$('#review-query').focus();};

  if($('#clear-review'))$('#clear-review').onclick=()=>{state.sampleFilter='';state.sampleQuery='';render();$('#review-query').focus();};

  $$('[data-sample]').forEach(b=>b.onclick=()=>guard(async()=>{

    if(state.reviewPending)return;

    const token=state.token, callId=b.dataset.call, action=b.dataset.sample;

    state.reviewPending=true;state.reviewError='';render();

    try{const saved=await api('/channel/sample',{call_id:callId,action});if(token!==state.token)return;

      const current=(state.calls?.calls||[]).find(c=>c.id===callId);if(current)current.review=saved.review||{note:({confirm:'确认违规',false_positive:'误报',need_knowledge:'需补知识'})[action]};

      const refreshed=await api('/channel/calls?channel='+encodeURIComponent(state.callChannel||'')+'&q='+encodeURIComponent(state.callQuery||''));if(token!==state.token)return;state.calls=refreshed;toast('处置已追加，原来的回答没有改');

    }catch(e){if(token===state.token)state.reviewError=e.message+'。请刷新记录核实处置结果后再操作。';}

    finally{state.reviewPending=false;if(token===state.token&&state.page==='sample'){render();$('.review-actions')?.scrollIntoView({block:'nearest'});}}

  }));

}



const PLAZA_FILTERS=[['explore','探索'],['team','我的团队'],['all','全部'],['platform','中台'],['sales','展业'],['service','客服'],['uwclaim','核保理赔'],['phone','质检外呼'],['office','综合职能']];

const PLAZA_LANES={platform:'中台',sales:'展业',service:'客服',uwclaim:'核保理赔',phone:'质检外呼',office:'综合职能'};

const PLAZA_EXPLORE=['advisor','desk','outreach','underwrite','ops-knowledge','ops-observe','ops-sample','ops-voice'];

const PLAZA_AVATARS={advisor:'/classic/illustrations/avatar-advisor.png',desk:'/classic/illustrations/avatar-desk.png',outreach:'/classic/illustrations/avatar-outreach.png',underwrite:'/classic/illustrations/avatar-underwrite.png','ops-knowledge':'/classic/illustrations/avatar-ops-knowledge.png','ops-observe':'/classic/illustrations/avatar-ops-observe.png','ops-sample':'/classic/illustrations/avatar-ops-sample.png','ops-voice':'/classic/illustrations/avatar-ops-voice.png','hr-policy':'/classic/illustrations/avatar-hr-policy.png','admin-guide':'/classic/illustrations/avatar-admin-guide.png','it-helpdesk':'/classic/illustrations/avatar-it-helpdesk.png'};

const PLAZA_TEAM_KEY='baozhi.plaza.team.v1';

function localRead(key){try{return (typeof localStorage!=='undefined'&&localStorage.getItem(key))||''}catch(e){return ''}}

function localWrite(key,value){try{if(typeof localStorage!=='undefined')localStorage.setItem(key,value)}catch(e){}}

function plazaTeam(){try{const list=JSON.parse(localRead(PLAZA_TEAM_KEY)||'[]');return Array.isArray(list)?list.filter(x=>typeof x==='string'):[]}catch(e){return []}}

function plazaLane(a){return a.layer==='platform'?'platform':(a.lane||'');}

function plazaList(){

  const agents=state.portal?.agents||[];

  const q=(state.plazaQuery||'').trim();

  let list;

  if(state.plazaFilter==='explore')list=PLAZA_EXPLORE.map(id=>agents.find(a=>a.id===id)).filter(Boolean);

  else if(state.plazaFilter==='team')list=agents.filter(a=>state.plazaTeam.includes(a.id));

  else if(state.plazaFilter==='all')list=agents.slice();

  else list=agents.filter(a=>plazaLane(a)===state.plazaFilter);

  return q?list.filter(a=>a.name.includes(q)):list;

}

function plazaCard(a){

  const picked=state.plazaPick===a.id;

  const inTeam=state.plazaTeam.includes(a.id);

  const lane=plazaLane(a);

  const calls=a.calls||0;

  const side=picked?`<div class="plaza-card-actions"><button type="button" class="btn primary" data-plaza-talk="${esc(a.id)}">对话</button><button type="button" class="btn" data-plaza-team="${esc(a.id)}">${inTeam?'移出团队':'加入团队'}</button></div>`:`<span class="plaza-lane">${esc(PLAZA_LANES[lane]||a.group||'')}</span>`;

  const portrait=PLAZA_AVATARS[a.id];

  const avatar=portrait?`<img class="plaza-portrait" src="${portrait}" alt="${esc(a.name)}" loading="lazy">`:`<span class="plaza-avatar accent-${esc(a.accent||'violet')}">${esc(a.name.slice(0,1))}</span>`;

  return `<article class="plaza-card ${picked?'picked':''}" data-plaza="${esc(a.id)}" role="button" tabindex="0" aria-pressed="${picked}"><div class="plaza-card-top">${avatar}${side}</div><h3>${esc(a.name)}</h3><p class="plaza-note">${esc(a.note||a.group||'')}</p><p class="plaza-duty">${esc(a.duty||'')}</p>${picked?`<div class="skill-spec"><p><b>不能做</b> ${esc(a.boundary||'没有额外边界')}</p><p><b>技能</b> ${esc((a.skills||[]).slice(0,4).join(' · ')||'原文检索')}</p><p><b>可试</b> ${esc((a.starters||[]).slice(0,2).join('；')||'从对话页提问')}</p></div>`:''}${lane==='office'?'<p class="plaza-office-note">不接真实 OA，只读本机演示制度摘录</p>':''}<div class="plaza-meta"><span>${calls?`本机留存 ${calls} 次`:'暂无留存'}</span><span class="tag">${esc(a.origin||'平台预置')}</span></div></article>`;

}

function plazaTalk(id){

  const agent=(state.portal?.agents||[]).find(a=>a.id===id);

  if(!agent)return;

  if(agent.layer==='platform'){state.hubAgent=id;state.hubMessages=[];state.hubConversation='';navigate('hub');}

  else{state.chatAgent=id;state.conversation=null;state.messages=[];state.draft=(agent.starters||[''])[0]||'';navigate('talk');}

}

function plazaToggleTeam(id){

  const list=plazaTeam();

  const at=list.indexOf(id);

  if(at>=0)list.splice(at,1);else list.push(id);

  localWrite(PLAZA_TEAM_KEY,JSON.stringify(list));

  state.plazaTeam=list;

  toast(at>=0?'已移出我的团队':'已加入我的团队，只记在本机');

  render();

}

function plazaPage(){

  state.plazaTeam=plazaTeam();

  const portal=state.portal;

  if(!portal)return header('智能体广场','正在读取智能体名录。');

  const list=plazaList();

  const banner=state.plazaBanner?`<section class="plaza-banner"><div class="plaza-banner-copy"><b>欢迎新同事。</b><small>人、条款和智能体接在一处，回答要能回到出处。</small></div><img class="plaza-banner-illu" src="/classic/illustrations/banner-wave.png" alt="挥手的保险同事"><span class="plaza-banner-blend" aria-hidden="true"></span><button type="button" class="btn text" id="plaza-banner-toggle">收起说明</button></section>`:`<div class="plaza-banner-closed"><span>欢迎新同事。人、条款和智能体接在一处，回答要能回到出处。</span><button type="button" class="btn text" id="plaza-banner-toggle">展开说明</button></div>`;

  const chips=PLAZA_FILTERS.map(([id,label])=>`<button type="button" data-plaza-filter="${id}" class="${state.plazaFilter===id?'btn primary':'btn'}">${esc(label)}${id==='team'&&state.plazaTeam.length?` · ${state.plazaTeam.length}`:''}</button>`).join('');

  return header('智能体广场','浏览入口智能体、中台智能体和综合职能智能体，按岗位筛选，加入个人团队，再进入已有对话。','<span class="tag">只给平台与知识运营</span>')+banner+`<div class="plaza-toolbar"><div class="chips">${chips}</div><form id="plaza-search" class="search-form"><input id="plaza-query" aria-label="按名称搜索智能体" placeholder="按名称搜索" maxlength="40" value="${esc(state.plazaQuery||'')}"><button class="btn">查找</button></form></div><div class="plaza-layout"><div class="plaza-grid">${list.map(plazaCard).join('')||'<p class="subtle">没有匹配的智能体。改个关键词，或换一个标签看看。</p>'}</div><aside class="plaza-rail"><h2>智能体广场，是中台看全部同事的地方。</h2><p>广场用来浏览入口智能体、中台智能体和综合职能智能体，按岗位筛选，加入个人团队，再进入已有对话。知识库和三个入口是底层支撑。没有真实微信和电话，没有多人同时编辑。</p><ul class="bullet-list"><li>入口智能体给展业、客户自助和电话中心用。中台智能体只给平台与知识运营用，不放进 APP。</li><li>综合职能给人力、综合、信息部等内勤用：回答制度与办事步骤，资料来自本机虚构制度摘录，不能替代真实 HR/IT 系统办结。</li><li>加入团队只表示这位同事出现在「我的团队」，不是多人同时编辑文件。</li><li>对话仍然走中台。产品事实先查结构化条款，说不出出处的不说；制度与办事只引用已发布的内勤演示资料。</li><li>知识库负责条款字段和出处；内勤制度单独成架「制度演示架」。三个入口负责把同一个中台接到展业、客户和坐席。没有真实微信，没有真实电话。</li></ul></aside></div>`;

}

function bindPlaza(){

  $$('[data-plaza-filter]').forEach(b=>b.onclick=()=>{state.plazaFilter=b.dataset.plazaFilter;state.plazaPick='';render();});

  if($('#plaza-search'))$('#plaza-search').onsubmit=e=>{e.preventDefault();state.plazaQuery=$('#plaza-query').value.trim();render();};

  if($('#plaza-banner-toggle'))$('#plaza-banner-toggle').onclick=()=>{state.plazaBanner=!state.plazaBanner;render();};

  $$('[data-plaza]').forEach(card=>{const pick=()=>{state.plazaPick=card.dataset.plaza;render();};card.onclick=pick;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}};});

  $$('[data-plaza-talk]').forEach(b=>b.onclick=e=>{e.stopPropagation();plazaTalk(b.dataset.plazaTalk);});

  $$('[data-plaza-team]').forEach(b=>b.onclick=e=>{e.stopPropagation();plazaToggleTeam(b.dataset.plazaTeam);});

}

function bindJob(){

  $$('[data-job-agent]').forEach(b=>b.onclick=()=>{state.jobAgent=b.dataset.jobAgent;state.jobMessages=[];state.jobConversation='';render();});

  if($('#job-form'))$('#job-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const agents=state.portal.agents||[];const agent=(agents.find(a=>a.id===state.jobAgent)||agents[0]).id;const text=$('#job-text').value.trim();const submit=$('#job-form button');submit.disabled=true;submit.textContent='正在生成…';let reply;try{reply=await api('/chat',{agent,message:text,conversation:state.jobConversation||undefined});}finally{submit.disabled=false;submit.textContent='发送';}const last=reply.messages[reply.messages.length-1];state.jobAgent=agent;state.jobConversation=reply.conversation;state.jobMessages=state.jobMessages.concat([{speaker:'user',content:text},{speaker:'assistant',content:last.content,evidence:last.evidence||[],manual:!last.model?.adopted,model:last.model}]);render();});};

  if($('#fill-job'))$('#fill-job').onclick=()=>{$('#job-text').value={underwrite:'核保讨论前，中宏健康双星要核对投保年龄、等待期和如实告知。不要给承保结论。',claim:'中宏健康双星首次重大疾病保险金怎么给付？请带出处，不要计算赔款。',training:'请扮演客户，问海港金彩颐年女性从几岁开始领养老年金。'}[state.role]||'';};

  $$('[data-job-starter]').forEach(b=>b.onclick=()=>{const box=$('#job-text');box.value=b.dataset.jobStarter;box.focus();});

}

function callSummary(calls){const blocked=calls.filter(c=>c.rule_category||c.status==='rejected').length;const handoff=calls.filter(c=>c.handoff).length;return `<section class="panel record-summary"><h2>这批记录的摘要</h2><p>当前筛选载入 ${calls.length} 条，其中 ${blocked} 条带拦截或规则信号，${handoff} 条已转人工。信号需复核，不代表已经认定违规。</p><div class="summary-channels">${['sales','self','phone'].map((c,i)=>`<span>${['展业','客户自助','电话中心'][i]} ${calls.filter(x=>x.channel===c).length} 条</span>`).join('')}</div><small>按实际载入记录计数；下方摘要截取原回答，不新增模型结论。</small></section>`;}

function permissionEditor(grants,products){const agents=state.portal?.agents||[],a=agents.find(x=>x.id===state.editAgent)||agents[0];if(!a)return header('已有授权','没有可编辑智能体');const roles=a.layer==='platform'?grants.filter(g=>g[0]==='platform'):grants;const pills=(name,items,selected)=>`<div class="grant-tools"><button type="button" data-grant-all="${name}">全选</button><button type="button" data-grant-clear="${name}">清空</button></div><div class="grant-pills">${items.map(([id,label])=>`<label class="grant-pill"><input type="checkbox" name="${name}" value="${esc(id)}" ${selected.includes(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div>`;return header('已有授权','修改后立即用于新请求。清空岗位授权会停止这些岗位调用，不会删除历史记录。')+`<div class="access-tabs"><button data-access-tab="query">查询记录</button><button data-access-tab="create">新建智能体</button><button data-access-tab="edit" aria-selected="true">已有授权</button></div><form id="edit-permissions" class="panel"><label class="field">选择智能体<select id="edit-agent-select">${agents.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><p>${esc(a.duty)}</p><fieldset class="grant-fieldset"><legend>谁可以用</legend>${pills('edit-duty',roles,a.duties||[])}</fieldset><fieldset class="grant-fieldset"><legend>可以查阅的资料</legend>${pills('edit-product',products.map(p=>[p.product,p.title]),a.products||[])}</fieldset><button class="btn primary">保存授权</button></form>`;}

function bindPlatform(){

  $$('[data-access-tab]').forEach(b=>b.onclick=()=>{state.grantTab=b.dataset.accessTab;render();});

  if($('#edit-agent-select'))$('#edit-agent-select').onchange=e=>{state.editAgent=e.target.value;render();};

  if($('#edit-permissions'))$('#edit-permissions').onsubmit=e=>{e.preventDefault();guard(async()=>{state.portal=await api('/dialog-agents/permissions',{id:$('#edit-agent-select').value,products:$$('[name=edit-product]:checked').map(x=>x.value),duties:$$('[name=edit-duty]:checked').map(x=>x.value)});state.grantTab='query';render();toast('授权已更新，历史回答保持原样');});};

  $$('[data-grant-all],[data-grant-clear]').forEach(b=>b.onclick=()=>{const name=b.dataset.grantAll||b.dataset.grantClear;$$(`[name="${name}"]`).forEach(x=>{x.checked=!!b.dataset.grantAll;});});

  if($('#call-search'))$('#call-search').onsubmit=e=>{e.preventDefault();state.callChannel=$('#call-channel').value;state.callQuery=$('#call-query').value.trim();guard(()=>navigate('platform'));};

  if($('#grant-agent'))$('#grant-agent').onsubmit=e=>{e.preventDefault();guard(async()=>{const duties=$$('[name=grant-duty]:checked').map(x=>x.value);const products=$$('[name=grant-product]:checked').map(x=>x.value);if(!duties.length)throw Error('请至少授权一条职责或客户自助');state.portal=await api('/dialog-agents',{name:$('#grant-name').value,duty:$('#grant-duty').value,audience:duties.includes('customer')?'user':'staff',products,duties});state.grantTab='query';render();toast('已保存');});};

}

function bindTalk(){

  const input=$('#chat-input');

  if(input&&state.draft){input.value=state.draft;state.draft='';}

  $$('[data-starter]').forEach(b=>b.onclick=()=>{input.value=b.dataset.starter;input.focus();});

  $$('[data-handoff]').forEach(b=>b.onclick=()=>{const next=state.portal.agents.find(a=>a.id===b.dataset.handoff);if(!next)return;state.chatAgent=next.id;state.conversation=null;state.messages=[];state.draft=next.starters[0]||'';render();});

  if($('#chat-form'))$('#chat-form').onsubmit=e=>{e.preventDefault();guard(async()=>{const button=$('#chat-send'), taskToken=state.token, text=input.value.trim();button.disabled=true;try{const reply=await api('/chat',{agent:state.chatAgent,message:text,conversation:state.conversation});if(taskToken!==state.token||state.page!=='talk')return;state.conversation=reply.conversation;state.messages=reply.messages;state.draft='';render();const thread=$('#thread');if(thread)thread.scrollTop=thread.scrollHeight;}finally{if($('#chat-send'))$('#chat-send').disabled=false;}});};

}

function workflowRoadmap(){return `<div class="workflow-roadmap">${[['knowledge','01','整理资料','分清事实、摘录与业务上下文'],['process','02','处理问题','选择查询或模型解释分支'],['sample','03','核对留存','还原问题、依据与处理'],['verification','04','准备验证','逐题留证，区分测试用途']].map(([page,n,title,desc])=>`<button data-page="${page}"><span>${n}</span><b>${title}</b><small>${desc}</small></button>`).join('')}</div>`;}

function dataClasses(){const n=(state.life?.products||[]).length;return `<section class="data-classes" aria-label="四类数据分工">${[

['条款事实','回答关键约定',`${n} 份结构化公开样例；数值须与条件、例外一同核对。`,'knowledge','查看事实'],

['资料摘录','提供语境与出处','已发布正文按段检索。相关片段不等于适用于这张保单。','knowledge','查看资料'],

['业务上下文','确定查询对象','虚构客户、保单与产品关联，仅用于确定范围，不决定责任。','library','查看关联'],

['运行治理','还原与复核','问题、答案、检查与追加意见。不能自动当成新的条款事实。','sample','查看留存']

].map(([title,job,desc,page,label],i)=>`<article><span>0${i+1} / ${job}</span><h2>${title}</h2><p>${desc}</p><button class="btn" data-data-link="${i}" data-page="${page}">${label} →</button></article>`).join('')}</section><p class="data-separation">教学利益表和评测题单独存放：前者不是报价，后者不能作为回答的知识来源。</p>`;}

const REQUEST_ROUTES={

 professional:{title:'专业条款查询',intro:'展业与客户自助选择“专业咨询”，明确产品后读取已授权的结构化字段。',steps:[['请求','入口、岗位、操作者与演示保单'],['校验','校验岗位与智能体、产品资料范围'],['查事实','产品明确时匹配数值、条件、例外与出处'],['返回','命中则用字段回答并附千问解释；不明则补充确认，缺失则提示核对'],['留存','记录最终答案、依据和处理状态']],model:'字段命中时调用一次千问，把查到的事实改写成通俗解释；数字和话术核对通过才附在字段回答后面，否则只用字段回答。需求情景查询不调用模型。'},

 general:{title:'普通咨询与岗位解释',intro:'普通咨询解释一般保险概念；岗位助手回答工作方法。不能声称核对了客户合同。',steps:[['请求','一般概念或岗位工作问题'],['分流','明显无关问题拒绝；合同事实转向授权资料'],['模型','调用一次已配置的千问'],['检查','检查返回是否可用；岗位解释还检查数字与风险表述'],['留存','区分接口成功与正文采用；失败明确提示']],model:'普通咨询不发送公司资料；一般岗位问题不附无关条款。两者检查机制不完全相同。'},

 grounded:{title:'岗位依据与中台快照',intro:'电话文字任务、具体岗位问题与中台解释依任务取证，不是一条固定的模型流水线。',steps:[['确定范围','核对角色、上下文和授权资料'],['取证','具体产品查事实与摘录；中台助手使用本机运行快照'],['分支','字段、摘录、澄清、风险提示或一次模型解释'],['检查','数字文本支持与风险表述检查；失败保留已有依据'],['留存','最终回答与模型原状态分开保存']],model:'最多一次模型调用；调用成功也可能不采用正文。数字支持检查不等于业务语义校验。'}

};

function processPage(){const key=state.processRoute||'professional',route=REQUEST_ROUTES[key];return header('一次问题，怎样走过中台','先看请求走哪条分支，再用真实留存核对发生了什么。')+`<div class="route-tabs" role="tablist" aria-label="查询分支">${Object.entries(REQUEST_ROUTES).map(([id,r])=>`<button role="tab" data-route="${id}" aria-selected="${key===id}">${r.title}</button>`).join('')}</div><section class="panel request-route" role="tabpanel"><h2>${route.title}</h2><p>${route.intro}</p><ol>${route.steps.map(([title,text],i)=>`<li><span>${i+1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join('')}</ol><p class="notice">${route.model}</p><div class="row"><button class="btn primary" data-desk="sales">去展业入口试一次</button><button class="btn" data-page="sample">查看调用轨迹</button></div></section><section class="panel"><h2>回答回来后，先留线索，再改知识</h2><div class="feedback-track"><span>调用编号定位</span><span>人工核对原因</span><span>回到正式资料</span><span>新版本复核发布</span><span>用原问题回归</span></div><p>已实现调用留存和追加复核；反馈不会自动改写条款。后续知识修订仍需要人工处理。</p></section><details class="panel"><summary>当前实现与机构落地的区别</summary><p>当前使用本机演示职责和虚构业务编号。真实账号、系统接口、适用条款历史版本匹配、机构数据授权仍需建设。上传文档不等于自动获得完整事实字段。</p></details>`;}

const VALIDATION_GROUPS={

 A:{name:'功能与流程',question:'入口提交、补充确认、转人工和追加复核是否按预期工作？',need:'需要操作步骤、预期结果、实际结果及截图或调用编号。下方调用可作案例，不能仅凭有记录判定流程通过。'},

 B:{name:'条款回答质量',question:'事实、条件与例外、引用支持和处理方式是否正确？',need:'需要固定题目、正式出处和人工判定。当前未登记独立复核真值，不计算准确率或引用支持率。'},

 C:{name:'输出检查与异常',question:'风险表述、无证据数字和模型异常能否恰当处理？',need:'需同时测试风险原词、正常表达及同义改写。规则命中不是人工真值，不能据此计算Precision或Recall。'},

 D:{name:'留痕与人工复核',question:'能否还原当时依据，并证明追加意见不改原回答？',need:'调用轨迹和处置可在下方查看；证明原回答未变仍需前后快照或对应回归检查。'}

};

function validationRows(){const g=state.validationGroup||'A';return (state.calls?.calls||[]).filter(c=>g==='B'?(c.excerpts||[]).length:g==='C'?(c.rule_category||['error','rejected','unavailable','refused','clarify'].includes(c.status)):g==='D'?c.review||Object.keys(c.trace||{}).length:true);}

function verificationPage(){const calls=state.calls?.calls||[],known=calls.filter(c=>Number.isInteger(c.trace?.model_call?.count)),unknown=calls.length-known.length,group=state.validationGroup||'A',rows=validationRows();const current=calls.filter(c=>c.trace?.program?.build===state.data.build).length;return header('验证与证据','把演示、工程回归和独立质量验证分开。每个结论都要找到对应材料。')+`<section class="validation-banner"><div><span>当前运行版本</span><h2>${esc(state.data.version)} · ${esc(state.data.build)}</h2><p>当前载入 ${calls.length} 条历史渠道记录，其中 ${current} 条明确登记为当前构建；其余不自动归入本轮测试。</p></div><span class="tag amber">本轮独立验证尚未登记</span></section><div class="validation-kinds"><article><h3>演示案例</h3><p>用来讲清操作和输出，不计专业准确率。</p></article><article><h3>开发与回归</h3><p>验证指定行为。历史结果须核对版本，不能挪作本轮成绩。</p></article><article><h3>独立验证</h3><p>冻结题目、标准答案与评分规则，再由复核者逐题判定。</p></article></div><div class="route-tabs validation-tabs" role="tablist">${Object.entries(VALIDATION_GROUPS).map(([id,g])=>`<button role="tab" data-validation-group="${id}" aria-selected="${id===group}">${id} · ${g.name}</button>`).join('')}</div><section class="panel"><h2>${VALIDATION_GROUPS[group].question}</h2><p>${VALIDATION_GROUPS[group].need}</p><div class="validation-missing"><b>本轮需要补齐</b><span>冻结方案与题目</span><span>标准答案与原文</span><span>独立复核及分歧记录</span><span>当前版本逐题输出</span></div><div class="row"><button class="btn" id="export-plan">下载测试方案待填稿</button><button class="btn" id="export-evidence">导出当前历史记录 CSV</button></div><p class="subtle">导出不运行测试、不调用模型，也不自动生成判分或把历史记录变成独立题集。</p></section><section class="panel"><h2>可查的记录 · ${rows.length} 条</h2><p>从当前载入集合筛选，包含虚构预置记录，不是验证通过数。只有明确登记的调用次数才能合计。</p><div class="trace-totals"><span>有精确次数 ${known.length} 条</span><span>模型调用 ${known.reduce((n,c)=>n+c.trace.model_call.count,0)} 次</span><span>次数未知 ${unknown} 条</span><span>采用模型正文 ${calls.filter(c=>c.adopted===true||c.adopted===1).length} 条</span></div><div class="validation-records">${rows.map(c=>`<button data-ops-call="${esc(c.id)}"><span><b>${esc(c.text||'未登记问题')}</b><small>${esc(c.channel_name||c.channel)} · ${esc(c.id)} · ${esc(c.trace?.program?.build||'构建未登记')} · ${c.fictional?'虚构预置记录':'本机渠道调用'}</small></span><span>${esc(c.status)}<br>${c.review?'已有追加意见':'未处置'} →</span></button>`).join('')||'<p>当前集合没有对应记录。空白不代表全部通过。</p>'}</div><p class="subtle">${esc(state.calls?.scope||'当前接口返回的记录，未加载项不计入。')}</p></section>`;}

function downloadLocal(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}

function evidenceCSV(){const fields=['case_id（待编制）','数据分组','调用编号','调用时间','记录构建','导出时构建','入口','问题','最终回答','依据','产品及版本','模型状态','模型调用次数','采用模型正文','耗时ms','风险类别','处置意见','事实正确（待判）','条件例外（待判）','引用支持（待判）','复核者（待填）'];const rows=(state.calls?.calls||[]).map(c=>['','历史运行记录，未冻结为独立测试',c.id,c.created,c.trace?.program?.build||'未登记',state.data.build,c.channel_name||c.channel,c.text,c.answer,JSON.stringify(c.excerpts||[]),c.trace?.version_label||'',c.status,c.trace?.model_call?.count??'未知',c.adopted?'是':'否',c.ms??'未知',c.rule_category||'',c.review?JSON.stringify(c.review):'','','','','']);return '\ufeff'+[fields,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');}

function exportEvidence(){downloadLocal('历史调用记录-待编题复核.csv',evidenceCSV(),'text/csv;charset=utf-8');}

function exportPlan(){downloadLocal('测试方案-待冻结.md',`# 测试方案（待填写，尚未冻结）\n\n生成时间：${new Date().toISOString()}\n当前程序：${state.data.version} / ${state.data.build}\n\n本文件只是待填稿，不表示已跑测试或完成独立验证。\n\n- 负责人、冻结时间、代码快照或哈希：待填写\n- 数据库副本与运行环境：待填写\n- 模型名称、配置、测试批次：待填写；禁止附密钥\n- 题目来源、产品版本、数量、是否用于开发：待填写\n- 标准答案、条件、例外、原文出处：逐题填写\n- 两名复核者及分歧裁定；只有一人则如实说明：待填写\n- 评分分母、失败/超时/拒答/转人工处理：测试前固定\n- 功能流程、回答质量、异常处理、留痕复核：分组报告\n- 逐题输出与截图、耗时、实际调用、账单来源：待记录\n\n保留所有失败题。修复后另记版本和回归，不覆盖原始结果。\n`,'text/markdown;charset=utf-8');}



const params=new URLSearchParams(location.search);

const entryDesk=params.get('desk');

const entryPage=params.get('page')||'';

guard(async()=>{

  if(entryDesk&&['sales','wechat','phone','platform','legacy'].includes(entryDesk)){await enterDesk(entryDesk,entryPage);return;}

  location.replace('/');

});

