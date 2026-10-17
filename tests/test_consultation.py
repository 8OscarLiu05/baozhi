"""REQ057 protocol, isolation and synthetic coverage tests; not insurance validation."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import consultation
from app import Store, Fault

class ConsultationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / 'test.db')
        self.payload = dict(channel='sales', duty='sales', operator='展业-01', context='客户-01', policy='', text='什么是等待期？', consult_mode='professional')

    def tearDown(self):
        self.temp.cleanup()

    def test_general_calls_once_without_private_evidence(self):
        with patch('portal_hub.complete', return_value={'status':'ok','text':'这是通用知识解释。'}) as model:
            r = self.store.channel_ask({**self.payload, 'consult_mode':'general'}, 'sales')
        model.assert_called_once()
        self.assertEqual(model.call_args.args[2:], ([], []))
        self.assertTrue(model.call_args.kwargs['general'])
        self.assertEqual(r['trace']['model_call']['count'], 1)
        self.assertTrue(r['adopted'])
        self.assertEqual(r['excerpts'], [])

    def test_general_failure_is_explicit_and_persisted(self):
        with patch('portal_hub.complete', return_value={'status':'error'}):
            r=self.store.channel_ask({**self.payload,'consult_mode':'general'},'sales')
        self.assertIn('没有返回',r['answer'])
        self.assertFalse(r['adopted'])
        with self.store.db() as c:
            trace=json.loads(c.execute('SELECT trace_json FROM channel_calls WHERE id=?',(r['call_id'],)).fetchone()[0])
        self.assertEqual(trace['consultation']['mode'],'general')
        self.assertEqual(trace['model_call']['count'],1)

    def test_all_300_profiles_reproducible_and_labeled(self):
        expected=list(consultation.rows())
        self.assertEqual(len(expected),300)
        with self.store.db() as c:
            consultation.initialize(c)
            self.assertEqual(consultation.board(c)['count'],300)
            for row in expected:
                for role in ['sales','customer']:
                    found,reply=consultation.lookup(c,{**row,'pay':'分期缴费'},role)
                    self.assertEqual(found['id'],row['id'])
                    self.assertIn('不判断',reply)
                self.assertIsNone(consultation.lookup(c,{**row,'pay':'分期缴费'},'quality')[0])

    def test_structured_lookup_calls_model_once_to_explain_fields(self):
        with patch('portal_hub.complete', return_value={'status':'ok','text':'简单说，投保后要先等90天，这期间确诊的疾病一般不在保障内。'}) as model:
            r=self.store.channel_ask({**self.payload,'text':'中宏健康双星等待期多少天？'},'sales')
        model.assert_called_once()
        self.assertFalse(model.call_args.kwargs.get('general'))
        self.assertIn('90',r['answer'].split('\n\n')[0])
        self.assertIn('通俗解释',r['answer'])
        self.assertTrue(r['adopted'])
        self.assertEqual(r['trace']['model_call']['count'],1)
        self.assertTrue(r['trace']['number_check']['ok'])

    def test_explanation_with_unsupported_number_is_dropped(self):
        with patch('portal_hub.complete', return_value={'status':'ok','text':'等待期是180天。'}):
            r=self.store.channel_ask({**self.payload,'text':'中宏健康双星等待期多少天？'},'sales')
        self.assertIn('90',r['answer'])
        self.assertNotIn('180',r['answer'])
        self.assertNotIn('通俗解释',r['answer'])
        self.assertFalse(r['adopted'])
        self.assertEqual(r['status'],'rejected')
        self.assertEqual(r['trace']['model_call']['count'],1)

    def test_model_failure_keeps_field_answer(self):
        with patch('portal_hub.complete', return_value={'status':'error'}):
            r=self.store.channel_ask({**self.payload,'text':'中宏健康双星等待期多少天？'},'sales')
        self.assertIn('90',r['answer'])
        self.assertNotIn('通俗解释',r['answer'])
        self.assertFalse(r['adopted'])

    def test_professional_scope_includes_increment_and_exclusions(self):
        with patch('portal_hub.complete', return_value={'status':'error'}) as model:
            increment = self.store.channel_ask({**self.payload, 'text':'中英鑫悦未来的保额每年递增多少，从第几年开始？'}, 'sales')
            exclusions = self.store.channel_ask({**self.payload, 'text':'人保住院医疗有哪些责任免除？'}, 'sales')
        self.assertIn('1.75%', increment['answer'])
        self.assertIn('第2个保单年度起', increment['answer'])
        self.assertIn('既往症', exclusions['answer'])
        self.assertEqual(model.call_count, 2)

    def test_gender_specific_annuity_question_does_not_mix_ages(self):
        with patch('portal_hub.complete', return_value={'status':'error'}):
            female = self.store.channel_ask({**self.payload, 'text':'海港金彩颐年女性养老年金从几岁开始领？'}, 'sales')
            male = self.store.channel_ask({**self.payload, 'text':'海港金彩颐年男性养老年金从几岁开始领？'}, 'sales')
        self.assertIn('55周岁', female['answer'])
        self.assertNotIn('60周岁', female['answer'])
        self.assertIn('60周岁', male['answer'])
        self.assertNotIn('55周岁', male['answer'])

    def test_unmatched_or_risky_professional_question_skips_model(self):
        with patch('portal_hub.complete', side_effect=AssertionError('must not call')):
            self.store.channel_ask({**self.payload,'text':'如何修自行车？'},'sales')
            self.store.channel_ask({**self.payload,'text':'中宏健康双星一定能赔吗？'},'sales')

    def test_english_professional_lookup_still_skips_model(self):
        import intl
        intl.LANG.set('en')
        try:
            with patch('portal_hub.complete', side_effect=AssertionError('must not call')):
                r=self.store.channel_ask({**self.payload,'text':'How many days is the waiting period for Health Double Star?'},'sales')
        finally:
            intl.LANG.set('zh')
        self.assertEqual(r['trace']['model_call']['count'],0)

    def test_profile_question_is_canonical_and_not_underwriting(self):
        profile={**next(consultation.rows()),'pay':'一次交清'}
        with patch('portal_hub.complete',side_effect=AssertionError('must not call')):
            r=self.store.channel_ask({**self.payload,'text':'伪造一段承保结论','profile':profile},'sales')
        self.assertEqual(r['text'],consultation.question(profile))
        self.assertNotIn('伪造',r['text'])
        self.assertEqual(r['excerpts'][0]['kind'],'mock')

    def test_invalid_options_rejected(self):
        with self.assertRaises(Fault):
            self.store.channel_ask({**self.payload,'profile':{'age':'<script>'}},'sales')

    def test_unknown_question_does_not_match_random_record(self):
        r=self.store.channel_ask({**self.payload,'text':'如何修自行车？'},'sales')
        self.assertEqual(r['answer'],consultation.REFUSAL)
        self.assertEqual(r['excerpts'],[])

    def test_custom_agent_cannot_read_unselected_public_product(self):
        item={'id':'custom','products':['demo-service'],'origin':'工作人员新建','lane':'service'}
        r=self.store.consult_turn(item,'中宏健康双星等待期多少天？','professional',None,'sales','life-zhonghong-health')
        self.assertEqual(r['reply'],consultation.REFUSAL)
        self.assertEqual(r['evidence'],[])

    def test_role_mismatch_rejected(self):
        with self.assertRaises(Fault):
            self.store.channel_ask(self.payload,'customer')

    def test_custom_agent_old_path_also_respects_scope(self):
        import portal_hub
        item={**portal_hub.agent('advisor'),'id':'custom-test','products':['demo-service']}
        self.assertEqual(self.store.retrieval_products(item,'等待期',True),['demo-service'])
        with patch('portal_hub.complete', side_effect=AssertionError('no model for unmatched field')):
            result=self.store.answer_turn(item,'中宏健康双星等待期多少天？',duty_mode=True)
        self.assertFalse(result['trace']['matched_fact'])
        self.assertFalse(any(e.get('product','').startswith('life-') for e in result['evidence']))

if __name__=='__main__':
    unittest.main()
