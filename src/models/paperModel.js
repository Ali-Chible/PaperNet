const pool = require('../config/db');
const pgvector = require('pgvector/pg');

async function createPaper({
  openalexId, doi, title, abstract, publicationYear, venue, citedByCount, embedding,
  referencedWorkIds,
}) {
  const { rows } = await pool.query(
    `INSERT INTO papers
      (openalex_id, doi, title, abstract, publication_year, venue, cited_by_count, embedding, referenced_works)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (openalex_id) DO UPDATE SET
       abstract = EXCLUDED.abstract,
       embedding = EXCLUDED.embedding,
       referenced_works = EXCLUDED.referenced_works,
       updated_at = NOW()
     RETURNING id`,
    [
      openalexId, doi, title, abstract, publicationYear, venue, citedByCount,
      embedding ? pgvector.toSql(embedding) : null,
      referencedWorkIds || null, 
    ]
  );
  return rows[0].id;
}

async function findByOpenAlexId(openalexId) {
  const { rows } = await pool.query(
    'SELECT * FROM papers WHERE openalex_id = $1',
    [openalexId]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM papers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findMostSimilar(embedding, { limit = 10, excludeId = null, minYear = null, maxYear = null } = {}) {
  const vec = pgvector.toSql(embedding);
  const { rows } = await pool.query(
    `SELECT id, openalex_id, title, abstract, publication_year, embedding, embedding <=> $1 AS distance
     FROM papers
     WHERE ($2::int IS NULL OR id <> $2)
       AND ($4::smallint IS NULL OR publication_year >= $4)
       AND ($5::smallint IS NULL OR publication_year <= $5)
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [vec, excludeId, limit, minYear, maxYear]
  );
  return rows;
}

async function markCitationsResolved(id) {
  const { rows } = await pool.query(
    `UPDATE papers SET citations_resolved_at = NOW() WHERE id = $1 RETURNING citations_resolved_at`,
    [id]
  );
  return rows[0] ? rows[0].citations_resolved_at : null;
}

module.exports = { createPaper, findByOpenAlexId, findById, findMostSimilar, markCitationsResolved };