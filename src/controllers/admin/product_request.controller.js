const get_all_product_requests = async (req, res) => {
    try {
        const result = await getmultipleSP('get_all_product_requests', []);
        return successResponse(res, 'Product requests retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get all product requests error:', error);
        return errorResponse(res, 'Failed to fetch product requests', 500);
    }
};

const handle_product_request = async (req, res) => {
    try {
        const request_id = req.params.id;
        const admin_id = req.user.user_id;
        const { action, admin_price, admin_size, admin_color } = req.body;

        const result = await executeTransaction('handle_product_request', [
            request_id,
            admin_id,
            action,
            admin_price,
            admin_size,
            admin_color
        ]);

        return successResponse(res, `Product request ${action}ed successfully`, result.request);
    } catch (error) {
        console.error('Handle product request error:', error);
        return errorResponse(res, 'Failed to handle product request', 500);
    }
};

module.exports = {
    get_all_product_requests,
    handle_product_request
};
