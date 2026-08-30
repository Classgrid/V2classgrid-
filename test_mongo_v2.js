import 'dotenv/config';
import connectDB from './config/db.js';

async function testConnection() {
    try {
        console.log("Connecting to MongoDB:", process.env.MONGO_URI);
        const mongoose = await connectDB();
        console.log("SUCCESS! Connected to MongoDB V2 Cluster.");
        process.exit(0);
    } catch (err) {
        console.error("FAILED to connect to MongoDB V2 Cluster.");
        console.error(err);
        process.exit(1);
    }
}

testConnection();
