const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const doc = {
    info: {
        title: 'Vergyl E-Commerce API',
        description: 'API documentation for Vergyl E-Commerce platform'
    },
    host: 'localhost:3000',
    schemes: ['http', 'https'],
    securityDefinitions: {
        bearerAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'Enter your bearer token in the format **Bearer <token>**'
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ],
    definitions: {
        LoginRequest: {
            email: 'user@example.com',
            password: 'password123'
        },
        SignupRequest: {
            name: 'John Doe',
            email: 'user@example.com',
            phone: '1234567890',
            password: 'password123'
        },
        OrderRequest: {
            address_id: 1,
            items: [{
                product_id: 1,
                quantity: 2,
                price: 99.99
            }],
            delivery_time: '2024-03-15T14:30:00Z'
        },
        AddressRequest: {
            address_line: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip_code: '10001',
            country: 'USA'
        },
        ProductRequest: {
            name: 'Product Name',
            description: 'Product Description',
            price: 99.99,
            stock: 100,
            category: 'Electronics'
        },
        SuccessResponse: {
            success: true,
            message: 'Operation successful',
            data: {}
        },
        ErrorResponse: {
            success: false,
            message: 'Error message'
        }
    }
};

const outputFile = './src/swagger/swagger-output.json';
const routes = [
    './src/app.js'  // Point to your main app.js file
];

// Generate swagger.json
swaggerAutogen(outputFile, routes, doc).then(() => {
    console.log('Swagger documentation generated successfully');
}).catch((err) => {
    console.error('Error generating swagger documentation:', err);
}); 