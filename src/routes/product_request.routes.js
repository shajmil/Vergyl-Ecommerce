// src/routes/product_request.routes.js
const express = require('express');
const router = express.Router();
const { 
    create_product_request,
    get_customer_product_requests
} = require('../controllers/product_request.controller');

router.post('/create_product_request', create_product_request);
router.get('/get_customer_product_requests', get_customer_product_requests);

module.exports = router;