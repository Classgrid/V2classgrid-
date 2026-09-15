import admin from 'firebase-admin';

let isInitialized = false;

export const initFirebase = () => {
    if (isInitialized) return;
    
    try {
        const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        if (!base64ServiceAccount) {
            console.warn("FIREBASE_SERVICE_ACCOUNT_BASE64 not found in environment variables. Push notifications will be disabled.");
            return;
        }

        const serviceAccountJson = Buffer.from(base64ServiceAccount, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        
        isInitialized = true;
        console.log("🔥 Firebase Admin SDK initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
    }
};

export const sendPushNotification = async ({ fcmToken, title, body, data }) => {
    if (!isInitialized || !fcmToken) return false;

    try {
        const message = {
            notification: {
                title,
                body
            },
            data: data || {},
            token: fcmToken
        };

        const response = await admin.messaging().send(message);
        console.log("Successfully sent push message:", response);
        return true;
    } catch (error) {
        console.error("Error sending push message:", error);
        return false;
    }
};
