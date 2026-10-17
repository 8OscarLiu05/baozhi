/* 工作台动效层（motion.js）
   挂在 index.html 的 SPA 上；无外部依赖。
   只在「换页」时运行进场（Operate 模式：不做整页编排），
   状态更新（提交、检索、筛选）不重播动画。 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var app = function () { return document.getElementById('app'); };

  /* ---------- 页面签名：只在换页时进场 ---------- */
  function pageSignature() {
    var root = app();
    if (!root) return '';
    var desk = '';
    var first = root.firstElementChild;
    if (first && first.className) {
      var m = /desk-([a-z]+)/.exec(first.className);
      if (m) desk = m[1];
    }
    var h1 = root.querySelector('.heading h1, .desk-toolbar b, .crumb b');
    return desk + '|' + (h1 ? h1.textContent.trim() : '');
  }

  /* ---------- 显现：换页后把当屏内容轻轻带出 ---------- */
  var revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }) : null;

  function revealIn(root) {
    var targets = root.querySelectorAll(
      '.content > .panel, .content > .stats, .content > .search-form, .content > .grid2 > *, .content > .grid3 > *, ' +
      '.layer-board article, .duty-board, .plat-hero, .gate-card, .guide-grid article, .sales-caption, .desk-story, ' +
      '.phone-frame, .seat-switch, .zone-grid > *, .queue-panel, .review-toolbar'
    );
    var i = 0;
    targets.forEach(function (el) {
      if (el.classList.contains('mv-in')) return;
      el.style.setProperty('--mv-d', Math.min(i, 6) * 45 + 'ms');
      el.classList.add('mv-in');
      i += 1;
      if (revealIO) revealIO.observe(el); else el.classList.add('is-in');
    });
    revealInView();
  }

  /* 兜底：IO 未触发的当屏元素直接显现（无头/异常环境） */
  function revealInView() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll('.mv-in:not(.is-in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.98 && r.bottom > 0) el.classList.add('is-in');
    });
  }

  /* ---------- 签名时刻：结果 sheet 编排 ---------- */
  function choreograph(sheet) {
    if (!sheet || sheet.classList.contains('sheet-empty')) return;
    if (sheet.closest('.review-desk')) {
      sheet.classList.add('mv-detail-swap');
      return;
    }
    sheet.classList.add('mv-answer');
    var groups = ['.run-trail li', '.fact-row', '.evidence-note'];
    groups.forEach(function (sel) {
      sheet.querySelectorAll(sel).forEach(function (el, i) {
        el.style.setProperty('--i', i);
      });
    });
  }

  /* ---------- 数字滚动 ---------- */
  function countUp(el) {
    var raw = el.textContent.trim();
    var num = Number(raw.replace(/[^\d.]/g, ''));
    if (!isFinite(num) || raw === '') return;
    if (reduceMotion) return;
    var decimals = (raw.split('.')[1] || '').length;
    var start = performance.now(), dur = 900;
    function frame(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 4);
      el.textContent = (num * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = raw;
    }
    el.textContent = decimals ? (0).toFixed(decimals) : '0';
    requestAnimationFrame(frame);
  }

  function countIn(root) {
    root.querySelectorAll('.plat-metrics strong, .stat strong').forEach(function (el) {
      if (el.classList.contains('mv-count')) return;
      el.classList.add('mv-count');
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) countUp(el);
    });
    var metrics = root.querySelector('.plat-metrics');
    if (metrics) metrics.classList.add('is-in');
  }

  /* ---------- 席位页签滑动指示条 ---------- */
  function seatInk(root) {
    var strip = root.querySelector('.seat-switch');
    if (!strip) return;
    var active = strip.querySelector('button[aria-pressed="true"]');
    if (!active) return;
    var ink = strip.querySelector('.seat-ink');
    if (!ink) {
      ink = document.createElement('span');
      ink.className = 'seat-ink';
      strip.appendChild(ink);
    }
    var a = active.getBoundingClientRect(), s = strip.getBoundingClientRect();
    ink.style.width = a.width + 'px';
    ink.style.transform = 'translateX(' + (a.left - s.left) + 'px)';
  }

  /* ---------- 自助结果承接 ---------- */
  function carryIn(root) {
    var carry = root.querySelector('.desk-result');
    if (carry && !carry.classList.contains('mv-carry')) carry.classList.add('mv-carry');
  }

  /* ---------- 聚光目标 ---------- */
  function spotIn(root) {
    root.querySelectorAll('.gate-card, .layer-board article, .guide-grid article, .plaza-card').forEach(function (el) {
      el.classList.add('mv-spot');
    });
  }

  /* ---------- 一次增强 ---------- */
  var lastSig = '';
  function enhance(force) {
    var root = app();
    if (!root) return;
    var sig = pageSignature();
    if (sig === lastSig && !force) {
      // 同页状态更新：只处理新出现的结果 sheet，并继续兜底
      root.querySelectorAll('.clause-sheet:not(.mv-answer):not(.sheet-empty)').forEach(choreograph);
      seatInk(root);
      spotIn(root);
      carryIn(root);
      revealInView();
      return;
    }
    lastSig = sig;
    revealIn(root);
    countIn(root);
    seatInk(root);
    spotIn(root);
    root.querySelectorAll('.clause-sheet').forEach(choreograph);
    carryIn(root);
  }

  /* ---------- 聚光卡片（事件委托，不随重渲染失效） ---------- */
  if (finePointer && !reduceMotion) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest('.mv-spot') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- 观察 SPA 重渲染 ---------- */
  var host = app();
  if (host && 'MutationObserver' in window) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; enhance(false); });
    }).observe(host, { childList: true, subtree: true });
  }
  window.addEventListener('resize', function () {
    var root = app();
    if (root) seatInk(root);
    revealInView();
  });
  var sweepPending = false;
  window.addEventListener('scroll', function () {
    if (sweepPending) return;
    sweepPending = true;
    requestAnimationFrame(function () { sweepPending = false; revealInView(); });
  }, { passive: true });
  window.addEventListener('load', revealInView);
  setTimeout(revealInView, 400);
  setTimeout(revealInView, 1200);

  enhance(true);
})();
