"""REQ058 workspace, benefit chart data and role-method routing checks."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app import Store
import illustrations
import platform_ops


class Req058Test(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "req058.sqlite3")

    def tearDown(self):
        self.temp.cleanup()

    def test_benefit_chart_keeps_three_source_series(self):
        listed = illustrations.public_list()
        self.assertTrue(listed)
        option = listed[0]["options"][0]
        table = illustrations.table(listed[0]["name"], option["gender"], option["age"], option["pay"])
        self.assertTrue(table["chart"])
        self.assertTrue(all({"year", "premium", "cash", "death"} <= set(point) for point in table["chart"]))
        self.assertTrue(any(point["cash"] is not None and point["death"] is not None for point in table["chart"]))
        self.assertIn("不是", table["notice"])

    def test_training_method_question_calls_model_without_evidence(self):
        generated = {"status": "ok", "text": "先说明资料边界，再解释责任与限制；不承诺投保或赔付。", "model": "mock"}
        with patch("portal_hub.complete", return_value=generated) as model:
            result = self.store.chat({"agent": "coach", "message": "展业有哪些可以说，哪些不可以说？"}, "training")
        model.assert_called_once()
        self.assertEqual(model.call_args.kwargs["general"], "role")
        last = result["messages"][-1]
        self.assertEqual(last["evidence"], [])
        self.assertEqual(last["model"]["status"], "ok")
        self.assertIn("不承诺", last["content"])

    def test_specific_training_question_still_uses_authorized_materials(self):
        with patch("portal_hub.complete", return_value={"status": "error", "message": "offline"}) as model:
            result = self.store.chat({"agent": "coach", "message": "海港金彩颐年女性从几岁开始领养老年金？"}, "training")
        self.assertNotEqual(model.call_args.kwargs.get("general"), "role")
        self.assertTrue(result["messages"][-1]["evidence"])

    def test_platform_agents_cover_structure_and_failure_questions(self):
        products = [{"short": "产品甲", "shelf": "主产品"}, {"short": "产品乙", "shelf": "对照"}]
        knowledge = platform_ops.compose("ops-knowledge", "资料从导入到发布要经过什么？", products, {}, [], [])
        self.assertIn("登记来源", knowledge["text"])
        calls = [{"channel": "sales", "status": "error", "rule_category": "promise_pay"}]
        observe = platform_ops.compose("ops-observe", "有哪些失败和拦截？", products, {"calls": 1, "blocked": 1, "confirmed": 0}, calls, [])
        self.assertIn("模型异常 1 条", observe["text"])
        self.assertIn("合规类别 1 条", observe["text"])


if __name__ == "__main__":
    unittest.main()
