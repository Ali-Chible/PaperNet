const pool = require('../config/db');

async function createPaperAuthor({
    paper_id,author_id,author_position
}){
    const {rows}= await pool.query(
        `Insert into paper_authors 
        (paper_id,author_id,author_position)
        values ($1,$2,$3)
        On Conflict (paper_id,author_id) Do nothing
        `,
        [paper_id,author_id,author_position]
    );

}
async function findByAuthorId(author_id){
    const {rows}=await pool.query(
        `Select * from paper_authors where author_id=$1`,
        [author_id]
    );
    return rows || null;
}
async function findByPaperId(paper_id){
    const {rows}=await pool.query(
        `Select * from paper_authors where paper_id=$1`,
        [paper_id]
    );
    return rows || null;
}
async function findByFullId({paper_id,author_id}){
    const {rows}=await pool.query(
        `select * from paper_authors where paper_id=$1 and author_id=$2`,
        [paper_id,author_id]
    );
    return rows[0] || null;
}
module.exports = {createPaperAuthor,findByAuthorId,findByPaperId,findByFullId};