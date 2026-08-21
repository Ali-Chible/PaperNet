const paperModel = require('../models/paperModel');
const authorModel = require('../models/authorModel');
const paperAuthorModel = require('../models/paperAuthorModel');
const { searchWorks, parseWork } = require('./openAlexService');
const { embedText } = require('./embeddingService');

async function ingestWork(parsedWork) {
  const embedding = parsedWork.abstract ? await embedText(parsedWork.abstract) : null;

  const paperId = await paperModel.createPaper({
    openalexId: parsedWork.openalexId,
    doi: parsedWork.doi,
    title: parsedWork.title,
    abstract: parsedWork.abstract,
    publicationYear: parsedWork.publicationYear,
    venue: parsedWork.venue,
    citedByCount: parsedWork.citedByCount,
    embedding,
    referencedWorkIds: parsedWork.referencedWorkIds,
  });

  for (const author of parsedWork.authors) {
    if (!author.openalexAuthorId) continue; 
    const authorId = await authorModel.createAuthor({
      openalex_author_id: author.openalexAuthorId,
      display_name: author.displayName,
    });
    await paperAuthorModel.createPaperAuthor({
      paper_id: paperId,
      author_id: authorId,
      author_position: author.position,
    });
  }

  return paperId;
}

async function ingestSearchResults(keyword,{ perPage = 50, minYear = null, maxYear = null } = {}) {
    const rawWorks=await searchWorks(keyword, { perPage, minYear, maxYear });
    const savedIds = [];
    const skipped = [];

    for (const rawWork of rawWorks){
        const parsed=parseWork(rawWork);
        if (!parsed.openalexId) {
        skipped.push(rawWork);
        continue;
        }
        const paperId=await ingestWork(parsed);
        savedIds.push(paperId);
    }
    if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length}/${rawWorks.length} malformed result(s).`);
  }
  return savedIds;

}

module.exports={ingestWork,ingestSearchResults};