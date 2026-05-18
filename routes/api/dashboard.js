const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/stats', async (req, res) => {
  try {
    const [[{ count: entities }]] = await db.query('SELECT COUNT(*) AS count FROM entities');
    const [[{ count: locations }]] = await db.query('SELECT COUNT(*) AS count FROM entity_locations');
    const [[{ count: programs }]] = await db.query('SELECT COUNT(*) AS count FROM programs');
    const [[{ count: media }]] = await db.query('SELECT COUNT(*) AS count FROM media');
    const [recent] = await db.query(
      'SELECT id, name, type, status, created_at FROM entities ORDER BY created_at DESC LIMIT 5'
    );
    res.json({ entities, locations, programs, media, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
