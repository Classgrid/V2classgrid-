/**
 * Backward Compatibility Setup Script
 * 
 * Creates a "Classgrid Legacy" default organization and assigns
 * all existing faculty users (without an organization) to it.
 * 
 * Run once with: node setup_legacy_org.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from './src/models/User.js';
import Organization from './src/models/Organization.js';

dotenv.config();

const setupLegacyOrg = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find all faculty/teacher without an org
        const orphanedFaculty = await User.find({
            role: { $in: ['faculty', 'teacher'] },
            $or: [{ organization_id: null }, { organization_id: { $exists: false } }]
        });

        console.log(`Found ${orphanedFaculty.length} faculty/teacher users without an organization.`);

        if (orphanedFaculty.length === 0) {
            console.log('No orphaned faculty found. All faculty are already in orgs. Done!');
            await mongoose.connection.close();
            return;
        }

        // Check if Legacy org already exists
        let legacyOrg = await Organization.findOne({ name: 'Classgrid Legacy' });

        if (!legacyOrg) {
            console.log('Creating Classgrid Legacy organization...');

            // Find super_admin to be owner (or use first faculty)
            const superAdmin = await User.findOne({ role: 'super_admin' });
            const ownerId = superAdmin ? superAdmin._id : orphanedFaculty[0]._id;

            const privateCode = crypto.randomBytes(8).toString('hex').toUpperCase();

            legacyOrg = new Organization({
                name: 'Classgrid Legacy',
                address: 'Classgrid Platform',
                logo_url: 'https://classgrid.in/Classgrid.png',
                owner_id: ownerId,
                private_code: privateCode,
                plan: 'pro', // Legacy gets pro plan for unlimited faculty
                faculty_limit: 1000, // Effectively unlimited for backward compat
            });

            await legacyOrg.save();
            console.log(`✅ Created organization: Classgrid Legacy`);
            console.log(`   Private Code: ${privateCode}`);
        } else {
            console.log(`✅ Found existing organization: Classgrid Legacy`);
        }

        // Assign all orphaned faculty to the legacy org
        const result = await User.updateMany(
            {
                role: { $in: ['faculty', 'teacher'] },
                $or: [{ organization_id: null }, { organization_id: { $exists: false } }]
            },
            { $set: { organization_id: legacyOrg._id } }
        );

        console.log(`✅ Assigned ${result.modifiedCount} faculty users to Classgrid Legacy`);

        // Also ensure all 'teacher' roles become 'faculty' for consistency
        const teacherUpdate = await User.updateMany(
            { role: 'teacher', organization_id: legacyOrg._id },
            { $set: { role: 'faculty' } }
        );
        if (teacherUpdate.modifiedCount > 0) {
            console.log(`✅ Updated ${teacherUpdate.modifiedCount} 'teacher' roles to 'faculty'`);
        }

        console.log('\n🎉 Backward compatibility setup complete!');
        console.log(`   Organization: Classgrid Legacy`);
        console.log(`   Private Code: ${legacyOrg.private_code}`);
        console.log(`   Faculty assigned: ${result.modifiedCount}`);

        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Error setting up legacy org:', err);
        await mongoose.connection.close();
        process.exit(1);
    }
};

setupLegacyOrg();
