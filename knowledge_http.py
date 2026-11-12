"""HTTP adapter using dedicated local operator credentials, separate from demo sessions."""
import hmac
import os

from knowledge_extract import QwenAdapter
from knowledge_store import KnowledgeError, require

PREFIX = "/api/knowledge/v1/"

def credentials():
    result = {}
    for role in ("builder", "reviewer", "publisher"):
        token = os.getenv("BAOZHI_KG_" + role.upper() + "_TOKEN", "")
        if token:
            require(len(token) >= 24 and token.isascii() and token not in result,
                    "知识管理员令牌应至少 24 个 ASCII 字符且各角色不同", 503)
            result[token] = role
    return result

def dispatch(handler, path, data=None):
    store = getattr(handler.server.store, "knowledge", None)
    require(store is not None, "未启用隔离知识工作台", 404)
    header = handler.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    role = next((r for t,r in handler.server.knowledge_credentials.items()
                 if token.isascii() and hmac.compare_digest(t,token)), None)
    require(role, "需要独立的知识工作台凭据", 403)
    parts = path.removeprefix(PREFIX).strip("/").split("/")
    action = parts[0]
    actor = "local:" + role
    if data is None:
        if parts == ["state"]:
            return store.snapshot()
        if len(parts) == 2 and action == "fragments":
            return store.fragments(parts[1])
        if len(parts) == 2 and action == "original":
            return store.original(parts[1])
        if len(parts) == 2 and action == "tables":
            return store.tables(parts[1])
    else:
        if parts == ["versions"] or parts == ["materials"]:
            require(role == "builder", "需要资料登记权限", 403)
            return {"id": (store.version if action == "versions" else store.ingest)(data, actor)}
        if len(parts) == 2:
            ident = parts[1]
            if action in {"verify","review"}:
                require(role == "reviewer", "需要审核权限", 403)
                if action == "verify":
                    store.verify_source(ident, data.get("reason"), actor)
                    return {"verified": True}
                return {"replacement_id":store.review(ident, data, actor)}
            if action == "extract":
                require(role == "builder", "需要提取权限", 403)
                return store.start_extract(ident, actor, QwenAdapter())
            if action == "table-parse":
                require(role == "builder", "需要解析权限", 403)
                result = store.reparse_tables(ident, actor)
                return {k:v for k,v in result.items() if k != "tables"}
            if action in {"publish","restore"}:
                require(role == "publisher", "需要发布权限", 403)
                if action == "publish":
                    return {"release_id":store.release(ident, data, actor)}
                store.restore(ident,data,actor)
                return {"restored":True}
    raise KnowledgeError("知识接口不存在", 404)
