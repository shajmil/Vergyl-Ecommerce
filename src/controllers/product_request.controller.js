const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const create_product_request = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { product_name, description, requested_size, requested_color,image } = req.body;

        const result = await executeTransaction('create_product_request', [
            user_id,
            product_name,
            description,
            requested_size,
            requested_color,
            image
        ]);
        console.log(result);
        return successResponse(res, 'Product request created successfully', result, 201);
    } catch (error) {
        console.error('Create product request error:', error);
        return errorResponse(res, 'Failed to create product request', 500);
    }
};

const get_customer_product_requests = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { status } = req.query; // Get status from query params
        const result = await getmultipleSP('get_customer_product_requests', [user_id, status || null]);
        return successResponse(res, 'Product requests retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get product requests error:', error);
        return errorResponse(res, 'Failed to fetch product requests', 500);
    }
};

module.exports = {
    create_product_request,
    get_customer_product_requests
};
