
import "../env.js";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const MONGO_URI = process.env.MONGO_URI;

async function fix() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected.");

        console.log("🗑️  Dropping indexes on ALL collections...");

        const collections = mongoose.connection.collections;
        // Wait for connection to be established and collections to be ready? 
        // We might need to list collections first?
        // Actually, listing collections is safer.
        const cols = await mongoose.connection.db.listCollections().toArray();
        delete mongoose.connection.models;

        for (const c of cols) {
            if (c.name === 'system.indexes') continue;
            try {
                await mongoose.connection.db.collection(c.name).dropIndexes();
                console.log(`   - Dropped indexes for '${c.name}'`);
            } catch (e) {
                if (e.code === 26) {
                    console.log(`   - '${c.name}' check skipped (Namespace not found)`);
                } else {
                    console.log(`   - Error on '${c.name}': ${e.message}`);
                }
            }
        }

        console.log("✅ Indexes dropped successfully.");
        console.log("🎉 You can now restart your server (npm start). Mongoose will rebuild indexes correctly.");

    } catch (err) {
        console.error("❌ Error dropping indexes:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fix();
