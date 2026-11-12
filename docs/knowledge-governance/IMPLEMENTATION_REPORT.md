# 第二阶段实施记录

开发分支 feature/knowledge-governance-v1，从 ff00af0d0c4f44d2fee89a20b98d571ea42f53fb 建独立 worktree。第一阶段九份文件按原样复制作为设计输入，本记录以代码和实测结果为准。

| 文件 | 已实现 |
|---|---|
| knowledge_schema.sql / knowledge_store.py | 独立知识域增量迁移。产品、合同版次、材料修订、原件、页和片段、候选修订、复核、发布快照、查询/变更审计 |
| knowledge_extract.py | 复用 BAOZHI_MODEL_URL、BAOZHI_MODEL、BAOZHI_API_KEY 配置协议。注入式提取、响应 Schema、重试、固定连接超时、禁止重定向、无密钥日志 |
| knowledge_http.py / app.py | 新管理路由、三种独立本机操作凭据、受控原件读取、原展业 /api/channel 的显式发布知识模式。默认启动沿用原库及路由 |
| static/classic/{knowledge.html,knowledge.js,knowledge.css,app.js} | 知识页入口、版本登记、资料/任务、上传与下载、证据/候选对照、审批/退修、发布和回滚。销售页仅列服务端授权且已有发布的选项 |
| tools/run_knowledge_pilot.py | 对已核验国寿原件做固定哈希登记、证据导出、提取尝试及人工复核导航 |
| tests/test_knowledge_governance.py | 数据、迁移、权限、模型故障和回环 HTTP 端到端验证 |

正式查询只取已发布快照成员。批准必须由审核角色逐条确认，发布人独立持令牌，审计 actor 从服务端角色派生。测试注入的候选只能在标为 synthetic 的合同版次批准。展业选择不与虚构保单混用。英文版未新增工作台；老路径继续使用已有演示口径。

设计取舍：本轮采用 SQLite 内不可覆盖的 SHA-256 BLOB，便于在同一事务归档元数据及页证据、与快照一致备份。材料只绑定单一合同版次，配套材料可记录同版附件关系。正式事实是快照成员引用的已审核候选修订，无额外可独立修改的事实表。任务同步执行，落库保留状态。高风险项自动校验仍需要专业人员判断语义。其他边界见 KNOWN_LIMITATIONS.md。

## 本机启动

从当前 worktree 执行下列 PowerShell。使用已安装 pypdf 的 Python，或安装 requirements.txt。需要处理表格类附件时可另装 pdfplumber。只在本机安全配置三种不同的岗位令牌，至少 24 个 ASCII 字符，通过 `BAOZHI_KG_BUILDER_TOKEN`、`BAOZHI_KG_REVIEWER_TOKEN`、`BAOZHI_KG_PUBLISHER_TOKEN` 传入启动进程。配置只交给对应的本机操作者。模型配置沿用已有 BAOZHI_MODEL* 和 BAOZHI_API_KEY 环境变量。

```powershell
$python = 'C:/Users/yjy19/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$sandbox = (Resolve-Path ../knowledge-private/sandbox.sqlite3).Path
& $python -B -X utf8 app.py --port 8765 --knowledge-sandbox $sandbox
```

工作台在 `http://127.0.0.1:8765/classic/knowledge.html`。输入各岗位令牌后可刷新数据；首选真实合同已登记，可检查原件及解析证据。配置模型后由资料登记岗触发抽取，授权审核岗逐条核对，发布岗单独操作。已授权且已发布的版次由启动环境变量 BAOZHI_KG_SALES_VERSIONS（逗号分隔的版次 ID）开放到国内展业页。在隔离环境使用合成验证时，运行 TEST_REPORT.md 的新测试即可演示发布、查询和回滚，测试会启动并关闭本机 HTTP 进程。
