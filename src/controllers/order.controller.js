const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');

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

        res.status(201).json({
            message: 'Order created successfully',
            order: result.order
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
};

const get_orders = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_orders', [user_id]);
        res.json(result[0]);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

const get_order_details = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const order_id = req.params.id;

        const result = await getmultipleSP('get_order_details', [order_id, user_id]);
        
        if (!result[0] || result[0].length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = result[0][0];
        order.items = result[1];

        res.json(order);
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
};

const update_order_delivery = async (req, res) => {
    try {
        const userId = req.user.id;
        const orderId = req.params.id;
        const { delivery_time } = req.body;

        const result = await executeTransaction('update_order_delivery', [
            orderId,
            userId,
            delivery_time
        ]);

        if (!result.updated) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ 
            message: 'Delivery time updated successfully',
            order: result.order
        });
    } catch (error) {
        console.error('Update delivery time error:', error);
        res.status(500).json({ error: 'Failed to update delivery time' });
    }
};

module.exports = {
    create_order,
    get_orders,
    get_order_details,
    update_order_delivery
}; 