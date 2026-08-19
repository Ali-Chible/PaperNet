const pool = require('../config/db');

async function createAuthor({
    openalex_author_id, display_name
}) {
    const { rows } = await pool.query(
        `Insert into authors
        (openalex_author_id, display_name)
        Values ($1, $2)
        ON CONFLICT (openalex_author_id) DO UPDATE SET display_name = EXCLUDED.display_name
        RETURNING id
        `,
        [openalex_author_id, display_name]
    );
    return rows[0].id;
}

async function findByOpenAlexAuthorId(openalex_author_id) {
    const { rows } = await pool.query(
      `Select * from authors where openalex_author_id=$1`,
      [openalex_author_id]
    );
    return rows[0] || null;
}

async function findById(id) {
    const { rows } = await pool.query(`Select * from authors where id = $1`, [id]);
    return rows[0] || null;
}

module.exports = { createAuthor, findByOpenAlexAuthorId, findById };