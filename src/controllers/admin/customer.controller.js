const { successResponse, errorResponse } = require('../../helpers/response.helper');

const get_customers = async (req, res) => {
    try {
        const { search, limit, offset } = req.query;
        const result = await getmultipleSP('get_customers', [
            search || null,
            limit || 10,
            offset || 0
        ]);

        return successResponse(res, 'Customers retrieved successfully', {
            customers: result[0],
            total: result[1][0].total
        });
    } catch (error) {
        console.error('Get customers error:', error);
        return errorResponse(res, 'Failed to fetch customers', 500);
    }
};

const get_customer_details = async (req, res) => {
    try {
        const customer_id = req.params.id;
        const result = await getmultipleSP('get_customer_details', [customer_id]);

        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Customer not found', 404);
        }

        const customerDetails = {
            ...result[0][0],
            orders: result[1],
            addresses: result[2]
        };

        return successResponse(res, 'Customer details retrieved successfully', customerDetails);
    } catch (error) {
        console.error('Get customer details error:', error);
        return errorResponse(res, 'Failed to fetch customer details', 500);
    }
};

module.exports = {
    get_customers,
    get_customer_details
}; 