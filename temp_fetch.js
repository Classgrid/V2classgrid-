import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Organization from './src/models/Organization.js';

async function check() {
    await connectDB();
    const orgs = await Organization.find();
    console.log(JSON.stringify(orgs.map(o => ({
        name: o.name,
        honorCode: o.honorCode,
        honor_code: o.honor_code,
        status: o.status,
        is_active: o.is_active
    })), null, 2));
    process.exit(0);
}

check();
