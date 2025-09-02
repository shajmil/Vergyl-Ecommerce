const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const get_addresses = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_addresses', [user_id]);
        return successResponse(res, 'Addresses retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get addresses error:', error);
        return errorResponse(res, 'Failed to fetch addresses', 500);
    }
};

const add_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { address_line, city, state, zip_code, country,latitude,longitude } = req.body;

        const result = await executeTransaction('add_address', [
            user_id,
            address_line,
            city,
            state,
            zip_code,
            country,
            latitude,longitude

        ]);

        return successResponse(res, 'Address added successfully', result, 201);
    } catch (error) {
        console.error('Add address error:', error);
        return errorResponse(res, 'Failed to add address', 500);
    }
};

const update_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const address_id = req.params.id;
        const { address_line, city, state, zip_code, country } = req.body;

        const result = await executeTransaction('update_address', [
            address_id,
            user_id,
            address_line,
            city,
            state,
            zip_code,
            country
        ]);


        return successResponse(res, 'Address updated successfully', result);
    } catch (error) {
        console.error('Update address error:', error);
        return errorResponse(res, 'Failed to update address', 500);
    }
};

const delete_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const address_id = req.params.id;

        const result = await executeTransaction('delete_address', [address_id, user_id]);

      
        return successResponse(res, 'Address deleted successfully', result);
    } catch (error) {
        console.error('Delete address error:', error);
        return errorResponse(res, 'Failed to delete address', 500);
    }
};

module.exports = {
    get_addresses,
    add_address,
    update_address,
    delete_address
}; 