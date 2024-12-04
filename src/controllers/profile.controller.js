const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const get_profile = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_profile', [user_id]);
        
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Profile not found', 404);
        }

        return successResponse(res, 'Profile retrieved successfully', result[0][0]);
    } catch (error) {
        console.error('Get profile error:', error);
        return errorResponse(res, 'Failed to fetch profile', 500);
    }
};

const update_profile = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { name, phone } = req.body;

        const result = await executeTransaction('update_profile', [
            user_id,
            name,
            phone
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Profile update failed', 400);
        }

        return successResponse(res, 'Profile updated successfully', result.user);
    } catch (error) {
        console.error('Update profile error:', error);
        return errorResponse(res, 'Failed to update profile', 500);
    }
};

module.exports = {
    get_profile,
    update_profile
}; 