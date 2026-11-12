# 工程测试

2026-11-09。所有数据库测试使用临时库或明确隔离副本。

| 测试层 | 结果 |
|---|---|
| 旧回归 | 66 通过。test_consultation.py 16、test_life.py 12、test_app.py 32、test_intl.py 6 |
| 新逻辑与安全 | 9 个存储/校验/安全用例通过。含迁移失败回滚、重复迁移、坏 PDF、同原件去重、跨产品/跨版、模型超时及错误响应、数值与单位、审核修订、冲突与发布回滚 |
| HTTP 端到端 | 1 个综合用例通过。实际回环 HTTP 建版、上传 PDF、查原件/解析、注入明确标识的合成提取、审核、发布、渠道查询、回滚和历史保留。客户/展业无候选及审批权限、伪造 actor 无效、未授权版次和英文分支拒绝 |
| 实际 CLI 启动 | 拒绝以源库启动知识模式。隔离服务启动后，两版首页、国内工作台及脚本、真实样本列表返回成功。测试进程已关闭 |
| 前端静态检查 | 国内工作台脚本、国内既有脚本、国际既有脚本通过 node --check。未执行真实浏览器交互 |
| 真实千问 / 专业事实审核 | 未执行。无完整运行配置，无人工专业结论 |

从 worktree 运行，Python 环境需含 requirements.txt 中的 pypdf。

```powershell
python -B -X utf8 -m unittest discover -s tests -p test_knowledge_governance.py -v
foreach ($name in @('test_consultation.py','test_life.py','test_app.py','test_intl.py')) {
  python -B -X utf8 -m unittest discover -s tests -p $name -v
}
node --check static/classic/knowledge.js
node --check static/classic/app.js
node --check static/app.js
```
