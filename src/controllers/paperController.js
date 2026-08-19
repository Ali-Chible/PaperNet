const paperModel = require('../models/paperModel');

async function getPaper(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Paper id must be an integer.' });
  }

  try {
    const paper = await paperModel.findById(id);
    if (!paper) {
      return res.status(404).json({ error: `No paper with id ${id}.` });
    }
    const { embedding, ...rest } = paper;
    res.json(rest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPaper };
