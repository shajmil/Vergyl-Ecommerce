const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const create_product_request = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const address_id = req.body.address_id;
        const delivery_time = req.body.delivery_time;
        const product_requests = req.body.product_requests; // Expecting an array of products
        const delivery_date = req.body.delivery_date; // Expecting an array of products

        if (!Array.isArray(product_requests) || product_requests.length === 0) {
            return errorResponse(res, 'Product requests must be an array with at least one item', 400);
        }

        // Call stored procedure with JSON data
        const result = await executeTransaction('create_product_request', [
            user_id,
            address_id,
            delivery_date,
            delivery_time,
            JSON.stringify(product_requests) // Convert array to JSON string
        ]);

        return successResponse(res, 'Product request created successfully', result, 201);
    } catch (error) {
        console.error('Create product request error:', error);
        return errorResponse(res, 'Failed to create product request', 500);
    }
};


const get_customer_product_requests = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { status, request_master_id } = req.query;

        const result = await getmultipleSP('get_customer_product_requests', [
            user_id, 
            status || null, 
            request_master_id || 0
        ]);
        console.log(result);
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
