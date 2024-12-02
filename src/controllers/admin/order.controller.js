const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');

const get_all_orders = async (req, res) => {
    try {
        const { status, start_date, end_date } = req.query;
        const result = await getmultipleSP('get_all_orders', [status, start_date, end_date]);
        res.json(result[0]);
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

const get_admin_order_details = async (req, res) => {
    try {
        const orderId = req.params.id;
        const result = await getmultipleSP('get_admin_order_details', [orderId]);
        
        if (!result[0] || result[0].length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = result[0][0];
        order.items = result[1];
        order.history = result[2];

        res.json(order);
    } catch (error) {
        console.error('Get admin order details error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};

const update_order_status = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, notes } = req.body;
        const adminId = req.user.id;

        const result = await executeTransaction('update_order_status', [
            orderId,
            status,
            notes,
            adminId
        ]);

        if (!result.updated) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ 
            message: 'Order status updated successfully',
            order: result.order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
};

const update_order_schedule = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { delivery_time } = req.body;
        const adminId = req.user.id;

        const result = await executeTransaction('update_order_schedule', [
            orderId,
            delivery_time,
            adminId
        ]);

        if (!result.updated) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ 
            message: 'Delivery schedule updated successfully',
            order: result.order
        });
    } catch (error) {
        console.error('Update order schedule error:', error);
        res.status(500).json({ error: 'Failed to update delivery schedule' });
    }
};

module.exports = {
    get_all_orders,
    get_admin_order_details,
    update_order_status,
    update_order_schedule
}; 