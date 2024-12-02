const express = require('express');
const router = express.Router();
const { 
    create_order,
    get_orders,
    get_order_details,
    update_order_delivery
} = require('../controllers/order.controller');

router.post('/', create_order);
router.get('/', get_orders);
router.get('/:id', get_order_details);
router.put('/:id', update_order_delivery);

module.exports = router; 