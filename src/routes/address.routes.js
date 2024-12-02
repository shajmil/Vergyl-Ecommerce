const express = require('express');
const router = express.Router();
const { 
    get_addresses, 
    add_address, 
    update_address, 
    delete_address 
} = require('../controllers/address.controller');

router.get('/', get_addresses);
router.post('/', add_address);
router.put('/:id', update_address);
router.delete('/:id', delete_address);

module.exports = router; 