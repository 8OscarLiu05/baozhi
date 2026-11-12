# 数据库迁移记录

- 受保护源库 D:/baozhi/data/baozhi.sqlite3，开始及完成时 SHA-256 均为 `FABF56750CA8F8199DD779D82CB6D936743618D0EA0B6196B4B15289733EA12B`。
- 隔离目录为 work/knowledge-private，与 worktree 并列。以 SQLite 在线备份 API 从只读源取得 baseline.sqlite3 及 sandbox.sqlite3，备份通过 integrity_check，均含 17 条 legacy 文档。
- 新版 schema 1 只创建 kg_* 表与索引。通过 BEGIN IMMEDIATE 包住 DDL 和版本记录；未知版本拒绝。重复执行保留版本 1，错误 DDL 注入验证事务回滚。迁移没有复制任何旧 published 为新版审核通过。
- 应用仅在显式 --knowledge-sandbox 指定已有副本时启用。CLI 拒绝主目录和 worktree 默认数据库，包括同文件硬链接路径。正常入口不触发本次知识迁移。
- 知识回滚原子切回同合同版次的历史快照，保留审批、发布与查询记录。应用层回退可关闭隔离知识功能；已将一致性备份通过 SQLite backup 恢复到独立 restore-check.sqlite3，验证 integrity_check、17 条 legacy 文档且无 kg_migration。真实运行恢复应在维护窗口另建副本、验证后切换路径；保留迁移后的数据库和审计用于恢复点核对。
