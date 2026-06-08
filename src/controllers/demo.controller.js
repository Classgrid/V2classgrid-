import User from "../models/User.js";
import Organization from "../models/Organization.js";
import connectDB from "../../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

/**
 * Generate a demo email address.
 * Format: {ownerName}_{4randomDigits}{role}@classgrid.in
 */
function generateDemoEmail(ownerName, role) {
    const clean = ownerName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    return `${clean}_${rand}${role}@classgrid.in`;
}

/**
 * Generate a strong random password.
 */
function generateStrongPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// ─────────────────────────────────────────────
// POST /api/demo/create
// Create a demo faculty or student account
// ─────────────────────────────────────────────
export const createDemoAccount = async (req, res) => {
    try {
        await connectDB();
        const { role } = req.body; // "faculty" or "student"

        if (!role || !["faculty", "student"].includes(role)) {
            return res.status(400).json({ message: "Role must be 'faculty' or 'student'" });
        }

        const adminUser = req.user;

        // Determine organization
        let organization_id = adminUser.organization_id;

        // Super admin must specify an org (or we use their org if they have one)
        if (adminUser.role === "super_admin" && req.body.organization_id) {
            organization_id = req.body.organization_id;
        }

        if (!organization_id) {
            return res.status(400).json({ message: "No organization context. Please specify an organization." });
        }

        // Verify org exists
        const org = await Organization.findById(organization_id);
        if (!org) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Generate unique email (retry if collision)
        let email;
        let attempts = 0;
        do {
            email = generateDemoEmail(adminUser.name, role);
            const exists = await User.findOne({ email });
            if (!exists) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return res.status(500).json({ message: "Could not generate unique demo email. Try again." });
        }

        // Generate password
        const plainPassword = generateStrongPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Create the demo user
        const demoUser = new User({
            name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            email,
            role: role === "faculty" ? "faculty" : "student",
            organization_id,
            password: hashedPassword,
            is_demo: true,
            created_by: adminUser._id,
            isEmailVerified: true, // No verification needed
            authProvider: "manual",
            linkedProviders: ["manual"],
            status: "active",
        });

        await demoUser.save();

        // Log the action
        try {
            const { default: ActivityLog } = await import("../models/ActivityLog.js");
            await ActivityLog.create({
                user_id: adminUser._id,
                action: `Created demo ${role} account`,
                details: `Email: ${email}`,
                organization_id,
            });
        } catch (logErr) {
            console.error("Activity log error:", logErr.message);
        }

        res.status(201).json({
            message: `Demo ${role} account created successfully`,
            demo: {
                _id: demoUser._id,
                name: demoUser.name,
                email: demoUser.email,
                role: demoUser.role,
                password: plainPassword, // Shown once only
                organization_id,
                createdAt: demoUser.createdAt,
            },
        });
    } catch (err) {
        console.error("createDemoAccount Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/demo/list
// List all demo accounts for the admin's org
// ─────────────────────────────────────────────
export const getDemoAccounts = async (req, res) => {
    try {
        await connectDB();

        let filter = { is_demo: true };

        if (req.user.role === "org_admin") {
            filter.organization_id = req.user.organization_id;
        } else if (req.user.role === "super_admin" && req.query.org) {
            filter.organization_id = req.query.org;
        }

        const demos = await User.find(filter)
            .select("name email role organization_id createdAt status created_by")
            .sort({ createdAt: -1 })
            .lean();

        res.json({ demos });
    } catch (err) {
        console.error("getDemoAccounts Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/demo/:id/reset-password
// Reset or set custom password for demo account
// ─────────────────────────────────────────────
export const resetDemoPassword = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { customPassword } = req.body;

        const demoUser = await User.findById(id).select("+password");
        if (!demoUser || !demoUser.is_demo) {
            return res.status(404).json({ message: "Demo account not found" });
        }

        // Org admin can only reset their own org's demo accounts
        if (req.user.role === "org_admin" &&
            demoUser.organization_id?.toString() !== req.user.organization_id?.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        const newPassword = customPassword || generateStrongPassword();
        demoUser.password = await bcrypt.hash(newPassword, 10);
        await demoUser.save();

        // Log
        try {
            const { default: ActivityLog } = await import("../models/ActivityLog.js");
            await ActivityLog.create({
                user_id: req.user._id,
                action: `Reset demo account password`,
                details: `Email: ${demoUser.email}`,
                organization_id: demoUser.organization_id,
            });
        } catch (logErr) {
            console.error("Activity log error:", logErr.message);
        }

        res.json({
            message: "Password reset successfully",
            password: newPassword, // Shown once
        });
    } catch (err) {
        console.error("resetDemoPassword Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/demo/:id/login-as
// Impersonate a demo user (generates impersonation JWT)
// ─────────────────────────────────────────────
export const loginAsDemo = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        // ── Guard: Block nested impersonation ──
        if (req.isImpersonating) {
            return res.status(403).json({ message: "Cannot impersonate while already impersonating" });
        }

        const demoUser = await User.findById(id);
        if (!demoUser || !demoUser.is_demo) {
            return res.status(404).json({ message: "Demo account not found" });
        }

        // ── Guard: Block impersonating super_admin ──
        if (demoUser.role === "super_admin") {
            return res.status(403).json({ message: "Cannot impersonate a super admin" });
        }

        // ── Guard: Block cross-organization impersonation ──
        if (req.user.role === "org_admin" &&
            demoUser.organization_id?.toString() !== req.user.organization_id?.toString()) {
            return res.status(403).json({ message: "Cannot impersonate users from another organization" });
        }

        // Generate impersonation JWT (standardized structure)
        const token = jwt.sign(
            {
                id: req.user._id,                // real admin
                actingAs: demoUser._id,           // demo user being impersonated
                role: req.user.role,              // preserve admin role
                organizationId: req.user.organization_id || null,
                impersonation: true,
            },
            JWT_SECRET,
            { expiresIn: "2h" }
        );

        // Audit log
        try {
            const { default: ImpersonationLog } = await import("../models/ImpersonationLog.js");
            await ImpersonationLog.create({
                adminId: req.user._id,
                actingAsId: demoUser._id,
                organizationId: req.user.organization_id,
                startTime: new Date(),
            });
        } catch (logErr) {
            console.error("Impersonation audit log error:", logErr.message);
        }

        // Activity log
        try {
            const { default: ActivityLog } = await import("../models/ActivityLog.js");
            await ActivityLog.create({
                user_id: req.user._id,
                action: `Started impersonation as demo ${demoUser.role}`,
                details: `Email: ${demoUser.email}`,
                organization_id: demoUser.organization_id,
            });
        } catch (logErr) {
            console.error("Activity log error:", logErr.message);
        }

        res.json({
            message: "Impersonation token generated",
            token,
            demo: {
                _id: demoUser._id,
                name: demoUser.name,
                email: demoUser.email,
                role: demoUser.role,
            },
        });
    } catch (err) {
        console.error("loginAsDemo Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/demo/exit-impersonation
// Exit impersonation — issue fresh admin token
// ─────────────────────────────────────────────
export const exitImpersonation = async (req, res) => {
    try {
        await connectDB();

        if (!req.isImpersonating || !req.realUser) {
            return res.status(400).json({ message: "Not currently impersonating" });
        }

        // Fetch the real admin user to generate a proper token
        const adminUser = await User.findById(req.realUser._id).select("-password -verificationToken");
        if (!adminUser) {
            return res.status(401).json({ message: "Admin account no longer exists" });
        }

        // Generate fresh normal token for the admin
        const token = jwt.sign(
            { id: adminUser._id, role: adminUser.role, organizationId: adminUser.organization_id || null },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Close audit log entry
        try {
            const { default: ImpersonationLog } = await import("../models/ImpersonationLog.js");
            await ImpersonationLog.findOneAndUpdate(
                { adminId: req.realUser._id, endTime: null },
                { endTime: new Date() },
                { sort: { startTime: -1 } }
            );
        } catch (logErr) {
            console.error("Impersonation audit close error:", logErr.message);
        }

        // Activity log
        try {
            const { default: ActivityLog } = await import("../models/ActivityLog.js");
            await ActivityLog.create({
                user_id: req.realUser._id,
                action: "Exited impersonation",
                details: `Returned to admin account: ${adminUser.email}`,
                organization_id: adminUser.organization_id,
            });
        } catch (logErr) {
            console.error("Activity log error:", logErr.message);
        }

        res.json({
            message: "Impersonation ended",
            token,
            user: {
                _id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role,
                organization_id: adminUser.organization_id,
            },
        });
    } catch (err) {
        console.error("exitImpersonation Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────
// DELETE /api/demo/:id
// Hard-delete a demo account
// ─────────────────────────────────────────────
export const deleteDemoAccount = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        const demoUser = await User.findById(id);
        if (!demoUser || !demoUser.is_demo) {
            return res.status(404).json({ message: "Demo account not found" });
        }

        // Org admin can only delete their own org's demo accounts
        if (req.user.role === "org_admin" &&
            demoUser.organization_id?.toString() !== req.user.organization_id?.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        const email = demoUser.email;
        const role = demoUser.role;

        // Also remove from any classroom memberships
        try {
            const { default: ClassroomMembership } = await import("../models/ClassroomMembership.js");
            await ClassroomMembership.deleteMany({ user_id: demoUser._id });
        } catch (e) {
            console.error("Classroom membership cleanup error:", e.message);
        }

        await User.findByIdAndDelete(id);

        // Log
        try {
            const { default: ActivityLog } = await import("../models/ActivityLog.js");
            await ActivityLog.create({
                user_id: req.user._id,
                action: `Deleted demo ${role} account`,
                details: `Email: ${email}`,
                organization_id: demoUser.organization_id,
            });
        } catch (logErr) {
            console.error("Activity log error:", logErr.message);
        }

        res.json({ message: `Demo ${role} account deleted successfully` });
    } catch (err) {
        console.error("deleteDemoAccount Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
