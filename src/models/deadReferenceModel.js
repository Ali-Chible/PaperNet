const pool = require('../config/db');

async function markDead(openalex_id) {
    await pool.query(
        `INSERT INTO dead_references (openalex_id) VALUES ($1)
         ON CONFLICT (openalex_id) DO NOTHING`,
        [openalex_id]
    );
}

async function isDead(openalex_id) {
    const { rows } = await pool.query(
        `SELECT 1 FROM dead_references WHERE openalex_id = $1`,
        [openalex_id]
    );
    return rows.length > 0;
}

module.exports = { markDead, isDead };