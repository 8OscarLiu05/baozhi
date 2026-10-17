/* 保溯 · 开场页交互（2026-10-17）
   服务带 CSP（script-src/style-src 'self'）：不使用内联脚本，
   也不通过 element.style 写样式；视差与磁吸一律走 Web Animations API
   （暂停动画 + currentTime 擦洗），只做类名与文本操作。 */
(function(){
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer:fine)').matches && !reduce;
  var body = document.body;

  /* 入场：等两帧样式落定后再触发，保证过渡从初始态开始 */
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ body.classList.add('ready'); });
  });

  /* 暂停 / 重播 */
  var pauseBtn = document.querySelector('[data-motion-pause]');
  var replayBtn = document.querySelector('[data-motion-replay]');
  function setPause(paused){
    body.classList.toggle('motion-paused', paused);
    pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    pauseBtn.setAttribute('aria-label', paused ? '播放动画' : '暂停动画');
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.title = paused ? '播放动画' : '暂停动画';
  }
  pauseBtn.addEventListener('click', function(){
    setPause(!body.classList.contains('motion-paused'));
  });
  replayBtn.addEventListener('click', function(){
    setPause(false);
    body.classList.remove('ready');
    void body.offsetWidth;
    requestAnimationFrame(function(){ body.classList.add('ready'); });
  });

  if (fine){
    /* 指针视差：每条链路一个暂停的 WAAPI 动画，用 currentTime 擦洗。
       网格与微光反向、档案卡小幅跟随，全部只碰 transform。 */
    var grid = document.querySelector('.bg-grid');
    var glow = document.querySelector('.bg-glow');
    var stage = document.querySelector('.stage-parallax');
    var gridA = grid.animate(
      [{transform:'translate3d(-30px,-18px,0)'},{transform:'translate3d(30px,18px,0)'}],
      {duration:2000, fill:'forwards', paused:true}
    );
    var glowA = glow.animate(
      [{transform:'translate3d(40px,24px,0)'},{transform:'translate3d(-40px,-24px,0)'}],
      {duration:2000, fill:'forwards', paused:true}
    );
    var stageA = stage.animate(
      [{transform:'translate3d(-10px,-6px,0)'},{transform:'translate3d(10px,6px,0)'}],
      {duration:2000, fill:'forwards', paused:true}
    );

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    window.addEventListener('pointermove', function(e){
      tx = (e.clientX / window.innerWidth - .5) * 2;
      ty = (e.clientY / window.innerHeight - .5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    }, {passive:true});

    function loop(){
      cx += (tx - cx) * .07;
      cy += (ty - cy) * .07;
      var t = 1000 + cx * 1000;
      gridA.currentTime = t;
      glowA.currentTime = t;
      stageA.currentTime = 1000 + cy * 1000;
      if (Math.abs(tx - cx) > .0008 || Math.abs(ty - cy) > .0008){
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    /* 主按钮磁吸：最大偏移约 5px、倾斜不超过 1.2deg */
    var cta = document.querySelector('.cta');
    var ctaA = cta.animate(
      [{transform:'translate(-5px,-2px) rotate(-1.2deg)'},{transform:'translate(5px,-2px) rotate(1.2deg)'}],
      {duration:2000, fill:'forwards', paused:true}
    );
    cta.addEventListener('pointermove', function(e){
      var r = cta.getBoundingClientRect();
      var nx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      nx = nx > 1 ? 1 : nx < -1 ? -1 : nx;
      ctaA.currentTime = 1000 + nx * 1000;
    });
    cta.addEventListener('pointerleave', function(){ ctaA.cancel(); });
  }
})();
