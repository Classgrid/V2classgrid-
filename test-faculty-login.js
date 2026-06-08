import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const email = 'amol.kharche@classgrid.in';
        const password = 'pass@123';

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            console.log('❌ User not found');
            process.exit(1);
        }

        console.log('✅ User found:', user.email);
        console.log('Role:', user.role);
        console.log('Subject:', user.subject);

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            console.log('✅ Password matches!');
        } else {
            console.log('❌ Password DOES NOT match');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

testLogin();
