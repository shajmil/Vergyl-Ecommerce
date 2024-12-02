const express = require('express');
const router = express.Router();


// Order management
const { 
    get_all_orders,
    get_admin_order_details,
    update_order_status,
    update_order_schedule
} = require('../controllers/admin/order.controller');

router.get('/orders', get_all_orders);
router.get('/orders/:id', get_admin_order_details);
router.put('/orders/:id/status', update_order_status);
router.put('/orders/:id/schedule', update_order_schedule);

// Product management
const {
    get_products,
    add_product,
    update_product,
    delete_product
} = require('../controllers/admin/product.controller');

router.get('/products', get_products);
router.post('/products', add_product);
router.put('/products/:id', update_product);
router.delete('/products/:id', delete_product);

// Customer management
const {
    get_customers,
    get_customer_details
} = require('../controllers/admin/customer.controller');

router.get('/customers', get_customers);
router.get('/customers/:id', get_customer_details);

// Reports
const {
    get_order_reports,
    get_revenue_reports,
    get_product_reports,
    get_customer_reports
} = require('../controllers/admin/report.controller');

router.get('/reports/orders', get_order_reports);
router.get('/reports/revenue', get_revenue_reports);
router.get('/reports/products', get_product_reports);
router.get('/reports/customers', get_customer_reports);

module.exports = router; 