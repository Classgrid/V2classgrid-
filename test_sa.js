import 'dotenv/config';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const mongoURI = process.env.MONGO_URI || "mongodb+srv://classgrid-admin:pass123@classgrid.sa5ww0z.mongodb.net/classgrid?retryWrites=true&w=majority&appName=Classgrid";

async function testEndpoints() {
    try {
        await mongoose.connect(mongoURI);

        // Find super admin
        const db = mongoose.connection.useDb('classgrid'); // Use main db explicitly
        const users = await db.collection('users').find({ role: 'super_admin' }).toArray();
        if (users.length === 0) {
            console.log("No super admin found");
            process.exit(1);
        }

        const adminId = users[0]._id.toString();
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const token = jwt.sign({ id: adminId }, secret, { expiresIn: '1h' });

        console.log(`Testing with admin: ${users[0].email}`);

        const endpoints = [
            '/api/admin/system-settings',
            '/api/admin/dashboard-analytics',
            '/api/admin/system-activity',
            '/api/admin/email-analytics',
            '/api/admin/student-performance',
            '/api/admin/audit-log',
            '/api/admin/all-organizations',
            '/api/admin/all-users',
        ];

        const API = 'http://localhost:3000';

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${API}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`\nEndpoint: ${endpoint}`);
                console.log(`Status: ${res.status}`);
                if (!res.ok) {
                    const text = await res.text();
                    console.log(`Error Response: ${text}`);
                } else {
                    const data = await res.json();
                    console.log(`Success! Response size: ${JSON.stringify(data).length} bytes`);
                    if (data.error) console.log(`Contains error key:`, data.error);
                }
            } catch (err) {
                console.error(`Fetch failed for ${endpoint}:`, err.message);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testEndpoints();
