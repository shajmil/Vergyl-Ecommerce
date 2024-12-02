const { executeTransaction, getmultipleSP } = require('../helpers/sp-caller');

const get_profile = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const result = await getmultipleSP('get_profile', [user_id]);
        
        if (!result[0] || result[0].length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(result[0][0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

const update_profile = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { name, phone } = req.body;

        const result = await executeTransaction('update_profile', [
            user_id,
            name,
            phone
        ]);

        if (!result.updated) {
            throw new Error('Profile update failed');
        }

        res.json({ 
            message: 'Profile updated successfully',
            user: result.user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

module.exports = {
    get_profile,
    update_profile
}; 