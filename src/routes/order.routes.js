const express = require('express');
const router = express.Router();
const { 
    create_order,
    get_all_orders,
    get_user_orders,
    get_order_details,
    delete_order,
    get_order_history,
    get_not_deliverable_dates   
} = require('../controllers/order.controller');

router.post('/create_order', create_order);
router.get('/get_user_orders', get_user_orders);
router.get('/get_all_orders', get_all_orders);
router.get('/get_not_deliverable_dates', get_not_deliverable_dates);
router.get('/get_order_details', get_order_details);
router.delete('/:id', delete_order);
router.get('/:id/history', get_order_history);

module.exports = router;