import OrganizationPending from "../models/OrganizationPending.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Classroom from "../models/Classroom.js";
import ClassroomMembership from "../models/ClassroomMembership.js";
import { studentNotesClient } from "../config/supabaseClient.js";
import { s3Storage } from "../services/s3-storage.service.js";
import { sendEmail } from "../services/aws-ses.service.js";
import connectDB from "../../config/db.js";
import { getMaxFaculty, getMaxClassroomsPerFaculty, getMaxStudentsPerClassroom, getStudentLimit, getEffectivePlan } from "../config/plan.config.js";
import OrganizationAnnouncement from "../models/OrganizationAnnouncement.js";
import { logAdminAction } from "../services/auditLog.service.js";
import mongoose from "mongoose";

// POST /api/organization/apply
export const applyOrganization = async (req, res) => {
    try {
        await connectDB();
        const { institute_name, address, owner_name, owner_email, phone, logo_base64, website, designation, planRequested, transactionId, paymentScreenshot_base64 } = req.body;

        if (!institute_name || !address || !owner_name || !owner_email || !phone) {
            return res.status(400).json({ message: "All required fields must be filled" });
        }

        // Normalize plan — default to FREE
        const plan = (planRequested && ["FREE", "PRO"].includes(planRequested.toUpperCase()))
            ? planRequested.toUpperCase()
            : "FREE";

        // PRO plan payment is now handled via Razorpay (no UPI name/screenshot required)

        let finalLogoUrl = "";

        // Server-Side File Validation & Handling — Logo
        if (logo_base64) {
            // 100 MB limit
            if (logo_base64.length > 137000000) {
                return res.status(400).json({ message: "Logo file exceeds 100 MB limit." });
            }

            const match = logo_base64.match(/^data:image\/(png|jpeg|webp);base64,/);
            if (!match) {
                return res.status(400).json({ message: "Invalid image type. Only PNG, JPEG, and WEBP are allowed." });
            }

            const ext = match[1];
            const base64Data = logo_base64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");

            try {
                const filename = `org_${Date.now()}.${ext}`;
                const { publicUrl } = await s3Storage.uploadFile(`logos/${filename}`, buffer, `image/${ext}`);
                finalLogoUrl = publicUrl;
            } catch (storageErr) {
                console.error("Supabase Storage Error:", storageErr);
                finalLogoUrl = "";
            }
        }

        // PRO plan payment screenshots are no longer needed — Razorpay handles payment flow

        // All applications go to pending_review — PRO payment is handled via Razorpay separately
        const applicationStatus = "pending_review";

        const pendingOrg = new OrganizationPending({
            institute_name,
            address,
            owner_name,
            owner_email,
            phone,
            logo_url: finalLogoUrl,
            website: website || "",
            designation: designation || "",
            planRequested: plan,
            applicationStatus,
        });

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await pendingOrg.save({ session });

            const {
                getAdminOrgApplicationNotificationHtml,
                getAdminOrgApplicationNotificationPlainText,
                getOrgApplicationConfirmationHtml,
                getOrgApplicationConfirmationPlainText
            } = await import("../services/email-templates.service.js");

            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";

            await sendEmail({
                to: superAdminEmail,
                subject: `New Organization Application (${plan}) - Classgrid`,
                html: getAdminOrgApplicationNotificationHtml(pendingOrg),
                text: getAdminOrgApplicationNotificationPlainText(pendingOrg),
            });

            await sendEmail({
                to: owner_email,
                subject: `Application Received — ${institute_name}`,
                html: getOrgApplicationConfirmationHtml(owner_name, institute_name, plan),
                text: getOrgApplicationConfirmationPlainText(owner_name, institute_name, plan),
            });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json({
                message: plan === "PRO"
                    ? "Application submitted. Complete payment to activate instantly."
                    : "Application submitted successfully. We will review it shortly.",
                pendingOrgId: plan === "PRO" ? pendingOrg._id : undefined,
            });
        } catch (txnError) {
            await session.abortTransaction();
            session.endSession();
            throw txnError;
        }
    } catch (err) {
        console.error("applyOrganization error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/org/add-faculty
export const addFaculty = async (req, res) => {
    try {
        await connectDB();
        const { email, name } = req.body;

        if (!email || !name) {
            return res.status(400).json({ message: "Faculty name and email are required" });
        }

        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const organization = await Organization.findById(organization_id);

        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Check count of current faculty (plan-driven limit with expiry)
        // Exclude demo accounts from count
        const facultyCount = await User.countDocuments({
            role: "faculty",
            organization_id: organization_id,
            is_demo: { $ne: true },
        });

        const effectivePlan = getEffectivePlan(organization.plan, organization.planExpiresAt);
        const maxFaculty = getMaxFaculty(effectivePlan);

        if (facultyCount >= maxFaculty) {
            return res.status(403).json({
                message: `Faculty limit reached (${maxFaculty} on ${effectivePlan} plan). ${effectivePlan === 'FREE' ? 'Upgrade to add more faculty.' : 'Contact support.'}`,
                code: 'PLAN_LIMIT_REACHED',
            });
        }

        const crypto = (await import("crypto")).default;
        const bcrypt = (await import("bcryptjs")).default;
        const { getFacultyInviteEmailHtml, getFacultyInviteEmailPlainText } = await import("../services/email-templates.service.js");

        // Generate a random secure password as placeholder
        const randomPlaceholder = crypto.randomBytes(16).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPlaceholder, 10);

        // Generate secure reset token for direct Set Password flow
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        let user = await User.findOne({ email });

        if (user) {
            if (user.role === "faculty" && user.organization_id && user.organization_id.toString() === organization_id.toString()) {
                // If they are already in the org but need activation, we are resending the invite
                if (user.mustResetPassword) {
                    user.resetPasswordToken = hashedToken;
                    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
                    await user.save();
                } else {
                    return res.status(400).json({ message: "Faculty already added and activated in your organization." });
                }
            } else if (user.organization_id && user.organization_id.toString() !== organization_id.toString()) {
                return res.status(400).json({ message: "This email is already registered to another organization." });
            } else if (user.role === "super_admin") {
                return res.status(400).json({ message: "Cannot modify a super admin account." });
            } else {
                user.role = "faculty";
                user.organization_id = organization_id;
                user.password = hashedPassword;
                user.mustResetPassword = true;
                user.isEmailVerified = false;
                user.resetPasswordToken = hashedToken;
                user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
                user.authProvider = "manual";

                if (!user.linkedProviders) user.linkedProviders = [];
                if (!user.linkedProviders.includes("manual")) user.linkedProviders.push("manual");
                await user.save();
            }
        } else {
            user = new User({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role: "faculty",
                organization_id: organization_id,
                password: hashedPassword,
                mustResetPassword: true,
                isEmailVerified: false,
                resetPasswordToken: hashedToken,
                resetPasswordExpires: Date.now() + 5 * 60 * 1000, // 5 minutes
                authProvider: "manual",
                linkedProviders: ["manual"]
            });
            await user.save();
        }

        const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");

        const verifyLink = `${frontendUrl}/faculty/activate?token=${rawToken}`;

        const session = await (await import("mongoose")).default.startSession();
        session.startTransaction();

        try {
            if (user.isNew) {
                await user.save({ session });
            } else {
                await user.save({ session });
            }

            await sendEmail({
                to: email,
                subject: `You've been invited to join Classgrid`,
                html: getFacultyInviteEmailHtml(user.name, organization.name, verifyLink, organization.organizationCode || organization.private_code),
                text: getFacultyInviteEmailPlainText(user.name, organization.name, verifyLink, organization.organizationCode || organization.private_code),
            });

            await session.commitTransaction();
            session.endSession();
        } catch (emailError) {
            await session.abortTransaction();
            session.endSession();
            console.error("addFaculty Transaction Error:", emailError);
            return res.status(500).json({ message: "Failed to send invite email. Organization/faculty change reversed.", error: emailError.message });
        }

        // Audit log (fire-and-forget)
        logAdminAction(req, "add_faculty", "faculty", user._id, user.name);

        res.status(201).json({ message: "Faculty added successfully. Invitation sent.", faculty: user });
    } catch (err) {
        console.error("addFaculty Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE /api/org/remove-faculty/:id
export const removeFaculty = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const faculty = await User.findOne({
            _id: id,
            role: "faculty",
            organization_id: organization_id,
        });

        if (!faculty) {
            return res.status(404).json({ message: "Faculty not found in your organization" });
        }

        // Soft Delete Faculty from DB
        faculty.status = "deleted";
        // Assuming faculty logic handles checking status now; if isActive exists, set it
        if (faculty.isActive !== undefined) faculty.isActive = false;
        await faculty.save();

        // Audit log
        logAdminAction(req, "remove_faculty", "faculty", faculty._id, faculty.name);

        res.json({ message: "Faculty removed from organization successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// DELETE /api/org/remove-student/:id
export const removeStudent = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const student = await User.findOne({
            _id: id,
            role: "student",
            organization_id: organization_id,
        });

        if (!student) {
            return res.status(404).json({ message: "Student not found in your organization" });
        }

        // Soft Eviction: Remove from org, but DO NOT delete user account.
        // They should be able to join another org (or re-join) later.
        student.organization_id = null;
        // Keep them as 'student' role so they still have a basic student UI

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Also remove them from any classrooms in this organization
            await Classroom.updateMany(
                { organization_id: organization_id },
                { $pull: { students: student._id } },
                { session }
            );

            await student.save({ session });

            await session.commitTransaction();
            session.endSession();
        } catch (txnError) {
            await session.abortTransaction();
            session.endSession();
            throw txnError;
        }

        // Audit log
        logAdminAction(req, "remove_student", "student", student._id, student.name);

        res.json({ message: "Student successfully removed from the organization" });
    } catch (err) {
        console.error("removeStudent Error:", err);
        res.status(500).json({ message: "Server error removing student", error: err.message });
    }
};

// PUT /api/org/faculty/:id
export const updateFaculty = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { name } = req.body;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const faculty = await User.findOne({
            _id: id,
            organization_id: organization_id,
        });

        if (!faculty) {
            return res.status(404).json({ message: "Faculty not found in your organization" });
        }

        if (name && name.trim()) {
            faculty.name = name.trim();
        }

        await faculty.save();
        res.json({ message: "Faculty details updated successfully", faculty });
    } catch (err) {
        console.error("updateFaculty error:", err);
        res.status(500).json({ message: "Server error updating faculty", error: err.message });
    }
};

// PUT /api/org/faculty/:id/role
export const updateFacultyRole = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { role } = req.body;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const allowedRoles = ["faculty", "org_admin", "student"];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role specified." });
        }

        const targetUser = await User.findOne({
            _id: id,
            organization_id: organization_id,
        });

        if (!targetUser) {
            return res.status(404).json({ message: "User not found in your organization" });
        }

        // Rule: Prevent org_admin from demoting themselves
        if (req.user._id.toString() === targetUser._id.toString() && role !== "org_admin") {
            return res.status(403).json({ message: "You cannot demote yourself. Ask another Organization Admin or Super Admin." });
        }

        // Rule: Prevent removing the LAST org_admin
        if (targetUser.role === "org_admin" && role !== "org_admin") {
            const adminCount = await User.countDocuments({
                organization_id: organization_id,
                role: "org_admin"
            });
            if (adminCount <= 1) {
                return res.status(403).json({ message: "You cannot demote the last remaining Organization Admin." });
            }
        }

        const oldRole = targetUser.role;
        targetUser.role = role;
        await targetUser.save();

        // Audit log
        logAdminAction(req, "change_role", "user", targetUser._id, targetUser.name, { oldRole, newRole: role });

        res.json({ message: `Role successfully updated to ${role}`, user: targetUser });
    } catch (err) {
        console.error("updateFacultyRole error:", err);
        res.status(500).json({ message: "Server error updating role", error: err.message });
    }
};

