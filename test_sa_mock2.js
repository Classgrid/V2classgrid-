import 'dotenv/config';
import { getDashboardAnalytics } from './src/controllers/admin-analytics.controller.js';
import connectDB from './config/db.js';

async function run() {
    try {
        await connectDB();
        console.log('DB connected');
    } catch (e) {
        console.error('DB error', e);
        process.exit(1);
    }

    const resMock = {
        json: (data) => console.log('✅ JSON Response:', JSON.stringify(data).substring(0, 100)),
        status: function (code) {
            console.log('⚠️ Status called:', code);
            return this;
        }
    };

    console.log('\n--- Testing getDashboardAnalytics ---');
    try {
        await getDashboardAnalytics({ query: {} }, resMock);
    } catch (err) {
        console.error('getDashboardAnalytics stack:', err);
    }

    console.log('\nDone.');
    process.exit(0);
}
run();
