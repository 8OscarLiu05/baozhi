"""外部条款对照和新建对话智能体。"""
import tempfile
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Fault, Store
import external_material as em


class ParseTest(unittest.TestCase):
    def test_allowance_file_stops_before_the_next_policy(self):
        text = "住院日额津贴" + ("日额。" * 200) + "附加个人意外伤害医疗保险\n燃气用户意外伤害"
        kept = em.allowance_text(text)
        self.assertNotIn("医疗保险", kept)
        self.assertNotIn("燃气", kept)

    def test_articles_stay_together(self):
        text = "第一条 合同构成\n本附加合同成立。\n第七条 保险责任\n因意外住院给付日额津贴。\n第八条 责任免除\n疾病不承担。"
        blocks = em.clause_blocks(text)
        self.assertTrue(any("第七条" in block and "日额津贴" in block for block in blocks))
        self.assertTrue(any("第八条" in block and "疾病" in block for block in blocks))

    def test_reading_does_not_decide_cover(self):
        reading = em.read_question("我有高血压，住院后生活费怎么办")
        self.assertEqual(reading["event"], "提到住院")
        self.assertEqual(reading["cause"], "提到高血压")
        self.assertIn("不是投保", reading["note"])

    def test_selected_questions_keep_excerpt_not_model_promise(self):
        rows = em.selected_questions(
            {"某短期住院津贴条款": {"等待期怎么算？": {"p": "等待期为三十日。"}}},
            [{"input": "片段内容：住院日额津贴按日给付。用户提问：医药费能报销吗？", "output": "保证能赔", "id": 1}],
        )
        self.assertEqual(len(rows), 2)
        self.assertNotIn("保证能赔", "".join(rows[1]))


class AgentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "ext.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_staff_only_agent_is_hidden_from_viewer(self):
        portal = self.store.create_dialog_agent({"name": "内部核对话术", "duty": "只给工作人员列缺项", "audience": "staff", "products": ["qianxin"]}, "builder")
        created = next(item for item in portal["agents"] if item["name"] == "内部核对话术")
        self.assertEqual(created["origin"], "工作人员新建")
        with self.assertRaises(Fault) as caught:
            self.store.chat({"agent": created["id"], "message": "给我核保结论"}, "viewer")
        self.assertEqual(caught.exception.status, 403)
        viewer = self.store.portal("viewer")
        self.assertFalse(any(item["id"] == created["id"] for item in viewer["agents"]))

    def test_downloaded_allowance_clause_stays_external(self):
        docs = [item for item in self.store.snapshot()["documents"] if item["product"] == em.PRODUCT]
        if not docs:
            self.skipTest("本机没有附加保险材料目录")
        doc = self.store.document(docs[0]["id"])
        self.assertEqual(doc["kind"], "imported")
        self.assertEqual(doc["status"], "published")
        living = next(rule for rule in doc["rules"] if rule["scenario"] == "living")
        self.assertEqual(living["outcome"], "limited")
        self.assertIn("意外", living["note"])
        self.assertNotIn("燃气用户意外伤害", doc["content"])


if __name__ == "__main__":
    unittest.main()
