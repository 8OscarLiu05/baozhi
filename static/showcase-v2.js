(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
  var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 玻璃页头、移动导航与原创三级菜单 */
  var nav=$('#nav'),more=$('#nav-more'),mega=$('#mega-menu'),mobile=$('#nav-mobile'),links=$('.nav-links');
  function closeMega(){if(!mega)return;mega.hidden=true;if(more)more.setAttribute('aria-expanded','false');}
  if(more&&mega)more.addEventListener('click',function(){var open=mega.hidden;mega.hidden=!open;more.setAttribute('aria-expanded',String(open));});
  if(mobile&&links)mobile.addEventListener('click',function(){var open=links.classList.toggle('is-open');mobile.setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',function(e){if(mega&&!mega.hidden&&!nav.contains(e.target))closeMega();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMega();});
  window.addEventListener('scroll',function(){if(nav)nav.classList.toggle('is-scrolled',window.scrollY>10);},{passive:true});

  /* revealInView 保留兜底：低性能设备和关闭动态时直接展示 */
  var revealEls=$$('.reveal');
  function revealInView(){var h=window.innerHeight||document.documentElement.clientHeight;revealEls.forEach(function(el){if(el.getBoundingClientRect().top<h*.96)el.classList.add('is-in');});}
  if('IntersectionObserver' in window&&!reduceMotion){
    var io=new IntersectionObserver(function(items){items.forEach(function(item){if(item.isIntersecting){item.target.classList.add('is-in');io.unobserve(item.target);}});},{threshold:.08,rootMargin:'0px 0px -5% 0px'});
    revealEls.forEach(function(el){io.observe(el);});window.addEventListener('load',revealInView);setTimeout(revealInView,500);
  }else revealEls.forEach(function(el){el.classList.add('is-in');});

  /* 首屏不是视频文件：CSS 数据流配合可暂停的分镜文字 */
  var cinema=$('#cinema'),motionToggle=$('#motion-toggle'),sceneTitle=$('#scene-title'),sceneCopy=$('#scene-copy');
  var scenes=[
    ['问题正在进入','职责、上下文和产品焦点一起提交'],
    ['证据正在汇合','问题、字段、例外与调用记录进入同一条链路'],
    ['数字正在核对','回答中的每个数字都要回到本次证据'],
    ['记录已经留存','维护者可按调用编号复核，不改原回答']
  ],sceneIndex=0,sceneTimer=null,motionPaused=reduceMotion;
  function paintScene(){if(sceneTitle)sceneTitle.textContent=scenes[sceneIndex][0];if(sceneCopy)sceneCopy.textContent=scenes[sceneIndex][1];}
  function startScenes(){clearInterval(sceneTimer);if(motionPaused||reduceMotion)return;sceneTimer=setInterval(function(){sceneIndex=(sceneIndex+1)%scenes.length;paintScene();},2700);}
  function setMotionPaused(paused){motionPaused=paused;if(cinema)cinema.classList.toggle('is-paused',paused);if(motionToggle){motionToggle.setAttribute('aria-pressed',String(paused));motionToggle.firstElementChild.textContent=paused?'▶':'Ⅱ';$('.sr-only',motionToggle).textContent=paused?'继续首屏动态':'暂停首屏动态';}startScenes();}
  if(motionToggle)motionToggle.addEventListener('click',function(){setMotionPaused(!motionPaused);});paintScene();setMotionPaused(motionPaused);

  var mascotLines=['先找条款出处，再回答产品事实。','数字、条件和例外，要在同一次回答里出现。','没有可定位证据，就不补写保险事实。','三个业务入口的调用，都会回到平台供抽检。'];
  var mascotButton=$('#mascot-talk'),mascotLine=$('#mascot-line'),mascotIndex=0;
  if(mascotButton&&mascotLine)mascotButton.addEventListener('click',function(){mascotIndex=(mascotIndex+1)%mascotLines.length;mascotLine.textContent=mascotLines[mascotIndex];});

  /* 四入口往返轨道：到末端后反向，悬停/聚焦暂停，可手动控制 */
  var viewport=$('#entry-viewport'),cards=$$('.entry-card'),dots=$$('#entry-progress [data-slide]'),prev=$('#entry-prev'),next=$('#entry-next'),play=$('#entry-play');
  var active=0,direction=1,railPaused=reduceMotion,railTimer=null;
  function go(index,smooth){if(!viewport||!cards.length)return;active=Math.max(0,Math.min(cards.length-1,index));var left=cards[active].offsetLeft-viewport.offsetLeft;viewport.scrollTo({left:left,behavior:smooth&&!reduceMotion?'smooth':'auto'});dots.forEach(function(dot,i){dot.classList.toggle('active',i===active);});}
  function step(dir){var target=active+dir;if(target>=cards.length){direction=-1;target=cards.length-2;}else if(target<0){direction=1;target=1;}go(target,true);}
  function startRail(){clearInterval(railTimer);if(railPaused||reduceMotion)return;railTimer=setInterval(function(){step(direction);},3600);}
  function setRailPaused(paused){railPaused=paused;if(play){play.textContent=paused?'继续':'暂停';play.setAttribute('aria-pressed',String(paused));}startRail();}
  if(prev)prev.addEventListener('click',function(){direction=-1;step(-1);});
  if(next)next.addEventListener('click',function(){direction=1;step(1);});
  if(play)play.addEventListener('click',function(){setRailPaused(!railPaused);});
  dots.forEach(function(dot){dot.addEventListener('click',function(){go(Number(dot.dataset.slide),true);});});
  if(viewport){viewport.addEventListener('mouseenter',function(){clearInterval(railTimer);});viewport.addEventListener('mouseleave',startRail);viewport.addEventListener('focusin',function(){clearInterval(railTimer);});viewport.addEventListener('focusout',startRail);viewport.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}});}
  window.addEventListener('resize',function(){go(active,false);});go(0,false);setRailPaused(railPaused);

  var chart=$('#score-chart');
  if(chart)chart.querySelectorAll('[data-score]').forEach(function(bar){bar.style.setProperty('--score',bar.dataset.score+'%');});
  if(chart){if('IntersectionObserver' in window&&!reduceMotion){var chartIo=new IntersectionObserver(function(items){if(items[0].isIntersecting){chart.classList.add('is-in');chartIo.disconnect();}},{threshold:.3});chartIo.observe(chart);}else chart.classList.add('is-in');}
})();
