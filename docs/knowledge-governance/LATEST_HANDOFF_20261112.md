# 2026-11-12 最新交接

本次准备将第二阶段知识治理代码提交到feature/knowledge-governance-v1，不合并main。最终提交号与远端核验见比赛资料包的上传完成记录。

最新实现以TABLE_REVIEW_ITERATION_20261112.md和代码为准，优先于早期KNOWN_LIMITATIONS.md、PILOT_EXECUTION_REPORT.md及第一阶段设计文件中的阶段性状态。真实材料为4份21页，现金价值表20个物理表块、23,414个非空数字单元格，12个选定单元格完成定位交叉核查。浏览器退修、审批、发布、回滚与新版展业已用合成样本验证；浏览器上传仍受扩展文件权限阻塞。

真实模型配置缺失，按用户要求跳过。真实候选、专业审批、发布均为0，专业指标没有人工基准分母。未实现OCR、企业认证、持久队列、通用条件引擎及自然语言版次推断，多端新路径先接国内展业。旧published不视为新版专业审批。

上传前重新执行6组84项相关测试全部通过；knowledge.js与classic/app.js语法及git diff --check通过。实际依赖Python3.12.14、pypdf6.21.4、pdfplumber0.11.9、reportlab4.4.9，见requirements-knowledge-verified.txt。原有requirements文件保留，不宣称其他依赖组合已测试。

比赛交接先读../competition-pre-20261117/00_队友先读.md。原正式源库不改写、不上传；运行数据库、密钥与.env不入Git。当前本机令牌仅为试点分岗，不代表生产身份系统。
