# 现状盘点

核验日期 2026-11-09（北京时间）。本地仓库 D:/baozhi，origin 为 8OscarLiu05/baozhi，版本 0.17.2 / REQ073-20261018。本地与 GitHub main 均为 [ff00af0](https://github.com/8OscarLiu05/baozhi/commit/ff00af0d0c4f44d2fee89a20b98d571ea42f53fb)。工作区起始状态只有未跟踪的「会话交接说明-2026-11-05.md」。最近历史依次为 ff00af0（0.17.2）、1e8e3bd（0.17.1）、55a2219（验证批次）、9727013（初始交接）。

## 审计范围

枚举了 Git 跟踪树、根目录及资料目录。检查了 README、现有架构文档、启动器、HTTP 路由、Store 和 SQLite 快照、双版本页面和脚本、模型及业务模块，以及测试入口。验证资料的目录、历史批次与既有交接用于定位回归资产，未重新开展保险专业评分。SQLite 使用 mode=ro&immutable=1，统计是磁盘主库快照。未启动默认 Store，也未向真实模型发请求。相关链路见 [当前架构](ARCHITECTURE_CURRENT.md)。

| 文件或目录 | 实查内容 |
|---|---|
| app.py、launch.py、requirements.txt | 启动端口、默认 DB、迁移/种子、角色、GET/POST、上传发布、知识查询、对话及记录。文字 PDF 依赖 pypdf |
| life_catalog.py、clause_query.py、external_material.py、insurance_content.py | 四个固定产品样例、字段投影、条件与免责、外部条款/QA 导入、条款分块和缺口 |
| portal_hub.py、consultation.py、compliance_rules.py、intl.py | 模型请求、普通和专业咨询、需求情景、话术规则、英语路由 |
| company_library.py、platform_ops.py、product_design.py、simulation.py、illustrations.py | 虚构保单与授权、运行快照、设计与利益演示隔离 |
| static/、static/classic/ | home/opening、showcase、index 和两套 app.js 的工作台、API 连接、文档与证据视图 |
| tests/、tools/、docs/验证/ | 26 个跟踪测试文件，已有回归用例及冻结验证批次。没有把历史开发集作为本轮新知识的验收样本 |
| 演示资料/、参考资料/、data/ | 结构化条款和利益演示目录、课程参考目录、现有 SQLite 及运行路径。结构化样例与正式合同原件须分开管理 |

## SQLite 快照与字段

| 表组 | 实际字段或关联 | 快照记录 |
|---|---|---|
| documents | id, product, version, title, kind, source, content, status, created, review | 17（1 草稿，16 已演示发布） |
| chunks、clauses | chunks 有 id/doc_id/position/content。clauses 另有 heading/element/chunk_id | 各 119 |
| rules | id/doc_id/scenario/outcome/evidence_id/note | 34 |
| products | id/company/name/short/category/shelf/source_file/source_note/info_json/doc_id | 4 |
| product_duties、product_exclusions | product_id/position/cite/source_file；责任还有 name/kind/required/payload，免除有 scope/item_count/body/note | 26、5 |
| knowledge_steps | id/product_id/position/name/detail | 20 |
| company_org、company_staff、company_products、company_customers、company_policies | 虚构主体与保单，保单 catalog_id 关联条款目录 | 1、18、2、40、120 |
| consultation_scenarios、external_qa | 情景 id/version/payload；外部 QA id/contract/question/excerpt/source | 300、14 |
| agents、flows、dialog_agents、agent_permissions | 配置版本、职责、产品范围、授权覆盖 | 3、2、0、0 |
| runs、reviews、audit | 运行 data；运行复核 run_id/disposition/checks/gap_actions；操作审计 role/action/detail | 7、1、238 |
| channel_sessions、channel_calls、handoffs、sample_reviews | 渠道、岗位、保单、答案、摘录、trace_json；转人工和事后抽检关联 call_id | 120、120、4、6 |
| conversations、messages、model_calls | 对话、消息 meta、模型调用 status/ms/usage | 35、90、145 |
| product_designs、benefit_simulations | 设计版本及演算数据 | 2、3 |

共 30 张表，快照没有声明式外键。published 记录包含 2 个 design、5 个 imported、9 个 mock。仓库跟踪 data/baozhi.sqlite3 和历史验证 SQLite/ZIP，和 README 中运行数据说明存在差异。新增私有材料需另设提交拦截，既有历史处置单独审批。

## 问题清单

| 分类 | 证据位置 | 当前表现及影响 |
|---|---|---|
| 已有且可复用 | app.py:466、497、517；static/classic/app.js:283 | 有草稿、同文档段落规则、复核说明和文档发布。可保留旧文档及界面，复用证据交互 |
| 已有且可复用 | app.py:1087、1179、1248、1322；clause_query.py:249 | 有岗位、渠道、保单上下文、字段模板、转人工和调用抽检。可作为业务回归基线 |
| 已有但需优化 | app.py:84、92、485、1831 | 同步 Base64 上传，文字 PDF 以页标记拼接、按段落和字符分块。表格坐标、跨页定位与原件哈希缺失；原始文件写入晚于草稿事务 |
| 已有但需优化 | app.py:477、591、951；clause_query.py:293 | 文档编号按产品递增，段落检索取每产品最新已发布文档；结构化字段走目录表。合同版次、多材料和保单版次尚未共用严格身份 |
| 目前缺失 | app.py:145、197、232、517；life_catalog.py:87 | 未见抽取任务、不可变候选修订、事实级证据关联、错误反馈、审核发布快照 |
| 设计风险 | app.py:335、517；external_material.py:128 | 启动导入把待专业核实的样例标作演示已发布。业务查询不能用旧 published 状态认定专业审核通过 |
| 设计风险 | app.py:809、846、1111、1158；clause_query.py:285 | 有字段、数字与话术约束，但数字存在于任一摘录不证明条件、归属、单位或否定关系正确。普通咨询及部分通用聊天采用模型文字 |
| 设计风险 | app.py:1711、1774、1831；company_library.py:68 | 演示角色由客户端请求，资料详情以角色/状态判断为主。上线前需要真实身份、产品版本级授权与防越权测试 |
| 暂缓 | app.py:581；clause_query.py:249 | 先以关系数据和结构化检索验证 2–3 份合同。向量数据库、外部队列、服务拆分及新前端框架不列入首批 |

发布判断、授权路径和业务回退的验收口径见 [风险与验收](RISKS_AND_ACCEPTANCE.md)。

## 本轮验证

用临时数据库运行 `test_consultation.py`（16 项）、`test_life.py`（12 项）、`test_app.py`（32 项），60 项全部通过。覆盖了专业查询的回退、结构化证据、草稿隔离、同文档引用、版本冲突及既有 HTTP 行为。真实模型连通性、浏览器端到端交互、保险专业准确率和新试点提取质量未纳入本轮验证。

盘点前后 `data/baozhi.sqlite3` 的 SHA-256 均为 `FABF56750CA8F8199DD779D82CB6D936743618D0EA0B6196B4B15289733EA12B`。本轮写入仅为 `docs/knowledge-governance/` 下的方案文档。
