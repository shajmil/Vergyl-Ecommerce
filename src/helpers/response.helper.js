const successResponse = (res, message, data = null, statusCode = 200) => {
    const response = {
        success: true,
        message: message
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return res.status(statusCode).json(response);
};

const errorResponse = (res, message, statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message: message
    });
};

module.exports = {
    successResponse,
    errorResponse
}; 