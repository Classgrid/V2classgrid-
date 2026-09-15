import 'dotenv/config';
import connectDB from '../config/db.js';
import User from '../src/models/User.js';

async function revert() {
    await connectDB();
    const email = 'chandrakishor.ladekar@gmail.com'.toLowerCase().trim();
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
        console.log(`User ${email} not found.`);
        process.exit(1);
    }
    
    // Revert sandbox flag
    user.isSandbox = false;
    await user.save();
    console.log(`Successfully reverted OTP bypass for ${user.name} (${user.email}). They will now receive OTPs again.`);
    process.exit(0);
}

revert();
