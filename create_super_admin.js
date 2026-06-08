import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const createSuperAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const email = "nikhil.shinde@classgrid.in";
        const passwordPlain = "Nikhil@5049";
        const hashedPassword = await bcrypt.hash(passwordPlain, 10);

        let user = await User.findOne({ email });

        if (user) {
            user.role = 'super_admin';
            user.password = hashedPassword;
            user.isEmailVerified = true;
            user.authProvider = 'manual';
            if (!user.linkedProviders) user.linkedProviders = [];
            if (!user.linkedProviders.includes('manual')) user.linkedProviders.push('manual');
            await user.save();
            console.log("✅ Updated existing user → super_admin, password reset to Nikhil@5049");
        } else {
            user = new User({
                name: "Nikhil Shinde",
                email: email,
                password: hashedPassword,
                role: 'super_admin',
                isEmailVerified: true,
                authProvider: 'manual',
                linkedProviders: ['manual'],
            });
            await user.save();
            console.log("✅ Created new super_admin user with email:", email);
        }

        mongoose.connection.close();
    } catch (err) {
        console.error("Error creating super admin:", err);
        mongoose.connection.close();
    }
};

createSuperAdmin();
