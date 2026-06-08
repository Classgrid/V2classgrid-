/**
 * Classgrid — Migration Script
 * Backfills organizationCode and honorCode for any existing organizations
 * that were created before the dual-code system was introduced.
 *
 * Run once: node migrate_org_codes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from './src/models/Organization.js';
import { generateUniqueDualCodes } from './src/services/code-generator.service.js';

dotenv.config();

const migrate = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    // Find all orgs missing either code
    const orgs = await Organization.find({
        $or: [
            { organizationCode: { $exists: false } },
            { honorCode: { $exists: false } },
            { organizationCode: null },
            { honorCode: null },
        ]
    });

    console.log(`Found ${orgs.length} organizations needing code migration...`);

    let updated = 0;
    for (const org of orgs) {
        try {
            const { organizationCode, honorCode } = await generateUniqueDualCodes(Organization);
            org.organizationCode = organizationCode;
            org.honorCode = honorCode;
            await org.save();
            console.log(`  ✅ ${org.name}: orgCode=${organizationCode}, honorCode=${honorCode}`);
            updated++;
        } catch (err) {
            console.error(`  ❌ Failed for ${org.name}:`, err.message);
        }
    }

    console.log(`\nMigration complete. Updated ${updated}/${orgs.length} organizations.`);
    await mongoose.connection.close();
};

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
