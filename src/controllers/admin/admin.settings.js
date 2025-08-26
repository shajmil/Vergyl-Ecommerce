

const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getmultipleSP,executeTransaction } = require('../../helpers/sp-caller');

const get_settings = async (req, res) => {
    try {
        const result = await getmultipleSP('get_settings', [
        ]);

        return successResponse(res, 'Settings retrieved successfully',  result[0]);
    } catch (error) {
        console.error('Get settings error:', error);
        return errorResponse(res, 'Failed to fetch settings', 500);
    }
};
const add_settings = async (req, res) => {
    try {
        
        const { id,service_charge,purchase_limit,max_items_in_request } = req.body;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('add_settings', [
            id,
            service_charge,
            purchase_limit,
            max_items_in_request,
            admin_id
        ]);

        return successResponse(res, 'Settings updated successfully', result);
    } catch (error) {
        console.error('Update settings error:', error);
        return errorResponse(res, 'Failed to update settings', 500);
    }
};

module.exports = {
    get_settings,
    add_settings
}; 