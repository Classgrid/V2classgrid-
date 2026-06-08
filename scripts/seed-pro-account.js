/**
 * Seed script: Create / upgrade the admin@classgrid.in account to PRO plan.
 * 
 * Usage: node scripts/seed-pro-account.js
 * 
 * If the org already exists, it upgrades its plan to PRO.
 * If not, it creates a new organization + org_admin.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
}

async function seed() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Check if admin@classgrid.in exists
    const adminEmail = 'admin@classgrid.in';
    const password = 'Nikhil@5049';
    const passwordHash = await bcrypt.hash(password, 12);

    let user = await db.collection('users').findOne({ email: adminEmail });

    if (user) {
        console.log(`✅ User ${adminEmail} already exists (ID: ${user._id})`);
        // Update password
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { password: passwordHash } }
        );
        console.log('✅ Password updated');
    } else {
        // Create user
        const result = await db.collection('users').insertOne({
            name: 'Classgrid Admin',
            email: adminEmail,
            password: passwordHash,
            role: 'org_admin',
            isVerified: true,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        user = { _id: result.insertedId };
        console.log(`✅ Created user ${adminEmail} (ID: ${user._id})`);
    }

    // 2. Find or create org linked to this user
    let org = await db.collection('organizations').findOne({ owner_id: user._id });

    if (!org) {
        // Also check if user has organization_id
        const u = await db.collection('users').findOne({ email: adminEmail });
        if (u && u.organization_id) {
            org = await db.collection('organizations').findOne({ _id: u.organization_id });
        }
    }

    if (org) {
        console.log(`✅ Organization found: ${org.name} (ID: ${org._id})`);
        // Upgrade to PRO
        await db.collection('organizations').updateOne(
            { _id: org._id },
            {
                $set: {
                    plan: 'PRO',
                    studentLimit: 150,
                    planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                },
            }
        );
        console.log('✅ Organization upgraded to PRO plan');
    } else {
        console.log('⚠️  No organization found for this user.\n    Login to the super admin portal and assign a PRO plan to their org,\n    or approve their pending org application first.');
    }

    // 3. Ensure user role is org_admin
    await db.collection('users').updateOne(
        { email: adminEmail },
        { $set: { role: 'org_admin', isVerified: true, status: 'active' } }
    );

    console.log('\n🎯 Done! admin@classgrid.in is ready:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${password}`);
    console.log(`   Plan:     PRO`);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
