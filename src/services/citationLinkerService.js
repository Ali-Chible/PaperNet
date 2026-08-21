const paperModel = require('../models/paperModel');
const citationModel = require('../models/citationModel');
const deadReferenceModel = require('../models/deadReferenceModel');
const { getWorkById, getCitingWorks, parseWork } = require('./openAlexService');
const { ingestWork } = require('./ingestionService');

async function resolvePaperId(openalexId){
    const existing = await paperModel.findByOpenAlexId(openalexId);
    if (existing) return existing.id;

    if(await deadReferenceModel.isDead(openalexId)){
        throw new Error(`${openalexId} is a dead reference`);
    }
    try{
        const rawWork = await getWorkById(openalexId);
        return await ingestWork(parseWork(rawWork));
    }catch (err){
        if(err.status===404){
            await deadReferenceModel.markDead(openalexId);
        }
        throw err;
    }
}

async function ensureLocalFromParsed(parsed){
    const existing = await paperModel.findByOpenAlexId(parsed.openalexId);
    if(existing) return existing.id;
    return ingestWork(parsed);
}

async function resolveOutgoingCitations(paper){
    const referencedIds=paper.referenced_works || [];
    let linked=0;

    for (const openalexId of referencedIds){
        try{
            const citedPaperId=await resolvePaperId(openalexId);
            await citationModel.createCitation({
                citing_paper_id:paper.id,
                cited_paper_id:citedPaperId,
            });
            linked++;
        }catch(err){
            console.warn(  `Skipping reference ${openalexId}: ${err.message}`);
        }

    }        return linked;
}

async function resolveIncomingCitations(paper, { limit = 20 } = {}) {
    const citingWorks = await getCitingWorks(paper.openalex_id,{limit});
    let linked =0 ;

    for(const rawWork of citingWorks){
        try{
            const parsed = parseWork(rawWork);
            const citingPaperId= await ensureLocalFromParsed(parsed);
            await citationModel.createCitation({
                citing_paper_id:citingPaperId,
                cited_paper_id:paper.id,
            });
            linked++;

        }catch(err){
            console.warn(`skipping a citing work:${err.message}`);
        }
    }
    return linked;
}
async function resolveCitationsForPaper(paper,{ incomingLimit = 20 } = {}) {
    if (paper.citations_resolved_at){
        return { outgoing: 0, incoming: 0, skipped: true };
    }
    const outgoing = await resolveOutgoingCitations(paper);
    const incoming=await resolveIncomingCitations(paper, { limit: incomingLimit });
    paper.citations_resolved_at = new Date();
    return { outgoing, incoming, skipped: false };

}
module.exports = { resolveOutgoingCitations, resolveIncomingCitations, resolveCitationsForPaper };