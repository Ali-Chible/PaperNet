const paperModel = require('../models/paperModel');
const { embedText } = require('./embeddingService');
const { ingestSearchResults } = require('./ingestionService');

function toSimilarity(distance) {
  return 1 - distance;
}

async function findLocalCandidate(keywordEmbedding, { threshold = 0.62, minYear = null, maxYear = null } = {}) {
  const [top] = await paperModel.findMostSimilar(keywordEmbedding, { limit: 1, minYear, maxYear });
  if (!top) return null; // empty database, or nothing in range

  const similarity = toSimilarity(top.distance);
  if (similarity < threshold) return null;

  return { id: top.id, similarity };
}

async function resolveRootPaper(keyword, { minYear = null, maxYear = null, threshold = 0.62 } = {}) {
  const keywordEmbedding = await embedText(keyword);

  const localMatch = await findLocalCandidate(keywordEmbedding, { minYear, maxYear, threshold });
  if (localMatch) {
    return {
      paper: await paperModel.findById(localMatch.id),
      similarity: localMatch.similarity,
      source: 'local',
    };
  }

  await ingestSearchResults(keyword, { minYear, maxYear });

  const [top] = await paperModel.findMostSimilar(keywordEmbedding, { limit: 1, minYear, maxYear });
  if (!top) {
    const range = minYear != null || maxYear != null ? ` between ${minYear ?? 'any'}–${maxYear ?? 'any'}` : '';
    throw new Error(`No papers found for "${keyword}"${range}, even after fetching from OpenAlex.`);
  }

  return {
    paper: await paperModel.findById(top.id),
    similarity: toSimilarity(top.distance),
    source: 'openalex',
  };
}

module.exports = { findLocalCandidate, resolveRootPaper };