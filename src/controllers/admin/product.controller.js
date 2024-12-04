const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');
const { successResponse, errorResponse } = require('../../helpers/response.helper');

const get_products = async (req, res) => {
    try {
        const { category, search, limit, offset } = req.query;
        const result = await getmultipleSP('get_products', [
            category || null,
            search || null,
            limit || 10,
            offset || 0
        ]);
        
        return successResponse(res, 'Products retrieved successfully', {
            products: result[0],
            total: result[1][0].total
        });
    } catch (error) {
        console.error('Get products error:', error);
        return errorResponse(res, 'Failed to fetch products', 500);
    }
};

const add_product = async (req, res) => {
    try {
        const { name, description, price, stock, category } = req.body;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('add_product', [
            name,
            description,
            price,
            stock,
            category,
            admin_id
        ]);

        return successResponse(res, 'Product added successfully', result, 201);
    } catch (error) {
        console.error('Add product error:', error);
        return errorResponse(res, 'Failed to add product', 500);
    }
};

const update_product = async (req, res) => {
    try {
        const product_id = req.params.id;
        const { name, description, price, stock, category } = req.body;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('update_product', [
            product_id,
            name,
            description,
            price,
            stock,
            category,
            admin_id
        ]);

        if (!result.updated) {
            return errorResponse(res, 'Product not found', 404);
        }

        return successResponse(res, 'Product updated successfully', result.product);
    } catch (error) {
        console.error('Update product error:', error);
        return errorResponse(res, 'Failed to update product', 500);
    }
};

const delete_product = async (req, res) => {
    try {
        const product_id = req.params.id;
        const admin_id = req.user.user_id;

        const result = await executeTransaction('delete_product', [product_id, admin_id]);

        if (!result.deleted) {
            return errorResponse(res, 'Product not found', 404);
        }

        return successResponse(res, 'Product deleted successfully');
    } catch (error) {
        console.error('Delete product error:', error);
        return errorResponse(res, 'Failed to delete product', 500);
    }
};

module.exports = {
    get_products,
    add_product,
    update_product,
    delete_product
}; 