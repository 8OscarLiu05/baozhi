const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8773/classic/showcase.html');
    await page.locator('.faq-list').waitFor();
    await page.locator('.faq-list details').first().locator('summary').click();
    await page.locator('[data-about-toggle]').click();
    const chinese = await page.locator('body').innerText();
    assert.match(chinese, /普通咨询调用一次千问，不发送公司资料/);
    assert.match(chinese, /专业咨询零次模型/);
    assert.match(chinese, /不是每个入口的固定流程/);
    assert.match(chinese, /没有接通真实展业 APP、微信、电话或录音/);
    assert.doesNotMatch(chinese, /三个入口先使用中台规则与知识/);
    assert.equal(await page.locator('[data-language]').count(), 0);
    await page.goto('http://127.0.0.1:8773/showcase.html');
    await page.locator('.faq-list').waitFor();
    await page.evaluate(() => { document.querySelector('.faq-list details').open = true; });
    await page.waitForFunction(() => /General consultations call Qwen once without company data/.test(document.querySelector('.faq-list').innerText));
    assert.equal(await page.locator('[data-language]').count(), 0);
    fs.mkdirSync('docs/演示/REQ062', { recursive: true });
    await page.screenshot({ path: 'docs/演示/REQ062/showcase.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('REQ062 showcase wording, Chinese and English copy, boundary statement and fixed languages passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
