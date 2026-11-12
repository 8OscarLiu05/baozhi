"use strict";
const byId = (id) => document.getElementById(id);
let token = "";
let state = {};
const prefix = "/api/knowledge/v1/";
async function api(path, body) {
  const response = await fetch(prefix + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || String(response.status));
  return result;
}
function node(tag, text, parent) {
  const el = document.createElement(tag);
  el.textContent = text;
  parent.append(el);
  return el;
}
function ask(question, initial = "", confirmation = false) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    const form = node("form", "", dialog);
    form.method = "dialog";
    const label = node("label", question, form);
    const input = confirmation ? null : node("textarea", "", label);
    if (input) input.value = initial;
    const cancel = node("button", "取消", form);
    cancel.value = "cancel";
    const submit = node("button", "确认", form);
    submit.value = "accept";
    dialog.addEventListener("close", () => {
      const accepted = dialog.returnValue === "accept";
      resolve(confirmation ? accepted : accepted ? input.value : null);
      dialog.remove();
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
    (input || cancel).focus();
  });
}
function run(work, refresh = true) {
  return async (event) => {
    event.preventDefault();
    if (event.currentTarget.disabled) return;
    byId("status").textContent = "处理中…";
    try {
      await work(event.currentTarget);
      if (refresh) await loadState();
      byId("status").textContent = "操作完成";
    } catch (error) {
      byId("status").textContent = error.message;
    }
  };
}
function action(parent, title, work, refresh) {
  node("button", title, parent).onclick = run(work, refresh);
}
function head(version) {
  return state.releases.find(r => r.version_id === version && r.active)?.id ?? null;
}
function list(id, items, render) {
  const box = byId(id);
  box.replaceChildren();
  for (const item of items) render(node("article", "", box), item);
}
function renderTables(result) {
  const box = byId("table-view");
  box.replaceChildren();
  node("h3", "原件表格定位", box);
  node("p", "自动解析结果，表头和适用条件待专业审核。空白与数值零分别保留。", box);
  const tables = Object.values(result.tables).flat();
  if (!tables.length) {
    node("p", "尚无表格解析结果，请由登记岗执行表格解析。", box);
    return;
  }
  const label = node("label", "选择表块", box);
  const choice = node("select", "", label);
  choice.setAttribute("aria-label", "选择表块");
  for (const [index,t] of tables.entries()) {
    node("option", "PDF 第 " + t.page + " 页 · " + t.table_id, choice).value = index;
  }
  const panel = node("div", "", box);
  function showTable() {
    panel.replaceChildren();
    const table = tables[Number(choice.value)];
    node("p", "定位 " + table.table_id + " · 原件 SHA-256 " + result.source_sha256, panel);
    for (const context of table.header_context) {
      node("p", "表前说明来自 PDF 第 " + context.page + " 页", panel);
      node("pre", context.text, panel);
    }
    if (table.continuation_of) node("p", "表头续接 PDF 第 " + table.continuation_of.page +
      " 页 " + table.continuation_of.table_id, panel);
    const filterLabel = node("label", "投保年龄列", panel);
    const age = node("select", "", filterLabel);
    age.setAttribute("aria-label", "投保年龄列");
    node("option", "所有原始列", age).value = "";
    table.columns.slice(1).forEach((column,index) => {
      node("option", String(column), age).value = index + 1;
    });
    const wrap = node("div", "", panel);
    wrap.className = "table-scroll";
    function showRows() {
      wrap.replaceChildren();
      const grid = node("table", "", wrap);
      node("caption", "表块 " + table.table_id + " · 行为原文年度，列为原文年龄", grid);
      const chosen = age.value ? [0,Number(age.value)] : null;
      if (table.continuation_of) {
        const header = node("tr", "", grid);
        table.columns.forEach((column,index) => {
          if (!chosen || chosen.includes(index)) node("th", String(column), header);
        });
      }
      for (const row of table.rows) {
        const tr = node("tr", "", grid);
        for (const cell of row.cells) {
          if (chosen && !chosen.includes(cell.column-1)) continue;
          const td = node(!row.row_label || cell.column === 1 ? "th" : "td",
            cell.text === "" ? "空白" : cell.text === null ? "合并单元格" : cell.text, tr);
          td.title = "PDF 第 " + table.page + " 页 · 行 " + row.row +
            " · 列 " + cell.column + " · 坐标 " + JSON.stringify(cell.bbox);
        }
      }
    }
    age.onchange = showRows;
    showRows();
  }
  choice.onchange = showTable;
  showTable();
}
async function loadState() {
  state = await api("state");
  for (const el of document.querySelectorAll("select[name=version_id]")) {
    const before = el.value;
    el.replaceChildren();
    for (const v of state.versions) {
      node("option", (v.synthetic ? "[合成] " : "") + v.name + " · " + v.edition, el).value = v.id;
    }
    if (before) el.value = before;
  }
  list("materials", state.materials, (el, m) => {
    node("div", m.filename + " · " + m.page_count + " 页 · " + (m.verified ? "来源已核验" : "来源待核验"), el);
    node("small", m.id + " · SHA-256 " + m.sha256 + " · " + m.source, el);
    node("div", "", el);
    action(el, "查看解析证据", async () => {
      const fragments = await api("fragments/" + m.id);
      byId("fragments").textContent = fragments.map(f => "PDF 第 " + f.page + " 页 " + (f.clause || "") + "\n" + f.text).join("\n\n");
    }, false);
    action(el, "下载哈希校验原件", async () => {
      const res = await fetch(prefix + "original/" + m.id, {headers: {Authorization: "Bearer " + token}});
      if (!res.ok) throw new Error("读取原件失败");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = m.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, false);
    action(el, "确认来源", async () => {
      const reason = await ask("仅在完成官方来源与合同版本核验后填写核验记录");
      if (reason) await api("verify/" + m.id, {reason});
    });
    action(el, "提取候选", () => api("extract/" + m.id, {}));
    if (["rates","cash_value","conversion_table","illustration"].includes(m.kind)) {
      action(el, "重解析表格", () => api("table-parse/" + m.id, {}));
      action(el, "查看表格", async () => {
        const result = await api("tables/" + m.id);
        renderTables(result);
      }, false);
    }
  });
  list("tasks", state.tasks, (el, t) => {
    node("div", t.stage + " · " + t.status + " · " + t.method + " · " + t.material_id, el);
    if (t.result) {
      const detail = node("details", "", el);
      node("summary", "诊断与字段覆盖", detail);
      const result = JSON.parse(t.result);
      node("pre", JSON.stringify({...result, model_response: undefined}, null, 2), detail);
    }
  });
  list("candidates", state.candidates, (el, c) => {
    node("strong", c.fact_type + " · " + c.status + " · " + c.id, el);
    node("pre", JSON.stringify(c.payload, null, 2), el);
    node("p", c.checks.join(" | "), el);
    for (const e of c.evidence) node("blockquote", e.filename + " · PDF 第 " + e.page + " 页 · " + (e.clause || "") + "\n" + e.quote, el);
    if (["pending", "disputed", "needs_revision"].includes(c.status)) {
      for (const [decision, label] of Object.entries({approved:"批准", rejected:"拒绝", needs_revision:"退修", disputed:"争议"})) {
        action(el, label, async () => {
          const reason = await ask("审核依据或问题");
          if (!reason) return;
          const confirmed = decision === "approved" && await ask("已逐项核对原件、语义、条件、例外和风险。确认批准？", "", true);
          if (decision === "approved" && !confirmed) return;
          const body = {decision, reason, confirmed, expected_status:c.status};
          const tags = await ask("错误分类（可空，逗号分隔 E01 至 E10）", "");
          if (tags === null) return;
          if (tags) body.errors = tags.split(",").map(s => s.trim()).filter(Boolean);
          if (decision === "needs_revision") {
            const initial = {...c.payload,evidence:c.evidence.map(({fragment_id,quote,role}) => ({fragment_id,quote,role}))};
            const correction = await ask("可选：提交候选修订 JSON。取消则仅标记退修。", JSON.stringify(initial));
            if (correction) body.replacement = JSON.parse(correction);
          }
          await api("review/" + c.id, body);
        });
      }
    }
  });
  list("releases", state.releases, (el, r) => {
    node("div", r.id + " · " + r.version_id + " · " + (r.active ? "当前生效" : "历史快照"), el);
    if (!r.active) action(el, "回滚到此快照", async () => {
      const reason = await ask("回滚原因");
      if (reason) await api("restore/" + r.version_id, {release_id:r.id, expected_head:head(r.version_id), reason});
    });
  });
}
byId("connect").onsubmit = run(async (form) => {
  token = form.elements.token.value;
  form.elements.token.value = "";
});
byId("version").onsubmit = run(form => api("versions", Object.fromEntries(new FormData(form))));
byId("upload").onsubmit = run(async (form) => {
  const data = Object.fromEntries(new FormData(form));
  const pdf = data.pdf;
  if (!pdf?.size || pdf.size > 8 * 1024 * 1024) throw new Error("请选择 8 MiB 以内的 PDF");
  const encoded = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("读取 PDF 失败"));
    reader.readAsDataURL(pdf);
  });
  delete data.pdf;
  await api("materials", {...data, filename:pdf.name, file:encoded});
});
byId("publish").onsubmit = run(form => {
  const {version_id, candidate_ids} = Object.fromEntries(new FormData(form));
  return api("publish/" + version_id, {candidate_ids:candidate_ids.split(",").map(x => x.trim()).filter(Boolean),
                                       expected_head:head(version_id)});
});
