"""REQ-013：需求分流、对话留痕和角色边界。"""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Fault, Store
import portal_hub
import test_app


class PortalStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "portal.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_catalog_products_are_published_once(self):
        products = {d["product"] for d in self.store.snapshot()["documents"] if d["status"] == "published"}
        self.assertTrue({"qianxin", "sample-medical", "ride-accident", "clinic-gap", "demo-product", "demo-service", "demo-underwrite", "demo-ban"} <= products)
        before = len(self.store.snapshot()["documents"])
        self.store.ensure_catalog()
        self.assertEqual(before, len(self.store.snapshot()["documents"]))
        agents = self.store.snapshot()["agents"]
        self.assertTrue(all({"ride-accident", "clinic-gap"} <= set(a["products"]) for a in agents))

    def test_viewer_chat_uses_excerpt_and_blocks_staff_agent(self):
        with patch.dict(os.environ, {"BAOZHI_API_KEY": "", "BAOZHI_MODEL_URL": "", "BAOZHI_MODEL": ""}):
            result = self.store.chat({"agent": "advisor", "message": "住院后的生活津贴和医疗报销有什么不同？"}, "viewer")
        self.assertTrue(result["messages"][-1]["evidence"])
        self.assertEqual(result["messages"][-1]["model"]["status"], "unavailable")
        self.assertIn("摘录", result["messages"][-1]["content"])
        with self.assertRaises(Fault) as caught:
            self.store.chat({"agent": "coach", "message": "陪我练习"}, "viewer")
        self.assertEqual(caught.exception.status, 403)

    def test_quality_flags_promise_without_calling_model(self):
        with patch("portal_hub.complete", return_value={"status": "ok", "text": "这段话把草案说成了确定给付，不能这样讲。", "model": "mock", "usage": {}}):
            result = self.store.chat({"agent": "quality", "message": "购买后住院一定能赔。"}, "builder")
        self.assertIn("一定能赔", result["messages"][-1]["flags"])
        self.assertNotEqual(result["messages"][-1]["model"]["status"], "ok")
        self.assertNotIn("确定给付", result["messages"][-1]["content"])
        saved = self.store.governance()
        self.assertEqual(saved["summary"]["model_ok"], 0)

    def test_rejected_model_text_is_not_shown(self):
        with patch("portal_hub.complete", return_value={"status": "rejected", "message": "模型输出出现不适当的确定性表述，已隐藏并改用资料摘录。"}):
            result = self.store.chat({"agent": "desk", "message": "等待期写了吗？"}, "builder")
        self.assertNotIn("保证", result["messages"][-1]["content"])
        self.assertEqual(result["messages"][-1]["model"]["status"], "rejected")

    def test_promise_detector(self):
        self.assertEqual(portal_hub.promise_hits("我们保证能赔"), ["保证能赔"])
        self.assertEqual(portal_hub.promise_hits("还不能确定"), [])


class PortalHttpTest(unittest.TestCase):
    setUpClass = classmethod(test_app.HttpTest.setUpClass.__func__)
    tearDownClass = classmethod(test_app.HttpTest.tearDownClass.__func__)
    request = test_app.HttpTest.request
    login = test_app.HttpTest.login

    def test_viewer_portal_hides_staff_tools_and_governance(self):
        token = self.login("viewer")
        code, portal = self.request("/api/portal", token=token)
        self.assertEqual(code, 200)
        self.assertTrue(portal["products"])
        self.assertTrue(all(a["audience"] == "user" for a in portal["agents"]))
        self.assertEqual(portal["benches"], [])
        self.assertEqual(self.request("/api/governance", token=token)[0], 403)
        self.assertEqual(self.request("/api/chat", {"agent": "underwrite", "message": "给个核保结论"}, token)[0], 403)


if __name__ == "__main__":
    unittest.main()
