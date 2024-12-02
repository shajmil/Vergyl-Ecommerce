const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');

const get_addresses = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_addresses', [user_id]);
        res.json(result[0]);
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
};

const add_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { address_line, city, state, zip_code, country } = req.body;

        const result = await executeTransaction('add_address', [
            user_id,
            address_line,
            city,
            state,
            zip_code,
            country
        ]);

        res.status(201).json({
            message: 'Address added successfully',
            address: result
        });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address' });
    }
};

const update_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const address_id = req.params.id;
        const { address_line, city, state, zip_code, country } = req.body;

        const result = await executeTransaction('update_address', [
            address_id,
            user_id,
            address_line,
            city,
            state,
            zip_code,
            country
        ]);

        if (!result.updated) {
            return res.status(404).json({ error: 'Address not found' });
        }

        res.json({ 
            message: 'Address updated successfully',
            address: result.address
        });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address' });
    }
};

const delete_address = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const address_id = req.params.id;

        const result = await executeTransaction('delete_address', [address_id, user_id]);

        if (!result.deleted) {
            return res.status(404).json({ error: 'Address not found' });
        }

        res.json({ message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address' });
    }
};

module.exports = {
    get_addresses,
    add_address,
    update_address,
    delete_address
}; 