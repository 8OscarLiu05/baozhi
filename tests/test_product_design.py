import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import product_design as pd
from app import Store
import test_app

CASE = dict(start='2026-01-01', end='2026-12-31', admission='2026-03-01', discharge='2026-03-08', used=0, eligibility='assumed_yes')

class ProductTest(unittest.TestCase):
    def setUp(self):
        self.design = {**copy.deepcopy(pd.DEFAULT), 'version': 1}

    def test_unknown_never_outputs_money(self):
        r = pd.simulate(self.design, {**CASE, 'eligibility': 'unknown'})
        self.assertIsNone(r['amount'])
        self.assertIsNone(r['payable_days'])

    def test_formula_and_annual_cap(self):
        self.assertEqual(pd.simulate(self.design, CASE)['amount'], 400)
        self.assertEqual(pd.simulate(self.design, {**CASE, 'used': 58})['amount'], 200)
        self.assertEqual(pd.simulate(self.design, {**CASE, 'used': 60})['amount'], 0)
        self.assertEqual(pd.simulate(self.design, {**CASE, 'discharge': '2026-05-01'})['amount'], 3000)

    def test_waiting_boundary(self):
        self.assertEqual(pd.simulate(self.design, {**CASE, 'admission': '2026-01-30'})['status'], 'waiting')
        self.assertEqual(pd.simulate(self.design, {**CASE, 'admission': '2026-01-31'})['status'], 'calculated')

    def test_cross_period_and_same_day(self):
        self.assertIsNone(pd.simulate(self.design, {**CASE, 'end': '2026-03-05'})['amount'])
        self.assertEqual(pd.simulate(self.design, {**CASE, 'discharge': CASE['admission']})['amount'], 0)

    def test_bad_values(self):
        for change in [{'used': -1}, {'used': 61}, {'used': 2.3}, {'used': True}, {'used': 'nan'}, {'discharge': '2026-02-01'}, {'start': 'bad'}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                pd.simulate(self.design, {**CASE, **change})

    def test_version_migration_and_conflict(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'design.sqlite3'
            store = Store(path)
            with store.db() as c:
                first = pd.current(c)
                second = pd.save(c, {**first, 'parameters': {**first['parameters'], 'daily': 80}})
            with store.db() as c:
                with self.assertRaises(ValueError): pd.save(c, first)
            reopened = Store(path)
            with reopened.db() as c:
                self.assertEqual(pd.current(c)['version'], 2)
                self.assertEqual(json.loads(c.execute('SELECT data FROM product_designs WHERE version=1').fetchone()[0])['parameters']['daily'], 100)
            self.assertIn('每日津贴（元）：80', pd.document_text(second))

class ProductHttpTest(unittest.TestCase):
    setUpClass = classmethod(test_app.HttpTest.setUpClass.__func__)
    tearDownClass = classmethod(test_app.HttpTest.tearDownClass.__func__)
    request = test_app.HttpTest.request
    login = test_app.HttpTest.login
    def test_product_path(self):
        viewer = self.login('viewer')
        builder = self.login('builder')
        _, state = self.request('/api/state', token=builder)
        design = state['design']['current']
        self.assertEqual(self.request('/api/design', design, viewer)[0], 403)
        self.assertEqual(self.request('/api/design/document', {'version':design['version']}, viewer)[0], 403)
        self.assertEqual(self.request('/api/design/simulate', {**CASE, 'version':design['version']}, viewer)[0], 403)
        code, result = self.request('/api/design/simulate', {**CASE, 'version':design['version']}, builder)
        self.assertEqual(code, 200)
        self.assertEqual(result['amount'], 400)
        with self.server.store.db() as c:
            record = json.loads(c.execute('SELECT data FROM benefit_simulations WHERE id=?', (result['record_id'],)).fetchone()[0])
            self.assertEqual(record['parameters']['daily'], 100)
        code, doc = self.request('/api/design/document', {'version':design['version']}, builder)
        self.assertEqual(code, 200)
        self.assertEqual(doc['status'], 'draft')
        self.assertEqual(doc['rules'], [])
        self.assertEqual(self.request('/api/design', {**design, 'parameters':{**design['parameters'], 'daily':90}}, builder)[0], 200)
        self.assertEqual(self.request('/api/design/simulate', {**CASE, 'version':design['version']}, builder)[0], 409)

if __name__ == '__main__': unittest.main()
