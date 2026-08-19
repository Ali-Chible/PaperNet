const paperModel = require('../models/paperModel');
const citationModel = require('../models/citationModel');
const searchQueriesModel = require('../models/searchQueriesModel');
const { resolveRootPaper } = require('./relevanceService');
const { resolveCitationsForPaper } = require('./citationLinkerService');
const { cosineSimilarity } = require('../utils/vectorMath');


const SEMANTIC_NEIGHBOR_LIMIT = 10;
const NEIGHBOR_SEMANTIC_THRESHOLD = 0.62;

function pairKey(idA, idB) {
  if (idA < idB) {
    return `${idA}-${idB}`;
  } else {
    return `${idB}-${idA}`;
  }
}


async function assembleNet(rootPaper, { minYear = null, maxYear = null } = {}) {
  if (!rootPaper.embedding) {
    throw new Error(`"${rootPaper.title}" (id ${rootPaper.id}) has no embedding — can't build a net around it.`);
  }

  await resolveCitationsForPaper(rootPaper);

  const citingRows = await citationModel.findCiting(rootPaper.id);   
  const citedByRows = await citationModel.findCitedBy(rootPaper.id);

  const citationNeighborIds = new Set([
    ...citingRows.map((r) => r.cited_paper_id),
    ...citedByRows.map((r) => r.citing_paper_id),
  ]);

  const semanticMatches = await paperModel.findMostSimilar(rootPaper.embedding, {
    limit: SEMANTIC_NEIGHBOR_LIMIT,
    excludeId: rootPaper.id,
    minYear,
    maxYear,
  });

  const nodesById = new Map();
  const embeddingsById = new Map();  

  for (const match of semanticMatches) {
    nodesById.set(match.id, {
      id: match.id,
      title: match.title,
      publicationYear: match.publication_year,
      similarity: 1 - match.distance,
      viaCitation: citationNeighborIds.has(match.id),
    });
    if (match.embedding) embeddingsById.set(match.id, match.embedding);
  }
  for (const id of citationNeighborIds) {
    if (nodesById.has(id)) continue;
    const paper = await paperModel.findById(id);
    if (!paper || !paper.embedding) continue;
    if (minYear != null && (paper.publication_year == null || paper.publication_year < minYear)) continue;
    if (maxYear != null && (paper.publication_year == null || paper.publication_year > maxYear)) continue;
    nodesById.set(id, {
      id,
      title: paper.title,
      publicationYear: paper.publication_year,
      similarity: cosineSimilarity(rootPaper.embedding, paper.embedding),
      viaCitation: true,
    });
    embeddingsById.set(id, paper.embedding);
  }

  const neighbors = Array.from(nodesById.values());
  const survivingIds = new Set(neighbors.map((n) => n.id));
  const neighborIds = neighbors.map((n) => n.id);

  const nodes = [
    {
      id: rootPaper.id,
      title: rootPaper.title,
      abstract: rootPaper.abstract,
      publicationYear: rootPaper.publication_year,
      similarity: 1,
      isRoot: true,
    },
    ...neighbors,
  ];

  const rootEdges = [
    ...citingRows
      .filter((r) => survivingIds.has(r.cited_paper_id))
      .map((r) => ({ from: rootPaper.id, to: r.cited_paper_id, type: 'cites', scope: 'root' })),
    ...citedByRows
      .filter((r) => survivingIds.has(r.citing_paper_id))
      .map((r) => ({ from: r.citing_paper_id, to: rootPaper.id, type: 'cites', scope: 'root' })),
    ...semanticMatches
      .filter((m) => survivingIds.has(m.id) && !citationNeighborIds.has(m.id))
      .map((m) => ({ from: rootPaper.id, to: m.id, type: 'semantic', scope: 'root' })),
  ];

  const neighborCitationRows = await citationModel.findAmong(neighborIds);
  const neighborCitationEdges = neighborCitationRows.map((r) => ({
    from: r.citing_paper_id,
    to: r.cited_paper_id,
    type: 'cites',
    scope: 'neighbor',
  }));
  const citedPairs = new Set(neighborCitationEdges.map((e) => pairKey(e.from, e.to)));

  const neighborSemanticEdges = [];
  for (let i = 0; i < neighbors.length; i++) {
    for (let j = i + 1; j < neighbors.length; j++) {
      const a = neighbors[i];
      const b = neighbors[j];
      if (citedPairs.has(pairKey(a.id, b.id))) continue;  
      const embA = embeddingsById.get(a.id);
      const embB = embeddingsById.get(b.id);
      if (!embA || !embB) continue;
      const similarity = cosineSimilarity(embA, embB);
      if (similarity >= NEIGHBOR_SEMANTIC_THRESHOLD) {
        neighborSemanticEdges.push({ from: a.id, to: b.id, type: 'semantic', similarity, scope: 'neighbor' });
      }
    }
  }

  const edges = [...rootEdges, ...neighborCitationEdges, ...neighborSemanticEdges];

  return { root: rootPaper.id, nodes, edges };
}

function truncateNet(net, maxNodes) {
  if (!maxNodes) return net;

  const root = net.nodes.find((n) => n.isRoot);
  let others = net.nodes.filter((n) => !n.isRoot);

  if (others.length > maxNodes - 1) {
    others = others
      .slice()
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.max(maxNodes - 1, 0));
  }

  const survivingIds = new Set([root.id, ...others.map((n) => n.id)]);
  const edges = net.edges.filter((e) => survivingIds.has(e.from) && survivingIds.has(e.to));

  return { root: net.root, nodes: [root, ...others], edges };
}

const DEFAULT_RELEVANCE_THRESHOLD = 0.62;

function buildCacheKey(keyword, minYear, maxYear, threshold) {
  const bits = [keyword];
  if (minYear != null || maxYear != null) bits.push(`${minYear ?? ''}-${maxYear ?? ''}`);
  if (threshold !== DEFAULT_RELEVANCE_THRESHOLD) bits.push(`t${threshold}`);
  return bits.length > 1 ? bits.join('|') : bits[0];
}

async function search(keyword, { minYear = null, maxYear = null, maxNodes = null, threshold = DEFAULT_RELEVANCE_THRESHOLD } = {}) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const cacheKey = buildCacheKey(normalizedKeyword, minYear, maxYear, threshold);

  const cached = await searchQueriesModel.findBySearchQueryKeyword(cacheKey);
  if (cached && cached.net_json) {
    const net = truncateNet(cached.net_json, maxNodes);
    return {
      keyword: normalizedKeyword,
      rootSource: 'cache',
      rootSimilarity: cached.similarity,
      netSource: 'cache',
      ...net,
    };
  }

  let rootPaper;
  let rootSource;
  let rootSimilarity;

  if (cached) {
    rootPaper = await paperModel.findById(cached.root_paper_id);
    rootSource = 'cache';
    rootSimilarity = cached.similarity;
  } else {
    const resolved = await resolveRootPaper(normalizedKeyword, { minYear, maxYear, threshold });
    rootPaper = resolved.paper;
    rootSource = resolved.source;
    rootSimilarity = resolved.similarity;
    await searchQueriesModel.createSearchQueries({
      keyword: cacheKey,
      root_paper_id: rootPaper.id,
      similarity: rootSimilarity,
    });
  }

  const fullNet = await assembleNet(rootPaper, { minYear, maxYear });
  await searchQueriesModel.saveNet(cacheKey, fullNet);

  const net = truncateNet(fullNet, maxNodes);
  return { keyword: normalizedKeyword, rootSource, rootSimilarity, netSource: 'built', ...net };
}

module.exports = { assembleNet, search };