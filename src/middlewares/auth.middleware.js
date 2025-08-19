const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token is specifically an access token (not refresh token)
        if (decoded.type && decoded.type !== 'access') {
            return res.status(401).json({ 
                error: 'Invalid token type',
                message: 'Access token required'
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Access token has expired'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'Access token is invalid'
            });
        }
        
        return res.status(401).json({ 
            error: 'Invalid token',
            message: 'Token verification failed'
        });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ADD THIS: Refresh token middleware
const refreshTokenMiddleware = (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(401).json({ 
                error: 'Refresh token required',
                message: 'Refresh token is required'
            });
        }

        // Use separate refresh secret if available, otherwise use main secret
        const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(refresh_token, refreshSecret);
        
        // Check if token is specifically a refresh token
        if (decoded.type && decoded.type !== 'refresh') {
            return res.status(401).json({ 
                error: 'Invalid token type',
                message: 'Refresh token required'
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Refresh token expired',
                message: 'Refresh token has expired, please login again'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid refresh token',
                message: 'Refresh token is invalid'
            });
        }
        
        return res.status(401).json({ 
            error: 'Token refresh failed',
            message: 'Refresh token verification failed'
        });
    }
};

// ADD THIS: Token generation function
const generateTokens = (user) => {
    const payload = {
        id: user.id || user.user_id,
        user_id: user.user_id,  // Keep your existing field
        email: user.email,
        role: user.role,
        // Add other user fields as needed
    };

    // Access token (short-lived, e.g., 15 minutes)
    const accessToken = jwt.sign(
        { ...payload, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '60m' }
    );

    // Refresh token (long-lived, e.g., 7 days)
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        refreshSecret,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '2d' }
    );

    return { accessToken, refreshToken };
};

// ADD THIS: Refresh token endpoint
const refreshTokenEndpoint = async (req, res) => {
    try {
        // refreshTokenMiddleware should have already validated the refresh token
        const user = req.user;

        // Generate new tokens
        const { accessToken, refreshToken } = generateTokens(user);

        res.json({
            success: true,
            message: 'Tokens refreshed successfully',
            data: {
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '60m'
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Token refresh failed'
        });
    }
};

module.exports = { 
    authMiddleware, 
    adminMiddleware,
    refreshTokenMiddleware,
    generateTokens,
    refreshTokenEndpoint
};