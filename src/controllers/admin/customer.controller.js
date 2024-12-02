const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');

const get_customers = async (req, res) => {
    try {
        const { search, limit, offset } = req.query;
        const result = await getmultipleSP('get_customers', [
            search || null,
            limit || 10,
            offset || 0
        ]);

        res.json({
            customers: result[0],
            total: result[1][0].total
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
};

const get_customer_details = async (req, res) => {
    try {
        const customer_id = req.params.id;
        const result = await getmultipleSP('get_customer_details', [customer_id]);

        if (!result[0] || result[0].length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = result[0][0];
        customer.orders = result[1];
        customer.addresses = result[2];

        res.json(customer);
    } catch (error) {
        console.error('Get customer details error:', error);
        res.status(500).json({ error: 'Failed to fetch customer details' });
    }
};

module.exports = {
    get_customers,
    get_customer_details
}; 