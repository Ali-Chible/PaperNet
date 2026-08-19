const pool = require('../config/db');

async function createCitation({ citing_paper_id, cited_paper_id }) {
    await pool.query(
        `Insert into citations (citing_paper_id, cited_paper_id)
        Values ($1, $2)
        On conflict (citing_paper_id, cited_paper_id) Do nothing`,
        [citing_paper_id, cited_paper_id]
    );
}

async function findById({ citing_paper_id, cited_paper_id }) {
    const { rows } = await pool.query(
        `select * from citations where citing_paper_id=$1 and cited_paper_id=$2`,
        [citing_paper_id, cited_paper_id]
    );
    return rows[0] || null;
}

async function findCiting(citing_paper_id) {
    const { rows } = await pool.query(
        `Select * from citations where citing_paper_id=$1`,
        [citing_paper_id]
    );
    return rows;
}

async function findCitedBy(cited_paper_id) {
    const { rows } = await pool.query(
        `Select * from citations where cited_paper_id=$1`,
        [cited_paper_id]
    );
    return rows;
}
 
async function findAmong(paperIds) {
    if (!paperIds || paperIds.length === 0) return [];
    const { rows } = await pool.query(
        `select * from citations
         where citing_paper_id = any($1::int[])
           and cited_paper_id = any($1::int[])`,
        [paperIds]
    );
    return rows;
}

module.exports = { createCitation, findById, findCiting, findCitedBy, findAmong };