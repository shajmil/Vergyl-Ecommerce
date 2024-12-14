const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');
const jwt = require('jsonwebtoken');

const initiateLogin = async (req, res) => {
    try {
        const { email, phone, login_type, name } = req.body; // Add name to the request body
        
        // Validate input based on login type
        const value = login_type === 'email' ? email : phone;
        if (!value) {
            return errorResponse(res, `${login_type} is required`, 400);
        }
        
        // Check if user exists
        const users = await getmultipleSP('check_user_exists', [value, login_type]);
        let user = users[0][0];
        console.log('as',value);
        // If user doesn't exist, create new user
        if (!user) {
            const result = await executeTransaction('create_user', [
                login_type === 'email' ? value : null, // email
                login_type === 'phone' ? value : null, // phone
                'customer',
                null, // size_preferences initially null,
                name
            ]);
            console.log(result);
            user = {
                user_id: result[0].user_id,
                email: login_type === 'email' ? value : null,
                phone: login_type === 'phone' ? value : null,
                role: 'customer',
                name: name,
                size_preferences: null
            };
        }

        // Debugging: Log user_id
        console.log('User ID:', user.user_id);

        // Ensure user_id is not null
        if (!user.user_id) {
            return errorResponse(res, 'Failed to retrieve user ID', 500);
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP
        await executeTransaction('save_otp', [
            user.user_id,
            otp
        ]);

        // In production, send OTP via email/SMS based on login_type
        return successResponse(res, 'OTP sent successfully', {
            user_id: user.user_id,
            [login_type]: value,
            otp: otp, // Remove in production
            has_size_preferences: !!user.size_preferences
        });

    } catch (error) {
        console.error('Login initiation error:', error);
        return errorResponse(res, 'Failed to initiate login', 500);
    }
};

const socialLogin = async (req, res) => {
    try {
        const { social_id, email, name, login_type } = req.body; // login_type: 'google' or 'apple'
        
        // Check if user exists with this social ID
        const users = await getmultipleSP('check_social_user', [social_id, login_type]);
        let user = users[0][0];
        console.log('s',user);
        // If user doesn't exist, create new user
        if (!user) {
            const result = await executeTransaction('create_social_user', [
                social_id,
                email,
                name,
                login_type,
                null // size_preferences initially null
            ]);
            user = {
                user_id: result[0].user_id,
                email: email,
                name: name,
                role: 'customer',
                size_preferences: null
            };
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return successResponse(res, 'Login successful', {
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                has_size_preferences: !!user.size_preferences,
                size_preferences: user.size_preferences
            }
        });

    } catch (error) {
        console.error('Social login error:', error);
        return errorResponse(res, 'Failed to process social login', 500);
    }
};
const updateSizePreferences = async (req, res) => {
    try {
        const { user_id, size_preferences } = req.body;
        await executeTransaction('update_user_size_preferences', [user_id, size_preferences]);
        return successResponse(res, 'Size preferences updated successfully');
    } catch (error) {
        console.error('Size preferences update error:', error);
        return errorResponse(res, 'Failed to update size preferences', 500);
    }
};
const verifyOTP = async (req, res) => {
    try {
        const { user_id, otp } = req.body;

        // Verify OTP
        const result = await executeTransaction('verify_otp', [user_id, otp]);
        
        if (!result[0].verified) {
            return errorResponse(res, 'Invalid OTP', 400);
        }

        // Get user details
        const users = await getmultipleSP('get_user_by_id', [user_id]);
        const user = users[0][0];
console.log('user',user);
        // Generate JWT token
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                email: user.email, 
                role: user.role 
            },
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
                role: user.role,
                has_size_preferences: !!user.size_preferences,
                size_preferences: user.size_preferences
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        return errorResponse(res, 'Failed to verify OTP', 500);
    }
};

module.exports = {
    initiateLogin,
    socialLogin,
    verifyOTP,
    updateSizePreferences
}; 