"""Register the three association-linked attachments without approving any insurance facts."""
import base64
from contextlib import closing
from hashlib import sha256
import json
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from knowledge_store import KnowledgeStore
from knowledge_extract import CONFIG

FILES = [
    ("cash","cash_value","14e63f70-a201-46fd-9c3f-f8b57791010c_VALUE.PDF","05","国寿颐养人生_现金价值表.pdf",
     "6d88f9457f2d528c13cf8abb62fd03f81cde32ba60e45309f8e312bb980bc122"),
    ("rates","rates","7e665207-ee7e-4f26-86fe-89a1eb06b1f9_RATE.PDF","04","国寿颐养人生_基本保险金额表.pdf",
     "a732cc1485b161332fe22a5ad168918e2efc2015a25989e3c26c2d0e672184ef"),
    ("brochure","brochure","28f8ed51-4b81-44f8-889b-96f3b65fb60f_EXPLAIN.PDF","06","国寿颐养人生_产品说明书.pdf",
     "d5daa866e42b76cc8606ed6db459d0219b226ecde979b180d679d40d860a61bc"),
]
def main():
    private=Path(sys.argv[1]).resolve()
    output=Path(sys.argv[2]).resolve()
    database=private/'sandbox.sqlite3'
    KnowledgeStore(database)
    backup=private/'before-20261112.sqlite3'
    if not backup.exists():
        with closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as source:
            with closing(sqlite3.connect(backup)) as dest:
                source.backup(dest)
    kb=KnowledgeStore(database)
    state=kb.snapshot()
    version=next(v['id'] for v in state['versions'] if v['filing']=='中国人寿〔2023〕年金保险122号' and not v['synthetic'])
    parent=next(m['id'] for m in state['materials'] if m['version_id']==version and m['kind']=='terms')
    output.mkdir(parents=True,exist_ok=True)
    records=[]
    for source_name,kind,original,folder,standard,expected in FILES:
        raw=(private/(source_name+'.download')).read_bytes()
        assert sha256(raw).hexdigest()==expected
        source='https://www.iachina.cn/IC/tkk/'+folder+'/'+original
        material=kb.ingest({'version_id':version,'source':source,'kind':kind,'filename':standard,
                            'attachment_of':parent,'file':base64.b64encode(raw).decode()},'local:source-registration')
        kb.verify_source(material,'协会同一产品明细关联附件；首页产品名称及资料类别与登记一致。表格适用条件仍需逐项专业复核。',
                         'local:source-verifier')
        dest=output/standard
        if dest.exists():
            assert sha256(dest.read_bytes()).hexdigest()==expected
        else:
            dest.write_bytes(raw)
        record=next(m for m in kb.snapshot()['materials'] if m['id']==material)
        record.update(original_filename=original,bytes=len(raw),download_checked_at=record['observed'],
                      source_detail='https://www.iachina.cn/IC/tkk/01/006a722a-8a0f-4171-8fd5-35a013757798.html')
        records.append(record)
        (output/(kind+'_parsed.json')).write_text(json.dumps(kb.fragments(material),ensure_ascii=False,indent=2),encoding='utf-8')
    (output/'attachment_manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    checklist=[]
    for field in CONFIG['pilot_fields']:
        checklist.append({'field':field,'candidate_status':'not_extracted_model_stage_skipped',
                          'review_status':'not_started','gold_label':None,
                          'gold_conditions':None,'gold_exceptions':None,
                          'gold_evidence':[],'reviewer':None})
    (output/'human_annotation_template.json').write_text(json.dumps({
        'product_version_id':version,'purpose':'人工从原文独立标注，尚无专业结论',
        'fields':checklist},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'attachments':len(records),'pages':sum(r['page_count'] for r in records),
                      'real_candidates':len(kb.snapshot()['candidates']),'releases':len(kb.snapshot()['releases'])}))

if __name__=='__main__':
    main()
