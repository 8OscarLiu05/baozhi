"""REQ-010 acceptance: evidence granularity, snapshots, review and role boundaries."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Store, Fault
import insurance_content as ic
import product_design as pd
import test_app


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name)/'test.sqlite3')
        self.docs = self.store.snapshot()['documents']
        self.payload = dict(question='高血压骑手住院后生活支出怎么办？', event='hospital', related='yes', documents=[d['id'] for d in self.docs if d['product'] in ('qianxin', 'sample-medical')])

    def tearDown(self): self.temp.cleanup()

    def test_specific_sentences_and_shared_evidence(self):
        board = self.store.snapshot()['clause_board']
        slots = {s['code']: s for s in board['slots']}
        for code in ('waiting', 'exclusion', 'hospital'):
            s = slots[code]
            self.assertEqual(s['status'], 'coarse')
            self.assertGreaterEqual(s['shared_count'], 3)
            self.assertEqual(s['position'], 3)
            self.assertEqual(len(ic.sentences(s['excerpt'])), 1)
            self.assertNotIn('不能仅凭', s['excerpt'])
        self.assertEqual(len({slots[c]['expect'] for c in ('waiting','exclusion','hospital')}), 3)
        clauses = [dict(id='c1', chunk_id='d1-1', position=1, heading='条件', content='等待期尚待论证。医院范围未确定。责任免除尚未确定。')]
        result = {s['code']:s for s in ic.board({'id':'d1'}, clauses)['slots']}
        self.assertEqual(result['waiting']['excerpt'], '等待期尚待论证。')
        self.assertEqual(result['hospital']['excerpt'], '医院范围未确定。')
        self.assertEqual(result['exclusion']['excerpt'], '责任免除尚未确定。')
        self.assertEqual(result['waiting']['shared_count'], 3)

    def test_single_concrete_clause_is_not_shared(self):
        clauses = [dict(id='c1',chunk_id='d-1',position=1,heading='等待期',content='等待期为起始日起30日。')]
        slot = next(s for s in ic.board({'id':'d'}, clauses)['slots'] if s['code']=='waiting')
        self.assertEqual(slot['shared_count'],1)
        self.assertEqual(slot['status'],'stated')

    def test_mock_identity_prefers_identity_sentence(self):
        doc=self.store.document(next(d['id'] for d in self.docs if d['product']=='sample-medical'))
        identity=next(s for s in ic.board(doc,doc['clauses'])['slots'] if s['code']=='identity')
        self.assertEqual(identity['position'],1)
        self.assertIn('团队虚构',identity['excerpt'])

    def test_design_changes_board_but_not_history_or_run(self):
        before = self.store.run(self.payload)
        with self.store.db() as c:
            first = pd.current(c)
            pd.save(c,{**first,'parameters':dict(daily=137,waiting=41,deductible=4,per_stay=26,annual=59)})
        board = self.store.snapshot()['clause_board']
        self.assertEqual(board['research']['version'],2)
        self.assertEqual(board['research']['parameters'],dict(daily=137,waiting=41,deductible=4,per_stay=26,annual=59))
        after = self.store.runs(before['id'])
        self.assertEqual(after['research_snapshot'],before['research_snapshot'])
        self.assertEqual(after['clause_attention'],before['clause_attention'])
        self.assertEqual(after['research_snapshot']['parameters']['daily'],100)
        self.assertEqual(board['document']['version'],1)

    def test_two_living_cards_have_literal_sentence_and_paragraph(self):
        result = self.store.run(self.payload)
        cards = {c['kind']:c for c in result['cards'] if c['scenario']=='living'}
        self.assertIn('提供津贴',cards['design']['evidence_excerpt'])
        self.assertIn('没有设置住院生活津贴',cards['mock']['evidence_excerpt'])
        self.assertEqual(cards['design']['evidence_position'],2)
        self.assertEqual(cards['mock']['evidence_position'],3)
        for card in cards.values():
            original = next(e for e in result['evidence'] if e['id']==card['evidence'])
            self.assertIn(card['evidence_excerpt'],original['content'])

    def test_gap_omission_and_forgery_rejected_append_only(self):
        result = self.store.run(self.payload)
        checks = {k:True for k in ic.CHECKS}
        actions = {g['gap_id']:'insurance_member' for g in result['clause_attention']}
        def save(a, disposition='needs_specialist'):
            return self.store.review_run(result['id'],'仅核对虚拟资料，交保险成员确认。','reviewer',disposition,checks,a)
        missing = dict(actions);missing.pop(next(iter(missing)))
        for bad in (None,missing,{**actions,'forged:waiting':'checked_original'},dict.fromkeys(actions,'approved')):
            with self.subTest(bad=type(bad).__name__), self.assertRaises(Fault):save(bad)
        with self.assertRaises(Fault):save(actions,'continue_demo')
        saved = save(actions)
        self.assertEqual(len(saved['reviews']),1)
        self.assertEqual(len(saved['reviews'][0]['gap_actions']),len(actions))
        save(dict.fromkeys(actions,'checked_original'),'continue_demo')
        self.assertEqual(len(self.store.runs(result['id'])['reviews']),2)
        with self.store.db() as c:
            self.assertEqual(json.loads(c.execute('SELECT data FROM runs WHERE id=?',(result['id'],)).fetchone()[0]),result)

    def test_queue_metadata_and_search_beyond_last_100(self):
        old = self.store.run(self.payload)
        with self.store.db() as c:
            for i in range(101):
                item={**old,'id':f'{i:012x}'}
                c.execute('INSERT INTO runs VALUES(?,?,?)',(item['id'],item['created'],json.dumps(item)))
        self.assertFalse(any(r['id']==old['id'] for r in self.store.runs()))
        found=self.store.runs(query=old['id'])
        self.assertEqual(len(found),1)
        self.assertEqual(found[0]['flow_name'],'保障分析')
        self.assertEqual(len(found[0]['documents']),2)
        self.assertGreater(found[0]['gap_count'],0)
        self.store.review_run(old['id'],'逐项核对后转保险成员。','reviewer','needs_specialist',dict.fromkeys(ic.CHECKS,True),{g['gap_id']:'insurance_member' for g in old['clause_attention']})
        found=self.store.runs(query=old['id'])[0]
        self.assertEqual(found['disposition'],'needs_specialist')
        self.assertIn('转保险成员',found['latest_note'])

    def test_model_remains_one_end_of_flow_call(self):
        with patch('app.explain_model', return_value={'status':'error','message':'测试失败'}) as model:
            result = self.store.run({**self.payload,'flow':'claim'},model=True)
        self.assertEqual(model.call_count,1)
        self.assertEqual(len(result['traces']),3)
        self.assertEqual(len(result['cards']),6)
        self.assertEqual(result['mode'],'local')

    def test_legacy_gap_enrichment_does_not_change_stored_run(self):
        result=self.store.run(self.payload)
        for gap in result['clause_attention']: gap.pop('gap_id')
        with self.store.db() as c:c.execute('UPDATE runs SET data=? WHERE id=?',(json.dumps(result),result['id']))
        opened=self.store.runs(result['id'])
        self.assertTrue(all(g['gap_id'] for g in opened['clause_attention']))
        with self.store.db() as c:self.assertEqual(json.loads(c.execute('SELECT data FROM runs WHERE id=?',(result['id'],)).fetchone()[0]),result)


class BoundaryHttpTest(unittest.TestCase):
    setUpClass=classmethod(test_app.HttpTest.setUpClass.__func__)
    tearDownClass=classmethod(test_app.HttpTest.tearDownClass.__func__)
    request=test_app.HttpTest.request
    login=test_app.HttpTest.login

    def test_viewer_cannot_read_maintenance_or_global_records(self):
        token=self.login('viewer')
        _,state=self.request('/api/state',token=token)
        self.assertNotIn('agents',state)
        self.assertNotIn('design',state)
        self.assertNotIn('clause_board',state)
        doc=self.server.store.create_document(dict(product='private-draft',title='待审核资料',kind='design',source='虚拟',content='待研究的资料'),'builder')
        for path in ('/api/documents/'+doc['id'],'/api/runs','/api/runs?q=abc','/api/design/versions/1'):
            self.assertEqual(self.request(path,token=token)[0],403)
        self.assertTrue(all(d['status']=='published' for d in state['documents']))

    def test_research_history_endpoint_and_http_gap_guard(self):
        token=self.login('reviewer')
        self.assertEqual(self.request('/api/design/versions/1',token=token)[1]['parameters']['daily'],100)
        self.assertEqual(self.request('/api/design/versions/99999',token=token)[0],404)
        docs=[d for d in self.server.store.snapshot()['documents'] if d['status']=='published' and d['product'] in ('qianxin','sample-medical')]
        _,r=self.request('/api/run',dict(question='生活支出',event='hospital',documents=[d['id'] for d in docs]),token)
        data=dict(note='HTTP验收',disposition='needs_specialist',checks=dict.fromkeys(ic.CHECKS,True),gap_actions={g['gap_id']:'insurance_member' for g in r['clause_attention']})
        removed=data['gap_actions'].pop(next(iter(data['gap_actions'])))
        self.assertEqual(self.request('/api/runs/'+r['id']+'/review',data,token)[0],400)
        data['gap_actions']={g['gap_id']:'insurance_member' for g in r['clause_attention']}
        self.assertEqual(self.request('/api/runs/'+r['id']+'/review',data,token)[0],200)
        _,queue=self.request('/api/runs?q='+r['id'],token=token)
        self.assertEqual(queue[0]['disposition'],'needs_specialist')
        self.assertEqual(self.request('/api/runs?q=%25',token=token)[0],400)


if __name__=='__main__':unittest.main()
