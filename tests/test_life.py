"""REQ-019：结构化条款、字段回答、合规拦截和利益演示。"""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Fault, Store
import clause_query
import compliance_rules
import illustrations


QUIET = {"BAOZHI_API_KEY": "", "BAOZHI_MODEL_URL": "", "BAOZHI_MODEL": ""}


class LifeStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "life.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def products(self):
        with self.store.db() as c:
            return clause_query.load_rows(c)

    def test_catalog_keeps_source_and_does_not_duplicate(self):
        rows = self.products()
        self.assertEqual(len(rows), 4)
        self.assertEqual({row["shelf"] for row in rows}, {"主产品", "对照"})
        for row in rows:
            self.assertTrue(row["company"] and row["name"] and row["source_file"])
            self.assertTrue(row["duties"] and all(duty["cite"] for duty in row["duties"]))
            self.assertTrue(row["exclusions"] and all(group["cite"] for group in row["exclusions"]))
        self.store.ensure_life()
        self.assertEqual(len(self.products()), 4)
        company = self.store.company()
        linked = {row["id"]: row for row in company["policies"]}
        self.assertEqual(linked["DEMO-01"]["catalog_id"], "life-zhongying-xinyue")
        self.assertIn("中英", linked["DEMO-01"]["catalog_name"])
        self.assertEqual(linked["DEMO-02"]["catalog_id"], "ci-zhonghong-shuangxing")
        self.assertIn("不代表该公司承保", linked["DEMO-01"]["catalog_notice"])

    def test_field_questions_match_structured_values(self):
        rows = self.products()
        checked = 0
        for item in clause_query.exam_questions():
            found = clause_query.lookup(rows, item["ask"], item["product"] or None)
            self.assertTrue(clause_query.grade(found["grounded"], item["expect"]), item["ask"] + " => " + found["grounded"])
            if not item["paraphrase"]:
                self.assertIn("〔", found["grounded"])
            checked += 1
        self.assertGreaterEqual(checked, 20)

    def test_yield_question_has_no_rate_and_is_sampled(self):
        with patch.dict(os.environ, QUIET):
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-01", "policy": "DEMO-01", "text": "这款每年能赚多少？"}, "sales")
        self.assertNotIn("%", result["answer"])
        self.assertIn("分红不保证", result["answer"])
        self.assertFalse(result["adopted"])
        self.assertTrue(any(rule["id"] == "yield_guarantee" for rule in result["rules"]))
        calls = self.store.channel_calls("platform")
        self.assertEqual(calls["calls"][0]["rule_category"], "yield_guarantee")

    def test_four_rule_classes_and_review_keeps_answer(self):
        samples = [
            ("一定能赔", "promise_pay"),
            ("红利肯定有", "yield_guarantee"),
            ("这比存银行划算", "deposit_compare"),
            ("这是全市场第一", "disparage"),
        ]
        made = []
        with patch.dict(os.environ, QUIET):
            for text, expected in samples:
                result = self.store.channel_ask({"channel": "phone", "duty": "quality", "operator": "质检-01", "context": "通话-03", "text": text}, "quality")
                self.assertIn(expected, result["rules"][0]["id"])
                self.assertNotIn("%", result["answer"])
                made.append(result)
        before = made[0]["answer"]
        saved = self.store.sample_review({"call_id": made[0]["call_id"], "action": "confirm"}, "platform")
        self.assertTrue(saved["answer_unchanged"])
        with self.store.db() as c:
            after = c.execute("SELECT answer FROM channel_calls WHERE id=?", (made[0]["call_id"],)).fetchone()["answer"]
        self.assertEqual(after, before)
        with self.assertRaises(Fault):
            self.store.sample_review({"call_id": made[0]["call_id"], "action": "false_positive"}, "platform")
        metrics = self.store.channel_calls("platform")["metrics"]
        self.assertGreaterEqual(metrics["blocked"], 4)
        self.assertEqual(metrics["confirmed"], 1)

    def test_channel_answer_for_demo_policy_cites_clause(self):
        with patch.dict(os.environ, QUIET):
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-01", "policy": "DEMO-01", "text": "这款什么时候能减保、最多减多少？"}, "sales")
        self.assertIn("20%", result["answer"])
        self.assertIn("〔", result["answer"])
        self.assertFalse(result["adopted"])

    def test_ambiguous_product_asks_clarification_without_model(self):
        with patch.dict(os.environ, QUIET), patch("portal_hub.complete") as model:
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-03", "text": "犹豫期是多少天？"}, "sales")
        model.assert_not_called()
        self.assertEqual(result["status"], "clarify")
        self.assertIn("请先指明", result["answer"])
        self.assertFalse(result["adopted"])
        self.assertNotIn("15天", result["answer"])

    def test_missing_fact_and_excerpt_refuses_without_model(self):
        with patch.dict(os.environ, QUIET), patch("portal_hub.complete") as model:
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-02", "policy": "DEMO-02", "text": "zzzzqq"}, "sales")
        model.assert_not_called()
        self.assertEqual(result["status"], "refused")
        self.assertIn("事实不足", result["answer"])
        self.assertFalse(result["adopted"])

    def test_waiting_period_keeps_exception_clause_and_trace(self):
        with patch.dict(os.environ, QUIET):
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-02", "text": "中宏健康双星的等待期是多少天，意外是否同样等待？"}, "sales")
        self.assertIn("90", result["answer"])
        self.assertIn("意外伤害", result["answer"])
        self.assertIn("2.3.1", result["answer"])
        self.assertFalse(result["adopted"])
        trace = result["trace"]
        self.assertEqual(trace["product_id"], ["ci-zhonghong-shuangxing"])
        self.assertEqual(trace["version_label"], "v1")
        self.assertIn("2.3.1", trace["clause_codes"])
        self.assertTrue(trace["matched_fact"])
        self.assertIn("final_answer", trace)
        with self.store.db() as c:
            saved = c.execute("SELECT answer, trace_json FROM channel_calls WHERE id=?", (result["call_id"],)).fetchone()
        self.assertEqual(saved["answer"], result["answer"])
        stored = json.loads(saved["trace_json"])
        self.assertEqual(stored["final_answer"], result["answer"])
        before = result["answer"]
        review = self.store.sample_review({"call_id": result["call_id"], "action": "need_knowledge", "note": "等待期例外已在字段里"}, "platform")
        self.assertTrue(review["answer_unchanged"])
        with self.store.db() as c:
            after = c.execute("SELECT answer FROM channel_calls WHERE id=?", (result["call_id"],)).fetchone()["answer"]
        self.assertEqual(after, before)

    def test_wrong_model_number_keeps_field_template(self):
        with patch("portal_hub.complete", return_value={"status": "ok", "text": "等待期是999天。", "model": "mock", "usage": {}}):
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-02", "text": "中宏健康双星的等待期是多少天？"}, "sales")
        self.assertIn("90", result["answer"])
        self.assertIn("意外伤害", result["answer"])
        self.assertNotIn("999", result["answer"])
        self.assertFalse(result["adopted"])
        self.assertFalse(result["trace"]["number_check"]["ok"])

    def test_excerpt_only_does_not_call_model(self):
        with patch("portal_hub.complete") as model:
            result = self.store.channel_ask({"channel": "sales", "duty": "sales", "operator": "展业-01", "context": "客户-02", "text": "中宏健康双星的保险单怎么送达？"}, "sales")
        model.assert_not_called()
        self.assertIn(result["status"], ("excerpt", "refused"))
        self.assertNotIn("三日送达", result["answer"])
        self.assertFalse(result["adopted"])

    def test_illustration_is_labeled_non_guaranteed(self):
        listed = illustrations.public_list()
        self.assertTrue(listed)
        option = listed[0]["options"][0]
        table = illustrations.table(listed[0]["name"], option["gender"], option["age"], option["pay"])
        self.assertIn("分红不保证", table["notice"])
        self.assertEqual(table["non_guaranteed"]["title"], "演示利率下的非保证利益")
        self.assertTrue(table["years"])


class ComplianceTest(unittest.TestCase):
    def test_each_class_has_a_word(self):
        self.assertEqual({item["id"] for item in compliance_rules.find("一定能赔，红利肯定有，比存银行划算，全市场第一")}, {"promise_pay", "yield_guarantee", "deposit_compare", "disparage"})


if __name__ == "__main__":
    unittest.main()
