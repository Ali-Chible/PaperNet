const { search } = require('../services/netBuilderService');

async function getNet(req, res) {
  const keyword = req.query.keyword;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Query param "keyword" is required.' });
  }

  const minYear = req.query.minYear ? parseInt(req.query.minYear, 10) : null;
  const maxYear = req.query.maxYear ? parseInt(req.query.maxYear, 10) : null;
  const maxNodes = req.query.maxNodes ? parseInt(req.query.maxNodes, 10) : null;
  const threshold = req.query.threshold !== undefined ? parseFloat(req.query.threshold) : undefined;

  if (minYear !== null && Number.isNaN(minYear)) {
    return res.status(400).json({ error: '"minYear" must be a number.' });
  }
  if (maxYear !== null && Number.isNaN(maxYear)) {
    return res.status(400).json({ error: '"maxYear" must be a number.' });
  }
  if (maxNodes !== null && (Number.isNaN(maxNodes) || maxNodes < 1)) {
    return res.status(400).json({ error: '"maxNodes" must be a positive number.' });
  }
  if (threshold !== undefined && (Number.isNaN(threshold) || threshold < 0 || threshold > 1)) {
    return res.status(400).json({ error: '"threshold" must be a number between 0 and 1.' });
  }

  try {
    const net = await search(keyword, { minYear, maxYear, maxNodes, ...(threshold !== undefined ? { threshold } : {}) });
    res.json(net);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getNet };