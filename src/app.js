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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 