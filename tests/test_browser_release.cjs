const {chromium}=require('playwright');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BAOZHI_TEST_URL||fs.readFileSync('data/server.url','utf8').trim();const out=process.env.BAOZHI_TEST_OUTPUT||'docs/演示/release-current';fs.mkdirSync(out,{recursive:true});const results=[];
async function shot(name){await page.screenshot({path:`${out}/${name}.png`});}
async function check(name){const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,`${name}: overflow ${JSON.stringify(size)}`);results.push({name,...size});}
await page.goto(base+'/opening.html');await page.locator('.opening-start').click();await page.locator('.product-play').waitFor();assert.equal(await page.locator('.product-play').getAttribute('aria-pressed'),'true');
for(let i=0;i<4;i++){await page.locator('#product-tab-'+i).click();assert.equal(await page.locator('#product-panel-'+i).isVisible(),true);assert.equal(await page.locator('.product-hero').getAttribute('data-tone'),i%2?'light':'dark');await shot('home-'+i);}
await page.locator('#product-tab-3').press('Home');assert.equal(await page.locator('#product-tab-0').getAttribute('aria-selected'),'true');await page.locator('#product-tab-0').press('End');assert.equal(await page.locator('#product-tab-3').getAttribute('aria-selected'),'true');
assert.equal(await page.locator('#architecture-stage').getAttribute('data-phase'),'assembled');assert.equal(await page.locator('#architecture-play').getAttribute('aria-pressed'),'true');await page.locator('#architecture-toggle').click();assert.equal(await page.locator('#architecture-stage').getAttribute('data-expanded'),'true');assert.equal(await page.locator('#architecture-stage').getAttribute('data-phase'),'exploded');assert.equal(await page.locator('.arch-plate').count(),4);assert.equal(await page.locator('.arch-node').count(),19);await page.locator('.architecture-layer[data-layer="2"]').click();assert.ok((await page.locator('#architecture-detail').innerText()).includes('平台能力层'));await page.locator('#architecture').scrollIntoViewIfNeeded();await shot('architecture-expanded');await page.locator('.architecture-layer[data-layer="3"]').press('ArrowRight');assert.ok((await page.locator('#architecture-detail').innerText()).includes('平台能力层'));await page.locator('#architecture-toggle').click();assert.equal(await page.locator('#architecture-stage').getAttribute('data-phase'),'assembled');
for(const desk of ['sales','wechat','phone','platform']){
 await page.goto(base+'/index.html?desk='+desk);await page.waitForTimeout(900);
 if(desk==='sales'||desk==='wechat'){
 await page.locator('#channel-text').fill(desk==='sales'?'中英鑫悦未来5号什么时候能减保、最多减多少？':'中宏健康双星等待期多少天？');
 await page.locator('#channel-form button.primary').click();await page.locator('#answer-heading').waitFor({timeout:90000});assert.ok(await page.locator('.evidence-note').count()>0);
 if(desk==='wechat'){await page.locator('#channel-handoff').click();await page.waitForTimeout(400);assert.ok((await page.locator('#toast').innerText()).length>0);}
 }
 if(desk==='phone'){
 for(const role of ['outreach','seat','quality']){await page.locator(`[data-seat-role="${role}"]`).click();await page.locator(`form[data-zone="${role}"]`).waitFor();assert.equal(await page.locator('form[data-zone]').count(),1);}
 await page.locator('#zone-quality-text').fill('红利肯定有，比存银行划算');await page.locator('form[data-zone="quality"] button.primary').click();await page.locator('#answer-heading').waitFor({timeout:90000});assert.ok((await page.locator('.result-badge').innerText()).includes('拦截'));
 }
 await page.evaluate(()=>scrollTo(0,0));await check(desk);await shot(desk);
 await page.setViewportSize({width:390,height:844});await check(desk+'-mobile');await shot(desk+'-mobile');await page.setViewportSize({width:1440,height:1000});
 if(desk!=='platform'){assert.equal(await page.locator('.desk-switch [aria-current="page"]').count(),1);}if(desk==='platform'){assert.ok(await page.locator('.workflow-roadmap button').count()===4);await page.locator('[data-ops-review="pending"]').first().click();await page.locator('[data-review-mode="pending"]').waitFor();assert.equal(await page.locator('[data-review-mode="pending"]').getAttribute('aria-pressed'),'true');await shot('review');}
}
await page.goto(base);await page.setViewportSize({width:390,height:844});await check('home-mobile');await shot('home-mobile');assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/verification.json`,JSON.stringify({base,results,errors,checkedAt:new Date().toISOString()},null,2));console.log('PASS: tabs/keyboard/reduced-motion, channel submissions, handoff, seats, pending queue, responsive layouts; screenshots '+out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
