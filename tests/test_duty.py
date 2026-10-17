"""REQ-017：九条职责菜单、三个渠道入口和虚构公司库。"""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Fault, Store
import company_library
import test_app


QUIET = {"BAOZHI_API_KEY": "", "BAOZHI_MODEL_URL": "", "BAOZHI_MODEL": ""}


def ask(store, role, **fields):
    payload = {"text": "已发布资料里，住院生活津贴写了什么？不要下结论。", "policy": "", **fields}
    with patch.dict(os.environ, QUIET):
        return store.channel_ask(payload, role)


class LibraryTest(unittest.TestCase):
    def test_seed_is_stable_and_labeled_fictional(self):
        first, second = company_library.generate(), company_library.generate()
        self.assertEqual(first, second)
        self.assertEqual(first["org"]["name"], "示意保险（虚构）")
        self.assertEqual(first["org"]["seed"], 20261011)
        self.assertEqual(len(first["staff"]), 18)
        self.assertEqual(len({row["duty"] for row in first["staff"]}), 9)
        self.assertEqual(len(first["customers"]), 40)
        self.assertEqual(len(first["policies"]), 120)
        self.assertTrue(all(row["id"].startswith("DEMO-") and row["status"] == "演示保单" for row in first["policies"]))
        self.assertEqual(sum(row["customer_id"] == "客户-01" for row in first["policies"]), 3)
        self.assertEqual(len(first["sessions"]), 20)
        self.assertEqual(len(first["calls"]), 20)
        self.assertEqual(sum(row["status"] == "error" for row in first["calls"]), 1)
        self.assertEqual(sum(row["status"] == "rejected" for row in first["calls"]), 1)
        self.assertEqual(sum(row["handoff"] for row in first["calls"]), 1)
        self.assertTrue(all(row["channel"] in company_library.CHANNELS and row["fictional"] for row in first["calls"]))
        self.assertTrue(all(row["mark"] == "虚构句子" for row in first["products"]))


class DutyStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "duty.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_company_import_keeps_existing_documents(self):
        products = {row["product"] for row in self.store.snapshot()["documents"]}
        self.assertIn("qianxin", products)
        company = self.store.company()
        self.assertEqual(company["org"]["name"], "示意保险（虚构）")
        self.assertEqual(company["counts"]["staff"], 18)
        self.assertEqual(company["counts"]["customers"], 40)
        self.assertEqual(company["counts"]["policies"], 120)
        self.assertEqual(company["counts"]["calls"], 20)
        self.assertTrue(company["fictional"])
        self.store.ensure_company()
        self.assertEqual(self.store.company()["counts"]["staff"], 18)

    def test_three_channels_share_one_record_and_keep_excerpt(self):
        sales = ask(self.store, "sales", channel="sales", duty="sales", operator="展业-01", context="客户-01", policy="DEMO-01")
        self.assertFalse(sales["adopted"])
        self.assertTrue(sales["manual"])
        self.assertTrue(sales["excerpts"])
        self.assertTrue(any("虚构句子" in row["title"] for row in sales["excerpts"]))
        self.assertNotIn("一定能赔", sales["answer"])
        self.assertEqual(sales["trace"]["model_call"]["count"], 0)
        self.assertEqual(sales["trace"]["model_call"]["provider"], "未调用模型")
        customer = ask(self.store, "customer", channel="self", duty="customer", operator="客户-01", context="客户-01", policy="DEMO-01", text="这张演示保单对应的资料写了什么？")
        seat = ask(self.store, "seat", channel="phone", duty="seat", operator="坐席-01", context="通话-01", text="客户问住院生活津贴，请只根据摘录给旁边的提示。")
        self.assertEqual([sales["channel"], customer["channel"], seat["channel"]], ["sales", "self", "phone"])
        with self.store.db() as c:
            stored = c.execute("SELECT text,context_id FROM channel_calls WHERE id=?", (sales["call_id"],)).fetchone()
            seat_row = c.execute("SELECT text,context_id,channel FROM channel_calls WHERE id=?", (seat["call_id"],)).fetchone()
        self.assertEqual(stored["text"], "已发布资料里，住院生活津贴写了什么？不要下结论。")
        self.assertNotIn("演示上下文", stored["text"])
        self.assertEqual(seat_row["context_id"], "通话-01")
        self.assertEqual(seat_row["channel"], "phone")

    def test_promise_and_model_failure_keep_excerpt(self):
        with patch("portal_hub.complete", return_value={"status": "ok", "text": "这个一定能赔，每天都有。", "model": "mock", "usage": {}}):
            hidden = ask(self.store, "sales", channel="sales", duty="sales", operator="展业-01", context="客户-01", policy="DEMO-01", text="那是不是一定能赔")
        self.assertFalse(hidden["adopted"])
        self.assertNotIn("每天都有", hidden["answer"])
        self.assertTrue(hidden["excerpts"])
        with patch("portal_hub.complete", return_value={"status": "error", "message": "模型连接或返回结果异常，已改用资料摘录。"}):
            failed = ask(self.store, "customer", channel="self", duty="customer", operator="客户-02", context="客户-02", policy="DEMO-02", text="中宏健康双星的等待期是多少天？")
        self.assertEqual(failed["status"], "error")
        self.assertIn("90", failed["answer"])
        self.assertIn("意外伤害", failed["answer"])
        self.assertFalse(failed["adopted"])
        self.assertEqual(failed["trace"]["model_call"]["count"], 1)
        self.assertEqual(failed["trace"]["model_call"]["status"], "error")

    def test_handoff_reaches_service_and_quality_does_not_rewrite(self):
        call = ask(self.store, "customer", channel="self", duty="customer", operator="客户-04", context="客户-04", text="请帮我看一下这张演示保单。")
        saved = self.store.channel_handoff({"call_id": call["call_id"]}, "customer")
        self.assertEqual(saved["status"], "待处理")
        visible = self.store.handoff_list("service")
        self.assertTrue(any(item["call_id"] == call["call_id"] and item["customer_id"] == "客户-04" for item in visible["items"]))
        with self.assertRaises(Fault):
            self.store.handoff_list("sales")
        seat = ask(self.store, "seat", channel="phone", duty="seat", operator="坐席-01", context="通话-08", text="坐席当时的提示：只说摘录，不承诺赔付。")
        ask(self.store, "quality", channel="phone", duty="quality", operator="质检-01", context="通话-09", text="事后检查这段转写，不要改原来的提示。")
        with self.store.db() as c:
            again = c.execute("SELECT answer FROM channel_calls WHERE id=?", (seat["call_id"],)).fetchone()["answer"]
        self.assertEqual(again, seat["answer"])

    def test_duty_cannot_call_another_agents_or_read_all_calls(self):
        with self.assertRaises(Fault) as caught:
            self.store.chat({"agent": "underwrite", "message": "给个承保结论"}, "claim")
        self.assertEqual(caught.exception.status, 403)
        with self.assertRaises(Fault):
            self.store.chat({"agent": "desk", "message": "我想自己问"}, "customer")
        with self.assertRaises(Fault):
            ask(self.store, "sales", channel="phone", duty="sales", operator="展业-01", context="通话-01")
        with self.assertRaises(Fault):
            ask(self.store, "outreach", channel="phone", duty="outreach", operator="外呼-01", context="客户-01", text="给客户写开场白")
        with self.assertRaises(Fault):
            ask(self.store, "sales", channel="sales", duty="sales", operator="展业-01", context="客户-01", policy="DEMO-02")
        with self.assertRaises(Fault):
            self.store.channel_calls("sales")
        made = ask(self.store, "sales", channel="sales", duty="sales", operator="展业-01", context="客户-05")
        found = self.store.channel_calls("platform", "sales", made["call_id"])
        self.assertEqual(found["calls"][0]["id"], made["call_id"])
        portal = self.store.create_dialog_agent({"name": "展业简报", "duty": "只根据已发布资料说明产品边界。", "audience": "staff", "products": ["qianxin"], "duties": ["sales"]}, "platform")
        self.assertTrue(any(item["name"] == "展业简报" for item in self.store.portal("sales")["agents"]))
        self.assertFalse(any(item["name"] == "展业简报" for item in self.store.portal("underwrite")["agents"]))
        self.assertTrue(any(item["name"] == "展业简报" for item in portal["agents"]))

    def test_job_pages_only_see_their_agents(self):
        self.assertEqual({item["id"] for item in self.store.portal("underwrite")["agents"]}, {"underwrite"})
        self.assertEqual({item["id"] for item in self.store.portal("training")["agents"]}, {"coach"})
        self.assertEqual({item["id"] for item in self.store.portal("claim")["agents"]}, {"claimguide"})
        service = {item["id"] for item in self.store.portal("service")["agents"]}
        self.assertTrue({"desk", "claimguide"} <= service)
        self.assertNotIn("underwrite", service)

    def test_platform_agents_are_not_given_to_channels(self):
        sales = {item["id"] for item in self.store.portal("sales")["agents"]}
        self.assertTrue({"advisor", "compare"} <= sales)
        self.assertNotIn("ops-observe", sales)
        self.assertNotIn("ops-knowledge", sales)
        platform = {item["id"] for item in self.store.portal("platform")["agents"]}
        self.assertTrue({"ops-knowledge", "ops-observe", "ops-sample", "ops-grant", "ops-voice"} <= platform)
        with patch.dict(os.environ, QUIET):
            watched = self.store.chat({"agent": "ops-observe", "message": "三个入口最近用得怎么样？"}, "platform")
        self.assertIn("运行观测", watched["messages"][-1]["content"])
        self.assertIn("调用", watched["messages"][-1]["content"])
        with self.assertRaises(Fault) as caught:
            self.store.chat({"agent": "ops-grant", "message": "展业能调用哪些智能体？"}, "sales")
        self.assertEqual(caught.exception.status, 403)


