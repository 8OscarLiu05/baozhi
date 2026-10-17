/* Four business stories; no API calls and no fabricated live counters. */
(() => {
  'use strict';
  const hero = document.querySelector('.product-hero');
  if (!hero) return;
  const tabs = [...hero.querySelectorAll('[role="tab"]')];
  const panels = [...hero.querySelectorAll('[role="tabpanel"]')];
  const play = hero.querySelector('.product-play');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0, paused = motion.matches, timer;
  function show(index, focus = false) {
    active = (index + tabs.length) % tabs.length;
    hero.dataset.tone = panels[active].dataset.tone || 'dark';
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === active));
      tab.tabIndex = i === active ? 0 : -1;
      panels[i].hidden = i !== active;
    });
    if (focus) tabs[active].focus();
  }
  function schedule() {
    clearInterval(timer);
    if (!paused && !motion.matches && !document.hidden && !hero.matches(':hover') && !hero.contains(document.activeElement)) {
      timer = setInterval(() => show(active + 1), 6500);
    }
  }
  function pause(value) {
    paused = value;
    play.textContent = paused ? '▶' : 'Ⅱ';
    play.setAttribute('aria-pressed', String(paused));
    play.setAttribute('aria-label', paused ? '继续业务展示轮播' : '暂停业务展示轮播');
    schedule();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { show(i); pause(true); });
    tab.addEventListener('keydown', event => {
      const keys = {ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: tabs.length - 1};
      if (!(event.key in keys)) return;
      event.preventDefault(); show(keys[event.key], true); pause(true);
    });
  });
  play.addEventListener('click', () => pause(!paused));
  hero.addEventListener('mouseenter', () => clearInterval(timer));
  hero.addEventListener('mouseleave', schedule);
  hero.addEventListener('focusin', () => clearInterval(timer));
  hero.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => pause(motion.matches));
  pause(paused);
})();
