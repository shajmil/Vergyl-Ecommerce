const { executeTransaction, getmultipleSP } = require('../../helpers/sp-caller');
const { successResponse, errorResponse } = require('../../helpers/response.helper');
const { sendNotificationToTopic } = require('./firebase.controller');


const get_product_request_details = async (req, res) => {
    try {
        const { status, request_master_id } = req.query; // Get params from query
        const result = await getmultipleSP('get_product_request_details', [
            status || null, 
            parseInt(request_master_id) || 0
        ]);

        return successResponse(res, 'Product requests retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get all product requests error:', error);
        return errorResponse(res, 'Failed to fetch product requests', 500);
    }
};
const get_all_product_requests = async (req, res) => {
    try {
        const { status } = req.query; // Get params from query
        const result = await getmultipleSP('get_all_product_requests', [
            status || null, 
                ]);

        return successResponse(res, 'Product requests list retrieved successfully', result[0]);
    } catch (error) {
        console.error('Get all product requests error:', error);
        return errorResponse(res, 'Failed to fetch product requests list', 500);
    }
};


const handle_product_request = async (req, res) => {
    try {
        const request_id = req.params.id;
        const admin_id = req.user.user_id;
        const { action, approval_options } = req.body;

        if (!Array.isArray(approval_options) || approval_options.length === 0) {
            return errorResponse(res, "Approval options are required for approval", 400);
        }

        const result = await executeTransaction('handle_product_request', [
            request_id,
            admin_id,
            action,
            JSON.stringify(approval_options)
        ]);

        return successResponse(res, `Product request ${action}ed successfully`, result);
    } catch (error) {
        console.error('Handle product request error:', error);
        return errorResponse(res, 'Failed to handle product request', 500);
    }
};
const handle_multiple_product_requests = async (req, res) => {
    try {
        const admin_id = req.user.user_id;
        const { requested_order_data } = req.body;


        const userId=requested_order_data.user_id;
        const request_master_id=requested_order_data.request_master_id;
        const request_status=requested_order_data.status;
        const requestMasterId=requested_order_data.request_master_id;


        const product_requests=requested_order_data.product_requests;

        // if (!Array.isArray(requested_order_data) || requested_order_data.length === 0) {
        //     return errorResponse(res, "Approval options are required for approval", 400);
        // }

        
        // Validate that all requests have required fields
        for (const request of product_requests) {
            if (!request.request_id) {
                return errorResponse(res, "All product requests must have request_id", 400);
            }
            if (!['Approved', 'Rejected'].includes(request.status)) {
                return errorResponse(res, "Invalid status. Must be 'Approved' or 'Rejected'", 400);
            }
        }

        // Execute the stored procedure with all requests at once
        const result = await executeTransaction('handle_multiple_product_requests', [
            admin_id,
            product_requests,
            request_status,
            request_master_id


        ]);

        if (!result || !result[0]) {
            throw new Error('No result returned from stored procedure');
        }

        const procedureResult = result[0];
        
        // Check if procedure executed successfully
        if (procedureResult.status !== 'SUCCESS') {
            throw new Error('Stored procedure execution failed');
        }

        console.log('Database operations completed successfully:', procedureResult);

        // Now send notifications for rejected requests
        const rejectedRequests = product_requests.filter(req => req.status === 'Rejected');
        const notificationResults = [];

        if (rejectedRequests.length > 0) {
            console.log(`Sending notifications for ${rejectedRequests.length} rejected requests`);
            
            for (const rejectedRequest of rejectedRequests) {
                try {
                    const notificationData = {
                        type: 'product_request',
                        user_id: userId,
                        request_id: requestMasterId,
                        customer_email: req.body.customer_email || '',
                        customer_name: req.body.customer_name || '',
                        product_name: rejectedRequest.product_name || '',
                        admin_remarks: rejectedRequest.admin_remarks || '',
                        message: rejectedRequest.product_name || rejectedRequest.admin_remarks || 'NA',
                        title: `Your Product Request #${requestMasterId} has been rejected.`,
                    };      


                    const notificationResult = await sendNotification(notificationData,"userId_"+userId);
                    
                    notificationResults.push({
                        request_id: rejectedRequest.request_id,
                        notification_sent: true,
                        success: notificationResult
                    });

                } catch (notificationError) {
                    console.error(`Failed to send notification for request ${rejectedRequest.request_id}:`, notificationError);
                    
                    notificationResults.push({
                        request_id: rejectedRequest.request_id,
                        notification_sent: false,
                        error: notificationError.message
                    });
                }
            }
        }

        // Return comprehensive response
        return successResponse(res, 'Product requests processed successfully', {
            database_operation: {
                total_requests: procedureResult.total_requests,
                processed_requests: procedureResult.processed_requests,
                approved_count: procedureResult.approved_count,
                rejected_count: procedureResult.rejected_count,
                status: procedureResult.status
            },
            notifications: {
                total_sent: notificationResults.filter(n => n.notification_sent).length,
                total_failed: notificationResults.filter(n => !n.notification_sent).length,
                details: notificationResults.length > 0 ? notificationResults : undefined
            }
        });

    } catch (error) {
        console.error('Handle product request error:', error);
        return errorResponse(res, 'Failed to handle product request', 500);
    }
};
const sendNotification = async (notificationData,topic) => {
    try {
        const title = notificationData.title;
        const body = notificationData.message;
        
        // Convert all data values to strings as required by Firebase messaging
        const data = {
            request_id: notificationData.request_id.toString(),
            customer_email: notificationData.customer_email || '',
            customer_name: notificationData.customer_name || '',
            product_name: notificationData.product_name || '',
            admin_remarks: notificationData.admin_remarks || '',
            type: notificationData.type || '',
            timestamp: new Date().toISOString()
        };

        const result = await sendNotificationToTopic(topic, title, body, data);
        
        if (result.success) {
            console.log(`Notification sent successfully for request ${notificationData.request_id}, MessageId: ${result.messageId}`);
            return true;
        } else {
            console.error(`Failed to send notification for request ${notificationData.request_id}:`, result.error);
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Notification sending failed:', error);
        throw error;
    }
};


module.exports = {
    get_product_request_details,
    handle_product_request,
    get_all_product_requests,
    handle_multiple_product_requests
};
