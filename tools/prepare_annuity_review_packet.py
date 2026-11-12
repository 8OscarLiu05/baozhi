"""Build table geometry and evidence-only professional review materials."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from knowledge_store import KnowledgeStore

SAMPLES=[(1,1,"1","18","302"),(1,1,"1","59","430"),(1,2,"1","18","289"),
(2,1,"1","18","297"),(3,1,"1","60","430"),(3,3,"1","18","317"),
(3,5,"13","18","6075"),(4,1,"14","18","6379"),(4,4,"21","18","8762"),
(5,1,"22","18","9199"),(5,2,"1","55","421"),(5,5,"1","55","356")]
FIELDS=[
("product_name","产品名称",[(1,None)],"核对合同完整名称与同产品说明书身份。"),
("filing_number","备案编号",[(1,None)],"核对原件首页及协会登记，文字解析可能将备案号置于页尾。"),
("entry_age","投保年龄",[(1,"第二条")],"核对年龄上下限及健康前提，区分周岁、投保年龄和领取年龄。"),
("payment_method","交费方式",[(2,"第七条"),(4,"第二条")],"结合利益条款与基本条款核对交费方式、约定及宽限前提。"),
("payment_term","交费期间",[(2,"第七条")],"核对可选交费期间，勿将费率表头作为全部可投保条件。"),
("coverage_term","保险期间",[(1,"第三条")],"核对届满日定义及年生效对应日。"),
("annuity_start","领取起始条件",[(1,"第四条")],"核对性别、投保年龄分支和满一个保单年度条件。"),
("annuity_age","领取年龄",[(1,"第四条")],"年龄阈值与生效周年日联合判断，保留不同起领分支。"),
("annuity_method","领取方式",[(1,"第四条"),(1,"第五条"),(2,None)],"区分年/月领取、平准/增额类型及变更限制。"),
("annuity_frequency","领取频率",[(1,"第四条"),(2,None)],"核对年领/月领、对应日和年金数额关系。"),
("annuity_amount","金额计算规则",[(1,"第五条"),(2,None)],"核对关爱金、平准/增额、月领比例、年度基数和保险单基本金额。"),
("guaranteed_period","保证领取期间",[(1,"第五条"),(2,None)],"核对实际存在的保证领取或提前终止分支，未证实概念不补填。"),
("death_benefit","身故保险金",[(1,"第五条"),(2,None),(6,"第十三条")],"核对起领前后、已领金额扣除、对象和未成年人限制适用性。"),
("exclusions","责任免除",[(2,"第六条"),(4,"第四条")],"核对全部免除、告知规则及终止后返还对象。"),
("cash_value","现金价值",[(1,"第一条"),(3,"第九条"),(6,"第十四条")],"核对表格性别、年龄、交费期间、领取类型、起领条件及保单年度末，区分空白和零。"),
("non_guaranteed_benefit","非保证利益",[(3,"第十一条"),(6,"第十六条")],"从完整条款判定是否适用，不将没有候选直接标为不适用。")]

def main():
    private=Path(sys.argv[1]).resolve()
    output=Path(sys.argv[2]).resolve()
    kb=KnowledgeStore(private/'sandbox.sqlite3')
    backup=private/'before-table-v2.sqlite3'
    if not backup.exists():
        with closing(sqlite3.connect(kb.path.as_uri()+'?mode=ro',uri=True)) as source:
            with closing(sqlite3.connect(backup)) as dest: source.backup(dest)
    state=kb.snapshot()
    version=next(v for v in state['versions'] if not v['synthetic'] and v['edition']=='2023-122')
    materials=[m for m in state['materials'] if m['version_id']==version['id']]
    cash=next(m for m in materials if m['kind']=='cash_value')
    result=kb.reparse_tables(cash['id'],'local:table-parser-v2')
    tables=result['tables']
    import pdfplumber,io
    checked=[]
    with pdfplumber.open(io.BytesIO(kb.original(cash['id']))) as pdf:
        for page,index,year,age,expected in SAMPLES:
            table=tables[page][index-1]
            r=next(r for r in table['rows'] if r['row_label']==year)
            cell=next(c for c in r['cells'] if c['column_label']==age)
            x0,top,x1,bottom=cell['bbox']
            chars=[c for c in pdf.pages[page-1].chars
                   if x0<=(c['x0']+c['x1'])/2<x1 and top<=(c['top']+c['bottom'])/2<bottom]
            direct=''.join(c['text'] for c in sorted(chars,key=lambda c:(round(c['top'],1),c['x0']))).strip()
            assert cell['text']==direct==expected,(page,index,year,age,cell['text'],direct)
            checked.append(dict(page=page,table_id=table['table_id'],year=year,entry_age=age,value=expected,
                                bbox=cell['bbox'],character_check=True,professional_reviewed=False))
    continuations=[{"page":page,"table_id":t['table_id'],"from":t['continuation_of']}
                   for page,items in tables.items() for t in items if t['continuation_of']]
    assert len(continuations)==2
    counts={"physical_table_blocks":result['table_count'],"continuations":continuations,
            "context_carried_from_previous_page":[{"page":page,"table_id":t['table_id']}
                for page,items in tables.items() for t in items
                if any(c['page']!=page for c in t['header_context'])],
            "nonempty_numeric_cells":sum(1 for items in tables.values() for t in items for r in t['rows']
                if r['row_label'] for c in r['cells'][1:] if c['text'] and c['text'].isdigit()),
            "sample_checks":checked,"professional_status":"needs_review"}
    output.mkdir(parents=True,exist_ok=True)
    for name,data in (('现金价值表网格.json',result),('网格定位核验.json',counts)):
        (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    terms=next(m for m in materials if m['kind']=='terms')
    fragments=kb.fragments(terms['id'])
    packet=['# 国寿颐养人生专业审核工作包','',
            '生成来源为原件与确定性定位，模型阶段按用户指示跳过。事实值及专业结论尚未标注。',
            '本包列出16类字段的核验问题和逐字证据，字段定位供导航。跨页文字按原页保留。',
            '每项均需专业人员填写事实值、条件、例外、引文、审核人及日期。','','## 来源文件','']
    for m in materials:
        packet.extend([f"- {m['filename']}，{m['page_count']}页，SHA-256 {m['sha256']}",f"  来源 {m['source']}"])
    packet.extend(['','## 审核任务',''])
    checklist=[]
    used={}
    for number,(key,label,locations,question) in enumerate(FIELDS,1):
        selected=[f for f in fragments if (f['page'],f['clause']) in locations]
        refs=[]
        for f in selected:
            used[f['id']]=f
            refs.append(f"PDF第{f['page']}页 / {f['clause'] or '页续文'} / {f['id']}")
        packet.extend([f"### R{number:02d} {label}",'',question,'',
                       '原文定位：'+'；'.join(refs),'','专业结论：待填写。',''])
        checklist.append(dict(review_id=f'R{number:02d}',fact_type=key,question=question,
                              evidence_fragment_ids=[f['id'] for f in selected],fact_value=None,
                              conditions=None,exceptions=None,reviewer=None,reviewed_at=None,status='not_started'))
    packet.extend(['## 原文证据汇编',''])
    for f in sorted(used.values(),key=lambda f:(f['page'],f['start'])):
        packet.extend([f"### PDF第{f['page']}页 / {f['clause'] or '页续文'}",'',
                       f"证据ID {f['id']}，原件 {terms['sha256']}，字符区间 [{f['start']}, {f['stop']})",'',
                       chr(96)*3+'text',f['text'],chr(96)*3,''])
    packet.extend(['## 表格专项复核','',
                   '首个跨页表的表前说明位于上一页，两个年度续表的年龄表头来自前页，同时核对标题与引用位置。',
                   '识别及字符核对通过不构成专业审核。空白单元格不得填零，不能把年交1000元的示例直接解释为任意保单退保金额。'])
    (output/'人工审核工作包.md').write_text('\n'.join(packet),encoding='utf8')
    (output/'待人工判断清单.json').write_text(json.dumps({"product_version_id":version['id'],
        "extraction_method":"deterministic_evidence_navigation","professional_reviewed":False,
        "items":checklist},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in counts.items() if k!='sample_checks'},ensure_ascii=False))

if __name__=='__main__':
    main()
