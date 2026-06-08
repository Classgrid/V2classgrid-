import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'amol.kharche@Classgrid.site';
        const user = await User.findOne({ email }).select('+password');

        if (user) {
            console.log('User found in DB:');
            console.log('Email:', user.email);
            console.log('Email Length:', user.email.length);
            console.log('Expected Email:', email);
            console.log('Expected Email Length:', email.length);
            console.log('Emails Match:', user.email === email);
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
