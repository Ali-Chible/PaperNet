const paperModel=require('../models/paperModel');
const { embedText } = require('./embeddingService');
const { ingestSearchResults } = require('./ingestionService');


async function findLocalCandidate(keywordEmbedding,{ threshold = 0.62, minYear = null, maxYear = null } = {}) {
    const [top] =await paperModel.findMostSimilar(keywordEmbedding,{ limit: 1, minYear, maxYear });
    if(!top) return null;
    const similarity=1-top.distance;
    if(similarity<threshold)return null;

    return { id:top.id,similarity };
}

async function resolveRootPaper(keyword, { minYear = null, maxYear = null, threshold = 0.62 } = {}) {
    const keywordEmbedding=await embedText(keyword);
    const localMatch = await findLocalCandidate(keywordEmbedding, { minYear, maxYear, threshold });

    if (localMatch){
        return {
            paper: await paperModel.findById(localMatch.id),
            similarity:localMatch.similarity,
            source:'local',
        };
    }
    await ingestSearchResults(keyword,{minYear,maxYear});
    const [top]=await paperModel.findMostSimilar(keywordEmbedding, { limit: 1, minYear, maxYear });
    if (!top) {
        throw new Error(`No papers found for "${keyword}"` + (minYear || maxYear ? ` (${minYear ?? 'any'}–${maxYear ?? 'any'})` : '.'));
    }
    return {
        paper: await paperModel.findById(top.id),
        similarity:toSimilarity(top.distance),
        source:'openalex',
    };

}
module.exports={findLocalCandidate,resolveRootPaper};
