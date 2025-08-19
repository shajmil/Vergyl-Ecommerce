const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');
const jwt = require('jsonwebtoken');
const { generateTokens } = require('../middlewares/auth.middleware');
const EmailService = require('../services/emailservice');
const emailService = new EmailService();

const initiateLogin = async (req, res) => {
    try {
        const { email, phone, login_type, name, password, social_id, social_type } = req.body;

        // Handle different authentication types
        if (login_type === 'social') {
            return await handleSocialLogin(req, res);
        } else if (login_type === 'email_password') {
            return await handleEmailPasswordLogin(req, res);
        } else {
            // OTP-based login (email or phone)
            return await handleOTPLogin(req, res);
        }

    } catch (error) {
        console.error('Login initiation error:', error);
        return errorResponse(res, 'Failed to initiate login', 500);
    }
};
const handleEmailPasswordLogin = async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400);
    }

    // Check if user exists with email
    const users = await getmultipleSP('check_user_exists', [email, 'email']);
    let user = users[0][0];

    // If user doesn't exist, create new user with hashed password
    if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await executeTransaction('create_user', [
            email,
            null, // phone
            'customer',
            null, // size_preferences initially null
            name,
            hashedPassword, // hashed password
            null, // social_id
            null  // social_type
        ]);

        user = {
            user_id: result[0].user_id,
            email: email,
            phone: null,
            role: 'customer',
            name: name,
            size_preferences: null,
            password: hashedPassword
        };
    } else {
        // Verify password for existing user
        if (!user.password) {
            return errorResponse(res, 'Password not set for this account. Please use OTP login or set a password.', 400);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return errorResponse(res, 'Invalid email or password', 401);
        }
    }

    // Generate tokens directly (no OTP required)
    const { accessToken, refreshToken } = generateTokens(user);

    return successResponse(res, 'Login successful', {
        user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            has_size_preferences: !!user.size_preferences,
            size_preferences: user.size_preferences,
            access_token: accessToken,
            refresh_token: refreshToken
        },
        requires_otp: false
    });
};
// Handle OTP-based login (existing logic)
const handleOTPLogin = async (req, res) => {
    const { email, phone, login_type, name } = req.body;

    // Validate input based on login type
    const value = login_type === 'email' ? email : phone;
    if (!value) {
        return errorResponse(res, `${login_type} is required`, 400);
    }

    // Check if user exists
    const users = await getmultipleSP('check_user_exists', [value, login_type]);
    let user = users[0][0];

    // If user doesn't exist, create new user
    if (!user) {
        const result = await executeTransaction('create_user', [
            login_type === 'email' ? value : null, // email
            login_type === 'phone' ? value : null, // phone
            'customer',
            null, // size_preferences initially null
            name,
            null, // password
            null, // social_id
            null  // social_type
        ]);

        user = {
            user_id: result[0].user_id,
            email: login_type === 'email' ? value : null,
            phone: login_type === 'phone' ? value : null,
            role: 'customer',
            name: name,
            size_preferences: null
        };
    }

    // Ensure user_id is not null
    if (!user.user_id) {
        return errorResponse(res, 'Failed to retrieve user ID', 500);
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP
    await executeTransaction('save_otp', [user.user_id, otp]);
    const result = await emailService.sendOTP(value, otp);
    
    if (result.success) {
        console.log('OTP sent successfully');
        return successResponse(res, 'OTP sent successfully', {
            user_id: user.user_id,
            [login_type]: value,
            otp: otp, // Remove in production
            has_size_preferences: !!user.size_preferences,
            requires_otp: true
        });
    } else {
        console.error('Failed to send OTP:', result.error);
        return errorResponse(res, 'Failed to send OTP. Please try again.', {
            error: result.error,
            user_id: user.user_id,
            [login_type]: value
        });
    }
};
const handleSocialLogin = async (req, res) => {
    const { email, name, social_id, social_type } = req.body;

    if (!social_id || !social_type || !['apple', 'google'].includes(social_type)) {
        return errorResponse(res, 'Invalid social login data', 400);
    }

    // Check if user exists with social_id and social_type
    const users = await getmultipleSP('check_social_user', [social_id, social_type]);
    let user = users[0][0];

    // If user doesn't exist, create new user
    if (!user) {
        const result = await executeTransaction('create_user', [
            email,
            null, // phone
            'customer',
            null, // size_preferences initially null
            name,
            null, // password (not needed for social login)
            social_id,
            social_type
        ]);

        user = {
            user_id: result[0].user_id,
            email: email,
            phone: null,
            role: 'customer',
            name: name,
            size_preferences: null,
            social_id: social_id,
            social_type: social_type
        };
    }

    // Generate tokens directly (no OTP required)
    const { accessToken, refreshToken } = generateTokens(user);

    return successResponse(res, 'Social login successful', {
        user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            has_size_preferences: !!user.size_preferences,
            size_preferences: user.size_preferences,
            access_token: accessToken,
            refresh_token: refreshToken
        },
        requires_otp: false
    });
};
const socialLogin = async (req, res) => {
    try {
        const { social_id, email, name, login_type } = req.body; // login_type: 'google' or 'apple'

        // Check if user exists with this social ID
        const users = await getmultipleSP('check_social_user', [social_id, login_type]);
        let user = users[0][0];
        console.log('s', user);
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
                email: result[0].email,
                name: result[0].name,
                role: result[0].role,
                phone: result[0].phone,
                size_preferences: null
            };
        }

        const { accessToken, refreshToken } = generateTokens(user);

        return successResponse(res, 'Login successful', {
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                has_size_preferences: !!user.size_preferences,
                size_preferences: user.size_preferences,
                access_token: accessToken, // Keep for backward compatibility
                refresh_token: refreshToken // Add refresh token
            },
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
        console.log('user', user);

        // Generate both access and refresh tokens using the new function
        const { accessToken, refreshToken } = generateTokens(user);

        return successResponse(res, 'Login successful', {
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                has_size_preferences: !!user.size_preferences,
                size_preferences: user.size_preferences,
                access_token: accessToken, // Keep for backward compatibility
                refresh_token: refreshToken // Add refresh token
            },
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