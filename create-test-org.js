/**
 * Classgrid Free Plan Test Organization Seed Script
 * Run with: node create-test-org.js
 * Creates a Free Plan test organization and an org_admin account.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
dotenv.config();

const DB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!DB_URI) {
    console.error("No MongoDB URI found in .env (MONGO_URI, MONGODB_URI or DATABASE_URL)");
    process.exit(1);
}

function generateCode(length = 12) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function createTestOrg() {
    await mongoose.connect(DB_URI);
    console.log("Connected to MongoDB");

    const { default: User } = await import("./src/models/User.js");
    const { default: Organization } = await import("./src/models/Organization.js");

    const TEST_EMAIL = "testadmin@classgrid.test";
    const TEST_PASSWORD = "TestAdmin@2025";
    const ORG_NAME = "Classgrid Test Institution";

    const existing = await User.findOne({ email: TEST_EMAIL });
    if (existing) {
        console.log("Test org admin already exists:");
        console.log("   Email:", TEST_EMAIL);
        console.log("   Password: TestAdmin@2025 (set on creation)");
        await mongoose.disconnect();
        return;
    }

    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
    const adminUser = new User({
        name: "Test Org Admin",
        email: TEST_EMAIL,
        role: "org_admin",
        password: hashedPassword,
        isEmailVerified: true,
        status: "active",
        mustResetPassword: false,
    });
    await adminUser.save();

    const orgCode = generateCode(12);
    const honorCode = generateCode(12);
    const privateCode = generateCode(10);

    const org = new Organization({
        name: ORG_NAME,
        address: "123 Test Lane, Mumbai, India",
        owner_id: adminUser._id,
        ownerName: "Test Org Admin",
        ownerEmail: TEST_EMAIL,
        plan: "FREE",
        is_active: true,
        status: "active",
        organizationCode: orgCode,
        honorCode: honorCode,
        private_code: privateCode,
        studentLimit: 60,
        faculty_limit: 5,
    });
    await org.save();

    adminUser.organization_id = org._id;
    await adminUser.save();

    console.log("\n=== Test Organization Created Successfully! ===");
    console.log("Org Name:        ", ORG_NAME);
    console.log("Admin Email:     ", TEST_EMAIL);
    console.log("Admin Password:  ", TEST_PASSWORD);
    console.log("Plan:            ", "FREE");
    console.log("---");
    console.log("Org Code (faculty):  ", orgCode);
    console.log("Honor Code (students):", honorCode);
    console.log("---");
    console.log("Login at: /admin/login");
    console.log("Dashboard: /org-admin-dashboard");

    await mongoose.disconnect();
}

createTestOrg().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
