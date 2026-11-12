# 当前系统架构

基线为 ff00af0。图中节点对应实查代码。四层能力落在单个本地 Python HTTP 进程中。

## 1. 前端

```mermaid
flowchart LR
  A["launch.py 默认 /classic/"] --> B["classic/opening.html"]
  I["/ → static/home.html"] --> J["国际入口及展示"]
  B --> C["classic/showcase.html"]
  C --> D["classic/index.html + app.js"]
  J --> E["index.html + app.js"]
  D --> F["展业、客户、电话、平台"]
  E --> F
  F --> G["同源 JSON API /api/*"]
```

定位：app.py:1656；static/app.js:16、81、250；static/classic/app.js:27、157、495。工作台通过 desk/page 参数和本地 state 渲染，英文版 API 加 X-Baosu-Lang: en。

## 2. 后端

```mermaid
flowchart LR
  H["Handler GET/POST"] --> S["Store 业务、权限、读写"]
  H --> W["双版本静态文件"]
  S --> DB["SQLite"]
  S --> C["clause_query / consultation"]
  S --> L["life_catalog / external_material / insurance_content"]
  S --> P["company_library / platform_ops"]
  S --> M["portal_hub.complete / explain_model"]
  M --> Q["配置的兼容模型接口"]
  S --> T["product_design / simulation / illustrations"]
```

定位：app.py:133、197、1608、1656、1762、1863。启动器负责端口与浏览器入口。Store 初始化会建表、备份、导入及同步，不能作为只读盘点入口。

## 3. 知识数据流

```mermaid
flowchart LR
  A["上传文字 PDF / DOCX / TXT / MD"] --> P["同步解析、按字符分段"]
  P --> D["documents → chunks → clauses"]
  D --> R["人工配置情景规则、说明"]
  R --> V["演示发布"]
  J["固定结构化样例"] --> D
  J --> K["products / duties / exclusions / steps"]
  X["可选外部 bundle"] --> D
  X --> QA["external_qa"]
  V --> S["关键词段落检索"]
  K --> T["字段查找与模板"]
  QA --> U["部分聊天分支"]
```

定位：app.py:92、335、450、466、517、581、677、1831。文档与字段两路使用同一数据库，审核和版本边界不同。利益演示走 illustrations.py，不进入上述字段检索。

## 4. AI 调用

```mermaid
flowchart TD
  A["按角色、问题、语言分流"] --> G["普通咨询或岗位方法：通用模型"]
  A --> P["专业：字段查询与规则检查"]
  A --> O["中台：运行快照解释"]
  A --> R["旧 /api/run：规则执行，可选解释"]
  P --> C{"命中、语言与风险"}
  C --> D["国际专业：字段模板"]
  C --> E["国内专业：可附一次模型解释"]
  C --> F["职责题：模板 / 摘录 / 澄清"]
  E --> X["数字和话术检查，失败回字段"]
  G --> Y["调用状态与用量"]
  O --> X
  R --> Y
  X --> Y
```

定位：app.py:768、809、1111、1369、1561；portal_hub.py:362、383；clause_query.py:285。职责字段命中时即使尝试模型，也可能只采用模板。调用成功、最终采用与专业正确性是三个口径。

## 5. 业务端调用

```mermaid
flowchart LR
  A["展业 / 客户自助 / 电话三岗"] --> B["POST /api/channel"]
  B --> C["核对岗位、智能体、演示保单"]
  C --> D["consult_turn 或 answer_turn"]
  E["岗位助手 / 中台助手"] --> F["POST /api/chat"]
  F --> D
  D --> G["字段、段落、规则、模型分支"]
  G --> H["渠道轨迹或对话记录"]
  H --> I["抽检、转人工、运行观测"]
  J["资料与产品管理"] --> K["/api/state、/api/life、/api/documents"]
  L["旧流程试跑与复核"] --> M["/api/run、/api/runs"]
```

定位：app.py:1005、1087、1179、1248、1322、1688、1807。电话、微信和保单均为演示业务上下文，未见真实外部渠道接入。完整性复核和 UI/API 兼容约定见 [前端计划](FRONTEND_UPGRADE_PLAN.md)。
