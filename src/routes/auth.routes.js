const express = require('express');
const router = express.Router();
const { signup, login, verifyOTP, resetPassword } = require('../controllers/auth.controller');

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify_otp', verifyOTP);
router.post('/reset_password', resetPassword);

module.exports = router; 