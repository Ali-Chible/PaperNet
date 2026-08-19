const pool = require('../config/db');

async function createSearchQueries({ keyword, root_paper_id, similarity }) {
    await pool.query(
        `insert into search_queries (keyword, root_paper_id, similarity)
        values ($1, $2, $3)
        on conflict (keyword) do update set
          root_paper_id = excluded.root_paper_id,
          similarity = excluded.similarity,
          searched_at = now()`,
        [keyword, root_paper_id, similarity]
    );
}

async function findBySearchQueryId(id) {
    const { rows } = await pool.query(
        `Select * from search_queries where id=$1`,
        [id]
    );
    return rows[0] || null;
}

async function findBySearchQueryKeyword(keyword) {
    const { rows } = await pool.query(
        `select * from search_queries where keyword=$1`,
        [keyword]
    );
    return rows[0] || null; 
}

async function findBySearchQueryRootPaper(root_paper_id) {
    const { rows } = await pool.query(
        `select * from search_queries where root_paper_id=$1`,
        [root_paper_id]
    );
    return rows; 
}

async function saveNet(keyword, net) {
    await pool.query(
        `update search_queries set net_json = $2, net_built_at = now() where keyword = $1`,
        [keyword, JSON.stringify(net)]
    );
}

module.exports = {
    createSearchQueries,
    findBySearchQueryId,
    findBySearchQueryKeyword,
    findBySearchQueryRootPaper,
    saveNet,
};