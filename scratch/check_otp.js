import 'dotenv/config';
import connectDB from '../config/db.js';
import DeviceVerification from '../src/models/DeviceVerification.js';

async function check() {
    await connectDB();
    const docs = await DeviceVerification.find({ email: 'nikhilsubsun123@gmail.com' });
    console.log(`Found ${docs.length} documents for nikhilsubsun123@gmail.com`);
    for (const d of docs) {
        console.log(`- ID: ${d._id}, OTP: ${d.otp}, createdAt: ${d.createdAt}, expiresAt: ${d.expiresAt}`);
    }
    process.exit(0);
}
check();
