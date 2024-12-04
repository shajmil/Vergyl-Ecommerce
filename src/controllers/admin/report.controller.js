const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { getmultipleSP } = require('../../helpers/sp-caller');

const get_order_reports = async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        const result = await getmultipleSP('get_order_reports', [
            start_date,
            end_date,
            status || null
        ]);

        return successResponse(res, 'Order reports retrieved successfully', {
            summary: result[0][0],
            orders: result[1]
        });
    } catch (error) {
        console.error('Get order reports error:', error);
        return errorResponse(res, 'Failed to generate order reports', 500);
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

        return successResponse(res, 'Revenue reports retrieved successfully', {
            summary: result[0][0],
            revenue_data: result[1]
        });
    } catch (error) {
        console.error('Get revenue reports error:', error);
        return errorResponse(res, 'Failed to generate revenue reports', 500);
    }
};

const get_product_reports = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await getmultipleSP('get_product_reports', [
            start_date,
            end_date
        ]);

        return successResponse(res, 'Product reports retrieved successfully', {
            best_selling: result[0],
            low_stock: result[1],
            category_performance: result[2]
        });
    } catch (error) {
        console.error('Get product reports error:', error);
        return errorResponse(res, 'Failed to generate product reports', 500);
    }
};

const get_customer_reports = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const result = await getmultipleSP('get_customer_reports', [
            start_date,
            end_date
        ]);

        return successResponse(res, 'Customer reports retrieved successfully', {
            top_customers: result[0],
            new_customers: result[1],
            customer_retention: result[2]
        });
    } catch (error) {
        console.error('Get customer reports error:', error);
        return errorResponse(res, 'Failed to generate customer reports', 500);
    }
};

module.exports = {
    get_order_reports,
    get_revenue_reports,
    get_product_reports,
    get_customer_reports
}; 