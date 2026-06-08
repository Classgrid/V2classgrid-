import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { verifyOrgCode } from './src/controllers/organization.controller.js';
import User from './src/models/User.js';

async function testV() {
    await connectDB();
    const user = await User.findOne({ role: 'student' });
    if (!user) {
        console.log("No student found");
        process.exit(1);
    }
    const req = {
        body: { code: 'W15B5QSTXQDQ', type: 'student' },
        user: { _id: user._id, organization_id: null }
    };
    const res = {
        status: function (c) {
            console.log("STATUS", c);
            return this;
        },
        json: function (j) {
            console.log("JSON", j);
        }
    };
    await verifyOrgCode(req, res);
    process.exit(0);
}
testV();
