import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from './src/models/User.js';
import Organization from './src/models/Organization.js';

dotenv.config();

const setupMyOrg = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const email = "nikhil.shinde@classgrid.in";
        let user = await User.findOne({ email });

        if (!user) {
            console.error("User not found!");
            process.exit(1);
        }

        // Check if an org already belongs to this user
        let org = await Organization.findOne({ owner_id: user._id });

        if (!org) {
            console.log("Creating new organization...");
            const privateCode = crypto.randomBytes(8).toString("hex").toUpperCase();
            org = new Organization({
                name: "Classgrid HQ",
                address: "Pune, India",
                logo_url: "https://classgrid.in/Classgrid.png",
                owner_id: user._id,
                private_code: privateCode,
                plan: "pro", // Super admin gets pro!
                faculty_limit: 100,
            });
            await org.save();
            console.log("Organization created:", org.name);
        } else {
            console.log("Organization already exists:", org.name);
        }

        // Ensure user is linked to it and has at least org_admin or super_admin
        user.organization_id = org._id;
        if (user.role !== 'super_admin') {
            user.role = 'org_admin';
        }
        await user.save();

        console.log(`User ${email} is now linked to Organization: ${org.name}`);
        console.log(`Private Code for faculty: ${org.private_code}`);

        mongoose.connection.close();
    } catch (err) {
        console.error("Error setting up org:", err);
        mongoose.connection.close();
    }
};

setupMyOrg();
