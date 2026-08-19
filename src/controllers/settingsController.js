const settingsModel = require('../models/settingsModel');

const MASKABLE_KEYS = ['openalex_api_key', 'ai_api_key'];
const ALLOWED_KEYS = ['openalex_api_key', 'ai_provider', 'ai_api_key', 'ai_model'];

function mask(value) {
  if (!value) return null;
  if (value.length <= 6) return '••••••';
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

async function getSettings(req, res) {
  try {
    const all = await settingsModel.getAll();
    for (const key of MASKABLE_KEYS) {
      if (all[key]) all[key] = mask(all[key]);
    }
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateSettings(req, res) {
  const updates = {};
  for (const key of ALLOWED_KEYS) {
    if (req.body[key] !== undefined && req.body[key] !== '') {
      updates[key] = req.body[key];
    }
  }

  try {
    await settingsModel.setMany(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getSettings, updateSettings };
