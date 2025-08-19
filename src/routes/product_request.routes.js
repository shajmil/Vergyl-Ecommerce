// src/routes/product_request.routes.js
const express = require('express');
const router = express.Router();
const { 
    create_product_request,
    get_customer_product_requests,
    get_current_request
} = require('../controllers/product_request.controller');

router.post('/create_product_request', create_product_request);
router.get('/get_customer_product_requests', get_customer_product_requests);
router.get('/get_current_request', get_current_request);

module.exports = router;