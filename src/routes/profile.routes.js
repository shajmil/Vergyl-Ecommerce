const express = require('express');
const router = express.Router();
const { get_profile, update_profile } = require('../controllers/profile.controller');

router.get('/', get_profile);
router.put('/update', update_profile);

module.exports = router; 