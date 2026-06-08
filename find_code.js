import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Organization from './src/models/Organization.js';

async function check() {
    await connectDB();
    const normalizedCode = "EKW2PZJ782";

    console.log("Checking for code:", normalizedCode);

    const byHonor = await Organization.findOne({ honorCode: normalizedCode }).lean();
    console.log("Found by honorCode:", byHonor ? byHonor.name : "None");

    const byOrg = await Organization.findOne({ organizationCode: normalizedCode }).lean();
    console.log("Found by organizationCode:", byOrg ? byOrg.name : "None");

    const byPrivate = await Organization.findOne({ private_code: normalizedCode }).lean();
    console.log("Found by private_code:", byPrivate ? byPrivate.name : "None");

    // Just find any org that might contain this
    const allOrgs = await Organization.find({
        $or: [
            { honorCode: new RegExp(normalizedCode, "i") },
            { organizationCode: new RegExp(normalizedCode, "i") },
            { private_code: new RegExp(normalizedCode, "i") }
        ]
    }).lean();

    console.log("Partial matches:", allOrgs.map(o => ({
        name: o.name,
        honorCode: o.honorCode,
        organizationCode: o.organizationCode,
        private_code: o.private_code
    })));

    process.exit(0);
}

check();
