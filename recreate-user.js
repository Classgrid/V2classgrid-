import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const recreateUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'amol.kharche@classgrid.in';

        await User.deleteOne({ email });
        console.log('✅ Deleted existing user');

        const hashedPassword = await bcrypt.hash('pass@123', 12);
        const user = new User({
            name: 'Prof. Amol Kharche',
            email: email,
            password: hashedPassword,
            role: 'teacher',
            subject: 'chemistry',
            isEmailVerified: true,
            authProvider: 'manual',
            linkedProviders: ['manual']
        });

        await user.save();
        console.log('✅ Created fresh user with pass@123');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

recreateUser();
