const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const create_order = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { address_id, items, delivery_time } = req.body;

        const result = await executeTransaction('create_order', [
            user_id,
            address_id,
            JSON.stringify(items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price
            }))),
            delivery_time
        ]);

        return successResponse(res, 'Order created successfully', result.order, 201);
    } catch (error) {
        console.error('Create order error:', error);
        return errorResponse(res, 'Failed to create order', 500);
    }
};

const get_orders = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_orders', [user_id]);
        return successResponse(res, 'Orders retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get orders error:', error);
        return errorResponse(res, 'Failed to fetch orders', 500);
    }
};

const get_order_details = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const order_id = req.params.id;

        const result = await getmultipleSP('get_order_details', [order_id, user_id]);
        
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order not found', 404);
        }

        const orderDetails = {
            ...result[0][0],
            items: result[1]
        };

        return successResponse(res, 'Order details retrieved successfully', orderDetails);
    } catch (error) {
        console.error('Get order details error:', error);
        return errorResponse(res, 'Failed to fetch order details', 500);
    }
};

const update_order_delivery = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const order_id = req.params.id;
        const { delivery_time } = req.body;

        const result = await executeTransaction('update_order_delivery', [
            order_id,
            user_id,
            delivery_time
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Order not found', 404);
        }

        return successResponse(res, 'Order delivery time updated successfully', result.order);
    } catch (error) {
        console.error('Update order delivery error:', error);
        return errorResponse(res, 'Failed to update order delivery time', 500);
    }
};

module.exports = {
    create_order,
    get_orders,
    get_order_details,
    update_order_delivery
}; 