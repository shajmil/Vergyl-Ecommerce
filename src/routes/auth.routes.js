const express = require('express');
const router = express.Router();
const { initiateLogin, socialLogin, verifyOTP,updateSizePreferences } = require('../controllers/auth.controller');
const { refreshTokenEndpoint,refreshTokenMiddleware} = require('../middlewares/auth.middleware');

// Route for email/phone login
router.post('/login', initiateLogin);

// Route for social login (Google/Apple)
router.post('/socialLogin', socialLogin);

router.post('/update-size-preferences', updateSizePreferences);

// Route for OTP verification
router.post('/verify-otp', verifyOTP);
router.post('/refresh', refreshTokenMiddleware, refreshTokenEndpoint);


module.exports = router; 