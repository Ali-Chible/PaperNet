const express = require('express');
const { getNet } = require('../controllers/searchController');

const router = express.Router();
 
router.get('/', getNet);

module.exports = router;
