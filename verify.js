import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';

dotenv.config();

import User from './src/models/User.js';
import EmailJob from './src/models/EmailJob.js';
import SystemSettings from './src/models/SystemSettings.js';

// We will also import the controller functions to test them directly if the server isn't running,
// but they rely on req/res. Let's mock req/res.
import { getOrgUsage, getEmailAnalytics, getDashboardAnalytics, getSystemActivity, getSystemSettings } from './src/controllers/admin-analytics.controller.js';

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("==== MONGODB INDEXES ====");
        const userIndexes = await User.collection.indexes();
        console.log("User Indexes:\n", JSON.stringify(userIndexes, null, 2));

        const emailJobIndexes = await EmailJob.collection.indexes();
        console.log("EmailJob Indexes:\n", JSON.stringify(emailJobIndexes, null, 2));

        console.log("\n==== API RESPONSE PAYLOADS & PERFORMANCE ====");

        // Mock Res
        const mockRes = () => {
            const res = {};
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => { res.data = data; return res; };
            return res;
        };

        // 1. System Settings
        const reqSettings = {};
        const resSettings = mockRes();
        await getSystemSettings(reqSettings, resSettings);
        console.log("\nGET /api/admin/system-settings Payload:\n", JSON.stringify(resSettings.data, null, 2));

        // 2. System Activity
        const reqActivity = {};
        const resActivity = mockRes();
        await getSystemActivity(reqActivity, resActivity);
        console.log("\nGET /api/admin/system-activity Payload (First 3 items):\n", JSON.stringify(resActivity.data?.slice(0, 3), null, 2));

        // 3. Email Analytics
        const reqEmail = { query: {} };
        const resEmail = mockRes();
        let start = performance.now();
        await getEmailAnalytics(reqEmail, resEmail);
        let end = performance.now();
        console.log(`\nGET /api/admin/email-analytics (Response time: ${(end - start).toFixed(2)}ms) Payload:\n`, JSON.stringify(resEmail.data, null, 2));

        // Find an org to test with
        const orgs = await mongoose.connection.db.collection('organizations').find({}).limit(1).toArray();
        if (orgs.length > 0) {
            const orgId = orgs[0]._id.toString();

            // 4. Org Usage (Storage)
            const reqUsage = { params: { orgId } };
            const resUsage = mockRes();
            start = performance.now();
            await getOrgUsage(reqUsage, resUsage);
            end = performance.now();
            console.log(`\nGET /api/admin/usage/${orgId} [Storage Aggregation] (Response time: ${(end - start).toFixed(2)}ms) Payload:\n`, JSON.stringify(resUsage.data, null, 2));
        }

        // 5. Dashboard Analytics
        const reqDash = {};
        const resDash = mockRes();
        start = performance.now();
        await getDashboardAnalytics(reqDash, resDash);
        end = performance.now();
        console.log(`\nGET /api/admin/dashboard-analytics [Analytics Aggregation] (Response time: ${(end - start).toFixed(2)}ms) Payload:\n`, JSON.stringify(resDash.data, null, 2));

    } catch (e) {
        console.error("Error during verification:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
