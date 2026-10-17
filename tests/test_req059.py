from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from app import Store, Fault
import company_library
import simulation


class Req059(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'test.db')

    def tearDown(self):
        self.tmp.cleanup()

    def test_all_adult_curves_and_formula(self):
        for age in range(18, 66):
            for pay in (3, 5, 10):
                result = simulation.calculate(age, pay, 10000)
                self.assertEqual(len(result['chart']), 30)
                self.assertEqual(result['chart'][-1]['premium'], pay * 10000)
                self.assertTrue(result['fictional'])
                self.assertLess(result['chart'][0]['cash'], result['chart'][0]['premium'])
        for age in (0, 17, 66):
            with self.assertRaises(ValueError): simulation.calculate(age)

    def test_underwriting_general_and_unrelated(self):
        with patch('portal_hub.complete', return_value={'status':'ok','text':'先核对健康告知及诊疗信息，再由保险公司审核，不能仅凭疾病名称确定可投保产品。'}) as model:
            result = self.store.chat({'agent':'underwrite','message':'一个人有糖尿病、高血压，什么保险适合投保，核保要注意什么？'}, 'underwrite')
            model.assert_called_once()
            self.assertEqual(model.call_args.kwargs['general'], 'role')
            self.assertEqual(result['messages'][-1]['evidence'], [])
            self.assertTrue(result['messages'][-1]['model']['adopted'])
        with patch('portal_hub.complete') as model:
            result = self.store.chat({'agent':'underwrite','message':'帮我写一首诗'}, 'underwrite')
            model.assert_not_called()
            self.assertEqual(result['messages'][-1]['model']['count'], 0)

    def test_five_platform_agents_model_and_fallback(self):
        for agent in ('ops-knowledge','ops-observe','ops-sample','ops-grant','ops-voice'):
            with patch('portal_hub.complete', return_value={'status':'ok','text':'建议先核对资料版本，再查看对应的记录。'}) as model:
                result = self.store.chat({'agent':agent,'message':'如何核对知识和调用记录？'}, 'platform')
                model.assert_called_once()
                self.assertEqual(model.call_args.kwargs['general'], 'platform')
                self.assertEqual(result['messages'][-1]['model']['count'], 1)
            with patch('portal_hub.complete', return_value={'status':'error','message':'offline'}):
                result = self.store.chat({'agent':agent,'message':'查看当前记录'}, 'platform')
                self.assertTrue(result['messages'][-1]['evidence'])
                self.assertFalse(result['messages'][-1]['model']['adopted'])

    def test_revocation_and_material_scope(self):
        self.store.edit_agent_permissions({'id':'coach','products':[],'duties':[]}, 'platform')
        with self.assertRaises(Fault):
            self.store.chat({'agent':'coach','message':'培训怎么做'}, 'training')
        self.assertFalse(any(a['id']=='coach' for a in self.store.portal('training')['agents']))
        self.store.edit_agent_permissions({'id':'coach','products':[],'duties':['training']}, 'platform')
        a = self.store.resolve_agent('coach')
        self.assertEqual(self.store.retrieval_products(a, '中宏等待期', True), [])
        with patch('portal_hub.complete') as model:
            answer = self.store.answer_turn(a,'中宏等待期多少天',duty_mode=True)
            self.assertEqual(answer['evidence'], [])
            model.assert_not_called()
        self.assertTrue(company_library.agent_allowed('training',a))
        with self.assertRaises(Fault):
            self.store.edit_agent_permissions({'id':'coach','products':[],'duties':[]}, 'sales')
        with self.assertRaises(Fault):
            self.store.edit_agent_permissions({'id':'ops-grant','products':[],'duties':['sales']}, 'platform')


if __name__ == '__main__': unittest.main()
