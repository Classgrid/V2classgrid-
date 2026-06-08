import mongoose from 'mongoose';
import * as adminController from './src/controllers/admin.controller.js';
import OrganizationPending from './src/models/OrganizationPending.js';
import dotenv from 'dotenv';
dotenv.config();

const testApprove = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const pendingOrgs = await OrganizationPending.find({ status: 'pending' }).limit(1);
    if (pendingOrgs.length === 0) {
        console.log("No pending orgs found.");
        return process.exit(0);
    }

    const id = pendingOrgs[0]._id;
    console.log("Attempting to approve org:", id);

    const req = { params: { id } };
    const res = {
        status: (code) => { console.log('Status:', code); return res; },
        json: (data) => { console.log('JSON Output:', data); }
    };

    await adminController.approveOrganization(req, res);
    process.exit(0);
};

testApprove().catch(err => {
    console.error("Uncaught error:", err);
    process.exit(1);
});
