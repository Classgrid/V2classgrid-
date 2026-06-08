import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

dotenv.config();

import Organization from './src/models/Organization.js';
import User from './src/models/User.js';
import Classroom from './src/models/Classroom.js';

async function testLimit() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB.");

        // Find a PRO org
        const proOrg = await Organization.findOne({ plan: { $in: ['PRO', 'pro'] } });
        if (!proOrg) {
            console.log("No PRO org found. Creating a temporary one...");
            // ... fallback logic if needed
        }

        // Find a faculty or teacher in this org
        const faculty = await User.findOne({ organization_id: proOrg._id, role: { $in: ['faculty', 'teacher'] } });

        if (!faculty) {
            console.log("No faculty found for PRO org.");
            process.exit(1);
        }

        console.log(`Testing with user: ${faculty.email} (Role: ${faculty.role}, Org Plan: ${proOrg.plan})`);

        // Generate token
        const token = jwt.sign(
            { id: faculty._id, role: faculty.role, organizationId: faculty.organization_id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Make API request with maxStudents = 500
        const testPayload = {
            name: "Test Classroom Limit",
            subject: "Physics",
            description: "Testing backend enforcement",
            settings: {
                maxStudents: 500
            }
        };

        const backendUrl = process.env.API_URL || 'http://localhost:3000';

        console.log(`Sending POST to /api/classrooms with maxStudents: 500`);
        const res = await fetch(`${backendUrl}/api/classrooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testPayload)
        });

        const status = res.status;
        const data = await res.json();

        console.log(`\n--- API Response (${status}) ---`);
        console.log(JSON.stringify(data, null, 2));

        if (status === 201 && data.classroom) {
            const classId = data.classroom._id;

            // Check DB
            const dbClass = await Classroom.findById(classId);
            console.log(`\n--- Database Record ---`);
            console.log(`maxStudents saved as: ${dbClass.settings.maxStudents}`);

            if (dbClass.settings.maxStudents === 150) {
                console.log("✅ Backend explicitly clamped the value to 150 (PRO limit).");
            } else if (dbClass.settings.maxStudents === 500) {
                console.log("❌ Backend failed to clamp the value. It saved 500.");
            } else {
                console.log(`⚠️ Unexpected value saved: ${dbClass.settings.maxStudents}`);
            }

            // Cleanup
            await Classroom.findByIdAndDelete(classId);
            console.log("\nCleanup: Test classroom deleted.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testLimit();
