import mongoose from 'mongoose';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envLine = envFile.split('\n').find(line => line.startsWith('MONGO_URI='));
const mongoUri = envLine.substring('MONGO_URI='.length).trim();

async function resetDb() {
    await mongoose.connect(mongoUri);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Unbind ALL devices from all users so the user can start fresh
    const result = await User.updateMany(
        { 'registeredDevice.deviceId': { $exists: true } },
        { $unset: { registeredDevice: "" } }
    );
    
    console.log(`Successfully reset device bindings for ${result.modifiedCount} accounts.`);
    process.exit(0);
}

resetDb();