// POST /api/org/reset-faculty-password
// Org admin sends a password reset email to a faculty member in their org
export const resetFacultyPassword = async (req, res) => {
    try {
        await connectDB();
        const { facultyId } = req.body;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }
        if (!facultyId) {
            return res.status(400).json({ message: "facultyId is required" });
        }

        // Confirm faculty belongs to this org
        const faculty = await User.findOne({
            _id: facultyId,
            organization_id: organization_id,
        });
        if (!faculty) {
            return res.status(404).json({ message: "Faculty not found in your organization" });
        }

        // Generate a reset token
        const crypto = (await import("crypto")).default;
        const token = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        faculty.resetPasswordToken = hashedToken;
        faculty.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
        await faculty.save();

        const { getPasswordResetEmailHtml, getPasswordResetEmailPlainText } = await import("../services/email-templates.service.js");
        const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");

        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        await sendEmail({
            to: faculty.email,
            subject: "Classgrid — Password Reset Requested by Your Admin",
            html: getPasswordResetEmailHtml(resetLink),
            text: getPasswordResetEmailPlainText(resetLink),
        });

        return res.json({ message: `Password reset email sent to ${faculty.email}` });
    } catch (err) {
        console.error("resetFacultyPassword error:", err);
        res.status(500).json({ message: "Server error sending reset email" });
    }
};


