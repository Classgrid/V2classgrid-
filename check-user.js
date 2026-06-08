import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'amol.kharche@classgrid.in';
        const user = await User.findOne({ email }).select('+password');

        if (user) {
            console.log('User found in DB:');
            console.log('Name:', user.name);
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            console.log('Subject:', user.subject);
            console.log('isEmailVerified:', user.isEmailVerified);
            console.log('authProvider:', user.authProvider);
            console.log('linkedProviders:', user.linkedProviders);
            console.log('Has Password:', !!user.password);
        } else {
            console.log('User NOT found in DB');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUser();
