# 表格解析与审核准备执行记录

日期 2026-11-12。基于 feature/knowledge-governance-v1，HEAD ff00af0d0c4f44d2fee89a20b98d571ea42f53fb。真实模型按用户指示继续跳过。本记录更新前轮现金价值表网格为零、浏览器退修/回滚/展业未实测的状态。

## 已完成

现金价值表网格识别从 0 提升到 20 个物理表块，共 23,414 个非空数字单元格。根因是原件约3点的行距与默认3点容差相近，默认配置合并相邻横线。新增 knowledge_tables.py 对小字号网格采用小容差，保留实际页面、坐标、逐格文字、空白和表前说明。年龄与年度映射不依赖整页文本的空格顺序。

第3页首表的表前说明来自第2页末尾，明确保存来源页和坐标。第4页首表续接第3页末表的年度行；第5页首表续接第4页末表。只有列几何相符、年度连续且当前没有新表说明时才继承前表列标签。空白、零和合并单元格分别表示。

12个选定单元格通过表格结果、固定回归预期与原件字符坐标的交叉检查，覆盖5页、左右年龄边界、2处年度续表及不同表块。此项为工程定位核验，只核查所列样本，没有全量专业标注，不能据此报告全表准确率。

新增表格解析任务通过原 kg_task 保存不可覆盖结果，包含材料、原件哈希、解析版本和审计。保留原片段及其证据ID。表格类资料的专业状态保持 needs_review。为避免状态列表返回数兆网格，任务列表只显示摘要，受权表格详情接口单独读取完整结果。工作台新增表块和年龄列筛选，续表显示表头来源。

## 浏览器执行证据

在相互独立的真实隔离库和合成临时库进行实机 Edge 验证。

| 操作 | 结果 |
|---|---|
| PDF文件上传 | 阻塞。扩展未允许本地文件URL访问，filechooser.setFiles被拒绝，未改权限设置。上传后端原有HTTP测试通过 |
| 合成候选退修 | 完成。错误99 days记录E02，原候选保留needs_revision，创建30 days的新修订 |
| 合成修订审批/发布 | 完成。按审核岗与发布岗操作，生成第二个快照 |
| 历史回滚 | 完成。指针回到初始合法快照，两个快照和三个审核事件保留 |
| 回滚后展业查询 | 完成。两次查询均记录初始快照和对应事实ID，返回合成数据标签及原文证据 |
| 展业展示修复 | 旧咨询组件曾误显示“未匹配到授权资料”，新增已发布知识结果视图。重载后实际显示合同版次、发布批次、事实、证据编号、原件哈希与最终答复 |
| 真实网格查看 | 完成。第4页p4-t1可按18岁列筛选，显示第3页表头来源、年度14起的金额和格子坐标 |
| 浏览器日志 | 查询页面捕获到用户既有Zotero扩展的连接错误，错误URL为chrome-extension。未观察到应用自身脚本异常 |

浏览器上传设置提示为 Microsoft Edge 的 edge://extensions → ChatGPT扩展详情 → Allow access to file URLs。按浏览器技能的文件上传故障说明，上传实操在此暂停，详见 https://developers.openai.com/codex/app/chrome-extension#upload-files 。上传扩展权限须由用户处理。

截图保存在本次交付目录。browser_fixture_results.json包含合成审核、发布、回滚、查询轨迹；临时测试服务器已停止，合成临时数据库已随资源退出清理。真实数据库无候选、审批或发布。

## 人工审核交付

人工审核工作包.md按16类字段列出专业核验问题与原文定位，统一汇编逐字原文，避免重复查找。覆盖领取起始分支、领取方式/类型、公式前提、身故、免除和现金价值等。待人工判断清单.json保留空白事实值、条件、例外、审核人、日期及专业状态。

这些材料为确定性原文导航。没有真实AI候选，专业基准尚未建立，准确率、召回率和条件完整率未计算。人工工作包可先用于专业人员独立标注基准。

## 测试及数据保护

最终4项新表格用例、14项知识治理用例和66项原有回归全部通过，合计84项。权限用例包含客户及审核岗不能触发表格重解析、客户不能读网格、只有表格材料可重解析、表格详情及摘要返回正确。补测后的14项仍全部通过。中英文脚本语法和git diff --check通过。

解析/测试环境实际为pypdf 6.21.4、pdfplumber 0.11.9、reportlab 4.4.9。新增requirements-knowledge.txt登记可选网格及测试依赖，继承项目原PDF依赖要求；原requirements.txt锁定版本与当前运行时不同，尚未对另一安装组合重新测试。

开始前对隔离库创建SQLite一致备份 work/knowledge-private/before-table-v2.sqlite3。结束时隔离库integrity_check为ok，foreign_key_check无错误，真实candidate/review/release均为0。受保护源库D:/baozhi/data/baozhi.sqlite3前后SHA-256一致，为fabf56750ca8f8199dd779d82cb6d936743618d0ea0b6196b4b15289733ea12b。

## 本轮代码与复现

新增knowledge_tables.py、tests/test_knowledge_tables.py、tools/prepare_annuity_review_packet.py、requirements-knowledge.txt。更新knowledge_store.py、knowledge_http.py、static/classic/app.js、knowledge.html、knowledge.js、knowledge.css、tests/test_knowledge_governance.py、tools/serve_knowledge_browser_test.py。本轮变更保持未提交，尚未推送或合并。

从worktree执行测试，可使用含依赖的Python。

    python -B -X utf8 -m unittest discover -s tests -p test_knowledge_tables.py -v
    python -B -X utf8 -m unittest discover -s tests -p test_knowledge_governance.py -v
    python -B -X utf8 -m unittest discover -s tests -p test_consultation.py -v
    python -B -X utf8 -m unittest discover -s tests -p test_life.py -v
    python -B -X utf8 -m unittest discover -s tests -p test_app.py -v
    python -B -X utf8 -m unittest discover -s tests -p test_intl.py -v

生成真实表格与审核包会新增解析任务，保留旧结果。

    python -B -X utf8 tools/prepare_annuity_review_packet.py ../knowledge-private 输出目录

## 后续节点

需要专业人员独立标注工作包，才能形成真实质量分母并审批事实。真实模型调用继续等本机配置可用。浏览器上传需用户开启上述文件权限后补验。跨页上下文及合并表头仍是专业审核重点，当前结果不用于自动计算个人保单退保金额。
