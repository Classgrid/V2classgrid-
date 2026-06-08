import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
        console.log('Connected to DB:', mongoose.connection.name);

        // Find a test admin
        const email = 'sanketspundkar@gmail.com';
        const adminDoc = await mongoose.connection.collection('users').findOne({ email });
        if (adminDoc) {
            const result = await mongoose.connection.collection('users').updateOne(
                { email },
                { $unset: { password: '' }, $set: { mustResetPassword: true } }
            );
            console.log('Modified', result.modifiedCount);
            console.log('Admin email:', adminDoc.email, 'now has no password and mustResetPassword=true');
        } else {
            console.log('Admin not found in users collection');
            // optionally list users
            const count = await mongoose.connection.collection('users').countDocuments({ role: 'org_admin' });
            console.log(`Found ${count} total org admins`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
