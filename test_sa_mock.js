import 'dotenv/config';
import { getGlobalAuditLog, getGlobalStudentPerformance } from './src/controllers/admin.controller.js';
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

    console.log('\n--- Testing getGlobalAuditLog ---');
    try {
        await getGlobalAuditLog({ query: {} }, resMock);
    } catch (err) {
        console.error('getGlobalAuditLog stack:', err);
    }

    console.log('\n--- Testing getGlobalStudentPerformance ---');
    try {
        await getGlobalStudentPerformance({ query: {} }, resMock);
    } catch (err) {
        console.error('getGlobalStudentPerformance stack:', err);
    }

    console.log('\nDone.');
    process.exit(0);
}
run();
