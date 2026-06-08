import mongoose from "mongoose";
import Notification from "../src/models/Notification.js";
import User from "../src/models/User.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("Connecting to DB...");

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("Connected to MongoDB.");

        // Find a user to notify (e.g., the first one found)
        const user = await User.findOne();

        if (user) {
            console.log(`Creating notification for user: ${user.email} (${user._id})`);

            await Notification.create({
                recipient: user._id,
                type: "system",
                title: "System Test",
                message: "This is a test notification to verify the system is working.",
                link: "/classroom",
                createdAt: new Date()
            });

            console.log("✅ Notification created successfully!");
        } else {
            console.log("❌ No users found in database.");
        }

        process.exit(0);
    })
    .catch(err => {
        console.error("❌ DB Connection Error:", err);
        process.exit(1);
    });
