import mongoose from 'mongoose';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envLine = envFile.split('\n').find(line => line.startsWith('MONGO_URI='));
const mongoUri = envLine.substring('MONGO_URI='.length).trim();

async function checkDb() {
    await mongoose.connect(mongoUri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    const nikhil = await User.findOne({ email: 'nikhilsubsun123@gmail.com' });
    console.log('--- Nikhil Account ---');
    console.log(nikhil ? nikhil.registeredDevice : 'Not found');
    
    const others = await User.find({ 
        email: { $ne: 'nikhilsubsun123@gmail.com' }, 
        'registeredDevice.deviceId': { $exists: true } 
    });
    console.log('\n--- Other Bound Accounts ---');
    others.forEach(u => console.log(u.email, u.registeredDevice.deviceId));
    
    process.exit(0);
}

checkDb();
