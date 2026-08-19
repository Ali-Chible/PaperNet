const pool = require('../config/db');

async function get(key) {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
}

async function getAll() {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function set(key, value) {
    await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
    );
}

async function setMany(pairs) {
    for (const [key, value] of Object.entries(pairs)) {
        await set(key, value);
    }
}

module.exports = { get, getAll, set, setMany };