// GET /api/org/me
export const getOrganizationDetails = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.effectiveOrganizationId || req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const organization = await Organization.findById(organization_id);
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const facultyCount = await User.countDocuments({
            role: "faculty",
            organization_id: organization_id,
            is_demo: { $ne: true },
            isSandbox: { $ne: true },
            status: { $nin: ['deleted', 'suspended'] },
        });

        // Count students (users with org_id but not faculty/org_admin)
        const studentCount = await User.countDocuments({
            role: "student",
            organization_id: organization_id,
            isSandbox: { $ne: true },
        });

        const classroomCount = await Classroom.countDocuments({
            organization_id: organization_id,
        });

        const effectivePlan = getEffectivePlan(organization.plan, organization.planExpiresAt);

        res.json({
            organization,
            stats: {
                facultyCount,
                facultyLimit: getMaxFaculty(effectivePlan),
                studentCount,
                classroomCount,
                maxClassroomsPerFaculty: getMaxClassroomsPerFaculty(effectivePlan),
                maxStudentsPerClassroom: getMaxStudentsPerClassroom(effectivePlan),
                orgStudentLimit: getStudentLimit(effectivePlan),
                effectivePlan,
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/org/public-info — accessible by any authenticated user in this org
export const getOrgPublicInfo = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You are not connected to an organization" });
        }

        const organization = await Organization.findById(organization_id)
            .select("name address contactNumber website logo_url ownerName designation createdAt is_active status")
            .lean();
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Faculty list (names + profile pics only)
        const faculties = await User.find({
            role: "faculty",
            organization_id: organization_id,
            is_demo: { $ne: true },
            isSandbox: { $ne: true },
            status: { $nin: ['deleted', 'suspended'] },
        }).select("name profilePicture").lean();

        // Counts
        const studentCount = await User.countDocuments({
            role: "student",
            organization_id: organization_id,
            is_demo: { $ne: true },
            isSandbox: { $ne: true },
            status: { $nin: ['deleted', 'suspended'] },
        });
        const classroomCount = await Classroom.countDocuments({ organization_id });

        res.json({
            org: {
                name: organization.name,
                address: organization.address,
                phone: organization.contactNumber,
                website: organization.website,
                logo: organization.logo_url,
                adminName: organization.ownerName,
                adminDesignation: organization.designation,
                registeredAt: organization.createdAt,
                status: organization.status,
            },
            faculties: faculties.map(f => ({ name: f.name, avatar: f.profilePicture || null })),
            stats: {
                facultyCount: faculties.length,
                studentCount,
                classroomCount,
            },
            userJoinedAt: req.user.createdAt || null,
        });
    } catch (err) {
        console.error("getOrgPublicInfo error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// GET /api/org/faculties
export const getFaculties = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const faculties = await User.find({
            role: "faculty",
            organization_id: organization_id,
            is_demo: { $ne: true },
            isSandbox: { $ne: true },
            status: { $ne: "deleted" }
        }).select("-password");

        res.json(faculties);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/org/students
export const getStudents = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const students = await User.find({
            role: "student",
            organization_id: organization_id,
            is_demo: { $ne: true },
            isSandbox: { $ne: true },
            status: { $ne: "deleted" }
        }).select("-password -verificationToken -resetPasswordToken").lean();

        // Enrich with classroom names from ClassroomMembership
        const enriched = await Promise.all(students.map(async (s) => {
            const memberships = await ClassroomMembership.find({
                student: s._id,
                status: "approved"
            }).populate("classroom", "name").lean();

            const classroomNames = memberships
                .map(m => m.classroom?.name)
                .filter(Boolean);

            return {
                ...s,
                classroomName: classroomNames.length > 0 ? classroomNames.join(", ") : "—",
                classroomCount: classroomNames.length,
            };
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/org/classrooms
export const getClassrooms = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        // Fetch classrooms with teacher details
        const classrooms = await Classroom.find({
            organization_id: organization_id,
        }).populate("teacher", "name email").lean();

        // Dynamically calculate actual student count via ClassroomMembership
        const enriched = await Promise.all(classrooms.map(async (c) => {
            const studentCount = await ClassroomMembership.countDocuments({
                classroom: c._id,
                status: "approved"
            });

            return {
                ...c,
                facultyName: c.teacher?.name || "Unknown",
                studentCount,
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error("getClassrooms error:", err);
        res.status(500).json({ message: "Server error fetching classrooms", error: err.message });
    }
};

// PUT /api/org/logo — Org admin updates their organization logo
export const updateOrgLogo = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const { logo_base64 } = req.body;
        if (!logo_base64) {
            return res.status(400).json({ message: "logo_base64 is required" });
        }

        // Validate size (100 MB limit)
        if (logo_base64.length > 137000000) {
            return res.status(400).json({ message: "Logo file exceeds 100 MB limit." });
        }

        const match = logo_base64.match(/^data:image\/(png|jpeg|webp|jpg);base64,/);
        if (!match) {
            return res.status(400).json({ message: "Invalid image type. Only PNG, JPEG, and WEBP are allowed." });
        }

        const ext = match[1] === "jpg" ? "jpeg" : match[1];
        const base64Data = logo_base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const filename = `org_${organization_id}_${Date.now()}.${ext}`;
        
        const { publicUrl } = await s3Storage.uploadFile(`logos/${filename}`, buffer, `image/${ext}`);

        await Organization.findByIdAndUpdate(organization_id, { logo_url: publicUrl });

        return res.json({ message: "Logo updated successfully", logo_url: publicUrl });
    } catch (err) {
        console.error("updateOrgLogo error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/all-organizations (super_admin only)
export const getAllOrganizations = async (req, res) => {
    try {
        await connectDB();
        const orgs = await Organization.find({})
            .select("-organizationCode -honorCode -private_code") // 🔒 Codes are NEVER exposed to Super Admin
            .populate("owner_id", "name email")
            .lean();

        const enriched = await Promise.all(orgs.map(async (org) => {
            const facultyCount = await User.countDocuments({ role: "faculty", organization_id: org._id, is_demo: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });
            const studentCount = await User.countDocuments({ organization_id: org._id, role: "student", is_demo: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });
            return { ...org, facultyCount, studentCount };
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/org/analytics
export const getOrganizationAnalytics = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization" });
        }

        const { default: ActivityLog } = await import("../models/ActivityLog.js");

        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(now.getDate() - 3);

        // ── 1. ROLE BREAKDOWN ──
        const facultyCount = await User.countDocuments({ role: "faculty", organization_id, is_demo: { $ne: true }, isSandbox: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });
        const studentCount = await User.countDocuments({ role: "student", organization_id, is_demo: { $ne: true }, isSandbox: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });
        const classroomCount = await Classroom.countDocuments({ organization_id });

        // ── 2. WEEKLY GROWTH ──
        const studentsThisWeek = await User.countDocuments({ role: "student", organization_id, createdAt: { $gte: sevenDaysAgo }, is_demo: { $ne: true }, isSandbox: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });
        const facultyThisWeek = await User.countDocuments({ role: "faculty", organization_id, createdAt: { $gte: sevenDaysAgo }, is_demo: { $ne: true }, isSandbox: { $ne: true }, status: { $nin: ['deleted', 'suspended'] } });

        // ── 3. ORG CLASSROOMS ──
        const orgClassrooms = await Classroom.find({ organization_id }).select('_id name').lean();
        const orgClassroomIds = orgClassrooms.map(c => c._id);
        const classroomNameMap = {};
        orgClassrooms.forEach(c => { classroomNameMap[c._id.toString()] = c.name; });

        // ── 4. WAU ──
        const wauResult = await ActivityLog.aggregate([
            { $match: { classroom: { $in: orgClassroomIds }, timestamp: { $gte: sevenDaysAgo } } },
            { $group: { _id: "$user" } },
            { $count: "total" }
        ]);
        const weeklyActiveUsers = wauResult.length > 0 ? wauResult[0].total : 0;

        // ── 5. ACTIVE CLASSROOMS ──
        const activeClassroomResult = await ActivityLog.aggregate([
            { $match: { classroom: { $in: orgClassroomIds }, timestamp: { $gte: sevenDaysAgo } } },
            { $group: { _id: "$classroom" } },
            { $count: "total" }
        ]);
        const activeClassrooms = activeClassroomResult.length > 0 ? activeClassroomResult[0].total : 0;

        // ── 6. CONTENT STATS (Supabase) ──
        let approvedNotesCount = 0, pendingNotesCount = 0;
        try {
            const { count: ac, error: ae } = await studentNotesClient.from('student_notes').select('*', { count: 'exact', head: true }).eq('organization_id', organization_id.toString()).eq('status', 'approved');
            if (!ae) approvedNotesCount = ac || 0;
            const { count: pc, error: pe } = await studentNotesClient.from('student_notes').select('*', { count: 'exact', head: true }).eq('organization_id', organization_id.toString()).eq('status', 'pending');
            if (!pe) pendingNotesCount = pc || 0;
        } catch (e) { console.error("Supabase count error:", e); }
        const totalNotesCount = approvedNotesCount + pendingNotesCount;

        // ── 7. ACTIVITY TREND (Last 7 Days) ──
        const activityData = await ActivityLog.aggregate([
            { $match: { classroom: { $in: orgClassroomIds }, timestamp: { $gte: sevenDaysAgo } } },
            { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "Asia/Kolkata" } }, action: "$action" }, count: { $sum: 1 } } },
            { $sort: { "_id.date": 1 } }
        ]);

        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            trendMap[dateStr] = { date: dateStr, note_upload: 0, note_approved: 0, join_classroom: 0, login: 0, announcement_created: 0, view_material: 0, send_message: 0, total: 0 };
        }
        activityData.forEach(item => {
            const ds = item._id.date, act = item._id.action, cnt = item.count;
            if (trendMap[ds]) {
                if (trendMap[ds].hasOwnProperty(act)) trendMap[ds][act] += cnt;
                trendMap[ds].total += cnt;
            }
        });
        const activityTrend = Object.values(trendMap);

        // ── 8. MOST ACTIVE DAY ──
        let mostActiveDay = { day: "N/A", count: 0 };
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        activityTrend.forEach(d => {
            if (d.total > mostActiveDay.count) {
                const dateObj = new Date(d.date + 'T00:00:00+05:30');
                mostActiveDay = { day: dayNames[dateObj.getDay()], date: d.date, count: d.total };
            }
        });

        // ── 9. MOST ACTIVE CLASSROOM ──
        let mostActiveClassroom = { name: "N/A", count: 0 };
        if (orgClassroomIds.length > 0) {
            const topClassroom = await ActivityLog.aggregate([
                { $match: { classroom: { $in: orgClassroomIds }, timestamp: { $gte: sevenDaysAgo } } },
                { $group: { _id: "$classroom", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]);
            if (topClassroom.length > 0) {
                mostActiveClassroom = { name: classroomNameMap[topClassroom[0]._id.toString()] || "Unknown", count: topClassroom[0].count };
            }
        }

        // ── 10. ENGAGEMENT ──
        const avgNotesPerStudent = studentCount > 0 ? Math.round((approvedNotesCount / studentCount) * 100) / 100 : 0;
        const totalPossibleUsers = facultyCount + studentCount;
        const engagementScore = totalPossibleUsers > 0 ? Math.min(100, Math.round((weeklyActiveUsers / totalPossibleUsers) * 100)) : 0;

        // ── 11. PLAN UTILIZATION ──
        const org = await Organization.findById(organization_id).lean();
        const effectivePlan = getEffectivePlan(org?.plan, org?.planExpiresAt);
        const maxFacultyLimit = getMaxFaculty(effectivePlan);
        const maxClassroomsLimit = getMaxClassroomsPerFaculty(effectivePlan) * maxFacultyLimit;
        const maxStudentsLimit = getMaxStudentsPerClassroom(effectivePlan);

        // ── 12. SMART ALERTS ──
        const alerts = [];
        const recentActivity = await ActivityLog.countDocuments({ classroom: { $in: orgClassroomIds }, timestamp: { $gte: threeDaysAgo } });
        if (recentActivity === 0 && totalPossibleUsers > 0) alerts.push({ type: "warning", icon: "fa-exclamation-triangle", message: "No activity in the last 3 days", color: "var(--amber)" });
        const thisWeekNotes = activityTrend.reduce((s, d) => s + (d.note_upload || 0), 0);
        if (thisWeekNotes === 0 && studentCount > 0) alerts.push({ type: "info", icon: "fa-file-alt", message: "No notes uploaded this week", color: "var(--blue)" });
        if (engagementScore < 30 && totalPossibleUsers > 2) alerts.push({ type: "danger", icon: "fa-chart-line", message: `Engagement is low at ${engagementScore}%`, color: "var(--red)" });
        if (pendingNotesCount > 0) alerts.push({ type: "info", icon: "fa-clock", message: `${pendingNotesCount} note${pendingNotesCount > 1 ? 's' : ''} awaiting review`, color: "var(--amber)" });

        res.json({
            kpis: {
                students: { total: studentCount, thisWeek: studentsThisWeek },
                faculty: { total: facultyCount, thisWeek: facultyThisWeek },
                activeClassrooms: { total: activeClassrooms, outOf: classroomCount },
                wau: { total: weeklyActiveUsers, outOf: totalPossibleUsers },
            },
            roleBreakdown: { faculty: facultyCount, students: studentCount, classrooms: classroomCount },
            contentStats: { approvedNotes: approvedNotesCount, pendingNotes: pendingNotesCount, totalNotes: totalNotesCount },
            activityTrend,
            engagement: { score: engagementScore, avgNotesPerStudent },
            insights: { mostActiveDay, mostActiveClassroom },
            planUtilization: {
                plan: effectivePlan,
                faculty: { used: facultyCount, limit: maxFacultyLimit },
                classrooms: { used: classroomCount, limit: maxClassroomsLimit },
                studentsPerClassroom: { limit: maxStudentsLimit },
            },
            alerts,
        });

    } catch (err) {
        console.error("getOrganizationAnalytics error:", err);
        res.status(500).json({ message: "Server error fetching analytics" });
    }
};

// GET /api/admin/all-users (super_admin only)
export const getAttendanceAnalytics = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: "You do not belong to an organization" });

        const { default: AttendanceSession } = await import("../models/AttendanceSession.js");
        const { default: AttendanceRecord } = await import("../models/AttendanceRecord.js");

        const orgClassrooms = await Classroom.find({ organization_id }).select('_id name').lean();
        const filterClassroomId = req.query.classroom;
        let targetClassrooms = orgClassrooms;
        if (filterClassroomId) targetClassrooms = orgClassrooms.filter(c => c._id.toString() === filterClassroomId);
        const targetIds = targetClassrooms.map(c => c._id);

        // Per-classroom attendance stats
        const classroomStats = await Promise.all(targetClassrooms.map(async (cls) => {
            const totalSessions = await AttendanceSession.countDocuments({ classroom: cls._id });
            const totalPresent = await AttendanceRecord.countDocuments({ classroom: cls._id });
            const memberCount = await ClassroomMembership.countDocuments({ classroom: cls._id, status: 'approved' });
            const expectedTotal = totalSessions * memberCount;
            const attendanceRate = expectedTotal > 0 ? Math.round((totalPresent / expectedTotal) * 100) : 0;
            return { classroomId: cls._id, name: cls.name, totalSessions, totalPresent, memberCount, attendanceRate };
        }));

        // Daily chart (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyData = await AttendanceSession.aggregate([
            { $match: { classroom: { $in: targetIds }, createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } }, sessions: { $sum: 1 }, totalPresent: { $sum: "$presentCount" } } },
            { $sort: { _id: 1 } }
        ]);

        const dailyChart = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            const found = dailyData.find(dd => dd._id === dateStr);
            dailyChart.push({ date: dateStr, sessions: found?.sessions || 0, present: found?.totalPresent || 0 });
        }

        const totalSessions = classroomStats.reduce((s, c) => s + c.totalSessions, 0);
        const totalPresent = classroomStats.reduce((s, c) => s + c.totalPresent, 0);
        const totalExpected = classroomStats.reduce((s, c) => s + (c.totalSessions * c.memberCount), 0);
        const overallRate = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

        const lowAttendance = classroomStats.filter(c => c.totalSessions > 0 && c.attendanceRate < 60);

        res.json({
            classrooms: orgClassrooms.map(c => ({ _id: c._id, name: c.name })),
            selectedClassroom: filterClassroomId || 'all',
            overall: { totalSessions, totalPresent, totalExpected, attendanceRate: overallRate },
            classroomStats,
            dailyChart,
            lowAttendanceAlerts: lowAttendance,
        });
    } catch (err) {
        console.error("getAttendanceAnalytics error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// GET /api/admin/all-users (super_admin only)
export const getAllUsers = async (req, res) => {
    try {
        await connectDB();
        const { role, org } = req.query;
        const filter = { is_demo: { $ne: true } };
        if (role) filter.role = role;
        if (org) filter.organization_id = org;

        const users = await User.find(filter)
            .select("-password -verificationToken -resetPasswordToken")
            .populate("organization_id", "name")
            .lean();

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// POST /api/organization/validate
// Validates an org code, links the user to the org, returns org info
export const validateOrganization = async (req, res) => {
    try {
        await connectDB();
        const { organizationCode } = req.body;

        if (!organizationCode || typeof organizationCode !== "string") {
            return res.status(400).json({ message: "Organization code is required" });
        }

        const code = organizationCode.trim().toUpperCase();

        // Find active organization by private code (legacy) OR organizationCode
        const org = await Organization.findOne({
            $or: [
                { private_code: code },
                { organizationCode: code },
            ],
            is_active: true,
        }).lean();

        if (!org) {
            return res.status(404).json({ message: "Invalid organization code. Please check and try again." });
        }

        // ── STRICT SINGLE-ORG ENFORCEMENT ──────────────────────────
        if (req.user.organization_id) {
            const currentOrgId = req.user.organization_id.toString();
            const newOrgId = org._id.toString();

            if (currentOrgId === newOrgId) {
                // Same org — idempotent, just return the data
                return res.json({
                    message: "Already connected to this organization.",
                    organizationId: org._id,
                    organizationName: org.name,
                    organizationLogo: org.logo_url || "",
                });
            }

            // Different org — reject, no switching in V1
            const currentOrg = await Organization.findById(req.user.organization_id).select("name").lean();
            return res.status(409).json({
                message: `You are already connected to "${currentOrg?.name || "another organization"}". Organization switching is not supported. Contact support to change your organization.`,
                code: "ORG_CONFLICT",
                currentOrganizationName: currentOrg?.name || ""
            });
        }

        // User has no org — link them
        await User.findByIdAndUpdate(req.user._id, {
            organization_id: org._id,
        });

        return res.json({
            message: "Organization connected successfully!",
            organizationId: org._id,
            organizationName: org.name,
            organizationLogo: org.logo_url || "",
        });
    } catch (err) {
        console.error("validateOrganization error:", err);
        res.status(500).json({ message: "Server error validating organization code" });
    }
};

// POST /api/org/verify-code
// Dual code verifier: faculty uses organizationCode, students use honorCode
// This is the NEW production-grade endpoint replacing the legacy validate flow.
export const verifyOrgCode = async (req, res) => {
    try {
        await connectDB();
        const { code, type } = req.body;

        if (!code || !type) {
            return res.status(400).json({ message: "Both 'code' and 'type' are required" });
        }

        if (!['faculty', 'student'].includes(type)) {
            return res.status(400).json({ message: "'type' must be 'faculty' or 'student'" });
        }

        // Clean the code string: remove ALL whitespaces, hidden characters, hyphens, etc.
        const normalizedCode = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // ── SECURITY: One org per user ───────────────────────────────
        if (req.user.organization_id) {
            const currentOrg = await Organization.findById(req.user.organization_id).select("name").lean();
            return res.status(409).json({
                message: `You are already part of "${currentOrg?.name || 'an organization'}". Switching organizations is not supported.`,
                code: "ORG_CONFLICT"
            });
        }

        // ── FIND ORG BY CODE TYPE ────────────────────────────────────
        let org;
        if (type === 'faculty') {
            // Faculty must use organizationCode (or legacy private_code)
            org = await Organization.findOne({
                $or: [
                    { organizationCode: normalizedCode },
                    { private_code: normalizedCode },  // legacy fallback
                ],
            }).lean();

            // Security: prevent students from accidentally using honor code as org code
            if (!org) {
                // Check if this code is actually a honorCode — if so, return 403
                const honorOrg = await Organization.findOne({ honorCode: normalizedCode }).lean();
                if (honorOrg) {
                    return res.status(403).json({
                        message: "This is a Student Honor Code. Faculty must use the Organization Code.",
                        code: "WRONG_CODE_TYPE"
                    });
                }
                return res.status(404).json({ message: "Invalid Organization Code. Please check and try again." });
            }

        } else {
            // Students must use honorCode ONLY
            console.log(`[DEBUG] Finding honorCode: ${normalizedCode}`);
            org = await Organization.findOne({ honorCode: normalizedCode }).lean();
            console.log(`[DEBUG] org result:`, org);

            if (!org) {
                // Security: prevent students from using org code
                const orgCodeOrg = await Organization.findOne({
                    $or: [
                        { organizationCode: normalizedCode },
                        { private_code: normalizedCode },
                    ]
                }).lean();
                if (orgCodeOrg) {
                    return res.status(403).json({
                        message: "This is a Faculty Organization Code. Students must use the Honor Code.",
                        code: "WRONG_CODE_TYPE"
                    });
                }
                return res.status(404).json({ message: `Invalid Honor Code (${normalizedCode}). Please ensure you copied it exactly from your dashboard/email and try again.` });
            }
        }

        // ── ASSIGN ROLE + ORG ────────────────────────────────────────
        if (type === 'faculty') {
            const facultyCount = await User.countDocuments({
                role: "faculty",
                organization_id: org._id,
                is_demo: { $ne: true },
            });
            const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
            const maxFaculty = getMaxFaculty(effectivePlan);
            if (facultyCount >= maxFaculty) {
                return res.status(403).json({
                    message: `Organization faculty limit reached (${maxFaculty} on ${effectivePlan} plan). Contact your administrator.`,
                    code: 'PLAN_LIMIT_REACHED',
                });
            }
        }

        const updateData = {
            organization_id: org._id,
        };

        if (type === 'faculty') {
            updateData.role = 'faculty';
            // SECURITY FIX: Password was set before this step, do NOT force reset again.
        } else {
            updateData.role = 'student';
        }

        const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, { returnDocument: "after" });

        return res.json({
            message: type === 'faculty'
                ? "Faculty joined organization successfully!"
                : "You have successfully joined the organization!",
            organizationId: org._id,
            organizationName: org.name,
            organizationLogo: org.logo_url || "",
            userRole: updatedUser.role,
            mustResetPassword: updatedUser.mustResetPassword || false,
        });
    } catch (err) {
        console.error("verifyOrgCode error:", err);
        res.status(500).json({ message: "Server error verifying code" });
    }
};

// ─────────────────────────────────────────────────────────
// ORG ADMIN → REQUEST ORGANISATION DELETION (Email Verification)
// ─────────────────────────────────────────────────────────
export const requestDeleteOrganization = async (req, res) => {
    try {
        await connectDB();
        const user = req.user;

        if (!user || (user.role !== "org_admin" && user.role !== "super_admin")) {
            return res.status(403).json({ message: "Only organisation admins can request deletion." });
        }

        // Find the org this admin owns
        const org = await Organization.findOne({ owner_id: user._id });
        if (!org) {
            return res.status(404).json({ message: "No organisation found for your account." });
        }

        // Generate secure random token
        const crypto = (await import("crypto")).default;
        const rawToken = crypto.randomBytes(48).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        // Store hashed token in DB
        const { OrgDeleteToken } = await import("../services/org-delete.service.js");

        // Remove any old tokens for this org
        await OrgDeleteToken.deleteMany({ organizationId: org._id });

        await OrgDeleteToken.create({
            organizationId: org._id,
            tokenHash,
            requestedBy: user._id,
        });

        // Build verification link
        const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
        const verifyLink = `${frontendUrl}/api/organization/verify-delete?token=${rawToken}`;

        // Send verification email
        const { getOrgDeleteVerificationEmailHtml, getOrgDeleteVerificationEmailPlainText } = await import("../services/email-templates.service.js");
        await sendEmail({
            to: user.email,
            subject: `⚠️ Confirm Deletion of ${org.name} — Classgrid`,
            html: getOrgDeleteVerificationEmailHtml(org.name, user.name, verifyLink),
            text: getOrgDeleteVerificationEmailPlainText(org.name, user.name, verifyLink),
        });

        console.log(`🔐 Org delete verification sent to ${user.email} for org "${org.name}"`);

        res.json({
            message: "Verification email sent. Please check your email to confirm deletion.",
            email: user.email,
        });
    } catch (err) {
        console.error("requestDeleteOrganization error:", err);
        res.status(500).json({ message: "Server error requesting deletion", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────
// VERIFY & EXECUTE ORGANISATION DELETION (Token from Email)
// ─────────────────────────────────────────────────────────
export const verifyDeleteOrganization = async (req, res) => {
    try {
        await connectDB();
        const { token } = req.query;

        if (!token) {
            return res.status(400).send(renderDeleteResultPage("Invalid Request", "No verification token provided.", false));
        }

        const crypto = (await import("crypto")).default;
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const { OrgDeleteToken, hardDeleteOrganization } = await import("../services/org-delete.service.js");

        // Find the token (TTL auto-deletes expired ones)
        const deleteToken = await OrgDeleteToken.findOne({ tokenHash });
        if (!deleteToken) {
            return res.status(400).send(renderDeleteResultPage(
                "Link Expired or Invalid",
                "This deletion link has expired, already been used, or is invalid. Please request a new one from your dashboard.",
                false
            ));
        }

        const orgId = deleteToken.organizationId;
        const org = await Organization.findById(orgId);
        const orgName = org ? org.name : "Unknown Organisation";

        // Delete the token FIRST (single-use)
        await OrgDeleteToken.findByIdAndDelete(deleteToken._id);

        // Execute hard delete
        const result = await hardDeleteOrganization(orgId);

        console.log(`🗑️ Organisation "${result.orgName}" permanently deleted via email verification.`);

        return res.send(renderDeleteResultPage(
            "Organisation Deleted",
            `Your organisation <strong>"${result.orgName}"</strong> and all associated data have been permanently deleted.<br><br>
             <strong>${result.deletedClassrooms}</strong> classrooms and <strong>${result.deletedUsers}</strong> user accounts were removed.<br><br>
             You will be redirected to the homepage.`,
            true
        ));

    } catch (err) {
        console.error("verifyDeleteOrganization error:", err);
        return res.status(500).send(renderDeleteResultPage(
            "Deletion Failed",
            "An error occurred during deletion. Please contact support at support@classgrid.in.",
            false
        ));
    }
};

// Simple HTML page for delete result
function renderDeleteResultPage(title, message, success) {
    const color = success ? "#10b981" : "#ef4444";
    const icon = success ? "✅" : "❌";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Classgrid</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #161b22; border: 1px solid ${color}33; border-radius: 16px; padding: 48px; max-width: 520px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,.4); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 16px; color: ${color}; }
    p { color: #94a3b8; line-height: 1.7; font-size: 15px; }
    .btn { display: inline-block; margin-top: 28px; padding: 14px 32px; background: ${color}; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; }
  </style>
  ${success ? '<meta http-equiv="refresh" content="8;url=/index.html">' : ''}
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${success ? '/index.html' : '/login.html'}" class="btn">${success ? 'Go to Homepage' : 'Back to Login'}</a>
  </div>
</body>
</html>`;
}



// ─────────────────────────────────────────────────────────
// SMART ORGANIZATION ANNOUNCEMENTS API
// ─────────────────────────────────────────────────────────
const checkAnnouncementPlanLimits = async (organization_id, target_type, target_classrooms) => {
    const org = await Organization.findById(organization_id);
    const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);

    if (effectivePlan === 'FREE') {
        if (target_type === 'all') throw new Error('PLAN_LIMIT_REACHED: Send to All is a Pro feature.');
        if (target_classrooms && target_classrooms.length > 5) throw new Error('PLAN_LIMIT_REACHED: Free plan is limited to maximum 5 target classrooms per announcement.');
    } else if (effectivePlan === 'PLUS') {
        if (target_type === 'all') throw new Error('PLAN_LIMIT_REACHED: Send to All is a Pro feature.');
        if (target_classrooms && target_classrooms.length > 10) throw new Error('PLAN_LIMIT_REACHED: Plus plan is limited to maximum 10 target classrooms per announcement.');
    }
    return effectivePlan;
};

// Helper: upload an announcement attachment to Supabase Storage
async function uploadAnnouncementAttachment(base64, originalName, orgId) {
    // Detect MIME from data URI or infer from filename
    const dataUriMatch = base64.match(/^data:([^;]+);base64,/);
    const mimeType = dataUriMatch ? dataUriMatch[1] : 'application/octet-stream';
    const rawData = dataUriMatch ? base64.replace(/^data:[^;]+;base64,/, '') : base64;
    const buffer = Buffer.from(rawData, 'base64');

    // 100 MB limit
    if (buffer.length > 100 * 1024 * 1024) {
        throw new Error('Attachment exceeds 100 MB limit.');
    }

    // Determine extension from MIME
    const extMap = {
        'application/pdf': 'pdf',
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    const ext = extMap[mimeType] || originalName?.split('.').pop() || 'bin';
    const filename = `ann_${orgId}_${Date.now()}.${ext}`;

    const { publicUrl } = await s3Storage.uploadFile(`org-attachments/${filename}`, buffer, mimeType);

    // Determine simple file type category
    let fileType = 'file';
    if (mimeType.startsWith('image/')) fileType = 'image';
    else if (mimeType === 'application/pdf') fileType = 'pdf';
    else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) fileType = 'ppt';

    return { url: publicUrl, name: originalName || filename, type: fileType };
}

export const createOrganizationAnnouncement = async (req, res) => {
    try {
        await connectDB();
        const { title, content, type, target_type, target_classrooms, status, expires_at, attachment_base64, attachment_name } = req.body;
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization' });

        try {
            const effectivePlan = await checkAnnouncementPlanLimits(organization_id, target_type, target_classrooms);
            if (status === 'scheduled' && effectivePlan === 'FREE') return res.status(403).json({ message: 'Scheduling announcements is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

            // Handle optional attachment upload
            let attachmentFields = {};
            if (attachment_base64) {
                try {
                    const att = await uploadAnnouncementAttachment(attachment_base64, attachment_name, organization_id);
                    attachmentFields = { attachment_url: att.url, attachment_name: att.name, attachment_type: att.type };
                } catch (attErr) {
                    return res.status(400).json({ message: attErr.message || 'Failed to upload attachment.' });
                }
            }

            const announcementData = {
                title,
                content,
                type: type || 'announcement',
                organization_id: organization_id.toString(),
                created_by: req.user._id.toString(),
                creator_name: req.user.name || '',
                target_type: target_type || 'specific',
                target_classrooms: (target_type === 'specific' && target_classrooms) ? target_classrooms.map(String) : [],
                plan_snapshot: effectivePlan,
                status: status || 'published',
                expires_at: expires_at || null,
                sent_at: (status === 'published' || !status) ? new Date().toISOString() : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...attachmentFields,
            };

            const { data: announcement, error } = await studentNotesClient
                .from('org_announcements')
                .insert([announcementData])
                .select()
                .single();

            if (error) throw error;

            const { default: ActivityLog } = await import('../models/ActivityLog.js');
            ActivityLog.create({
                user: req.user._id,
                action: 'announcement_created',
                targetType: 'org_announcement',
                targetId: announcement.id,
                classroom: target_classrooms?.[0] || organization_id,
                timestamp: new Date(),
            }).catch(e => console.error('Failed to log activity:', e));

            logAdminAction(req, 'create_announcement', 'announcement', announcement.id, title);

            res.status(201).json({ message: 'Announcement created successfully', announcement });
        } catch (limitErr) {
            if (limitErr.message && limitErr.message.startsWith('PLAN_LIMIT_REACHED')) {
                return res.status(403).json({ message: limitErr.message.replace('PLAN_LIMIT_REACHED: ', ''), code: 'PLAN_LIMIT_REACHED' });
            }
            throw limitErr;
        }
    } catch (err) {
        console.error('createOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const getOrganizationAnnouncements = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        let query = studentNotesClient
            .from('org_announcements')
            .select('*', { count: 'exact' })
            .eq('organization_id', organization_id.toString())
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Non-admins only see published, non-expired announcements
        if (req.user.role !== 'org_admin' && req.user.role !== 'super_admin') {
            query = query.eq('status', 'published');
            query = query.or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`);
        }

        const { data: announcements, error, count } = await query;

        if (error) throw error;

        // Enrich with creator info from MongoDB (best effort)
        const creatorIds = [...new Set(announcements.map(a => a.created_by).filter(Boolean))];
        let creatorMap = {};
        if (creatorIds.length > 0) {
            try {
                const creators = await User.find({ _id: { $in: creatorIds } }).select('name email').lean();
                creators.forEach(c => { creatorMap[c._id.toString()] = { name: c.name, email: c.email }; });
            } catch (e) { /* ignore */ }
        }

        // Enrich with classroom names (best effort)
        const allClassroomIds = [...new Set(announcements.flatMap(a => a.target_classrooms || []).filter(Boolean))];
        let classroomMap = {};
        if (allClassroomIds.length > 0) {
            try {
                const classrooms = await Classroom.find({ _id: { $in: allClassroomIds } }).select('name subject').lean();
                classrooms.forEach(c => { classroomMap[c._id.toString()] = { name: c.name, subject: c.subject }; });
            } catch (e) { /* ignore */ }
        }

        const enriched = announcements.map(a => ({
            ...a,
            _id: a.id, // Compatibility with frontend expecting _id
            created_by: creatorMap[a.created_by] ? { _id: a.created_by, ...creatorMap[a.created_by] } : { _id: a.created_by, name: a.creator_name || 'Admin' },
            target_classrooms: (a.target_classrooms || []).map(cid => classroomMap[cid] ? { _id: cid, ...classroomMap[cid] } : { _id: cid }),
            createdAt: a.created_at, // Compatibility
            updatedAt: a.updated_at,
        }));

        const total = count || 0;
        res.json({ announcements: enriched, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
        console.error('getOrganizationAnnouncements error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const updateOrganizationAnnouncement = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { title, content, type, target_type, target_classrooms, status, expires_at, attachment_base64, attachment_name, remove_attachment } = req.body;
        const organization_id = req.user.organization_id;

        // Fetch existing announcement
        const { data: existing, error: fetchErr } = await studentNotesClient
            .from('org_announcements')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organization_id.toString())
            .single();

        if (fetchErr || !existing) return res.status(404).json({ message: 'Announcement not found' });

        if (existing.status === 'published' && status === 'draft') return res.status(400).json({ message: 'Cannot revert a published announcement to draft.' });

        try {
            const effectivePlan = await checkAnnouncementPlanLimits(organization_id, target_type || existing.target_type, target_classrooms || existing.target_classrooms);
            if (status === 'scheduled' && effectivePlan === 'FREE') return res.status(403).json({ message: 'Scheduling announcements is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

            const updates = { updated_at: new Date().toISOString() };
            if (title) updates.title = title;
            if (content) updates.content = content;
            if (type) updates.type = type;
            if (expires_at !== undefined) updates.expires_at = expires_at;
            if (target_type) {
                updates.target_type = target_type;
                updates.target_classrooms = target_type === 'specific' ? (target_classrooms || []).map(String) : [];
            }
            if (status === 'published' && existing.status !== 'published') {
                updates.status = 'published';
                updates.sent_at = new Date().toISOString();
            } else if (status) {
                updates.status = status;
            }

            // Handle attachment: new upload, removal, or keep existing
            if (remove_attachment) {
                updates.attachment_url = null;
                updates.attachment_name = null;
                updates.attachment_type = null;
            } else if (attachment_base64) {
                try {
                    const att = await uploadAnnouncementAttachment(attachment_base64, attachment_name, organization_id);
                    updates.attachment_url = att.url;
                    updates.attachment_name = att.name;
                    updates.attachment_type = att.type;
                } catch (attErr) {
                    return res.status(400).json({ message: attErr.message || 'Failed to upload attachment.' });
                }
            }

            const { data: announcement, error: updateErr } = await studentNotesClient
                .from('org_announcements')
                .update(updates)
                .eq('id', id)
                .eq('organization_id', organization_id.toString())
                .select()
                .single();

            if (updateErr) throw updateErr;

            res.json({ message: 'Announcement updated successfully', announcement: { ...announcement, _id: announcement.id } });
        } catch (limitErr) {
            return res.status(403).json({ message: limitErr.message.replace('PLAN_LIMIT_REACHED: ', ''), code: 'PLAN_LIMIT_REACHED' });
        }
    } catch (err) {
        console.error('updateOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const deleteOrganizationAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        const { error, count } = await studentNotesClient
            .from('org_announcements')
            .delete({ count: 'exact' })
            .eq('id', id)
            .eq('organization_id', organization_id.toString());

        if (error) throw error;
        if (count === 0) return res.status(404).json({ message: 'Announcement not found' });

        logAdminAction(req, 'delete_announcement', 'announcement', id, id);

        res.json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        console.error('deleteOrganizationAnnouncement error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

export const getOrganizationAnnouncementStats = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        const org = await Organization.findById(organization_id);
        const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);

        if (effectivePlan === 'FREE') return res.status(403).json({ message: 'Announcement Delivery Analytics is a Pro feature.', code: 'PLAN_LIMIT_REACHED' });

        const { data: announcement, error } = await studentNotesClient
            .from('org_announcements')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organization_id.toString())
            .single();

        if (error || !announcement) return res.status(404).json({ message: 'Announcement not found' });

        let targetSize = 0;
        if (announcement.target_type === 'all') {
            targetSize = await User.countDocuments({ organization_id });
        } else {
            const classrooms = await Classroom.find({ _id: { $in: announcement.target_classrooms || [] } });
            targetSize = classrooms.reduce((acc, c) => acc + (c.students ? c.students.length : 0) + 1, 0);
        }

        res.json({
            stats: {
                views: announcement.views_count || 0,
                targetAudienceSize: targetSize,
                reachPercentage: targetSize > 0 ? Math.min(100, Math.round(((announcement.views_count || 0) / targetSize) * 100)) : 0,
            }
        });
    } catch (err) {
        console.error('getOrganizationAnnouncementStats error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ─────────────────────────────────────────────
// POST /api/org/change-password
// Org Admin — change their own account password in-dashboard
// ─────────────────────────────────────────────
export const changeOrgAdminPassword = async (req, res) => {
    try {
        await connectDB();
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different from the current password.' });
        }

        const bcrypt = (await import('bcryptjs')).default;

        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Org admins who signed in via Google won't have a password
        if (!user.password) {
            return res.status(400).json({ message: 'Password change is not available for accounts signed in via Google/Social login.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        user.password = hashed;
        user.mustResetPassword = false;
        await user.save();

        res.json({ message: '✅ Password changed successfully.' });
    } catch (err) {
        console.error('changeOrgAdminPassword error:', err);
        res.status(500).json({ message: 'Server error changing password.' });
    }
};

// ─────────────────────────────────────────────
// POST /api/org/archive-classroom/:id
// Org Admin — archive (or un-archive) any classroom within their org
// ─────────────────────────────────────────────
export const archiveClassroomByAdmin = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: 'You do not belong to an organization.' });
        }

        const classroom = await Classroom.findOne({
            _id: id,
            organization_id: organization_id,
        });

        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found in your organization.' });
        }

        const newArchivedState = !classroom.settings.isArchived;
        classroom.settings.isArchived = newArchivedState;
        await classroom.save();

        // Audit log
        logAdminAction(req, newArchivedState ? 'archive_classroom' : 'restore_classroom', 'classroom', classroom._id, classroom.name);

        res.json({
            message: newArchivedState
                ? '✅ Classroom archived. Students can no longer join it.'
                : '✅ Classroom un-archived and is now active.',
            isArchived: newArchivedState,
        });
    } catch (err) {
        console.error('archiveClassroomByAdmin error:', err);
        res.status(500).json({ message: 'Server error archiving classroom.' });
    }
};

// ─────────────────────────────────────────────
// In-memory performance cache (5 min TTL)
// ─────────────────────────────────────────────
const _perfCache = new Map(); // key: orgId → { data, expireAt }

// ─────────────────────────────────────────────
// GET /api/org/student-performance
// Org Admin — Top 10 students ranked by composite score
// Score = quiz(0.40) + attendance(0.30) + notes(0.20) + activity(0.10)
// Cached 5 minutes per org
// ─────────────────────────────────────────────
export const getStudentPerformance = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization.' });

        const cacheKey = organization_id.toString();
        const cached = _perfCache.get(cacheKey);
        if (cached && cached.expireAt > Date.now()) {
            return res.json(cached.data);
        }

        const { default: Quiz } = await import('../models/Quiz.js');
        const { default: ActivityLog } = await import('../models/ActivityLog.js');
        const { default: AttendanceRecord } = await import('../models/AttendanceRecord.js');
        const { default: AttendanceSession } = await import('../models/AttendanceSession.js');

        // Get all students in org
        const students = await User.find({
            role: 'student',
            organization_id,
            is_demo: { $ne: true },
        }).select('_id name email createdAt').lean();

        if (students.length === 0) {
            return res.json({ students: [], cached: false });
        }

        const studentIds = students.map(s => s._id);

        // Get all classrooms in org
        const classrooms = await Classroom.find({ organization_id }).select('_id').lean();
        const classroomIds = classrooms.map(c => c._id);

        // ── 1. Quiz avg scores per student ──
        const quizAgg = await Quiz.aggregate([
            { $unwind: '$attempts' },
            { $match: { 'attempts.studentId': { $in: studentIds } } },
            { $group: { _id: '$attempts.studentId', avgScore: { $avg: '$attempts.percentage' }, attempts: { $sum: 1 } } },
        ]);
        const quizMap = {};
        quizAgg.forEach(q => { quizMap[q._id.toString()] = { avgScore: q.avgScore || 0, attempts: q.attempts }; });

        // ── 2. Attendance % per student ──
        const totalSessions = await AttendanceSession.countDocuments({ classroom: { $in: classroomIds } });
        const attAgg = await AttendanceRecord.aggregate([
            { $match: { student: { $in: studentIds }, classroom: { $in: classroomIds } } },
            { $group: { _id: '$student', presentCount: { $sum: 1 } } },
        ]);
        const attMap = {};
        attAgg.forEach(a => { attMap[a._id.toString()] = a.presentCount; });

        // ── 3. Approved notes count per student (Supabase) ──
        const notesMap = {};
        try {
            const { data: notesData } = await studentNotesClient
                .from('student_notes')
                .select('uploader_id')
                .eq('organization_id', organization_id.toString())
                .eq('status', 'approved');
            if (notesData) {
                notesData.forEach(n => {
                    const id = n.uploader_id;
                    if (id) notesMap[id] = (notesMap[id] || 0) + 1;
                });
            }
        } catch (e) { console.error('Notes fetch error:', e.message); }

        // ── 4. Activity count in last 30 days ──
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const actAgg = await ActivityLog.aggregate([
            { $match: { user: { $in: studentIds }, classroom: { $in: classroomIds }, timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$user', count: { $sum: 1 } } },
        ]);
        const actMap = {};
        actAgg.forEach(a => { actMap[a._id.toString()] = a.count; });

        // ── 5. Compute composite score ──
        const ranked = students.map(s => {
            const sid = s._id.toString();
            const quiz = quizMap[sid]?.avgScore || 0;        // 0-100
            const att = totalSessions > 0 ? (Math.min(attMap[sid] || 0, totalSessions) / totalSessions) * 100 : 0;
            const notes = Math.min((notesMap[sid] || 0) * 10, 100);   // 10pts per note, max 100
            const activity = Math.min((actMap[sid] || 0) * 2, 100);   // 2pts per action, max 100

            const score = (quiz * 0.4) + (att * 0.3) + (notes * 0.2) + (activity * 0.1);

            return {
                _id: s._id,
                name: s.name,
                email: s.email,
                quizAvg: Math.round(quiz),
                quizAttempts: quizMap[sid]?.attempts || 0,
                attendanceRate: Math.round(att),
                notesCount: notesMap[sid] || 0,
                activityCount: actMap[sid] || 0,
                engagementScore: Math.round(score),
            };
        });

        ranked.sort((a, b) => b.engagementScore - a.engagementScore);
        const top10 = ranked.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 }));

        const result = { students: top10, totalStudents: students.length, cached: false };
        _perfCache.set(cacheKey, { data: { ...result, cached: true }, expireAt: Date.now() + 5 * 60 * 1000 });

        res.json(result);
    } catch (err) {
        console.error('getStudentPerformance error:', err);
        res.status(500).json({ message: 'Server error fetching student performance.' });
    }
};

// ─────────────────────────────────────────────
// GET /api/org/audit-log
// Org Admin — audit log for their org (last 50 actions)
// Supports ?action=<action_type> for filtering
// ─────────────────────────────────────────────
export const getOrgAuditLog = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        if (!organization_id) return res.status(403).json({ message: 'You do not belong to an organization.' });

        const { default: AdminAuditLog } = await import('../models/AdminAuditLog.js');

        const query = { organization_id };
        if (req.query.action) query.action = req.query.action;

        const logs = await AdminAuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(50)
            .populate('actorId', 'name email')
            .lean();

        res.json({ logs });
    } catch (err) {
        console.error('getOrgAuditLog error:', err);
        res.status(500).json({ message: 'Server error fetching audit log.' });
    }
};

// ─────────────────────────────────────────────
// POST /api/org/upgrade-request
// Org Admin — submit a manual payment to upgrade to PRO
// ─────────────────────────────────────────────
export const createUpgradeRequest = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;
        const { planRequested, amount, transactionId, paymentScreenshot_base64 } = req.body;

        if (!organization_id) {
            return res.status(403).json({ message: "You do not belong to an organization." });
        }

        if (!transactionId || !paymentScreenshot_base64) {
            return res.status(400).json({ message: "Transaction ID (UPI Name) and screenshot are required." });
        }

        const org = await Organization.findById(organization_id);
        if (!org) {
            return res.status(404).json({ message: "Organization not found." });
        }

        if (org.plan === 'PRO' && org.planExpiresAt && org.planExpiresAt > new Date()) {
            return res.status(400).json({ message: "Your organization is already on the active PRO plan." });
        }

        const { default: PaymentRequest } = await import('../models/PaymentRequest.js');

        // Prevent multiple pending requests
        const existingPending = await PaymentRequest.findOne({ organizationId: organization_id, status: 'pending' });
        if (existingPending) {
            return res.status(400).json({ message: "An upgrade request is already pending. Please wait for verification." });
        }

        const request = new PaymentRequest({
            organizationId: organization_id,
            planRequested: planRequested || 'PRO',
            amount: amount || 100, // Hardcoded ₹100 as per user requirement, but accept from body if needed
            transactionId: transactionId.trim(),
            screenshotUrl: paymentScreenshot_base64,
            status: 'pending'
        });

        await request.save();

        res.status(201).json({ message: "Upgrade request submitted successfully.", paymentRequestId: request._id });
    } catch (err) {
        console.error("Upgrade request error:", err);
        res.status(500).json({ message: "Server error submitting upgrade request." });
    }
};


// ─────────────────────────────────────────────
// GET /api/org/test-accounts
// List all test accounts in the admin's organization
// ─────────────────────────────────────────────
export const getTestAccounts = async (req, res) => {
    try {
        await connectDB();
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "Not associated with an organization." });
        }

        const testAccounts = await User.find({
            organization_id,
            isSandbox: true
        }).select('name email role createdAt status sandboxPassword');

        res.status(200).json({ testAccounts });
    } catch (err) {
        console.error("getTestAccounts error:", err);
        res.status(500).json({ message: "Server error fetching test accounts." });
    }
};

