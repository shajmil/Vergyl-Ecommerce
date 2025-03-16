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
        const orderDetails = result[0];

        // The result[1] will contain the total amount
        const totalAmount = result[1][0] ? result[1][0].total_amount : 0;

     
        return successResponse(res, 'Orders retrieved successfully', {
            orders: orderDetails,
            total: totalAmount
        });
    } catch (error) {
        console.error('Get all orders error:', error);
        return errorResponse(res, 'Failed to fetch orders', 500);
    }
};

const get_admin_order_details = async (req, res) => {
    try {
        const order_id = req.params.id;
        const result = await getmultipleSP('get_order_details', [order_id]);
        
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order not found', 404);
        }

        // const orderDetails = {
        //     ...result[0][0],
        //     items: result[1],
        //     customer: result[2][0],
        //     address: result[3][0]
        // };
        const orderDetails = {
            ...result[0][0],
            items: result[1]
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

        return successResponse(res, 'Order status updated successfully', result);
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
// src/controllers/admin/order.controller.js

const manage_order_items = async (req, res) => {
    try {
        const order_id = req.params.id;
        const admin_id = req.user.user_id;
        const { 
            is_custom_product, 
            product_request_id, 
            product_id, 
            quantity, 
            price 
        } = req.body;

        const result = await executeTransaction('manage_order_items', [
            order_id,
            admin_id,
            is_custom_product,
            product_request_id,
            product_id,
            quantity,
            price
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Order not found or update failed', 404);
        }

        return successResponse(res, 'Order items updated successfully', result.order);
    } catch (error) {
        console.error('Manage order items error:', error);
        return errorResponse(res, 'Failed to manage order items', 500);
    }
};

const delete_order = async (req, res) => {
    try {
        const order_id = req.params.id;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('delete_order', [
            order_id,
            admin_id
        ]);

        if (!result.deleted) {
            return errorResponse(res, 'Order not found or delete failed', 404);
        }

        return successResponse(res, 'Order deleted successfully', null);
    } catch (error) {
        console.error('Delete order error:', error);
        return errorResponse(res, 'Failed to delete order', 500);
    }
};

const get_order_history = async (req, res) => {
    try {
        const order_id = req.params.id;
        const result = await getmultipleSP('get_order_history', [order_id]);
        
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order history not found', 404);
        }

        return successResponse(res, 'Order history retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get admin order history error:', error);
        return errorResponse(res, 'Failed to fetch order history', 500);
    }
};

module.exports = {
    get_all_orders,
    get_admin_order_details,
    update_order_status,
    update_order_schedule,
    manage_order_items,    // Add this
    delete_order,          // Add this
    get_order_history // Add this
};

