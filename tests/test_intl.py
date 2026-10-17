"""REQ068 international build: English questions, English answers, zh records kept apart."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import intl
from app import Store


class InternationalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / 'test.db')
        self.env = patch.dict(os.environ, {'BAOZHI_API_KEY': '', 'BAOZHI_MODEL_URL': '', 'BAOZHI_MODEL': ''})
        self.env.start()

    def tearDown(self):
        intl.LANG.set('zh')
        self.env.stop()
        self.temp.cleanup()

    def ask(self, text, lang='en', **extra):
        intl.LANG.set(lang)
        data = dict(channel='sales', duty='sales', operator='展业-01', context='客户-01', policy='', text=text, consult_mode='professional')
        data.update(extra)
        return self.store.channel_ask(data, 'sales')

    def test_field_answer_is_english_with_zero_model_calls(self):
        r = self.ask('How many days is the waiting period for Health Double Star?')
        self.assertIn('Waiting period: 90 days', r['answer'])
        self.assertIn('Clause 2.3.1', r['answer'])
        self.assertEqual(r['trace']['model_call']['count'], 0)
        self.assertEqual(r['trace']['lang'], 'en')
        self.assertEqual(r['channel_name'], 'Sales')

    def test_returns_question_is_guarded_in_english(self):
        r = self.ask('Dividends are guaranteed, and it is better than putting money in the bank.')
        self.assertIn('never quoted as figures', r['answer'])
        self.assertEqual(r['trace']['model_call']['count'], 0)

    def test_english_compliance_phrases(self):
        import compliance_rules
        intl.LANG.set('en')
        found = {item['id'] for item in compliance_rules.find('Will it definitely pay out? It is better than putting money in the bank.')}
        self.assertEqual(found, {'promise_pay', 'deposit_compare'})
        self.assertEqual(compliance_rules.find('Dividends are not guaranteed.'), [])

    def test_errors_are_translated_only_in_english(self):
        intl.LANG.set('en')
        self.assertEqual(intl.fault('这张演示保单不属于当前客户'), 'This demo policy does not belong to the current customer.')
        self.assertEqual(intl.fault('渠道不在允许范围内'), 'Channel is not an allowed value.')
        intl.LANG.set('zh')
        self.assertEqual(intl.fault('这张演示保单不属于当前客户'), '这张演示保单不属于当前客户')

    def test_record_lists_keep_languages_apart(self):
        self.ask('中宏健康双星的等待期是多少天？', lang='zh')
        self.ask('How many days is the waiting period for Health Double Star?')
        intl.LANG.set('en')
        english = self.store.channel_calls('platform')
        self.assertEqual([c['text'] for c in english['calls']], ['How many days is the waiting period for Health Double Star?'])
        self.assertEqual(english['metrics']['calls'], 1)
        intl.LANG.set('zh')
        texts = [c['text'] for c in self.store.channel_calls('platform')['calls']]
        self.assertIn('中宏健康双星的等待期是多少天？', texts)
        self.assertIn('How many days is the waiting period for Health Double Star?', texts)

    def test_chinese_mode_unchanged(self):
        r = self.ask('中宏健康双星的等待期是多少天？', lang='zh')
        self.assertIn('90天', r['answer'])
        self.assertNotIn('Waiting period', r['answer'])


if __name__ == '__main__':
    unittest.main()
