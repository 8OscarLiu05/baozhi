const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");

const opening = read("static/classic/opening.html");
assert.doesNotMatch(opening, /先看机制|本机演示|BS-2026-1017/);

const intlHome = read("static/home.html");
assert.doesNotMatch(intlHome, /Demo integrations|0 model calls|Local competition prototype|motion-toggle/);
assert.match(intlHome, /Up to 1 call/);
assert.match(intlHome, /Evidence first/);

const intlApp = read("static/app.js");
const classicApp = read("static/classic/app.js");
for (const source of [intlApp, classicApp]) {
  assert.doesNotMatch(source, /<div class="local-chip">/);
  assert.match(source, /overviewCallIsPrivate/);
  assert.match(source, /filter\(c=>!overviewCallIsPrivate\(c\)\)/);
  assert.match(source, /<b>已留存业务问题<\/b>/);
}
assert.match(intlApp, /optgroup label="Job roles"/);
assert.match(intlApp, /optgroup label="Customer"/);
assert.match(read("static/i18n.js"), /'溯':'Trace'/);

console.log("REQ-069 interface refinement assertions passed");
