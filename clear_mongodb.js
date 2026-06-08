import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clearDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        console.log("Dropping entire database...");
        await mongoose.connection.db.dropDatabase();
        console.log("✅ Database cleared completely.");
        mongoose.connection.close();
    } catch (error) {
        console.error("Error clearing DB:", error);
        mongoose.connection.close();
    }
};

clearDB();
