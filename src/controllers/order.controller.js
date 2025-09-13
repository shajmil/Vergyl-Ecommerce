const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');
const { successResponse, errorResponse } = require('../helpers/response.helper');

const get_all_orders = async (req, res) => {
    try {
        const { status } = req.query; // Get params from query
        const result = await getmultipleSP('get_all_orders', [ status || null, 
                ]);
        return successResponse(res, 'Orders retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get all orders error:', error);
        return errorResponse(res, 'Failed to fetch orders', 500);
    }
};
const get_user_orders = async (req, res) => {
    try {
        let user_id = req.user.user_id;
        const status_list = req.body.status_list;
        const result = await getmultipleSP('get_user_orders',
            [ user_id ,status_list]);
        return successResponse(res, 'Orders retrieved successfully', result[0]);
    } catch (error) {
            console.error('Get all orders error:', error);
        return errorResponse(res, 'Failed to fetch orders', 500);
    }
};
const get_not_deliverable_dates = async (req, res) => {

    try {
        const result = await getmultipleSP('get_not_deliverable_dates', []);

        return successResponse(res, 'Data retrieved successfully', result[0]);
    } catch (error) {
        console.error('get_not_deliverable_dates  error:', error);
        return errorResponse(res, 'Failed to fetch not delivarable dates', 500);
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

        return successResponse(res, 'Order deleted successfully', null);
    } catch (error) {
        console.error('Delete order error:', error);
        return errorResponse(res, 'Failed to delete order', 500);
    }
};
const get_order_details = async (req, res) => {
    try {
        const order_id = req.query.order_id;

        const result = await getmultipleSP('get_order_details', [order_id]);
        console.log(result);
        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order not found', 404);
        }

     

        return successResponse(res, 'Order details retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get order details error:', error);
        return errorResponse(res, 'Failed to fetch order details', 500);
    }
};




// src/controllers/order.controller.js
// Add this new method
const get_order_history = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const order_id = req.params.id;

        const result = await getmultipleSP('get_order_history', [order_id]);

        if (!result[0] || result[0].length === 0) {
            return errorResponse(res, 'Order history not found', 404);
        }

        return successResponse(res, 'Order history retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get order history error:', error);
        return errorResponse(res, 'Failed to fetch order history', 500);
    }
};

// Update create_order to handle custom products
const create_order = async (req, res) => {
    try {
        const {  order_data } = req.body;

        const {
            order_id = 0,
            request_master_id ,
            user_id,
            address_id,
            created_by,
            updated_by,
            status = 'Pending',
            order_status_id,
            delivery_date,
            requested_delivery_date,
            delivery_time,
            sub_total,
            service_charge = 0,
            delivery_charge = 0,
            tax_amt,
            total_amt,
            discount_amt,
            net_total,
            is_express_delivery,
            address_line,city,state,country,latitude,longitude,zip_code,
            order_items
        } = order_data;

        const result = await executeTransaction('create_order', [
            order_id,                           // p_order_id
            request_master_id,                           // p_request_master_id
            user_id,                            // p_user_id
            address_id,                         // p_address_id
            created_by,                         // p_created_by
            updated_by,                         // p_updated_by
            status,                             // p_status
            order_status_id,                    // p_order_status_id
            delivery_date,                      // p_delivery_date
            requested_delivery_date,                      // requested_delivery_date
            delivery_time,                      // p_delivery_time
            sub_total,                          // p_sub_total
            service_charge,                     // p_service_charge
            delivery_charge,                    // p_delivery_charge
            tax_amt,                            // p_tax_amt
            total_amt,                          // p_total_amt
            discount_amt,                       // p_discount_amt
            net_total,                          // p_net_total
            is_express_delivery,                          // is_express_delivery
            address_line,city,state,country,latitude,longitude,zip_code,
            JSON.stringify(order_items)         // p_order_items
        ]);
        

        return successResponse(res, 'Order created successfully', result, 200);


    } catch (error) {
        console.error('Create order request error:', error);
        return errorResponse(res, 'Failed to create order request', 500);
    }
};

// Export the new method
module.exports = {
    create_order,
    get_all_orders,
    get_user_orders,
    get_order_details,
    delete_order,
    get_order_history,
    get_not_deliverable_dates,
};
