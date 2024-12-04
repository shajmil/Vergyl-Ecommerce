const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const signup = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Check if user exists
        const existingUser = await getmultipleSP('check_existing_user', [email]);
        if (existingUser[0] && existingUser[0].length > 0) {
            return errorResponse(res, 'Email already registered');
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await executeTransaction('signup', [
            name, email, phone, hashedPassword, 'customer'
        ]);

        const token = jwt.sign(
            { user_id: result.user_id, email, role: 'customer' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return successResponse(res, 'User registered successfully', {
            token,
            user: {
                user_id: result.user_id,
                name,
                email,
                phone,
                role: 'customer'
            }
        }, 201);
    } catch (error) {
        console.error('Signup error:', error);
        return errorResponse(res, 'Failed to register user', 500);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await getmultipleSP('login', [email]);
        const user = users[0][0];

        if (!user) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return successResponse(res, 'Login successful', {
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 'Login failed', 500);
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        // Verify OTP using stored procedure
        const result = await executeTransaction('VerifyOTP', [phone, otp]);
        
        if (!result.verified) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        res.json({ message: 'OTP verified successfully' });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Find user using stored procedure
        const users = await getmultipleSP('FindUserByEmail', [email]);
        if (!users[0] || users[0].length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password using stored procedure with transaction
        const result = await executeTransaction('UpdateUserPassword', [email, hashedPassword]);
        
        if (!result.updated) {
            throw new Error('Password update failed');
        }

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

module.exports = {
    signup,
    login,
    verifyOTP,
    resetPassword
}; 