const express = require('express');
const { getPaper } = require('../controllers/paperController');

const router = express.Router();

router.get('/:id', getPaper);

module.exports = router;
