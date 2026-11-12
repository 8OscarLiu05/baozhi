CREATE TABLE kg_migration (version INTEGER PRIMARY KEY, applied TEXT NOT NULL);
CREATE TABLE kg_product (
 id TEXT PRIMARY KEY, insurer TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(insurer,name)
);
CREATE TABLE kg_version (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES kg_product(id),
 filing TEXT NOT NULL, edition TEXT NOT NULL, synthetic INTEGER NOT NULL CHECK(synthetic IN (0,1)),
 UNIQUE(product_id,filing,edition)
);
CREATE TABLE kg_asset (
 sha256 TEXT PRIMARY KEY, bytes INTEGER NOT NULL CHECK(bytes>0), pdf BLOB NOT NULL
);
CREATE TABLE kg_material (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES kg_version(id),
 sha256 TEXT NOT NULL REFERENCES kg_asset(sha256), kind TEXT NOT NULL,
 filename TEXT NOT NULL, source TEXT NOT NULL, observed TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
 attachment_of TEXT, revision INTEGER NOT NULL, page_count INTEGER NOT NULL,
 UNIQUE(id,version_id), UNIQUE(version_id,kind,revision), UNIQUE(version_id,kind,sha256,source),
 FOREIGN KEY(attachment_of,version_id) REFERENCES kg_material(id,version_id)
);
CREATE TABLE kg_page (
 material_id TEXT NOT NULL REFERENCES kg_material(id), page INTEGER NOT NULL CHECK(page>0),
 printed_page TEXT, text TEXT NOT NULL, quality TEXT NOT NULL, PRIMARY KEY(material_id,page)
);
CREATE TABLE kg_fragment (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL, material_id TEXT NOT NULL, page INTEGER NOT NULL,
 clause TEXT, title TEXT, start INTEGER NOT NULL, stop INTEGER NOT NULL, location TEXT,
 UNIQUE(id,version_id), FOREIGN KEY(material_id,version_id) REFERENCES kg_material(id,version_id),
 FOREIGN KEY(material_id,page) REFERENCES kg_page(material_id,page)
);
CREATE TABLE kg_task (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL, material_id TEXT NOT NULL, stage TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed','needs_review')),
 method TEXT NOT NULL, config TEXT NOT NULL, result TEXT, created TEXT NOT NULL,
 UNIQUE(id,version_id), FOREIGN KEY(material_id,version_id) REFERENCES kg_material(id,version_id)
);
CREATE TABLE kg_candidate (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL, task_id TEXT NOT NULL,
 parent_id TEXT, fact_type TEXT NOT NULL, payload TEXT NOT NULL, checks TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','needs_revision','disputed')),
 UNIQUE(id,version_id), FOREIGN KEY(task_id,version_id) REFERENCES kg_task(id,version_id),
 FOREIGN KEY(parent_id,version_id) REFERENCES kg_candidate(id,version_id)
);
CREATE TABLE kg_evidence (
 candidate_id TEXT NOT NULL, version_id TEXT NOT NULL, fragment_id TEXT NOT NULL,
 start INTEGER NOT NULL, stop INTEGER NOT NULL, quote TEXT NOT NULL, role TEXT NOT NULL,
 PRIMARY KEY(candidate_id,fragment_id,start,stop,role),
 FOREIGN KEY(candidate_id,version_id) REFERENCES kg_candidate(id,version_id),
 FOREIGN KEY(fragment_id,version_id) REFERENCES kg_fragment(id,version_id)
);
CREATE TABLE kg_review (
 id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES kg_candidate(id), actor TEXT NOT NULL,
 decision TEXT NOT NULL, reason TEXT NOT NULL, errors TEXT NOT NULL, before TEXT NOT NULL,
 after TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(id,candidate_id)
);
CREATE TABLE kg_release (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES kg_version(id), actor TEXT NOT NULL,
 created TEXT NOT NULL, UNIQUE(id,version_id)
);
CREATE TABLE kg_release_fact (
 release_id TEXT NOT NULL, version_id TEXT NOT NULL, candidate_id TEXT NOT NULL, review_id TEXT NOT NULL,
 PRIMARY KEY(release_id,candidate_id),
 FOREIGN KEY(release_id,version_id) REFERENCES kg_release(id,version_id),
 FOREIGN KEY(candidate_id,version_id) REFERENCES kg_candidate(id,version_id),
 FOREIGN KEY(review_id,candidate_id) REFERENCES kg_review(id,candidate_id)
);
CREATE TABLE kg_head (
 version_id TEXT PRIMARY KEY, release_id TEXT NOT NULL,
 FOREIGN KEY(release_id,version_id) REFERENCES kg_release(id,version_id)
);
CREATE TABLE kg_audit (
 id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 detail TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX kg_candidate_version_type ON kg_candidate(version_id,fact_type);
CREATE INDEX kg_material_version ON kg_material(version_id);
