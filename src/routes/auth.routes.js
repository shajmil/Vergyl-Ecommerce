const express = require('express');
const router = express.Router();
const { initiateLogin, socialLogin, verifyOTP,updateSizePreferences } = require('../controllers/auth.controller');

// Route for email/phone login
router.post('/login', initiateLogin);

// Route for social login (Google/Apple)
router.post('/social-login', socialLogin);

router.post('/update-size-preferences', updateSizePreferences);

// Route for OTP verification
router.post('/verify-otp', verifyOTP);

module.exports = router; 