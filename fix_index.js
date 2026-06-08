import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
dotenv.config();

const cleanIndex = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const indexes = await User.collection.indexes();
    for (let idx of indexes) {
        if (idx.name.includes("prn")) {
            console.log("Dropping index:", idx.name);
            await User.collection.dropIndex(idx.name).catch(console.error);
        }
    }

    // Create the correct one
    try {
        await User.collection.createIndex(
            { organization_id: 1, prn: 1 },
            { unique: true, partialFilterExpression: { prn: { $type: "string" } } }
        );
        console.log("New index created successfully with $type: 'string'!");
    } catch (e) {
        console.log("Failed to create new index:", e.message);
    }

    process.exit(0);
};

cleanIndex();
