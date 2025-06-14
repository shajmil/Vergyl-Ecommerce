const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (do this once in your app)
// You need to download your service account key from Firebase Console
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(
  fs.readFileSync('serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/**
 * Send push notification to a topic
 * @param {string} topic - Topic name
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Optional custom data payload
 * @returns {Promise} - Firebase messaging response
 */
async function sendNotificationToTopic(topic, title, body, data = {}) {
  try {
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: data,
      topic: topic,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent topic message:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending topic message:', error);
    return { success: false, error: error.message };
  }
}


module.exports = {
  sendNotificationToTopic,
};