// ─────────────────────────────────────────────
// POST /api/org/test-accounts
// Create a new test account (student or faculty)
// ─────────────────────────────────────────────
export const createTestAccount = async (req, res) => {
    try {
        await connectDB();
        const { role } = req.body; // 'student' or 'faculty'
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "Not associated with an organization." });
        }

        if (!role || !['student', 'faculty'].includes(role)) {
            return res.status(400).json({ message: "Valid role ('student' or 'faculty') is required." });
        }

        const org = await Organization.findById(organization_id);
        if (!org) return res.status(404).json({ message: "Organization not found." });

        // Fixed email pattern: [org_prefix]_[role]@classgrid.in
        const cleanOrgName = org.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);
        const email = `${cleanOrgName}_${role}@classgrid.in`;

        // Only one test account per role per org
        const existing = await User.findOne({ email, organization_id, isSandbox: true });
        if (existing) {
            return res.status(409).json({ message: `A test ${role} account already exists for this organization (${email}). Delete it first to create a new one.` });
        }

        // Generate secure 12-char random password
        const crypto = await import('crypto');
        const generatedPassword = crypto.randomBytes(6).toString('hex'); // 12 chars
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.default.hash(generatedPassword, 10);

        const name = `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`;

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            sandboxPassword: generatedPassword,
            role,
            organization_id,
            isSandbox: true,
            sandboxCreatedBy: req.user._id,
            isEmailVerified: true // Pre-verify so they don't get stuck
        });

        // If faculty, give them a dummy subject just so the UI doesn't crash if it expects one
        if (role === 'faculty') {
            newUser.subject = 'science';
        }

        await newUser.save();

        res.status(201).json({
            message: "Test account created successfully.",
            account: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt,
            },
            plaintextPassword: generatedPassword, // ONLY time we return this
        });

    } catch (err) {
        console.error("createTestAccount error:", err);
        res.status(500).json({ message: "Server error creating test account." });
    }
};

