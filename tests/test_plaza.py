"""REQ-021：智能体广场、综合职能智能体与制度演示边界。测试使用临时数据库。"""
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Fault, Store
import portal_hub
import test_app


QUIET = {"BAOZHI_API_KEY": "", "BAOZHI_MODEL_URL": "", "BAOZHI_MODEL": ""}


class PlazaAgentTest(unittest.TestCase):
    def test_office_agents_registered_with_office_lane(self):
        names = {item["id"]: item for item in portal_hub.AGENTS}
        for ident, name in (("hr-policy", "人事制度助手"), ("admin-guide", "行政办事指引"), ("it-helpdesk", "IT 报障与账号")):
            self.assertIn(ident, names)
            self.assertEqual(names[ident]["name"], name)
            self.assertEqual(names[ident]["lane"], "office")
            self.assertEqual(names[ident]["layer"], "channel")
            self.assertEqual(names[ident]["audience"], "staff")
            self.assertTrue(set(names[ident]["products"]) <= set(portal_hub.OFFICE_PRODUCTS))
            self.assertIn("真实", names[ident]["boundary"])
        self.assertNotIn("data-agent", names)
        self.assertNotIn("insight-agent", names)
        lanes = {item["id"]: item.get("lane") for item in portal_hub.AGENTS}
        self.assertEqual(lanes["advisor"], "sales")
        self.assertEqual(lanes["desk"], "service")
        self.assertEqual(lanes["underwrite"], "uwclaim")
        self.assertEqual(lanes["outreach"], "phone")
        self.assertEqual(lanes["ops-voice"], None)

    def test_office_demo_documents_are_published_fictional(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(Path(temp) / "plaza.sqlite3")
            docs = {row["product"]: row for row in store.snapshot()["documents"]}
            for product in portal_hub.OFFICE_PRODUCTS:
                self.assertIn(product, docs)
                self.assertEqual(docs[product]["status"], "published")
                self.assertEqual(docs[product]["kind"], "mock")
            published = store.portal("platform")["products"]
            titles = [row["title"] for row in published]
            self.assertTrue(any("人事制度演示" in title for title in titles))


class PlazaStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "plaza.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_plaza_portal_lists_sixteen_agents_for_platform(self):
        portal = self.store.portal("platform")
        agents = {item["id"]: item for item in portal["agents"]}
        self.assertEqual(len(portal["agents"]), 16)
        for ident in ("advisor", "compare", "desk", "claimguide", "coach", "outreach", "underwrite", "quality",
                      "ops-knowledge", "ops-observe", "ops-sample", "ops-grant", "ops-voice",
                      "hr-policy", "admin-guide", "it-helpdesk"):
            self.assertIn(ident, agents)
        self.assertEqual(agents["ops-voice"]["layer"], "platform")
        self.assertEqual(agents["hr-policy"]["lane"], "office")
        self.assertEqual(agents["hr-policy"]["origin"], "平台预置")
        self.assertIn("内勤", agents["hr-policy"]["note"])

    def test_office_agents_hidden_from_other_duties(self):
        for role in ("sales", "service", "outreach", "seat", "quality", "underwrite", "claim", "training", "customer", "viewer"):
            portal = self.store.portal(role)
            self.assertTrue(all(item.get("lane") != "office" for item in portal["agents"]), role)

    def test_office_chat_quotes_only_office_documents(self):
        with patch.dict(os.environ, QUIET):
            result = self.store.chat({"agent": "hr-policy", "message": "病假要提前多久登记？"}, "platform")
        last = result["messages"][-1]
        self.assertTrue(last["evidence"])
        self.assertTrue(all("演示" in row["title"] for row in last["evidence"]))
        self.assertIn("病假", last["content"])
        self.assertIn("OA", last["content"])
        with patch.dict(os.environ, QUIET):
            mixed = self.store.chat({"agent": "it-helpdesk", "message": "住院津贴怎么申请？"}, "platform")
        titles = {row["title"] for row in mixed["messages"][-1]["evidence"]}
        self.assertTrue(titles <= {"IT 报障与账号演示（虚构）"}, titles)

    def test_office_chat_says_missing_when_no_excerpt(self):
        with patch.dict(os.environ, QUIET):
            result = self.store.chat({"agent": "admin-guide", "message": "班车路线怎么走？"}, "platform")
        last = result["messages"][-1]
        self.assertIn("没有检索到对应原文", last["content"])
        self.assertIn("办结", last["content"])

    def test_duty_roles_cannot_call_office_or_platform_agents(self):
        for role in ("sales", "service", "training"):
            with self.assertRaises(Fault) as caught:
                self.store.chat({"agent": "hr-policy", "message": "请假流程"}, role)
            self.assertEqual(caught.exception.status, 403)
            with self.assertRaises(Fault) as caught:
                self.store.chat({"agent": "ops-knowledge", "message": "知识结构"}, role)
            self.assertEqual(caught.exception.status, 403)

    def test_plaza_call_counts_are_real_channel_records(self):
        with patch.dict(os.environ, QUIET):
            self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-01", "policy": "", "text": "已发布资料里，住院生活津贴写了什么？"}, "sales")
        counts = {item["id"]: item["calls"] for item in self.store.portal("platform")["agents"]}
        self.assertGreaterEqual(counts["advisor"], 1)
        self.assertEqual(counts["hr-policy"], 0)
        self.assertEqual(counts["ops-observe"], 0)

    def test_backup_before_office_documents_and_reseed(self):
        path = Path(self.temp.name) / "plaza.sqlite3"
        connection = sqlite3.connect(path)
        ids = [row[0] for row in connection.execute("SELECT id FROM documents WHERE product LIKE 'office-%'")]
        for doc_id in ids:
            connection.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))
            connection.execute("DELETE FROM rules WHERE doc_id=?", (doc_id,))
            connection.execute("DELETE FROM clauses WHERE doc_id=?", (doc_id,))
            connection.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        connection.commit()
        connection.close()
        Store(path)
        backups = list((Path(self.temp.name) / "backups").glob("before-REQ021-*.sqlite3"))
        self.assertEqual(len(backups), 1)
        restored = {row["product"] for row in Store(path).snapshot()["documents"]}
        self.assertTrue(set(portal_hub.OFFICE_PRODUCTS) <= restored)
        self.assertEqual(len(list((Path(self.temp.name) / "backups").glob("before-REQ021-*.sqlite3"))), 1)


class PlazaHttpTest(unittest.TestCase):
    setUpClass = classmethod(test_app.HttpTest.setUpClass.__func__)
    tearDownClass = classmethod(test_app.HttpTest.tearDownClass.__func__)
    request = test_app.HttpTest.request
    login = test_app.HttpTest.login

    def test_portal_endpoint_exposes_office_agents_only_to_platform(self):
        platform = self.login("platform")
        code, portal = self.request("/api/portal", token=platform)
        self.assertEqual(code, 200)
        lanes = {item["lane"] for item in portal["agents"]}
        self.assertIn("office", lanes)
        self.assertTrue(all("calls" in item for item in portal["agents"]))
        sales = self.login("sales")
        code, sales_portal = self.request("/api/portal", token=sales)
        self.assertEqual(code, 200)
        self.assertTrue(all(item.get("lane") != "office" for item in sales_portal["agents"]))
        self.assertEqual(self.request("/api/chat", {"agent": "hr-policy", "message": "请假"}, sales)[0], 403)


if __name__ == "__main__":
    unittest.main()
