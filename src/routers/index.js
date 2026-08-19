const express = require('express');
const searchRoutes = require('./searchRouter');
const paperRoutes = require('./paperRouter');
const settingsRoutes = require('./settingsRouter');
const chatRoutes = require('./chatRouter');

const router = express.Router();

router.use('/search', searchRoutes);
router.use('/papers', paperRoutes);
router.use('/settings', settingsRoutes);
router.use('/chat', chatRoutes);

module.exports = router;