// ─────────────────────────────────────────────
// POST /api/org/test-accounts/:id/reset
// Reset password for a test account
// ─────────────────────────────────────────────
export const resetTestAccountPassword = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "Not associated with an organization." });
        }

        const testAccount = await User.findOne({
            _id: id,
            organization_id,
            isSandbox: true
        });

        if (!testAccount) {
            return res.status(404).json({ message: "Test account not found or you don't have permission." });
        }

        const { customPassword } = req.body;
        const bcrypt = await import('bcryptjs');
        let finalPassword;

        if (customPassword && customPassword.trim().length >= 6) {
            finalPassword = customPassword.trim();
        } else {
            const crypto = await import('crypto');
            finalPassword = crypto.randomBytes(6).toString('hex');
        }

        const hashedPassword = await bcrypt.default.hash(finalPassword, 10);

        testAccount.password = hashedPassword;
        testAccount.sandboxPassword = finalPassword;
        testAccount.passwordChangedAt = new Date();
        await testAccount.save();

        res.status(200).json({
            message: "Password reset successfully.",
            plaintextPassword: finalPassword
        });

    } catch (err) {
        console.error("resetTestAccountPassword error:", err);
        res.status(500).json({ message: "Server error resetting password." });
    }
};

// ─────────────────────────────────────────────
// DELETE /api/org/test-accounts/:id
// Delete a test account completely
// ─────────────────────────────────────────────
export const deleteTestAccount = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const organization_id = req.user.organization_id;

        if (!organization_id) {
            return res.status(403).json({ message: "Not associated with an organization." });
        }

        const testAccount = await User.findOne({
            _id: id,
            organization_id,
            isSandbox: true
        });

        if (!testAccount) {
            return res.status(404).json({ message: "Test account not found or you don't have permission." });
        }

        const { default: ClassroomMembership } = await import('../models/ClassroomMembership.js');

        // Clean up classroom memberships purely for hygiene
        await ClassroomMembership.deleteMany({ user: id });

        await User.deleteOne({ _id: id });

        res.status(200).json({ message: "Test account deleted successfully." });

    } catch (err) {
        console.error("deleteTestAccount error:", err);
        res.status(500).json({ message: "Server error deleting test account." });
    }
};
