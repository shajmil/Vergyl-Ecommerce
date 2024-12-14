require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger/swagger-output.json');
const { authMiddleware, adminMiddleware } = require('./middlewares/auth.middleware');
const path = require('path');
const logger = require('morgan');
const cors = require('cors');
// Initialize express
const app = express();
const cron = require('node-cron');
const axios = require('axios');

// Middleware
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Swagger setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));


// Public routes
app.use('/auth', require('./routes/auth.routes'));
app.use('/preview', require('./routes/preview.routes'));

// Protected routes (require authentication)
app.use('/profile', authMiddleware, require('./routes/profile.routes'));
app.use('/address', authMiddleware, require('./routes/address.routes'));
app.use('/orders', authMiddleware, require('./routes/order.routes'));

// Admin routes (require admin authentication)
app.use('/admin', [authMiddleware, adminMiddleware], require('./routes/admin.routes'));


// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Root route for serving the landing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});




// Function to check API health
async function checkApiHealth() {
    const startTime = Date.now();
    const timeout = 40000; // 40 seconds in milliseconds
    let isHealthy = false;

    try {
        console.log(`[${new Date().toISOString()}] Starting API health check...`);

        while (Date.now() - startTime < timeout) {
            try {
                const response = await axios.get('https://link-preview-api-t0b4.onrender.com/');
                
                if (response.status === 200) {
                    console.log(`[${new Date().toISOString()}] API is responding successfully`);
                    isHealthy = true;
                    break;
                }
            } catch (error) {
                console.log(`[${new Date().toISOString()}] API check attempt failed, retrying...`);
                // Wait for 5 seconds before next attempt
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        if (!isHealthy) {
            console.error(`[${new Date().toISOString()}] API health check failed after 40 seconds`);
            // Here you can add notification logic (email, SMS, etc.)
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in health check:`, error.message);
    }
}

// Schedule cron job to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    console.log(`[${new Date().toISOString()}] Running scheduled API health check`);
    checkApiHealth();
});

// Initial check when the script starts
checkApiHealth();
 

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
}); 