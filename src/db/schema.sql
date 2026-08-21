CREATE EXTENSION IF NOT EXISTS vector;  
CREATE EXTENSION IF NOT EXISTS pg_trgm;  

Create Table papers(
    id               Serial Primary Key,
    openalex_id      Varchar(50) Unique Not Null,
    doi              Varchar(255),
    title            Text Not Null,
    abstract         Text,
    publication_year smallint,
    venue            varchar(500),
    cited_by_count   integer default 0,
    referenced_works Text[],
    embedding          VECTOR(384),
    fetched_at       timestamptz default now(),
    updated_at       timestamptz default now(),
    citations_resolved_at TIMESTAMPTZ

);
Create table authors(
    id  Serial PRimary key,
    openalex_author_id varchar(50) unique,
    display_name       varchar(255) not null
);
Create table paper_authors (
    paper_id            integer not null references papers(id) on delete cascade,
    author_id           integer not null references authors(id) on delete cascade,
    author_position     smallint,                       
    primary key (paper_id, author_id)
);
Create Table citations (
    citing_paper_id     integer not null references papers(id) on delete cascade,
    cited_paper_id      integer not null references papers(id) on delete cascade,
    primary key (citing_paper_id, cited_paper_id),
    check (citing_paper_id <> cited_paper_id)
);
Create Table search_queries (
    id                  Serial Primary Key,
    keyword             varchar(500) unique not null,   
    root_paper_id       integer not null references papers(id),
    similarity          real,                       
    searched_at         timestamptz default now(),
    net_json            JSONB,
    net_built_at        timestamptz
);
Create Table dead_references (
    openalex_id   varchar(50) primary key,
    failed_at     timestamptz default now()
);
Create table settings (
    key    varchar(100) primary key,
    value  text
);
CREATE INDEX idx_papers_openalex_id ON papers (openalex_id);
CREATE INDEX idx_papers_title_trgm ON papers USING gin (title gin_trgm_ops);
CREATE INDEX idx_papers_embedding_hnsw ON papers
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_citations_cited_paper ON citations (cited_paper_id);
CREATE INDEX idx_search_queries_keyword ON search_queries (keyword);
