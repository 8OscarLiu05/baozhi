/* REQ-049 四层架构动态机制图。只描述原型已实现、演示或预留的能力，不读取接口、不冒充实时数据。 */
(() => {
  'use strict';
  const section = document.querySelector('#architecture');
  const stage = document.querySelector('#architecture-stage');
  const toggle = document.querySelector('#architecture-toggle');
  const detail = document.querySelector('#architecture-detail');
  const play = document.querySelector('#architecture-play');
  if (!section || !stage || !toggle || !detail || !play) return;

  const STATUS = {live: '已实现', demo: '本机演示', reserved: '预留接口'};
  const LAYERS = {
    1: {n: '01', title: '基础能力层', en: 'FOUNDATION', role: ['model', '模型接入'], copy: '接入千问，用于理解问题和组织解释。是否调用按路径决定：普通咨询一次，专业咨询不调用，岗位依据最多一次且正文可以不采用。',
      note: '模型是底座，不是中台本身。', link: ['#trace', '查看证据'],
      nodes: [['千问', 'live', '已接入'], ['豆包', 'reserved', '预留'], ['DeepSeek', 'reserved', '预留'], ['自然语言理解', 'live'], ['知识问答', 'live'], ['内容生成', 'live']]},
    2: {n: '02', title: '平台能力层', en: 'AGENT PLATFORM', role: ['core', '核心 · 智能体中台'], copy: '中台核心之一：管理智能体、资料版本、查询工具、对话记录和效果检查。',
      note: '每次查询都留下可回看的记录。', link: ['/index.html?desk=platform', '打开保溯平台'],
      nodes: [['智能体开发', 'live', '广场 · 新建授权'], ['知识库管理', 'live', '条款字段 · 版本'], ['插件集成', 'demo', '字段查询 · 合规词表'], ['对话管理', 'live', '会话 · 调用留痕'], ['效果分析', 'live', '抽检 · 调用留存']]},
    3: {n: '03', title: '应用能力层', en: 'APPLICATIONS', role: ['core', '核心 · 智能体中台'], copy: '中台核心之二：问答、客服、培训和外呼四类智能体，按九条岗位职责开放。',
      note: '岗位决定能用哪些资料与工具。', link: ['/index.html?desk=platform&page=plaza', '查看智能体广场'],
      nodes: [['智能问答类', 'live'], ['客服类', 'live'], ['培训类', 'live'], ['外呼类', 'demo', '只出草稿']],
      groups: [['智能问答类', ['营销展业', '核保作业', '理赔作业', '平台与知识运营']], ['客服类', ['客户服务', '电话坐席']], ['培训类', ['员工培训']], ['外呼类', ['电话外呼', '通话质检']]]},
    4: {n: '04', title: '系统集成层', en: 'INTEGRATION', role: ['demo', '演示接入'], copy: '演示接入：展业、客户自助和电话中心把问题交给同一个中台接口，用来展示中台怎样被调用。均为本机演示，未对接真实展业 APP、微信或电话。',
      note: '三个业务端是调用方，不是核心。', link: ['/index.html?desk=sales', '进入业务端'],
      nodes: [['代理人展业', 'demo'], ['客户自助', 'demo'], ['电话中心', 'demo', '外呼 · 坐席 · 质检'], ['统一中台接口', 'live']]}
  };
  const ORDER = [1, 2, 3, 4];
  const TOUR = [2, 3, 4, 1];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...section.querySelectorAll('.arch-tab')];
  const caption = stage.querySelector('.arch-caption');
  const captionText = caption.querySelector('span');

  /* ---------- 构建三维场景 ---------- */
  const W = 400, H = 224;
  const slots = n => {
    const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols;
      const gx = (W - 90) / cols, gy = (H - 70) / rows;
      out.push([((c - (inRow - 1) / 2) * gx), ((r - (rows - 1) / 2) * gy + 8)]);
    }
    return out;
  };
  const world = document.createElement('div');
  world.className = 'arch-world';
  ORDER.forEach((id, i) => {
    const L = LAYERS[id], plate = document.createElement('div');
    plate.className = 'arch-plate';
    plate.dataset.layer = id;
    plate.style.setProperty('--i', i);
    plate.style.setProperty('--pd', `${i * 60}ms`);
    const pos = slots(L.nodes.length);
    plate.innerHTML = '<span class="arch-rim"></span>' + L.nodes.map(([name, status, sub], k) =>
      `<div class="arch-node"><span class="arch-socket"></span><span class="arch-chip ${status}"><span class="arch-dot ${status}"></span>${esc(name)}${status === 'reserved' ? '<small>预留</small>' : ''}</span></div>`).join('') +
      `<div class="arch-tag"><i>${L.n} · ${L.en}</i><b>${L.title}</b><em class="arch-role ${L.role[0]}">${L.role[1]}</em></div>` +
      (id === 4 ? '<div class="arch-core"><b><img src="/logo.svg" alt="">保溯 · 智能体中台</b><small>点击展开 · 或等待自动演示</small></div>' : '');
    [...plate.querySelectorAll('.arch-node')].forEach((node, k) => {
      node.style.setProperty('--x', `${pos[k][0]}px`);
      node.style.setProperty('--y', `${pos[k][1]}px`);
      node.style.setProperty('--d', `${(i * L.nodes.length + k) * 28}ms`);
    });
    plate.addEventListener('click', event => { event.stopPropagation(); userFocus(id); });
    world.appendChild(plate);
  });
  [[-W / 2 + 18, -H / 2 + 18], [W / 2 - 18, -H / 2 + 18], [-W / 2 + 18, H / 2 - 18], [W / 2 - 18, H / 2 - 18]].forEach(([x, y]) => {
    const p = document.createElement('span');
    p.className = 'arch-pillar';
    p.style.left = `${x}px`; p.style.top = `${y}px`;
    world.appendChild(p);
  });
  const beam = document.createElement('span');
  beam.className = 'arch-beam';
  [0, .65, 1.3, 1.95].forEach(k => { const dot = document.createElement('i'); dot.style.setProperty('--k', `${k}s`); beam.appendChild(dot); });
  world.appendChild(beam);
  stage.prepend(world);
  const plates = [...world.querySelectorAll('.arch-plate')];
  const nodes = [...world.querySelectorAll('.arch-node')];

  /* ---------- 状态 ---------- */
  let phase = 'assembled', active = 0, autoplay = !motion.matches, visible = false, timer = 0, runId = 0;
  const wait = ms => new Promise(resolve => { clearTimeout(timer); timer = setTimeout(resolve, ms); });

  function scatterSeeds() {
    nodes.forEach(node => {
      const a = Math.random() * Math.PI * 2, r = 160 + Math.random() * 220;
      node.style.setProperty('--sx', `${Math.cos(a) * r}px`);
      node.style.setProperty('--sy', `${Math.sin(a) * r}px`);
      node.style.setProperty('--sz', `${(Math.random() - .3) * 360}px`);
      node.style.setProperty('--sr', `${(Math.random() - .5) * 140}deg`);
    });
    plates.forEach(p => p.style.setProperty('--pr', `${(Math.random() - .5) * 24}deg`));
  }
  function setPhase(next) {
    phase = next;
    stage.dataset.phase = next;
    stage.dataset.expanded = String(next !== 'assembled');
    toggle.setAttribute('aria-expanded', String(next !== 'assembled'));
    toggle.firstChild.textContent = next === 'assembled' ? '展开四层架构 ' : '收拢为机制图 ';
    if (next !== 'scatter') plates.forEach(p => p.style.setProperty('--pr', '0deg'));
    updateCaption();
  }
  function updateCaption() {
    const label = phase === 'assembled' ? '机制图' : phase === 'scatter' ? '空间重组中' : active ? `四层结构 · ${LAYERS[active].n} ${LAYERS[active].title}` : '四层结构';
    captionText.textContent = `${autoplay ? '自动演示' : '手动查看'} · ${label}`;
    caption.classList.toggle('is-paused', !autoplay);
  }
  async function expand(id) {
    const run = runId;
    if (phase === 'exploded') return;
    if (motion.matches) { setPhase('exploded'); return; }
    scatterSeeds();
    setPhase('scatter');
    await wait(620);
    if (run !== runId) return;
    setPhase('exploded');
  }
  async function collapse() {
    const run = runId;
    focus(0);
    if (motion.matches) { setPhase('assembled'); return; }
    scatterSeeds();
    setPhase('scatter');
    await wait(480);
    if (run !== runId) return;
    setPhase('assembled');
  }
  function describe(id) {
    const L = LAYERS[id], accent = getComputedStyle(tabs.find(t => t.dataset.layer === String(id))).getPropertyValue('--accent');
    const mods = L.groups
      ? `<div class="arch-groups">${L.groups.map(([g, items]) => `<div><b>${esc(g)}</b>${items.map(s => `<span>${esc(s)}</span>`).join('')}</div>`).join('')}</div>`
      : `<ul class="arch-mods">${L.nodes.map(([name, status, sub]) => `<li><span class="arch-dot ${status}"></span>${esc(name)}<small>${esc(sub || STATUS[status])}</small></li>`).join('')}</ul>`;
    const html = `<div class="arch-detail-head"><i>${L.n}</i><b>${L.title}</b><span>${L.en}</span></div><p>${L.copy}</p>${mods}<div class="arch-detail-foot"><small>${L.note}</small><a href="${L.link[0]}">${L.link[1]} ↗</a></div>`;
    detail.style.setProperty('--accent', accent);
    if (motion.matches) { detail.innerHTML = html; return; }
    detail.classList.add('is-swapping');
    setTimeout(() => { detail.innerHTML = html; detail.classList.remove('is-swapping'); }, 180);
  }
  function focus(id, dur = 0) {
    active = id;
    plates.forEach(p => p.classList.toggle('is-active', Number(p.dataset.layer) === id));
    if (id) stage.dataset.active = id; else delete stage.dataset.active;
    tabs.forEach(t => {
      const on = Number(t.dataset.layer) === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on || (!id && t.dataset.layer === '4') ? 0 : -1;
      t.classList.remove('is-timing');
      if (on && dur) { t.style.setProperty('--dur', `${dur}ms`); void t.offsetWidth; t.classList.add('is-timing'); }
    });
    if (id) describe(id);
    updateCaption();
  }

  /* ---------- 自动循环：机制图 → 散开 → 聚合 → 逐层讲解 → 收拢 ---------- */
  async function loop() {
    const run = ++runId;
    const alive = () => run === runId && autoplay && visible;
    while (alive()) {
      if (phase !== 'assembled') { await collapse(); if (!alive()) return; await wait(900); }
      if (!alive()) return;
      await wait(1800); if (!alive()) return;
      await expand(); if (!alive()) return;
      await wait(1300); if (!alive()) return;
      for (const id of TOUR) { focus(id, 2900); await wait(2900); if (!alive()) return; }
      focus(0); await wait(1500); if (!alive()) return;
    }
  }
  function stop() { runId++; clearTimeout(timer); tabs.forEach(t => t.classList.remove('is-timing')); }
  function setAutoplay(value) {
    autoplay = value && !motion.matches;
    play.setAttribute('aria-pressed', String(!autoplay));
    play.setAttribute('aria-label', autoplay ? '暂停架构自动演示' : '继续架构自动演示');
    play.firstChild.textContent = autoplay ? 'Ⅱ' : '▶';
    play.querySelector('small').textContent = autoplay ? '自动演示中' : '已暂停';
    detail.setAttribute('aria-live', autoplay ? 'off' : 'polite');
    stop();
    updateCaption();
    if (autoplay && visible) loop();
  }
  async function userFocus(id) {
    setAutoplay(false);
    if (phase !== 'exploded') await expand();
    focus(id);
  }

  toggle.addEventListener('click', () => {
    setAutoplay(false);
    if (phase === 'assembled') expand().then(() => { if (!active) focus(4); });
    else collapse();
  });
  play.addEventListener('click', () => setAutoplay(!autoplay));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => userFocus(Number(tab.dataset.layer)));
    tab.addEventListener('keydown', event => {
      const keys = {ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1};
      if (!(event.key in keys)) return;
      event.preventDefault();
      const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
      next.focus(); userFocus(Number(next.dataset.layer));
    });
  });

  /* 指针视差：在 JS 中平滑插值，芯片的反向旋转与世界旋转同帧更新 */
  const base = {rx: 58, rz: -38};
  const cur = {...base}, goal = {...base};
  let raf = 0;
  const tick = () => {
    cur.rx += (goal.rx - cur.rx) * .12; cur.rz += (goal.rz - cur.rz) * .12;
    section.style.setProperty('--rx', `${cur.rx.toFixed(2)}deg`);
    section.style.setProperty('--rz', `${cur.rz.toFixed(2)}deg`);
    raf = Math.abs(goal.rx - cur.rx) + Math.abs(goal.rz - cur.rz) > .05 ? requestAnimationFrame(tick) : 0;
  };
  const steer = () => { if (!raf) raf = requestAnimationFrame(tick); };
  stage.addEventListener('pointermove', event => {
    if (motion.matches) return;
    const box = stage.getBoundingClientRect();
    goal.rx = base.rx + ((event.clientY - box.top) / box.height - .5) * -10;
    goal.rz = base.rz + ((event.clientX - box.left) / box.width - .5) * 16;
    steer();
  });
  stage.addEventListener('pointerleave', () => { goal.rx = base.rx; goal.rz = base.rz; steer(); });
  stage.addEventListener('click', () => { if (phase === 'assembled') { setAutoplay(false); expand().then(() => focus(4)); } });

  /* 只在可见时播放；离开视口、切走标签页时停止 */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && autoplay) loop(); else stop();
    }, {threshold: .35}).observe(stage);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (autoplay && visible) loop();
  });
  motion.addEventListener('change', () => { if (motion.matches) setAutoplay(false); });

  /* 从开场硬币进入：硬币放平后，在这里落成紧凑的中台机制图 */
  let arrived = false;
  try { arrived = sessionStorage.getItem('baosu-arrive') === '1'; sessionStorage.removeItem('baosu-arrive'); } catch (err) {}
  if (arrived && !motion.matches) {
    stage.animate([{opacity: 0, transform: 'translateY(-40px) scale(1.18)'}, {opacity: 1, transform: 'none'}], {duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)'});
    section.querySelector('.arch-copy').animate([{opacity: 0, transform: 'translateY(18px)'}, {opacity: 1, transform: 'none'}], {duration: 900, delay: 350, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards'});
  }

  setPhase('assembled');
  setAutoplay(autoplay);
})();
