import 'dotenv/config';
import mongoose from 'mongoose';
import express from 'express';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';

// Import the app
import app from './api/index.js';

const mongoURI = process.env.MONGO_URI || "mongodb+srv://classgrid-admin:pass123@classgrid.sa5ww0z.mongodb.net/classgrid?retryWrites=true&w=majority&appName=Classgrid";

async function testServer() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.useDb('classgrid');
        const users = await db.collection('users').find({ role: 'super_admin' }).toArray();
        if (users.length === 0) {
            console.log('No super_admin found!');
            process.exit(1);
        }

        const adminId = users[0]._id.toString();
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const token = jwt.sign({ id: adminId }, secret, { expiresIn: '1h' });

        const request = supertest(app);

        const endpoints = [
            '/api/admin/audit-log',
            '/api/admin/student-performance',
            '/api/admin/dashboard-analytics'
        ];

        for (const endpoint of endpoints) {
            console.log(`\nTesting ${endpoint}...`);
            const res = await request.get(endpoint)
                .set('Authorization', `Bearer ${token}`)
                .send();

            console.log(`Status: ${res.status}`);
            if (res.status >= 400) {
                console.log(`Error Response:`, res.text);
            } else {
                console.log(`Success! Data preview:`, JSON.stringify(res.body).substring(0, 150));
            }
        }
    } catch (e) {
        console.error('Test script error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

testServer();
