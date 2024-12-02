const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');

const get_products = async (req, res) => {
    try {
        const { category, search, limit, offset } = req.query;
        const result = await getmultipleSP('get_products', [
            category || null,
            search || null,
            limit || 10,
            offset || 0
        ]);
        
        res.json({
            products: result[0],
            total: result[1][0].total
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
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

        res.status(201).json({
            message: 'Product added successfully',
            product: result
        });
    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Failed to add product' });
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
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            message: 'Product updated successfully',
            product: result
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
};

const delete_product = async (req, res) => {
    try {
        const productId = req.params.id;
        const adminId = req.user.id;

        const result = await executeTransaction('delete_product', [productId, adminId]);

        if (!result.deleted) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
};

module.exports = {
    get_products,
    add_product,
    update_product,
    delete_product
}; 