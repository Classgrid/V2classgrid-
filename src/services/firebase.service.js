import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let isInitialized = false;
let messagingApp;

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

        const app = initializeApp({
            credential: cert(serviceAccount)
        });
        
        messagingApp = getMessaging(app);
        isInitialized = true;
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
    }
};

export const sendPushNotification = async ({ fcmToken, title, body, data }) => {
    if (!isInitialized || !fcmToken || !messagingApp) return false;

    try {
        const message = {
            notification: {
                title,
                body
            },
            data: data || {},
            token: fcmToken
        };

        const response = await messagingApp.send(message);
        console.log("Successfully sent push message:", response);
        return true;
    } catch (error) {
        console.error("Error sending push message:", error);
        return false;
    }
};
