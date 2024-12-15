const express = require('express');
const router = express.Router();
const { 
    create_order,
    get_orders,
    get_order_details,
    update_order_delivery,
    delete_order,
    get_order_history
} = require('../controllers/order.controller');

router.post('/', create_order);
router.get('/', get_orders);
router.delete('/:id', delete_order);
router.get('/:id', get_order_details);
router.put('/:id', update_order_delivery);
router.get('/:id/history', get_order_history);

module.exports = router;