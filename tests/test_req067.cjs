const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");

const currentHome = read("static/home.html");
const classicOpening = read("static/classic/opening.html");
const classicShowcase = read("static/classic/showcase.html");
const classicI18n = read("static/classic/i18n.js");
const server = read("app.py");

assert.match(currentHome, /Agentic middleware/, "当前 Claude 版首页必须保留");
assert.match(classicOpening, /三个业务入口，/);
assert.match(classicOpening, /一个保险智能体中台。/);
assert.match(classicOpening, /href="\/classic\/showcase\.html"/);
assert.match(classicShowcase, /href="\/classic\/index\.html\?desk=platform"/);
assert.match(classicShowcase, /showcase-v2\.css/);
assert.match(classicShowcase, /一个智能体中台，<br><em>连接业务与能力<\/em>。/);
assert.match(classicShowcase, /智能体中台/);
assert.match(classicI18n, /const lang='zh';/, "国内版固定中文");
assert.doesNotMatch(classicI18n, /data-language|localStorage/, "国内版不再提供语言切换");
const intlI18n = read("static/i18n.js");
assert.match(intlI18n, /const lang='en';/, "国际版固定英文");
assert.doesNotMatch(intlI18n, /localStorage/, "国际版不再提供语言切换");
assert.match(server, /path in \("\/classic", "\/classic\/"\)/);
assert.match(server, /ROOT \/ "static" \/ "classic" \/ rel/);

for (const file of ["opening.html", "showcase.html", "index.html"]) {
  const html = read(`static/classic/${file}`);
  const refs = [...html.matchAll(/(?:src|href)="(\/classic\/[^"?#]+)[^\"]*"/g)]
    .map((match) => match[1].replace("/classic/", "static/classic/"));
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(ROOT, ref)), `${file} 引用的资源不存在：${ref}`);
  }
}

console.log("REQ-067 classic variant assertions passed");
