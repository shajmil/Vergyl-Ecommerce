const express = require('express');
const router = express.Router();
const { generateLinkPreview } = require('../controllers/preview.controller');

router.post('/', generateLinkPreview);

module.exports = router; 