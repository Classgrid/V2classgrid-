import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config();
import Organization from './src/models/Organization.js';
import User from './src/models/User.js';
import Classroom from './src/models/Classroom.js';

async function testLimit() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const proOrg = await Organization.findOne({ plan: { $in: ['PRO', 'pro'] } });
        const faculty = await User.findOne({ organization_id: proOrg._id, role: { $in: ['faculty', 'teacher'] } });

        const token = jwt.sign(
            { id: faculty._id, role: faculty.role, organizationId: faculty.organization_id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        const testPayload = {
            name: "Test Classroom Limit",
            subject: "Physics",
            description: "Testing backend enforcement",
            settings: { maxStudents: 500 }
        };

        const backendUrl = process.env.API_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/classrooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(testPayload)
        });

        const status = res.status;
        const data = await res.json();
        const output = { status, apiResponse: data, dbMaxStudents: null };

        if (status === 201 && data.classroom) {
            const classId = data.classroom._id;
            const dbClass = await Classroom.findById(classId);
            output.dbMaxStudents = dbClass.settings.maxStudents;
            await Classroom.findByIdAndDelete(classId);
        }

        fs.writeFileSync('result.json', JSON.stringify(output, null, 2));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
testLimit();
