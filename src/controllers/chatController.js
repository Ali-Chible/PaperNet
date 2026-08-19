const { chat } = require('../services/aiService');

async function postChat(req, res) {
  const { netContext, messages } = req.body;

  if (!netContext || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request must include netContext and a non-empty messages array.' });
  }

  try {
    const reply = await chat({ netContext, messages });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { postChat };
