const express = require('express');
const router = express.Router();
const { get_profile, update_profile } = require('../controllers/profile.controller');
const {
    get_settings,
} = require('../controllers/admin/admin.settings');
router.get('/', get_profile);
router.put('/update', update_profile);
router.get('/get_settings', get_settings);

module.exports = router; 