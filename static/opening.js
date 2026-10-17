/* 保溯 · 开场页（REQ-060）
   一枚保单硬币即是中台：正面是保单印章（保险），背面是智能体节点（智能）。
   外圈粒子是围绕中台的调用，偶尔有一颗落入硬币。点击“了解中台结构”后，
   硬币转正、放平，落成展示页机制图的平台层。
   服务带 CSP：不使用内联脚本和 element.style，只画 canvas、切换类名。 */
(function(){
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ body.classList.add('ready'); }); });

  var canvas = document.querySelector('.coin-canvas');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, R = 0, CX = 0, CY = 0, front = null, back = null;
  var TAU = Math.PI * 2;
  var SANS = '"SF Pro Display","Segoe UI","Helvetica Neue",Arial,sans-serif';
  var SERIF = '"Songti SC","STSong","Noto Serif SC","SimSun",serif';

  /* ---------- 硬币贴图（每次尺寸变化重绘一次） ---------- */
  function face(isFront){
    var s = Math.ceil(R * 2), c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d'), o = s / 2, r = R, d = Math.max(1, r * .007);

    var base = g.createRadialGradient(o - r * .38, o - r * .42, r * .04, o, o, r);
    base.addColorStop(0, '#fbf2d6'); base.addColorStop(.42, '#dcc187');
    base.addColorStop(.82, '#a78642'); base.addColorStop(1, '#6a5122');
    g.fillStyle = base; g.beginPath(); g.arc(o, o, r, 0, TAU); g.fill();

    g.save(); g.beginPath(); g.arc(o, o, r, 0, TAU); g.clip();
    g.globalAlpha = .07; g.strokeStyle = '#3b2a0b'; g.lineWidth = Math.max(1, r * .003);
    for (var k = r * .08; k < r * .9; k += r * .016){ g.beginPath(); g.arc(o, o, k, 0, TAU); g.stroke(); }
    g.restore(); g.globalAlpha = 1;

    function emboss(path, lw, fill){
      g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      [[d, d, 'rgba(66,45,10,.6)'], [-d * .8, -d * .8, 'rgba(255,250,232,.8)'], [0, 0, '#c6a55e']].forEach(function(p){
        g.save(); g.translate(p[0], p[1]);
        if (fill){ g.fillStyle = p[2]; path(); g.fill(); } else { g.strokeStyle = p[2]; path(); g.stroke(); }
        g.restore();
      });
    }
    function ring(rad, lw){ emboss(function(){ g.beginPath(); g.arc(o, o, rad, 0, TAU); }, lw); }
    function ringText(text, rad, size){
      g.font = '600 ' + size + 'px ' + SANS; g.textAlign = 'center'; g.textBaseline = 'middle';
      var chars = text.split(''), ws = chars.map(function(ch){ return g.measureText(ch).width; });
      var sum = ws.reduce(function(a, b){ return a + b; }, 0), gap = (TAU * rad - sum) / chars.length, a = -Math.PI / 2;
      chars.forEach(function(ch, i){
        var step = (ws[i] + gap) / rad; a += step / 2;
        [[d, d, 'rgba(66,45,10,.6)'], [-d * .7, -d * .7, 'rgba(255,250,232,.75)'], [0, 0, '#b8974f']].forEach(function(p){
          g.save(); g.translate(o + Math.cos(a) * rad + p[0], o + Math.sin(a) * rad + p[1]); g.rotate(a + Math.PI / 2);
          g.fillStyle = p[2]; g.fillText(ch, 0, 0); g.restore();
        });
        a += step / 2;
      });
    }
    function label(text, y, size){
      g.font = '600 ' + size + 'px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle';
      [[d, d, 'rgba(66,45,10,.6)'], [-d * .7, -d * .7, 'rgba(255,250,232,.8)'], [0, 0, '#b8974f']].forEach(function(p){
        g.fillStyle = p[2]; g.fillText(text, o + p[0], y + p[1]);
      });
    }

    ring(r * .955, r * .022);
    g.save();
    for (var t = 0; t < 120; t++){
      var a = t / 120 * TAU;
      g.strokeStyle = t % 2 ? 'rgba(70,48,12,.35)' : 'rgba(255,246,220,.35)';
      g.lineWidth = Math.max(1, r * .004);
      g.beginPath(); g.moveTo(o + Math.cos(a) * r * .975, o + Math.sin(a) * r * .975); g.lineTo(o + Math.cos(a) * r * .995, o + Math.sin(a) * r * .995); g.stroke();
    }
    g.restore();
    ring(r * .72, r * .012);
    ring(r * .68, r * .005);
    ringText(isFront ? 'BAOSU · TRACEABLE INSURANCE · CLAUSE · EVIDENCE · ' : 'AGENTS · KNOWLEDGE · PLUGINS · DIALOG · ANALYTICS · ', r * .835, r * .072);

    var cy = o - r * .07;
    if (isFront){
      var sh = r * .34;
      emboss(function(){
        g.beginPath(); g.moveTo(o, cy - sh);
        g.bezierCurveTo(o + sh * .5, cy - sh * .8, o + sh * .78, cy - sh * .82, o + sh * .82, cy - sh * .74);
        g.lineTo(o + sh * .82, cy - sh * .02);
        g.bezierCurveTo(o + sh * .82, cy + sh * .56, o + sh * .36, cy + sh * .9, o, cy + sh * 1.04);
        g.bezierCurveTo(o - sh * .36, cy + sh * .9, o - sh * .82, cy + sh * .56, o - sh * .82, cy - sh * .02);
        g.lineTo(o - sh * .82, cy - sh * .74);
        g.bezierCurveTo(o - sh * .78, cy - sh * .82, o - sh * .5, cy - sh * .8, o, cy - sh);
        g.closePath();
      }, r * .026);
      emboss(function(){ g.beginPath(); g.moveTo(o - sh * .36, cy + sh * .06); g.lineTo(o - sh * .07, cy + sh * .36); g.lineTo(o + sh * .42, cy - sh * .3); }, r * .04);
      label('保 溯', o + r * .45, r * .125);
    } else {
      var nr = r * .3, pts = [[o, cy]];
      for (var n = 0; n < 6; n++){ var an = -Math.PI / 2 + n / 6 * TAU; pts.push([o + Math.cos(an) * nr, cy + Math.sin(an) * nr]); }
      emboss(function(){
        g.beginPath();
        for (var i = 1; i <= 6; i++){ g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[i][0], pts[i][1]); }
        for (var j = 1; j <= 6; j++){ var nx = j % 6 + 1; g.moveTo(pts[j][0], pts[j][1]); g.lineTo(pts[nx][0], pts[nx][1]); }
      }, r * .012);
      pts.forEach(function(p, i){ emboss(function(){ g.beginPath(); g.arc(p[0], p[1], i ? r * .045 : r * .07, 0, TAU); }, 0, true); });
      label('智能体中台', o + r * .45, r * .105);
    }
    return c;
  }

  /* ---------- 轨道粒子：围绕中台的调用 ---------- */
  var dots = [];
  for (var i = 0; i < 96; i++){
    dots.push({a: Math.random() * TAU, rad: 1.32 + Math.random() * .85, yj: (Math.random() - .5) * .16, sp: (.05 + Math.random() * .08) * (Math.random() < .5 ? 1 : .7), sz: .5 + Math.random() * 1.3, gold: Math.random() < .3});
  }
  var sparks = [], lastSpark = 0, flash = 0;

  function resize(){
    var box = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(box.width * DPR)); H = Math.max(1, Math.round(box.height * DPR));
    canvas.width = W; canvas.height = H;
    R = Math.min(W, H) * .25; CX = W / 2; CY = H * .48;
    front = face(true); back = face(false);
  }

  function project(dot){
    var x = CX + Math.cos(dot.a) * dot.rad * R, y = CY + Math.sin(dot.a) * dot.rad * R * .26 + dot.yj * R;
    return {x: x, y: y, depth: Math.sin(dot.a)};
  }

  function drawOrbits(isFront, fade){
    ctx.save(); ctx.strokeStyle = 'rgba(217,239,188,' + (.09 * fade) + ')'; ctx.lineWidth = DPR;
    [1.5, 1.98].forEach(function(k){
      ctx.beginPath(); ctx.ellipse(CX, CY, k * R, k * R * .26, 0, isFront ? 0 : Math.PI, isFront ? Math.PI : TAU); ctx.stroke();
    });
    ctx.restore();
  }

  function drawDots(isFront, fade){
    var pts = [];
    dots.forEach(function(dot){ var p = project(dot); if ((p.depth >= 0) === isFront){ p.dot = dot; pts.push(p); } });
    ctx.save();
    ctx.lineWidth = DPR * .8;
    for (var i = 0; i < pts.length; i++){
      for (var j = i + 1; j < pts.length; j++){
        var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dd = dx * dx + dy * dy, lim = R * .32;
        if (dd < lim * lim){ ctx.strokeStyle = 'rgba(217,239,188,' + ((1 - Math.sqrt(dd) / lim) * .14 * fade) + ')'; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
      }
    }
    pts.forEach(function(p){
      var alpha = (.25 + .6 * (p.depth + 1) / 2) * fade;
      ctx.fillStyle = p.dot.gold ? 'rgba(240,213,140,' + alpha + ')' : 'rgba(217,239,188,' + alpha + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.dot.sz * DPR * (1 + p.depth * .35), 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  function drawCoin(theta, vert, scale, lift){
    var cosT = Math.cos(theta), sinT = Math.sin(theta);
    var a = R * scale * Math.max(.02, Math.abs(cosT)), b = R * scale * vert;
    var cy = CY + lift, T = R * scale * .085;
    var dx = T * sinT, dy = T * Math.sqrt(Math.max(0, 1 - vert * vert));

    var glow = ctx.createRadialGradient(CX, cy, R * .2, CX, cy, R * 2.1);
    glow.addColorStop(0, 'rgba(232,210,154,' + (.12 + flash * .14) + ')'); glow.addColorStop(1, 'rgba(232,210,154,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    var shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * scale);
    shadow.addColorStop(0, 'rgba(0,0,0,.5)'); shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(CX, cy + R * 1.25 * vert + dy); ctx.scale(1, .2);
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, R * scale, 0, TAU); ctx.fill(); ctx.restore();

    var N = 16;
    for (var s = N; s >= 1; s--){
      var k = s / N;
      ctx.fillStyle = s % 2 ? '#7d5f27' : '#9c7b3a';
      ctx.beginPath(); ctx.ellipse(CX - dx * k, cy + dy * k, a, b, 0, 0, TAU); ctx.fill();
    }

    ctx.save();
    ctx.beginPath(); ctx.ellipse(CX, cy, a, b, 0, 0, TAU); ctx.clip();
    ctx.translate(CX, cy); ctx.scale(a / R, b / R);
    ctx.drawImage(cosT >= 0 ? front : back, -R, -R, R * 2, R * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    var p = .5 + .62 * Math.sin(theta * 1.15 + .8);
    var sweep = ctx.createLinearGradient(CX - a, cy - b, CX + a, cy + b);
    sweep.addColorStop(Math.max(0, Math.min(1, p - .22)), 'rgba(255,255,255,0)');
    sweep.addColorStop(Math.max(0, Math.min(1, p)), 'rgba(255,250,235,.42)');
    sweep.addColorStop(Math.max(0, Math.min(1, p + .22)), 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = sweep; ctx.fillRect(CX - a, cy - b, a * 2, b * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(20,12,2,' + ((1 - Math.abs(cosT)) * .38) + ')'; ctx.fillRect(CX - a, cy - b, a * 2, b * 2);
    ctx.restore();

    ctx.save(); ctx.strokeStyle = 'rgba(255,244,214,' + (.42 + flash * .5) + ')'; ctx.lineWidth = DPR * (1.1 + flash * 1.6);
    ctx.beginPath(); ctx.ellipse(CX, cy, a, b, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }

  function drawSparks(now, fade){
    sparks = sparks.filter(function(sp){
      var t = (now - sp.t0) / 900;
      if (t >= 1){ flash = 1; return false; }
      var e = t * t * (3 - 2 * t);
      var x = sp.x + (CX - sp.x) * e, y = sp.y + (CY - sp.y) * e;
      var tx = sp.x + (CX - sp.x) * Math.max(0, e - .18), ty = sp.y + (CY - sp.y) * Math.max(0, e - .18);
      var grad = ctx.createLinearGradient(tx, ty, x, y);
      grad.addColorStop(0, 'rgba(232,210,154,0)'); grad.addColorStop(1, 'rgba(250,236,196,' + (.85 * fade) + ')');
      ctx.strokeStyle = grad; ctx.lineWidth = DPR * 1.4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,246,220,' + fade + ')'; ctx.beginPath(); ctx.arc(x, y, DPR * 2, 0, TAU); ctx.fill();
      return true;
    });
  }

  /* ---------- 状态与循环 ---------- */
  var paused = false, clock = 0, last = 0, raf = 0;
  var theta = .35, tilt = 0, tiltGoal = 0, nudge = 0, nudgeGoal = 0;
  var leaving = null;

  function frame(now){
    raf = 0;
    var dt = last ? Math.min(50, now - last) : 16; last = now;
    if (!paused) clock += dt;
    tilt += (tiltGoal - tilt) * .06; nudge += (nudgeGoal - nudge) * .06;
    flash *= .93;

    var t = clock / 1000, vert = Math.cos(tilt), scale = 1, lift = Math.sin(t * .9) * R * .025, fade = 1;
    var th = reduce ? .35 : .35 + t * .48 + nudge;
    if (!reduce && !paused) dots.forEach(function(dot){ dot.a += dot.sp * dt / 1000; });

    if (leaving){
      var p = Math.min(1, (now - leaving.t0) / 1150), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      th = leaving.from + (leaving.to - leaving.from) * e;
      vert = vert + (.36 - vert) * e; scale = 1 + .4 * e; lift = lift * (1 - e) + R * .1 * e; fade = 1 - e;
      if (p >= 1 && !leaving.done){ leaving.done = true; setTimeout(function(){ location.href = leaving.href; }, 120); }
    } else if (!reduce && !paused && now - lastSpark > 1500){
      lastSpark = now;
      var src = project(dots[Math.floor(Math.random() * dots.length)]);
      sparks.push({x: src.x, y: src.y, t0: now});
    }
    theta = th;

    ctx.clearRect(0, 0, W, H);
    drawOrbits(false, fade); drawDots(false, fade);
    drawCoin(th, vert, scale, lift);
    drawSparks(now, fade);
    drawOrbits(true, fade); drawDots(true, fade);

    if (!reduce && !document.hidden && (!paused || leaving || Math.abs(tiltGoal - tilt) > .001)) raf = requestAnimationFrame(frame);
  }
  function kick(){ if (!raf) raf = requestAnimationFrame(frame); }

  resize(); kick();
  var resizeTimer = 0;
  window.addEventListener('resize', function(){ clearTimeout(resizeTimer); resizeTimer = setTimeout(function(){ resize(); kick(); }, 120); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden){ last = 0; kick(); } });

  if (!reduce && window.matchMedia('(pointer:fine)').matches){
    window.addEventListener('pointermove', function(e){
      tiltGoal = (e.clientY / window.innerHeight - .5) * .5;
      nudgeGoal = (e.clientX / window.innerWidth - .5) * .7;
      kick();
    }, {passive: true});
  }

  var pauseBtn = document.querySelector('[data-motion-pause]');
  pauseBtn.addEventListener('click', function(){
    paused = !paused;
    body.classList.toggle('motion-paused', paused);
    pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    pauseBtn.setAttribute('aria-label', paused ? '播放动画' : '暂停动画');
    pauseBtn.title = paused ? '播放动画' : '暂停动画';
    pauseBtn.setAttribute('aria-pressed', String(paused));
    last = 0; kick();
  });

  var start = document.querySelector('.opening-start');
  start.addEventListener('click', function(e){
    try { sessionStorage.setItem('baosu-arrive', '1'); } catch (err) {}
    if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (leaving) return;
    var turns = Math.round(theta / TAU) * TAU;
    if (turns < theta - .6) turns += TAU;
    leaving = {t0: performance.now(), from: theta, to: turns, href: start.href, done: false};
    paused = false; body.classList.add('leaving'); kick();
  });
  window.addEventListener('pageshow', function(e){ if (e.persisted){ leaving = null; body.classList.remove('leaving'); last = 0; kick(); } });
})();
