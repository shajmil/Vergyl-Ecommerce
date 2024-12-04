const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

const get_all_orders = async (req, res) => {
    try {
        const { status, start_date, end_date, limit, offset } = req.query;
        const result = await getmultipleSP('get_all_orders', [
            status || null,
            start_date || null,
            end_date || null,
            limit || 10,
            offset || 0
        ]);

        return successResponse(res, 'Orders retrieved successfully', {
            orders: result[0],
            total: result[1][0].total
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        return errorResponse(res, 'Failed to fetch orders', 500);
    }
};

const get_admin_order_details = async (req, res) => {
    try {
        const order_id = req.params.id;
        const result = await getmultipleSP('get_admin_order_details', [order_id]);
        
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order not found', 404);
        }

        const orderDetails = {
            ...result[0][0],
            items: result[1],
            customer: result[2][0],
            address: result[3][0]
        };

        return successResponse(res, 'Order details retrieved successfully', orderDetails);
    } catch (error) {
        console.error('Get admin order details error:', error);
        return errorResponse(res, 'Failed to fetch order details', 500);
    }
};

const update_order_status = async (req, res) => {
    try {
        const order_id = req.params.id;
        const { status } = req.body;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('update_order_status', [
            order_id,
            status,
            admin_id
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Order not found', 404);
        }

        return successResponse(res, 'Order status updated successfully', result.order);
    } catch (error) {
        console.error('Update order status error:', error);
        return errorResponse(res, 'Failed to update order status', 500);
    }
};

const update_order_schedule = async (req, res) => {
    try {
        const order_id = req.params.id;
        const { delivery_time } = req.body;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('update_order_schedule', [
            order_id,
            delivery_time,
            admin_id
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Order not found', 404);
        }

        return successResponse(res, 'Order schedule updated successfully', result.order);
    } catch (error) {
        console.error('Update order schedule error:', error);
        return errorResponse(res, 'Failed to update order schedule', 500);
    }
};

module.exports = {
    get_all_orders,
    get_admin_order_details,
    update_order_status,
    update_order_schedule
}; 