class DutyHttpTest(unittest.TestCase):
    setUpClass = classmethod(test_app.HttpTest.setUpClass.__func__)
    tearDownClass = classmethod(test_app.HttpTest.tearDownClass.__func__)
    request = test_app.HttpTest.request
    login = test_app.HttpTest.login

    def test_server_rejects_cross_duty_and_keeps_platform_search(self):
        sales = self.login("sales")
        platform = self.login("platform")
        customer = self.login("customer")
        self.assertEqual(self.request("/api/dialog-agents", {"name": "越权", "duty": "不该建成", "products": ["qianxin"]}, sales)[0], 403)
        self.assertEqual(self.request("/api/channel/calls", token=sales)[0], 403)
        self.assertEqual(self.request("/api/documents", {"title": "越权资料", "product": "nope", "kind": "mock", "source": "测试", "content": "正文"}, sales)[0], 403)
        self.assertEqual(self.request("/api/chat", {"agent": "desk", "message": "我想绕过渠道"}, customer)[0], 403)
        code, company = self.request("/api/company", token=sales)
        self.assertEqual(code, 200)
        self.assertIn("虚构", company["org"]["name"])
        with patch.dict(os.environ, QUIET):
            code, result = self.request("/api/channel", {"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-01", "policy": "DEMO-01", "text": "住院生活津贴在已发布资料里怎么写？"}, sales)
        self.assertEqual(code, 200)
        self.assertTrue(result["call_id"])
        self.assertTrue(result["excerpts"])
        code, calls = self.request("/api/channel/calls?channel=sales&q=" + result["call_id"], token=platform)
        self.assertEqual(code, 200)
        self.assertEqual(calls["calls"][0]["id"], result["call_id"])
        code, state = self.request("/api/state", token=self.login("builder"))
        self.assertEqual(state["build"], "REQ071-20261018")
        self.assertEqual(state["version"], "0.17.1")


if __name__ == "__main__":
    unittest.main()
