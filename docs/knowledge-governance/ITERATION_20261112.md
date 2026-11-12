# 2026-11-12 执行记录

本记录更新第二阶段交付后的实测状态，旧报告保留历史口径。开发目录为独立 worktree，分支 feature/knowledge-governance-v1，HEAD 为 ff00af0d0c4f44d2fee89a20b98d571ea42f53fb。GitHub main 当日复核仍是同一提交。原库 SHA-256 为 FABF56750CA8F8199DD779D82CB6D936743618D0EA0B6196B4B15289733EA12B，前后相同。

## 模型阶段

检查进程环境、D:/baozhi/.env、开发 worktree/.env，以及本地 Git 跟踪配置与配置文件历史。仅 .env.example 和 .env.qwen.example 示例，未找到完整模型配置。用户明确指示找不到则跳过。本轮真实模型调用 0，真实候选 0，真实专业审批 0，真实发布 0。没有生成 AI 候选文件或专业准确率。人工基准为尚待标注的模板，16 项字段均未标注。

## 附件核验

协会同一产品明细的正式附件链接已实际下载，严格 PDF 检查、哈希、首页文本与渲染身份核验完成。每份均绑定到国寿 2023-122 合同版次及原条款材料。附件来源已核验只表示来源与文件身份确认，表格适用性和专业事实尚待审核。

| 材料 | 页数 | SHA-256 | 当前解析状态 |
|---|---:|---|---|
| 现金价值表 | 5 | 6d88f9457f2d528c13cf8abb62fd03f81cde32ba60e45309f8e312bb980bc122 | 文本已取得。网格识别为 0，5 页全部 needs_review，阻止直接据此发布事实 |
| 协会费率附件，实际题名为基本保险金额表 | 4 | a732cc1485b161332fe22a5ad168918e2efc2015a25989e3c26c2d0e672184ef | 4 页及 4 张网格表。行列坐标已留存，合并表头与适用前提需专业复核 |
| 产品说明书 | 6 | d5daa866e42b76cc8606ed6db459d0219b226ecde979b180d679d40d860a61bc | 页文本已取得，登记为 brochure。不能单独支持合同事实发布 |

协会明细 https://www.iachina.cn/IC/tkk/01/006a722a-8a0f-4171-8fd5-35a013757798.html

来源登记与原件、逐页片段和表格位置、空白独立人工标注模板见 outputs/养老年金试点/2026-11-12补充核验。加上原条款，真实隔离库当前有 4 份材料、21 页。开始登记附件前，用 SQLite backup 生成 work/knowledge-private/before-20261112.sqlite3。

## 发布边界加固

knowledge_store.py 新增当前证据复检，在审批、发布、回滚和发布事实查询时核验已确认来源、页面质量、片段区间、引文和原始文件哈希。批准操作拒绝携带未解决错误。抽取失败保留受限错误信息和经过适配器脱敏检查的模型响应，工作台显示诊断及字段覆盖。

新增 4 个回归用例，覆盖来源/引文变化后禁止发布、页面质量退化和错误未关闭时禁止批准、无效历史证据禁止回滚、失败响应保留。

## 浏览器验证

使用实际 Edge 浏览器连接临时本机服务器。真实库与合成库使用两个不同数据库和端口。

- 真实工作台成功连接、显示 4 份资料与解析任务，条款按物理页和条款号展示。真实事实审核停止在零候选状态。
- 合成库展示待审候选、原文与字段，完成审核说明、确认、空错误分类、批准及独立发布岗位发布，界面出现当前生效快照。截图中的 synthetic.pdf 和合成版次明确标识测试身份。
- 原生 prompt/confirm 在浏览器自动化中出现模态超时。已替换为带标签、可取消的页面内 dialog 表单，修复后完成审批发布。最后增加错误分类取消即退出审批的处理。
- 国际首页实机可打开。受测页面未捕获到控制台 error。
- 原件下载按钮前端显示操作完成，但自动化未捕获 download 事件，浏览器下载落盘未验收。后端受权原件读取已有 HTTP 测试。真实浏览器上传、退修、回滚和展业交互仍待专项验证，HTTP 综合用例覆盖相应后端路径。
- 临时服务器已停止。合成数据库随测试资源退出清理，真实隔离库保留。截图保留为执行证据。

## 测试结果

最终代码运行 14 项新知识治理测试全部通过，其中含 1 项回环 HTTP 综合用例。原有回归 test_consultation 16、test_life 12、test_app 32、test_intl 6，共 66 项全部通过。总计 80 项。JavaScript 语法与 git diff --check 通过。浏览器检查不计入该 80 项。真实库 integrity_check 为 ok，foreign_key_check 无错误。

测试命令在 worktree 执行，使用已含 pypdf 的 Python。

```powershell
$python = 'C:/Users/yjy19/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
foreach ($name in @('test_knowledge_governance.py','test_consultation.py','test_life.py','test_app.py','test_intl.py')) {
  & $python -B -X utf8 -m unittest discover -s tests -p $name -v
}
node --check static/classic/knowledge.js
git diff --check
```

## 本轮文件

修改 knowledge_store.py、static/classic/knowledge.js、static/classic/knowledge.css、tests/test_knowledge_governance.py。新增 tools/register_pilot_attachments.py、tools/serve_knowledge_browser_test.py 和本记录。开发分支改动保留为未提交状态，未推送或合并。

## 后续必要工作

模型配置齐备后触发真实抽取；在现金价值表网格映射可靠之前保留阻塞。专业人员从原文独立建立字段、条件、例外及证据基准，逐条审核真实候选。事实发布前继续沿用本轮加固门槛。尚缺分母的专业指标保持未评估。
