const { getmultipleSP } = require('../../helpers/sp-caller');

const get_order_reports = async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        const result = await getmultipleSP('get_order_reports', [
            start_date,
            end_date,
            status || null
        ]);

        res.json({
            summary: result[0][0],
            orders: result[1]
        });
    } catch (error) {
        console.error('Get order reports error:', error);
        res.status(500).json({ error: 'Failed to generate order reports' });
    }
};

const get_revenue_reports = async (req, res) => {
    try {
        const { start_date, end_date, group_by } = req.query;
        const result = await getmultipleSP('get_revenue_reports', [
            start_date,
            end_date,
            group_by || 'daily'
        ]);

        res.json({
            summary: result[0][0],
            revenue_data: result[1]
        });
    } catch (error) {
        console.error('Get revenue reports error:', error);
        res.status(500).json({ error: 'Failed to generate revenue reports' });
    }
};

const get_product_reports = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await getmultipleSP('get_product_reports', [
            start_date,
            end_date
        ]);

        res.json({
            best_selling: result[0],
            low_stock: result[1],
            category_performance: result[2]
        });
    } catch (error) {
        console.error('Get product reports error:', error);
        res.status(500).json({ error: 'Failed to generate product reports' });
    }
};

const get_customer_reports = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await getmultipleSP('get_customer_reports', [
            start_date,
            end_date
        ]);

        res.json({
            top_customers: result[0],
            new_customers: result[1],
            customer_retention: result[2]
        });
    } catch (error) {
        console.error('Get customer reports error:', error);
        res.status(500).json({ error: 'Failed to generate customer reports' });
    }
};

module.exports = {
    get_order_reports,
    get_revenue_reports,
    get_product_reports,
    get_customer_reports
}; 