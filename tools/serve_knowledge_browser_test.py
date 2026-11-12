"""Temporary two-server UI fixture. Send a newline to stdin to stop both servers."""
from contextlib import ExitStack
from pathlib import Path
import json
from tempfile import TemporaryDirectory
import sys
import threading

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(ROOT/'tests'))
from app import Store,Server
from knowledge_store import KnowledgeStore
from test_knowledge_governance import pdf_bytes,input_data,make_adapter

def main():
    private=Path(sys.argv[1]).resolve()
    with ExitStack() as resources:
        temp=Path(resources.enter_context(TemporaryDirectory(prefix='browser-fixture-',dir=private)))
        fixture=Store(temp/'fixture.sqlite3')
        fixture.knowledge=KnowledgeStore(fixture.path,migrate=True)
        fixture.knowledge_sales_versions=set()
        kb=fixture.knowledge
        version=kb.version({'name':'合成浏览器流程测试','insurer':'合成测试','filing':'FIXTURE-ONLY',
                           'edition':'test-1','synthetic':True},'fixture')
        material=kb.ingest(input_data(version),'fixture')
        kb.verify_source(material,'合成 PDF 测试来源','fixture')
        candidate=kb.start_extract(material,'fixture',make_adapter())['candidate_ids'][0]
        kb.review(candidate,{"expected_status":"pending","decision":"approved","confirmed":True,
                             "reason":"合成测试初始基线"},"fixture")
        initial_release=kb.release(version,{"candidate_ids":[candidate],"expected_head":None},"fixture")
        bad=kb.start_extract(material,"fixture",make_adapter("99 days","other_benefit"))["candidate_ids"][0]
        fragment=kb.fragments(material)[0]["id"]
        replacement=json.loads(make_adapter("30 days","other_benefit")(
            ("",json.dumps([{"fragment_id":fragment}]))))["candidates"][0]
        upload=temp/"synthetic-upload.pdf"
        upload.write_bytes(pdf_bytes())
        fixture.knowledge_sales_versions.add(version)
        real=Store(private/'sandbox.sqlite3')
        real.knowledge=KnowledgeStore(real.path)
        real.knowledge_sales_versions=set()
        for label,store in [('REAL',real),('SYNTHETIC',fixture)]:
            server=Server(('127.0.0.1',0),store)
            server.knowledge_credentials={'browser-reviewer-20261112-only':'reviewer',
                                          'browser-publisher-20261112-only':'publisher',
                                          'browser-builder-20261112-only':'builder'}
            worker=threading.Thread(target=server.serve_forever,daemon=True)
            worker.start()
            resources.callback(server.server_close)
            resources.callback(server.shutdown)
            print(label,server.server_port,flush=True)
        print('FIXTURE_VERSION',version,'FIXTURE_CANDIDATE',candidate,flush=True)
        print("PENDING",bad,"INITIAL_RELEASE",initial_release,"UPLOAD",upload,flush=True)
        print("REPLACEMENT",json.dumps(replacement),flush=True)
        try:
            input()
        finally:
            if len(sys.argv)>2:
                out=Path(sys.argv[2]).resolve()
                out.mkdir(parents=True,exist_ok=True)
                with fixture.db() as c:
                    report={"synthetic":True,"knowledge":kb.snapshot(),
                            "reviews":[dict(r) for r in c.execute("SELECT * FROM kg_review")],
                            "audit":[dict(r) for r in c.execute("SELECT * FROM kg_audit")],
                            "knowledge_calls":[dict(r) for r in c.execute("SELECT * FROM channel_calls WHERE trace_json LIKE '%product_version_id%'")]}
                (out/"browser_fixture_results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")

if __name__=='__main__':
    main()
