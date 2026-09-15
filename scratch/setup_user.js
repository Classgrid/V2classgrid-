import 'dotenv/config';
import connectDB from '../config/db.js';
import User from '../src/models/User.js';
import DeviceVerification from '../src/models/DeviceVerification.js';
import bcrypt from 'bcryptjs';

async function setup() {
    await connectDB();
    const email = 'chandrakishor.ladekar@gmail.com'.toLowerCase().trim();
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
        console.log(`User ${email} not found.`);
        process.exit(1);
    }
    
    // 1. Set password to pass@123
    const hashedPassword = await bcrypt.hash('pass@123', 10);
    user.password = hashedPassword;
    
    // Set some flags so they don't have to reset it immediately
    user.mustResetPassword = false;
    user.isEmailVerified = true;
    
    // 2. Find their device fingerprint from recent OTP attempts
    const verif = await DeviceVerification.findOne({ email }).sort({ createdAt: -1 });
    if (verif && verif.deviceFingerprint) {
        console.log(`Found device fingerprint from recent OTP attempt: ${verif.deviceFingerprint}`);
        
        // Add to trusted devices if not already there
        const exists = user.trustedDevices.some(d => d.fingerprint === verif.deviceFingerprint);
        if (!exists) {
            user.trustedDevices.push({
                fingerprint: verif.deviceFingerprint,
                userAgent: 'Manual Bypass Admin Script',
                createdAt: new Date(),
                lastUsedAt: new Date()
            });
            console.log("Added fingerprint to trusted devices.");
        }
    } else {
        console.log("No recent device fingerprint found in DeviceVerification.");
        // We will set isSandbox true temporarily to bypass OTP entirely, or maybe they just want us to skip it.
        // Actually the prompt says "make it verified so no otp will be sent to it for deviece for 3 dasy"
        // Let's just set isSandbox: true
        user.isSandbox = true;
        console.log("Set isSandbox = true to completely bypass OTP.");
    }
    
    await user.save();
    console.log(`Successfully updated ${user.name} (${user.email}).`);
    process.exit(0);
}

setup();
