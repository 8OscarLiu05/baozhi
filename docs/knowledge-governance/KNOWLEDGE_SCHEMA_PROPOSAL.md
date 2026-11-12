# 统一知识结构方案

现有 products.doc_id 只能指一个文档，documents.version 是上传序号。保留旧键和旧表，新增知识域表，分别表达产品身份、合同版次、材料修订和知识发布。以下为逻辑 Schema，DDL 在第二阶段确认。

| 实体 | 关键字段和约束 |
|---|---|
| kb_product | id，insurer_id，canonical_name，product_kind，legacy_product_id 可空。别名另表，按公司和版本范围解析；重名返回多候选 |
| kb_product_version | id，product_id，filing_number，edition_key，valid_from/to，date_status，scope。product_id + edition_key 唯一，未知日期用 null 加原因 |
| kb_version_relation | base_version_id，rider_version_id，relation_type，有效期及证据；主附险按具体版本关联 |
| kb_asset | id，sha256 唯一，storage_key，mime，bytes，ingested_at；对象只读。相同字节复用对象，来源观察独立记录 |
| kb_material_version | id，asset_id，material_type，issuer，title，edition，supersedes_id，source_url，retrieved_at，verification_status，evidence_class，适用日期；多产品版本通过映射表关联 |
| kb_parse / kb_evidence | parse_id 绑定材料与解析配置，evidence_id 绑定原件哈希与解析修订；physical_page（从 1 起）、printed_page、clause_key、字符范围、bbox、表格行列、verbatim_quote |
| kb_job / kb_issue | task_id，阶段，状态，attempt，lease_until，input_fingerprint，parser/model/prompt/schema 版本。issue 挂到任务或事实，保存错误码、严重级、说明和关闭凭据 |
| kb_fact / kb_fact_revision | fact_id 标识产品版本与语义项；revision_id 保存 field_key、domain、typed_value、unit、benefit_basis、条件、例外、依赖和生效范围，修订不可覆盖 |
| kb_fact_evidence | revision_id + evidence_id + role 唯一，role 区分 supports、condition、exception、definition、table_lookup；同版本或有依据的主附险关系 |
| kb_review_event | revision_id，actor_id，decision，risk，reason，rubric_version，at，previous_event_id；追加保存，修订后需重新审核 |
| kb_release / kb_release_fact / kb_release_head | release 绑定产品版本及序列；成员指定 fact_revision；head 仅指同产品版本的快照。发布事务原子切换 head，审计记录撤回与回滚 |

### 事实与约束

domain 区分产品元数据、合同事实和业务服务规则。benefit_basis 采用 guaranteed、non_guaranteed、illustration、not_applicable、unknown。金额用十进制定点值及币种，比例有明确表示法，年龄区分周岁与保单周年日。复杂公式使用白名单运算、已版本化查表和明确舍入规则，保留输入和公式出处。条件与例外采用有限的 AND/OR/比较/事实引用结构，限定值类型。缺失、未知、明确无此责任、确实不适用分别表达。例外不能通过空数组默认认定不存在。

产品、版本和适用范围先匹配，再判断材料能证明哪类事实。已确认适用的正式条款及构成合同的附件支持合同权利义务；投保须知支持适用渠道和投保程序；正式业务规则支持其生效范围内的服务口径；说明书及演示材料只支持披露与示例。费率、现金价值和领取转换表须核对表头、版本及合同引用关系。发行人官网、行业协会和监管来源登记来源角色，不能仅凭站点等级消除同版本冲突。实质冲突挂起，由审核者选择依据并写理由；不同合同版本不合并。

### 迁移和回滚

采用新增表、约束、索引和迁移流水。复合外键或事务校验保证发布成员与证据在授权版本范围内，新连接开启 foreign_keys。索引优先覆盖 version_id + field_key、release_id、job state + lease。映射已有产品及文档进入 legacy 演示域，证据不够的待核实，旧 published 不自动生成审核事件。迁移前对 SQLite 做一致备份并生成资产清单，在副本做前后行数、引用完整性、两次执行及恢复验证。上线后优先关闭开关、回切发布指针，保留新审计数据；只有灾难恢复才在维护窗口用校验后的数据库与原件备份整体恢复，并记录恢复点以后需重放的事件。
