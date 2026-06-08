
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const createFaculty = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const email = 'science@classgrid.in';
        const password = 'classgrid@5049';
        const hashedPassword = await bcrypt.hash(password, 12);
        const name = 'Prof (Faculty)';

        let user = await User.findOne({ email });

        if (user) {
            console.log('User exists. Updating password and role...');
            user.password = hashedPassword;
            user.role = 'teacher';
            user.isEmailVerified = true;
            user.authProvider = 'manual';
            if (!user.linkedProviders) user.linkedProviders = [];
            if (!user.linkedProviders.includes('manual')) user.linkedProviders.push('manual');
            await user.save();
            console.log('Faculty user updated successfully.');
        } else {
            console.log('Creating new faculty user...');
            user = new User({
                name,
                email,
                password: hashedPassword,
                role: 'teacher',
                isEmailVerified: true,
                authProvider: 'manual',
                linkedProviders: ['manual']
            });
            await user.save();
            console.log('Faculty user created successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

createFaculty();
