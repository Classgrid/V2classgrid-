import OrganizationPending from "../models/OrganizationPending.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import Classroom from "../models/Classroom.js";
import Quiz from "../models/Quiz.js";
import ActivityLog from "../models/ActivityLog.js";
import AttendanceRecord from "../models/AttendanceRecord.js";
import AttendanceSession from "../models/AttendanceSession.js";
import crypto from "crypto";
import { sendEmail } from "../services/brevo.service.js";
import connectDB from "../../config/db.js";
import { generateUniqueDualCodes } from "../services/code-generator.service.js";
import { studentNotesClient } from "../config/supabaseClient.js"; // For interacting with student_notes

// GET /api/admin/pending-organizations
export const getPendingOrganizations = async (req, res) => {
    try {
        const pending = await OrganizationPending.find({ status: "pending" });
        res.status(200).json(pending);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/approve-organization/:id
export const approveOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const pendingOrg = await OrganizationPending.findById(id);

        if (!pendingOrg || pendingOrg.status !== "pending") {
            return res.status(404).json({ message: "Pending organization not found or already processed" });
        }

        const plan = pendingOrg.planRequested || "FREE";

        // For PRO applications, the super admin has already visually verified payment
        // details (UPI Name + screenshot) in the dashboard before clicking Approve.
        // Log a warning if proof is missing, but trust the super admin's judgment.
        if (plan === "PRO") {
            const hasDirectProof = pendingOrg.transactionId && pendingOrg.paymentScreenshotUrl;
            const hasPaymentRequest = !!pendingOrg.paymentRequestId;
            if (!hasDirectProof && !hasPaymentRequest) {
                console.warn(`âš ï¸ PRO org "${pendingOrg.institute_name}" approved without payment proof on record. Super admin manually verified.`);
            }
        }

        // Generate legacy private_code (backward compat) + dual secure codes
        const privateCode = crypto.randomBytes(8).toString("hex").toUpperCase();
        const { organizationCode, honorCode } = await generateUniqueDualCodes(Organization);

        // 1. Create User (org_admin) first so we have the owner_id
        let orgAdmin = await User.findOne({ email: pendingOrg.owner_email });
        if (!orgAdmin) {
            orgAdmin = new User({
                name: pendingOrg.owner_name,
                email: pendingOrg.owner_email,
                role: "org_admin",
                password: null,
                mustResetPassword: true,
                isEmailVerified: true,
                authProvider: "manual",
                linkedProviders: ["manual"],
            });
            await orgAdmin.save();
        } else {
            orgAdmin.role = "org_admin";
            orgAdmin.isEmailVerified = true;
            await orgAdmin.save();
        }

        // 2. Determine plan config
        const { PLANS } = await import("../config/plan.config.js");
        const planConfig = PLANS[plan] || PLANS.FREE;
        const studentLimit = planConfig.studentLimit || 60;
        const PLAN_DURATION_DAYS = 31;
        const activationDate = new Date();
        const planExpiresAt = plan === "PRO" ? new Date(activationDate.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000) : null;
        const planActivatedAt = plan === "PRO" ? activationDate : null;

        // 3. Create Organization with correct plan
        const newOrg = new Organization({
            name: pendingOrg.institute_name,
            address: pendingOrg.address,
            logo_url: pendingOrg.logo_url,
            owner_id: orgAdmin._id,
            ownerName: pendingOrg.owner_name,
            ownerEmail: pendingOrg.owner_email,
            contactNumber: pendingOrg.phone,
            website: pendingOrg.website || "",
            designation: pendingOrg.designation || "",
            private_code: privateCode,
            organizationCode,
            honorCode,
            plan: plan,
            studentLimit: studentLimit,
            planExpiresAt: planExpiresAt,
            planActivatedAt: planActivatedAt,
            faculty_limit: planConfig.maxFaculty || 5,
        });
        const savedOrg = await newOrg.save();

        // 4. Update User with organization_id + generate secure activation token
        orgAdmin.organization_id = savedOrg._id;

        // Generate secure single-use activation token (hashed in DB)
        const rawActivationToken = crypto.randomBytes(32).toString("hex");
        const hashedActivationToken = crypto.createHash("sha256").update(rawActivationToken).digest("hex");
        orgAdmin.activationToken = hashedActivationToken;
        orgAdmin.activationTokenExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        orgAdmin.mustResetPassword = true; // ensure step 2 flow shows as not-yet-activated
        await orgAdmin.save();

        // 5. Update Pending status (both legacy and new)
        pendingOrg.status = "approved";
        pendingOrg.applicationStatus = "approved";
        await pendingOrg.save();

        // 6. If PRO, link org back to the PaymentRequest and mark it as approved
        if (plan === "PRO" && pendingOrg.paymentRequestId) {
            const { default: PaymentRequest } = await import("../models/PaymentRequest.js");
            await PaymentRequest.findByIdAndUpdate(pendingOrg.paymentRequestId, {
                organizationId: savedOrg._id,
                status: 'approved',
                processedAt: new Date()
            });
        }

        const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";

        const {
            getAdminOrgApprovalNotificationHtml,
            getAdminOrgApprovalNotificationPlainText,
            getConsolidatedApprovalEmailHtml,
            getConsolidatedApprovalEmailPlainText,
        } = await import("../services/email-templates.service.js");

        // Email 1: Super admin internal notification
        await sendEmail({
            to: superAdminEmail,
            subject: `[Classgrid] Org Approved (${plan}): ${savedOrg.name}`,
            html: getAdminOrgApprovalNotificationHtml(savedOrg.name, pendingOrg.owner_email, organizationCode, honorCode, `${frontendUrl}/super-admin-dashboard`),
            text: getAdminOrgApprovalNotificationPlainText(savedOrg.name, pendingOrg.owner_email, organizationCode, honorCode, `${frontendUrl}/super-admin-dashboard`),
        });

        // Single consolidated email: approval + org codes + activation link (+ PRO plan details if applicable)
        const activationLink = `${frontendUrl}/admin/activate?token=${rawActivationToken}`;
        const consolSubject = plan === "PRO"
            ? "Activate Your Classgrid Admin Account \u2013 PRO Plan Active"
            : "Activate Your Classgrid Admin Account \u2013 FREE Plan";

        await sendEmail({
            to: pendingOrg.owner_email,
            subject: consolSubject,
            html: getConsolidatedApprovalEmailHtml({
                adminName: pendingOrg.owner_name,
                orgName: savedOrg.name,
                organizationCode,
                honorCode,
                plan,
                studentLimit,
                activationLink,
                activationDate,
                expiryDate: planExpiresAt,
                planDuration: PLAN_DURATION_DAYS,
            }),
            text: getConsolidatedApprovalEmailPlainText({
                adminName: pendingOrg.owner_name,
                orgName: savedOrg.name,
                organizationCode,
                honorCode,
                plan,
                studentLimit,
                activationLink,
                activationDate,
                expiryDate: planExpiresAt,
                planDuration: PLAN_DURATION_DAYS,
            }),
        });

        res.status(200).json({ message: `Organization approved successfully (${plan} plan)`, org: savedOrg });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/reject-organization/:id
export const rejectOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const pendingOrg = await OrganizationPending.findById(id);

        if (!pendingOrg || pendingOrg.status !== "pending") {
            return res.status(404).json({ message: "Pending organization not found or already processed" });
        }

        const { getOrgRejectionEmailHtml, getOrgRejectionEmailPlainText } = await import("../services/email-templates.service.js");

        await sendEmail({
            to: pendingOrg.owner_email,
            subject: "Update on your Classgrid Application",
            html: getOrgRejectionEmailHtml(pendingOrg.owner_name, pendingOrg.institute_name, reason),
            text: getOrgRejectionEmailPlainText(pendingOrg.owner_name, pendingOrg.institute_name, reason),
        });

        // Fix: permanently remove the pending record so it never reappears
        await OrganizationPending.deleteOne({ _id: id });

        res.status(200).json({ message: "Organization rejected successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/suspend-organization/:id
export const suspendOrganization = async (req, res) => {
    try {
        if (req.user && req.user.email !== "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "Only the system owner can suspend organizations" });
        }
        const { id } = req.params;
        const org = await Organization.findByIdAndUpdate(id, { status: "suspended" }, { returnDocument: "after" });
        if (!org) return res.status(404).json({ message: "Organization not found" });

        // Suspend all users in this org, protecting super admins & the owner
        const { default: User } = await import("../models/User.js");
        await User.updateMany(
            { organization_id: id, role: { $ne: "super_admin" }, email: { $ne: "nikhil.shinde@classgrid.in" } },
            { status: "suspended" }
        );

        res.json({ message: "Organization and all its users suspended", org });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/block-organization/:id
export const blockOrganization = async (req, res) => {
    try {
        if (req.user && req.user.email !== "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "Only the system owner can block organizations" });
        }
        const { id } = req.params;
        const org = await Organization.findByIdAndUpdate(id, { status: "blocked" }, { returnDocument: "after" });
        if (!org) return res.status(404).json({ message: "Organization not found" });

        // Block/Suspend all users, protecting super admins & the owner
        const { default: User } = await import("../models/User.js");
        await User.updateMany(
            { organization_id: id, role: { $ne: "super_admin" }, email: { $ne: "nikhil.shinde@classgrid.in" } },
            { status: "suspended" }
        );

        res.json({ message: "Organization blocked", org });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/reactivate-organization/:id
export const reactivateOrganization = async (req, res) => {
    try {
        if (req.user && req.user.email !== "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "Only the system owner can reactivate organizations" });
        }
        const { id } = req.params;
        const org = await Organization.findByIdAndUpdate(id, { status: "active" }, { returnDocument: "after" });
        if (!org) return res.status(404).json({ message: "Organization not found" });

        // Reactivate all users, protecting super admins & the owner
        const { default: User } = await import("../models/User.js");
        await User.updateMany(
            { organization_id: id, role: { $ne: "super_admin" }, email: { $ne: "nikhil.shinde@classgrid.in" } },
            { status: "active" }
        );

        res.json({ message: "Organization reactivated", org });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE /api/admin/delete-organization/:id â€” FULL HARD DELETE
export const deleteOrganization = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        // Import the hard delete service
        const { hardDeleteOrganization } = await import("../services/org-delete.service.js");

        const result = await hardDeleteOrganization(id);

        console.log(`ðŸ—‘ï¸ Organisation "${result.orgName}" permanently deleted by Super Admin ${req.user.email}`);
        console.log(`   Deleted: ${result.deletedClassrooms} classrooms, ${result.deletedUsers} users`);
        if (result.supabaseErrors) {
            console.warn(`   Supabase cleanup warnings:`, result.supabaseErrors);
        }

        res.json({
            message: `Organisation "${result.orgName}" has been permanently deleted.`,
            details: {
                classroomsDeleted: result.deletedClassrooms,
                usersDeleted: result.deletedUsers,
                supabaseWarnings: result.supabaseErrors || [],
            }
        });
    } catch (err) {
        console.error("âŒ Organisation delete error:", err.message);
        res.status(err.message === "Organization not found" ? 404 : 500).json({
            message: err.message === "Organization not found" ? "Organization not found" : "Server error during deletion",
            error: err.message
        });
    }
};

// POST /api/admin/update-faculty-limit/:id
export const updateFacultyLimit = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit } = req.body;

        if (!limit || isNaN(limit)) {
            return res.status(400).json({ message: "Valid limit is required" });
        }

        const org = await Organization.findByIdAndUpdate(id, { faculty_limit: limit }, { returnDocument: "after" });
        if (!org) return res.status(404).json({ message: "Organization not found" });

        res.json({ message: "Faculty limit updated", org });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/update-plan/:id
export const updatePlan = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { plan } = req.body;

        const validPlans = ['FREE', 'PLUS', 'PRO'];
        if (!plan || !validPlans.includes(plan.toUpperCase())) {
            return res.status(400).json({ message: "Plan must be FREE, PLUS, or PRO" });
        }

        const planUpper = plan.toUpperCase();
        const { PLANS } = await import("../config/plan.config.js");
        const planConfig = PLANS[planUpper] || PLANS.FREE;
        const PLAN_DURATION_DAYS = 31;
        const now = new Date();

        const org = await Organization.findByIdAndUpdate(
            id,
            {
                plan: planUpper,
                studentLimit: planConfig.studentLimit,
                faculty_limit: planConfig.maxFaculty,
                // If upgrading to paid plan, set 31-day expiry; if FREE, clear expiry
                planExpiresAt: planUpper === 'FREE' ? null : new Date(now.getTime() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000),
                planActivatedAt: planUpper === 'FREE' ? null : now,
            },
            { returnDocument: "after" }
        );

        if (!org) return res.status(404).json({ message: "Organization not found" });

        res.json({
            message: `Plan updated to ${planUpper}`,
            org: { plan: org.plan, studentLimit: org.studentLimit, planExpiresAt: org.planExpiresAt, planActivatedAt: org.planActivatedAt },
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/reset-admin-password/:id
export const resetOrgAdminPassword = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params; // Org ID
        const org = await Organization.findById(id);
        if (!org) return res.status(404).json({ message: "Organization not found" });

        const admin = await User.findOne({ _id: org.owner_id });
        if (!admin) return res.status(404).json({ message: "Organization admin not found" });

        // Generate reset token and email
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        admin.resetPasswordToken = hashedToken;
        admin.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
        await admin.save();

        const { getPasswordResetEmailHtml, getPasswordResetEmailPlainText } = await import("../services/email-templates.service.js");

        const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");

        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

        await sendEmail({
            to: admin.email,
            subject: "Admin Password Reset - Classgrid",
            html: getPasswordResetEmailHtml(resetLink),
            text: getPasswordResetEmailPlainText(resetLink),
        });

        res.json({ message: "Password reset instructions sent to admin", email: admin.email });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/suspend-user/:id
export const suspendUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ message: "Reason for suspension is required" });
        }

        const { default: User } = await import("../models/User.js");
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Access Rule check
        if (req.user.role === "org_admin") {
            if (targetUser.organization_id?.toString() !== req.user.organization_id?.toString()) {
                return res.status(403).json({ message: "You can only suspend users within your organization" });
            }
            if (targetUser.role === "org_admin") {
                return res.status(403).json({ message: "Organization Admins cannot suspend other Organization Admins" });
            }
        } else if (req.user.role !== "super_admin") {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (targetUser.role === "super_admin" || targetUser.email === "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "God owner cannot be suspended" });
        }

        targetUser.status = "suspended";
        await targetUser.save();

        // Send Email
        try {
            const { sendEmail } = await import("../services/brevo.service.js");
            const { getAccountSuspensionEmailHtml, getAccountSuspensionEmailPlainText } = await import("../services/email-templates.service.js");
            if (getAccountSuspensionEmailHtml && getAccountSuspensionEmailPlainText) {
                await sendEmail({
                    to: targetUser.email,
                    subject: "Account Suspended - Classgrid",
                    html: getAccountSuspensionEmailHtml(targetUser.name, reason),
                    text: getAccountSuspensionEmailPlainText(targetUser.name, reason),
                });
            }
        } catch (emailErr) {
            console.warn("Failed to send suspension email:", emailErr);
        }

        try {
            const { logAdminAction } = await import("../services/auditLog.service.js");
            logAdminAction(req, "suspend_user", "user", targetUser._id, targetUser.name, { reason });
        } catch (logErr) { }

        res.json({ message: "User suspended successfully", user: targetUser });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE /api/admin/delete-user/:id
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ message: "Reason for deletion is required" });
        }

        if (req.user.role !== "super_admin") {
            return res.status(403).json({ message: "Only Super Admins can delete users globally" });
        }

        const { default: User } = await import("../models/User.js");
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // God owner (nikhil.shinde@classgrid.in) can delete anyone EXCEPT themselves
        if (targetUser.email === "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "God owner account cannot be deleted" });
        }
        // Only God owner can delete other super admins
        if (targetUser.role === "super_admin" && req.user.email !== "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "Only the God owner can delete Super Admins" });
        }

        if (targetUser.role === "org_admin" && targetUser.organization_id) {
            const adminCount = await User.countDocuments({
                organization_id: targetUser.organization_id,
                role: "org_admin"
            });
            if (adminCount <= 1) {
                return res.status(403).json({ message: "Cannot delete the last Organization Admin of an organization." });
            }
        }

        // Send email BEFORE deletion (so we still have the email address)
        try {
            const { sendEmail } = await import("../services/brevo.service.js");
            const { getAccountDeletionEmailHtml, getAccountDeletionEmailPlainText } = await import("../services/email-templates.service.js");
            if (getAccountDeletionEmailHtml && getAccountDeletionEmailPlainText) {
                await sendEmail({
                    to: targetUser.email,
                    subject: "Account Deleted - Classgrid",
                    html: getAccountDeletionEmailHtml(targetUser.name, reason),
                    text: getAccountDeletionEmailPlainText(targetUser.name, reason),
                });
            }
        } catch (emailErr) {
            console.warn("Failed to send deletion email:", emailErr);
        }

        // Import all models needed for cascade cleanup
        const { default: Classroom } = await import("../models/Classroom.js");
        const { default: ClassroomMembership } = await import("../models/ClassroomMembership.js");
        const { default: AttendanceRecord } = await import("../models/AttendanceRecord.js");
        const { default: ActivityLog } = await import("../models/ActivityLog.js");
        const { default: Message } = await import("../models/Message.js");
        const { default: DeviceVerification } = await import("../models/DeviceVerification.js");
        const { default: Verification } = await import("../models/Verification.js");

        const session = await User.startSession();
        session.startTransaction();

        try {
            const userId = targetUser._id;
            const email = targetUser.email;

            if (targetUser.role === "student") {
                // Remove all classroom memberships & attendance records for this student
                await ClassroomMembership.deleteMany({ student: userId }, { session });
                await AttendanceRecord.deleteMany({ student: userId }, { session });
            } else if (targetUser.role === "faculty" || targetUser.role === "teacher") {
                // Archive all classrooms owned by this faculty (preserves student history)
                await Classroom.updateMany(
                    { teacher: userId },
                    { $set: { "settings.isArchived": true, teacher: null } },
                    { session }
                );
            }
            // For org_admin: their organization_id is stored on the User doc itself,
            // which gets deleted below — no separate mapping table to clean up.

            // Soft-delete messages sent by this user (preserves chat thread structure)
            await Message.updateMany(
                { sender: userId },
                { $set: { isDeleted: true, content: "[Message deleted — account removed]" } },
                { session }
            );

            // Hard-delete activity logs for this user (analytics data, safe to remove)
            await ActivityLog.deleteMany({ user: userId }, { session });

            // Delete device OTP verification records tied to this email
            await DeviceVerification.deleteMany({ email }, { session });

            // Delete any pending signup email-verification records for this email
            await Verification.deleteMany({ email }, { session });

            // Finally, delete the User record itself
            // (this also removes: password, resetPasswordToken, activationToken,
            //  deviceFingerprint, organization_id reference — all in one go)
            await User.deleteOne({ _id: userId }, { session });

            await session.commitTransaction();
            session.endSession();
        } catch (txnErr) {
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({ message: "Transaction failed during deletion", error: txnErr.message });
        }

        try {
            const { logAdminAction } = await import("../services/auditLog.service.js");
            logAdminAction(req, "delete_user", "user", targetUser._id, targetUser.name, {
                reason,
                deletedEmail: targetUser.email,
                deletedRole: targetUser.role,
            });
        } catch (logErr) { }

        res.json({ message: "User permanently deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/reactivate-user/:id
export const reactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { default: User } = await import("../models/User.js");
        const targetUser = await User.findById(id);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Access Rule check
        if (req.user.role === "org_admin") {
            if (targetUser.organization_id?.toString() !== req.user.organization_id?.toString()) {
                return res.status(403).json({ message: "You can only reactivate users within your organization" });
            }
        }

        targetUser.status = "active";
        await targetUser.save();

        try {
            const { logAdminAction } = await import("../services/auditLog.service.js");
            logAdminAction(req, "reactivate_user", "user", targetUser._id, targetUser.name, { reason: "Reactivated by admin" });
        } catch (logErr) { }

        res.json({ message: "User reactivated successfully", user: targetUser });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/admin/create-super-admin
export const createSuperAdmin = async (req, res) => {
    try {
        const { default: User } = await import("../models/User.js");

        // Fetch current req.user from DB based on ID implicitly passed over req.
        // Wait, authentication middleware puts `req.userId` not `req.user.email` but we can rely on `req.user.email` if it's there. 
        // Let's explicitly look up req.userId just to be safe.
        const currentUser = await User.findById(req.userId || (req.user && req.user._id));
        if (!currentUser || currentUser.email !== "nikhil.shinde@classgrid.in") {
            return res.status(403).json({ message: "Only the system owner (nikhil.shinde@classgrid.in) can create Super Admins" });
        }

        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        const bcrypt = (await import("bcryptjs")).default;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newSuperAdmin = new User({
            name,
            email,
            password: hashedPassword,
            role: "super_admin",
            status: "active",
            isEmailVerified: true, // Super admins are created explicitly
            authProvider: "manual",
            linkedProviders: ["manual"],
            mustResetPassword: true // Co-Super Admins must change password on first login
        });

        await newSuperAdmin.save();

        // Send login credentials and instructions via email
        try {
            const { sendEmail } = await import("../services/brevo.service.js");
            const { getSuperAdminCredentialsHtml, getSuperAdminCredentialsPlainText } = await import("../services/email-templates.service.js");
            const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");

            const loginLink = `${frontendUrl}/superadmin/login`;

            await sendEmail({
                to: email,
                subject: "Welcome to Classgrid - Super Admin Access",
                html: getSuperAdminCredentialsHtml(name, email, password, loginLink),
                text: getSuperAdminCredentialsPlainText(name, email, password, loginLink),
            });
        } catch (emailErr) {
            console.error("Failed to send Co-Super Admin creation email:", emailErr);
            // Non-blocking error
        }

        res.status(201).json({ message: "Super Admin created successfully", user: { name: newSuperAdmin.name, email: newSuperAdmin.email } });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/notes/pending
// Super admin: returns ALL notes, optional ?org=orgId filter
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getPendingNotes = async (req, res) => {
    try {
        const orgFilter = req.query.org;

        let query = studentNotesClient
            .from('student_notes')
            .select('*')
            .order('created_at', { ascending: false });

        if (orgFilter) {
            query = query.eq('organization_id', orgFilter);
        }

        const { data: notes, error } = await query;

        if (error) throw error;

        res.status(200).json(notes || []);
    } catch (err) {
        console.error("Fetch notes error:", err);
        res.status(500).json({ message: "Server error fetching notes" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/admin/notes/:id/approve
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const approveNote = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await studentNotesClient
            .from('student_notes')
            .update({ status: 'approved' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ message: "Note approved successfully", note: data });
    } catch (err) {
        console.error("Approve note error:", err);
        res.status(500).json({ message: "Server error approving note" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/admin/notes/:id/reject
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const rejectNote = async (req, res) => {
    try {
        const { id } = req.params;

        // Optionally, delete the underlying file from storage, but for now we just change status to rejected
        const { data, error } = await studentNotesClient
            .from('student_notes')
            .update({ status: 'rejected' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ message: "Note rejected successfully", note: data });
    } catch (err) {
        console.error("Reject note error:", err);
        res.status(500).json({ message: "Server error rejecting note" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ORG ADMIN â€” Get ALL notes for their organization
// GET /api/org/notes/pending
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getOrgPendingNotes = async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "No organization linked to this admin." });

        const { data: notes, error } = await studentNotesClient
            .from('student_notes')
            .select('*')
            .eq('organization_id', orgId.toString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(notes || []);
    } catch (err) {
        console.error("Org admin fetch notes error:", err);
        res.status(500).json({ message: "Server error fetching notes" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ORG ADMIN â€” Approve note (only within their org)
// POST /api/org/notes/:id/approve
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const approveOrgNote = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "No organization linked to this admin." });

        // Verify note belongs to this org
        const { data: note, error: fetchErr } = await studentNotesClient
            .from('student_notes')
            .select('id, organization_id')
            .eq('id', id)
            .single();

        if (fetchErr || !note) return res.status(404).json({ message: "Note not found." });
        if (note.organization_id !== orgId.toString()) {
            return res.status(403).json({ message: "You can only approve notes from your own organization." });
        }

        const { data, error } = await studentNotesClient
            .from('student_notes')
            .update({ status: 'approved' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ message: "Note approved successfully", note: data });
    } catch (err) {
        console.error("Org admin approve note error:", err);
        res.status(500).json({ message: "Server error approving note" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ORG ADMIN â€” Reject note (only within their org)
// POST /api/org/notes/:id/reject
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const rejectOrgNote = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "No organization linked to this admin." });

        // Verify note belongs to this org
        const { data: note, error: fetchErr } = await studentNotesClient
            .from('student_notes')
            .select('id, organization_id')
            .eq('id', id)
            .single();

        if (fetchErr || !note) return res.status(404).json({ message: "Note not found." });
        if (note.organization_id !== orgId.toString()) {
            return res.status(403).json({ message: "You can only reject notes from your own organization." });
        }

        const { data, error } = await studentNotesClient
            .from('student_notes')
            .update({ status: 'rejected' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ message: "Note rejected successfully", note: data });
    } catch (err) {
        console.error("Org admin reject note error:", err);
        res.status(500).json({ message: "Server error rejecting note" });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/org-insight/:orgId
// Returns faculty â†’ classrooms â†’ student counts for one org
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getOrgInsight = async (req, res) => {
    try {
        await connectDB();
        const { orgId } = req.params;

        const { default: Classroom } = await import("../models/Classroom.js");

        // 1. All faculty in this org
        const faculty = await User.find({
            organization_id: orgId,
            role: { $in: ["faculty", "teacher"] },
        }).select("name email department profilePicture").lean();

        // 2. All classrooms in this org
        const classrooms = await Classroom.find({ organization_id: orgId })
            .select("_id name subject teacher memberCount settings")
            .lean();

        // 3. Total students
        const studentCount = await User.countDocuments({
            organization_id: orgId,
            role: "student",
            is_demo: { $ne: true },
            status: { $nin: ['deleted', 'suspended'] },
        });

        // 4. Map classrooms per faculty
        const classroomsByFaculty = {};
        classrooms.forEach(c => {
            const tid = c.teacher?.toString();
            if (!classroomsByFaculty[tid]) classroomsByFaculty[tid] = [];
            classroomsByFaculty[tid].push({
                _id: c._id,
                name: c.name,
                subject: c.subject,
                memberCount: c.memberCount || 0,
                isArchived: c.settings?.isArchived || false,
            });
        });

        const facultyWithClassrooms = faculty.map(f => ({
            ...f,
            classrooms: classroomsByFaculty[f._id.toString()] || [],
        }));

        res.json({
            totalFaculty: faculty.length,
            totalStudents: studentCount,
            totalClassrooms: classrooms.length,
            faculty: facultyWithClassrooms,
        });
    } catch (err) {
        console.error("getOrgInsight error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/api-metrics
// Returns aggregated API health metrics for the dashboard
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getApiMetrics = async (req, res) => {
    try {
        const { getInMemorySnapshot, getRecentFailures } = await import("../middleware/metrics.middleware.js");
        const { default: ApiMetricBucket } = await import("../models/ApiMetricBucket.js");
        await connectDB();

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dbBuckets = await ApiMetricBucket.find({ bucket: { $gte: since } }).lean();
        const inMem = getInMemorySnapshot();
        const allBuckets = [...dbBuckets, ...inMem];

        let totalRequests = 0, successCount = 0, clientErr = 0, serverErr = 0, totalTime = 0;
        const routeMap = {};

        allBuckets.forEach(b => {
            totalRequests += b.totalRequests || 0;
            successCount += b.successCount || 0;
            clientErr += b.clientErrCount || 0;
            serverErr += b.serverErrCount || 0;
            totalTime += b.totalRespTimeMs || 0;
            const key = `${b.method} ${b.route}`;
            if (!routeMap[key]) routeMap[key] = { route: key, requests: 0, errors: 0, totalTime: 0 };
            routeMap[key].requests += b.totalRequests || 0;
            routeMap[key].errors += (b.clientErrCount || 0) + (b.serverErrCount || 0);
            routeMap[key].totalTime += b.totalRespTimeMs || 0;
        });

        const topRoutes = Object.values(routeMap)
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 10)
            .map(r => ({
                route: r.route,
                requests: r.requests,
                errorRate: r.requests > 0 ? ((r.errors / r.requests) * 100).toFixed(1) : "0.0",
                avgRespMs: r.requests > 0 ? Math.round(r.totalTime / r.requests) : 0,
            }));

        const errorRate = totalRequests > 0 ? ((serverErr / totalRequests) * 100).toFixed(2) : "0.00";
        const avgRespMs = totalRequests > 0 ? Math.round(totalTime / totalRequests) : 0;
        let health = "healthy";
        if (parseFloat(errorRate) > 10 || avgRespMs > 2000) health = "critical";
        else if (parseFloat(errorRate) > 3 || avgRespMs > 800) health = "warning";

        const recentTotal = inMem.reduce((s, b) => s + (b.totalRequests || 0), 0);

        res.json({
            health, totalRequests, successCount,
            clientErrCount: clientErr, serverErrCount: serverErr,
            errorRate, avgRespMs, requestsPerMinute: recentTotal,
            topRoutes, recentFailures: getRecentFailures().slice(0, 20),
            windowHours: 24,
        });
    } catch (err) {
        console.error("getApiMetrics error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// 
// Global performance cache for super admin (10 min TTL)
// 
let _globalPerfCache = null;
let _globalPerfExpire = 0;

// GET /api/admin/student-performance
// Super Admin â€” Top 20 students across ALL orgs; 10-min cache
export const getGlobalStudentPerformance = async (req, res) => {
    try {
        await connectDB();
        if (_globalPerfCache && _globalPerfExpire > Date.now()) {
            return res.json({ ..._globalPerfCache, cached: true });
        }

        const students = await User.find({ role: "student", is_demo: { $ne: true } })
            .select("_id name email organization_id").lean();
        if (students.length === 0) return res.json({ students: [], cached: false });

        const studentIds = students.map(s => s._id);

        const orgs = await Organization.find({}).select("_id name").lean();
        const orgNameMap = {};
        orgs.forEach(o => { orgNameMap[o._id.toString()] = o.name; });

        const quizAgg = await Quiz.aggregate([
            { $unwind: "$attempts" },
            { $match: { "attempts.studentId": { $in: studentIds } } },
            { $group: { _id: "$attempts.studentId", avgScore: { $avg: "$attempts.percentage" }, attempts: { $sum: 1 } } },
        ]);
        const quizMap = {};
        quizAgg.forEach(q => { quizMap[q._id.toString()] = { avgScore: q.avgScore || 0, attempts: q.attempts }; });

        const totalSessions = await AttendanceSession.countDocuments({});
        const attAgg = await AttendanceRecord.aggregate([
            { $match: { student: { $in: studentIds } } },
            { $group: { _id: "$student", presentCount: { $sum: 1 } } },
        ]);
        const attMap = {};
        attAgg.forEach(a => { attMap[a._id.toString()] = a.presentCount; });

        const notesMap = {};
        try {
            const { data } = await studentNotesClient.from("student_notes").select("uploader_id").eq("status", "approved");
            if (data) data.forEach(n => { if (n.uploader_id) notesMap[n.uploader_id] = (notesMap[n.uploader_id] || 0) + 1; });
        } catch (e) { console.error("[GlobalPerf] notes error:", e.message); }

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const actAgg = await ActivityLog.aggregate([
            { $match: { user: { $in: studentIds }, timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { _id: "$user", count: { $sum: 1 } } },
        ]);
        const actMap = {};
        actAgg.forEach(a => { actMap[a._id.toString()] = a.count; });

        const ranked = students.map(s => {
            const sid = s._id.toString();
            const quiz = quizMap[sid]?.avgScore || 0;
            const att = totalSessions > 0 ? (Math.min(attMap[sid] || 0, totalSessions) / totalSessions) * 100 : 0;
            const notes = Math.min((notesMap[sid] || 0) * 10, 100);
            const activity = Math.min((actMap[sid] || 0) * 2, 100);
            const score = (quiz * 0.4) + (att * 0.3) + (notes * 0.2) + (activity * 0.1);
            return {
                _id: s._id, name: s.name, email: s.email,
                organizationName: orgNameMap[s.organization_id?.toString()] || "â€”",
                quizAvg: Math.round(quiz), quizAttempts: quizMap[sid]?.attempts || 0,
                attendanceRate: Math.round(att), notesCount: notesMap[sid] || 0,
                activityCount: actMap[sid] || 0, engagementScore: Math.round(score),
            };
        });
        ranked.sort((a, b) => b.engagementScore - a.engagementScore);
        const top20 = ranked.slice(0, 20).map((s, i) => ({ ...s, rank: i + 1 }));
        _globalPerfCache = { students: top20, totalStudents: students.length };
        _globalPerfExpire = Date.now() + 10 * 60 * 1000;
        res.json({ ..._globalPerfCache, cached: false });
    } catch (err) {
        console.error("getGlobalStudentPerformance error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/audit-log
// Super Admin â€” ALL orgs audit logs (last 100), filterable by org + action
export const getGlobalAuditLog = async (req, res) => {
    try {
        await connectDB();
        const { org, action: actionFilter } = req.query;
        const query = {};
        if (org) query.organization_id = org;
        if (actionFilter) query.action = actionFilter;

        const logs = await AdminAuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(100)
            .populate("actorId", "name email")
            .lean();

        res.json({ logs });
    } catch (err) {
        console.error("getGlobalAuditLog error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

