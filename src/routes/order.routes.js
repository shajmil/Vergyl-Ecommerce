const express = require('express');
const router = express.Router();
const { 
    create_order,
    get_all_orders,
    get_order_details,
    update_order_delivery,
    delete_order,
    get_order_history,
    get_not_deliverable_dates   
} = require('../controllers/order.controller');

router.post('/create_order', create_order);
// router.get('/', get_orders);
router.get('/get_all_orders', get_all_orders);
router.get('/get_not_deliverable_dates', get_not_deliverable_dates);
router.delete('/:id', delete_order);
router.get('/:id', get_order_details);
router.put('/:id', update_order_delivery);
router.get('/:id/history', get_order_history);

module.exports = router;