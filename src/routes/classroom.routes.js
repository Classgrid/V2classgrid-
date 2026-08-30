import express from "express";
import { classroomClient } from "../config/supabaseClient.js";
import { s3Storage } from "../services/s3-storage.service.js";
import { isAuthenticated, requireRole, requireOrganization } from "../middleware/auth.middleware.js";
import { requireClassroomMember, requireClassroomOwner } from "../middleware/classroom.middleware.js";
import Classroom from "../models/Classroom.js";
import ClassroomMembership from "../models/ClassroomMembership.js";
import Notification from "../models/Notification.js";
import ActivityLog from "../models/ActivityLog.js";
import Organization from "../models/Organization.js";
import connectDB from "../../config/db.js";
import { getStudentLimit, getMaxStudentsPerClassroom, getMaxClassroomsPerFaculty, getEffectivePlan, normalizePlan } from "../config/plan.config.js";
import {
    sendClassroomActivityEmails,
    sendJoinRequestEmail,
    sendJoinApprovedEmail,
    sendBulkJoinApprovedEmails,
} from "../services/notification-email.service.js";

const router = express.Router();
import multer from "multer";
import { joinClassroomLimiter } from "../middleware/rateLimiter.js";
import { validateClassroom, validateJoinCode } from "../middleware/validation.middleware.js";



const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

// ─────────────────────────────────────────────
// PROXY PDF DOWNLOAD (Bypass CORS)
// ─────────────────────────────────────────────
router.get("/proxy/pdf", isAuthenticated, async (req, res) => {
    try {
        const fileUrl = req.query.url;
        if (!fileUrl) return res.status(400).json({ message: "Missing URL parameter" });

        // Basic security check to ensure it's a known storage URL (prevent SSRF)
        if (!fileUrl.includes('supabase.co/storage') && !fileUrl.includes('cdn.classgrid.in')) {
            return res.status(403).json({ message: "Only Supabase storage and Classgrid CDN URLs are allowed" });
        }

        const fetchRes = await fetch(fileUrl);
        if (!fetchRes.ok) throw new Error(`Failed to fetch from storage (HTTP ${fetchRes.status})`);

        const buffer = await fetchRes.arrayBuffer();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        res.send(Buffer.from(buffer));

    } catch (err) {
        console.error("Proxy PDF Error:", err);
        res.status(500).json({ message: "Error proxying PDF", error: err.message });
    }
});

// ─────────────────────────────────────────────
import { getChatReply } from "../services/chat.js";

// ─────────────────────────────────────────────
// GROQ/GEMINI SUMMARIZE PROXY (Replaces Hugging Face)
// Frontend sends text chunk → backend calls Groq → returns summary
// ─────────────────────────────────────────────
router.post("/hf-summarize", isAuthenticated, async (req, res) => {
    try {
        const { text, title } = req.body;
        if (!text || typeof text !== "string") {
            return res.status(400).json({ message: "Missing or invalid 'text' field" });
        }

        // We use our existing chat service which automatically routes to Groq (primary)
        // and falls back to Gemini if rate limited! This prevents 504 timeouts.

        const prompt = `You are an expert academic assistant. Please summarize the following text extracted from a document${title ? ` titled "${title}"` : ""}. 
Make the summary concise, clear, and highlight the key educational concepts.
Do not include conversational filler, just provide the summary directly.

TEXT TO SUMMARIZE:
"""
${text}
"""`;

        const summary = await getChatReply(prompt, 'groq');

        if (!summary) return res.status(500).json({ message: "No summary returned from model" });

        res.json({ summary });

    } catch (err) {
        console.error("[Groq Summarize API] Error:", err.message);
        res.status(500).json({ message: "Server error while summarizing", error: err.message });
    }
});

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// CREATE CLASSROOM (Teacher/Faculty only)
// ─────────────────────────────────────────────
router.post("/", isAuthenticated, requireRole("teacher", "faculty"), requireOrganization, validateClassroom, async (req, res) => {
    try {
        await connectDB();
        const { name, description, subject, subjectSlug, settings } = req.body;

        if (!name || !subject) {
            return res.status(400).json({ message: "Name and subject are required" });
        }

        if (!req.user || !req.user._id || !req.user.organization_id) {
            return res.status(400).json({ message: "Invalid user session or missing organization ID. Please re-login." });
        }

        // ── PLAN LIMIT: Max classrooms per faculty ──
        const org = await Organization.findById(req.user.organization_id).select('plan planExpiresAt').lean();
        if (org) {
            const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
            const maxClassrooms = getMaxClassroomsPerFaculty(effectivePlan);
            const currentClassrooms = await Classroom.countDocuments({
                teacher: req.user._id,
                organization_id: req.user.organization_id,
                "settings.isArchived": { $ne: true },
            });
            if (currentClassrooms >= maxClassrooms) {
                return res.status(403).json({
                    message: `Classroom limit reached (${maxClassrooms} per faculty on ${effectivePlan} plan). Upgrade your plan to create more.`,
                    code: 'PLAN_LIMIT_REACHED',
                });
            }
        }

        // ── Plan-driven maxStudents ──
        const effectivePlanForStudents = org ? getEffectivePlan(org.plan, org.planExpiresAt) : 'FREE';
        const planMaxStudents = getMaxStudentsPerClassroom(effectivePlanForStudents);

        const classroomData = {
            name,
            description: description || "",
            subject,
            subjectSlug: subjectSlug || subject.toLowerCase().replace(/\s+/g, "-"),
            teacher: req.user._id,
            organization_id: req.user.organization_id,
        };

        // Settings: maxStudents is now plan-driven (capped to plan limit)
        const requestedMax = settings?.maxStudents || planMaxStudents;
        classroomData.settings = {
            allowJoinRequests: settings?.allowJoinRequests !== undefined ? settings.allowJoinRequests : true,
            maxStudents: Math.min(requestedMax, planMaxStudents),
            isArchived: false,
        };

        const classroom = await Classroom.create(classroomData);

        res.status(201).json({
            message: "Classroom created successfully",
            classroom,
        });
    } catch (err) {
        console.error("Create classroom error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "A classroom with that code already exists. Please try again." });
        }
        if (err.name === "ValidationError") {
            return res.status(400).json({ message: "Database validation failed", error: err.message });
        }
        res.status(500).json({ message: "Server error creating classroom", error: err.message });
    }
});

// ─────────────────────────────────────────────
// LIST CLASSROOMS (role-aware)
// ─────────────────────────────────────────────
router.get("/", isAuthenticated, requireOrganization, async (req, res) => {
    try {
        await connectDB();
        if (req.user.role === "teacher" || req.user.role === "faculty") {
            // Teachers/Faculty see their own classrooms (isolated by org automatically since they only create in their org, but enforce it)
            const classrooms = await Classroom.find({
                teacher: req.user._id,
                organization_id: req.user.organization_id
            })
                .populate("teacher", "name email profilePicture qualification department bio")
                .sort({ createdAt: -1 })
                .lean();

            // Attach pending request counts
            const classroomIds = classrooms.map(c => c._id);
            const pendingCounts = await ClassroomMembership.aggregate([
                { $match: { classroom: { $in: classroomIds }, status: "pending" } },
                { $group: { _id: "$classroom", count: { $sum: 1 } } },
            ]);

            const pendingMap = {};
            pendingCounts.forEach(p => { pendingMap[p._id.toString()] = p.count; });

            const enriched = classrooms.map(c => ({
                ...c,
                pendingRequests: pendingMap[c._id.toString()] || 0,
            }));

            return res.json({ classrooms: enriched });
        }

        // Students: show approved + pending classrooms
        const memberships = await ClassroomMembership.find({
            student: req.user._id,
            status: { $in: ["approved", "pending"] },
        })
            .populate({
                path: "classroom",
                populate: { path: "teacher", select: "name email profilePicture qualification department bio" },
            })
            .lean();

        const myClassrooms = memberships.map(m => ({
            ...m.classroom,
            membershipStatus: m.status,
            membershipId: m._id,
        }));

        return res.json({ classrooms: myClassrooms });
    } catch (err) {
        console.error("List classrooms error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// DISCOVER / BROWSE CLASSROOMS (Students)
// ─────────────────────────────────────────────
router.get("/discover", isAuthenticated, requireOrganization, async (req, res) => {
    try {
        await connectDB();
        const { search, subject } = req.query;

        const filter = {
            "settings.isArchived": false,
            "settings.allowJoinRequests": true,
            organization_id: req.user.organization_id,
        };

        if (subject) filter.subject = subject.toLowerCase();
        if (search) filter.name = { $regex: search, $options: "i" };

        const classrooms = await Classroom.find(filter)
            .populate("teacher", "name email profilePicture")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Check existing memberships for this student
        const classroomIds = classrooms.map(c => c._id);
        const existingMemberships = await ClassroomMembership.find({
            student: req.user._id,
            classroom: { $in: classroomIds },
        }).lean();

        const membershipMap = {};
        existingMemberships.forEach(m => {
            membershipMap[m.classroom.toString()] = m.status;
        });

        const enriched = classrooms.map(c => ({
            ...c,
            membershipStatus: membershipMap[c._id.toString()] || null,
        }));

        res.json({ classrooms: enriched });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET ALL ORG CLASSROOMS (Students)
// ─────────────────────────────────────────────
router.get("/my-organization", isAuthenticated, requireOrganization, async (req, res) => {
    try {
        await connectDB();
        const classrooms = await Classroom.find({
            organization_id: req.user.organization_id,
            "settings.isArchived": false
        })
            .populate("teacher", "name email profilePicture")
            .sort({ createdAt: -1 })
            .lean();

        res.json({ classrooms });
    } catch (err) {
        console.error("Get org classrooms error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// JOIN BY CLASS CODE (Student) - AUTO APPROVE
// ─────────────────────────────────────────────
router.post("/join-by-code", isAuthenticated, joinClassroomLimiter, validateJoinCode, async (req, res) => {
    try {
        await connectDB();
        const { classCode, requestMessage } = req.body;

        if (!classCode) {
            return res.status(400).json({ message: "Class code is required" });
        }

        // Direct class code join — no org filter needed.
        // The class code is a direct invite and works for anyone.
        const classroom = await Classroom.findOne({
            classCode: classCode.toUpperCase().trim(),
        });

        if (!classroom) {
            return res.status(404).json({ message: "Invalid class code. No classroom found." });
        }

        // Allow joining even if requests are disabled, as code implies invite? 
        // Or strictly follow settings? User said "direct join". Usually code overrides "request" setting.
        // But let's respect "isArchived" if any. 
        if (classroom.settings.isArchived) {
            return res.status(403).json({ message: "This classroom is archived" });
        }

        // ── STRICT SINGLE-ORG ENFORCEMENT ──────────────────────────
        // If user already belongs to an org AND it doesn't match classroom's org → reject
        if (req.user.organization_id && classroom.organization_id) {
            const userOrgId = req.user.organization_id.toString();
            const classOrgId = classroom.organization_id.toString();
            if (userOrgId !== classOrgId) {
                return res.status(403).json({
                    message: "You already belong to another organization. You cannot join classrooms from a different organization.",
                    code: "ORG_CONFLICT"
                });
            }
        }

        // Auto-link student to the classroom's org if not yet linked
        if (req.user.role === "student" && !req.user.organization_id && classroom.organization_id) {
            const { default: User } = await import("../models/User.js");
            await User.findByIdAndUpdate(req.user._id, { organization_id: classroom.organization_id });
        }

        // Check if teacher is trying to join their own classroom
        if (classroom.teacher.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: "You are the owner of this classroom" });
        }

        // Check existing membership
        let membership = await ClassroomMembership.findOne({
            classroom: classroom._id,
            student: req.user._id,
        });

        if (membership) {
            if (membership.status === "approved") {
                return res.status(400).json({ message: "You are already a member of this classroom" });
            }
            // If pending or rejected, upgrade to approved since they have the code
            membership.status = "approved";
            membership.joinedAt = new Date();
            membership.respondedAt = new Date();
            membership.respondedBy = classroom.teacher; // System/Teacher
            membership.rejectionReason = "";
            await membership.save();

            // Increment count
            await Classroom.findByIdAndUpdate(classroom._id, { $inc: { memberCount: 1 } });

            return res.json({
                message: "Joined classroom successfully!",
                membership,
                classroomName: classroom.name
            });
        }

        // Check per-classroom limit
        const currentCount = await ClassroomMembership.countDocuments({
            classroom: classroom._id,
            status: "approved",
        });

        if (currentCount >= classroom.settings.maxStudents) {
            return res.status(400).json({ message: "Classroom is full" });
        }

        // ── Org-level student limit enforcement ──
        if (classroom.organization_id) {
            const org = await Organization.findById(classroom.organization_id).select('plan planExpiresAt studentLimit').lean();
            if (org) {
                const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
                const limit = org.studentLimit || getStudentLimit(effectivePlan);
                const orgClassrooms = await Classroom.find({ organization_id: classroom.organization_id }).select('_id').lean();
                const orgClassroomIds = orgClassrooms.map(c => c._id);
                const totalOrgStudents = await ClassroomMembership.countDocuments({
                    classroom: { $in: orgClassroomIds },
                    status: 'approved',
                });
                if (totalOrgStudents >= limit) {
                    return res.status(403).json({
                        message: `Organization student limit reached (${limit}). Contact your admin to upgrade the plan.`,
                        code: 'PLAN_LIMIT_REACHED',
                    });
                }
            }
        }

        // Create APPROVED membership
        membership = await ClassroomMembership.create({
            classroom: classroom._id,
            student: req.user._id,
            status: "approved", // Direct join
            joinedAt: new Date(),
            requestMessage: requestMessage || "Joined via Class Code",
        });

        // Increment count
        await Classroom.findByIdAndUpdate(classroom._id, { $inc: { memberCount: 1 } });

        // Notify Teacher
        await Notification.create({
            recipient: classroom.teacher,
            type: "system",
            title: "New Student Joined",
            message: `${req.user.name} joined "${classroom.name}" via class code.`,
            link: `/manage-classroom.html?id=${classroom._id}&tab=members`,
            createdAt: new Date()
        });

        res.status(201).json({
            message: "Joined classroom successfully!",
            membership,
            classroomName: classroom.name,
        });
    } catch (err) {
        console.error("Join by code error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "You are already in this classroom" });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// REQUEST TO JOIN (Student, by classroom ID)
// ─────────────────────────────────────────────
router.post("/:id/join", isAuthenticated, joinClassroomLimiter, async (req, res) => {
    try {
        await connectDB();
        const classroom = await Classroom.findById(req.params.id);

        if (!classroom) {
            return res.status(404).json({ message: "Classroom not found" });
        }

        if (!classroom.settings.allowJoinRequests) {
            return res.status(403).json({ message: "This classroom is not accepting join requests" });
        }

        if (classroom.teacher.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: "You own this classroom" });
        }

        // Check existing
        const existing = await ClassroomMembership.findOne({
            classroom: classroom._id,
            student: req.user._id,
        });

        if (existing) {
            if (existing.status === "approved") {
                return res.status(400).json({ message: "Already a member" });
            }
            if (existing.status === "pending") {
                return res.status(400).json({ message: "Request already pending" });
            }
            // rejected — allow re-request
            existing.status = "pending";
            existing.requestedAt = new Date();
            existing.requestMessage = req.body.requestMessage || "";
            existing.respondedAt = null;
            existing.respondedBy = null;
            existing.rejectionReason = "";
            await existing.save();

            // Notify Teacher of re-request
            await Notification.create({
                recipient: classroom.teacher,
                type: "system",
                title: "Join Re-request",
                message: `${req.user.name} has re-requested to join "${classroom.name}".`,
                link: "/manage-classroom.html#requests",
                relatedId: existing._id,
                createdAt: new Date()
            });

            return res.json({ message: "Join request re-submitted", membership: existing });
        }

        // ── Org-level student limit enforcement ──
        if (classroom.organization_id) {
            const org = await Organization.findById(classroom.organization_id).select('plan planExpiresAt studentLimit').lean();
            if (org) {
                const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
                const limit = org.studentLimit || getStudentLimit(effectivePlan);
                const orgClassrooms = await Classroom.find({ organization_id: classroom.organization_id }).select('_id').lean();
                const orgClassroomIds = orgClassrooms.map(c => c._id);
                const totalOrgStudents = await ClassroomMembership.countDocuments({
                    classroom: { $in: orgClassroomIds },
                    status: 'approved',
                });
                if (totalOrgStudents >= limit) {
                    return res.status(403).json({
                        message: `Organization student limit reached (${limit}). Contact your admin to upgrade the plan.`,
                        code: 'PLAN_LIMIT_REACHED',
                    });
                }
            }
        }

        // Auto-link student to the classroom's org if not yet linked
        if (req.user.role === "student" && !req.user.organization_id && classroom.organization_id) {
            const { default: User } = await import("../models/User.js");
            await User.findByIdAndUpdate(req.user._id, { organization_id: classroom.organization_id });
        }

        const membership = await ClassroomMembership.create({
            classroom: classroom._id,
            student: req.user._id,
            requestMessage: req.body.requestMessage || "",
        });

        // Notify Teacher
        await Notification.create({
            recipient: classroom.teacher,
            type: "system",
            title: "New Join Request",
            message: `${req.user.name} has requested to join "${classroom.name}".`,
            link: "/manage-classroom.html#requests",
            relatedId: membership._id,
            createdAt: new Date()
        });

        // Notify Student
        await Notification.create({
            recipient: req.user._id,
            type: "system",
            title: "Request Sent",
            message: `Your request to join "${classroom.name}" has been sent successfully.`,
            relatedId: classroom._id,
            createdAt: new Date()
        });

        // 📧 Fire-and-forget: email faculty about join request
        sendJoinRequestEmail({ classroom, student: req.user })
            .catch(err => console.error('[EmailNotification] join request email error:', err.message));

        res.status(201).json({
            message: "Join request sent!",
            membership,
        });
    } catch (err) {
        console.error("Join request error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Request already exists" });
        }
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET JOIN REQUESTS (Teacher)
// ─────────────────────────────────────────────
router.get("/:id/requests", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { classroom: req.params.id };
        if (status) filter.status = status;

        const requests = await ClassroomMembership.find(filter)
            .populate("student", "name email profilePicture role")
            .sort({ requestedAt: -1 })
            .lean();

        res.json({ requests });
    } catch (err) {
        console.error("Get requests error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// APPROVE / REJECT REQUEST (Teacher)
// ─────────────────────────────────────────────
router.put("/:id/requests/:requestId", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { action, rejectionReason } = req.body;

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
        }

        const membership = await ClassroomMembership.findOne({
            _id: req.params.requestId,
            classroom: req.params.id,
        });

        if (!membership) {
            return res.status(404).json({ message: "Request not found" });
        }

        if (membership.status !== "pending") {
            return res.status(400).json({ message: `Request is already ${membership.status}` });
        }

        // ── PLAN LIMIT CHECK on approve ──
        if (action === "approve") {
            const classroom = await Classroom.findById(req.params.id).select('organization_id settings').lean();

            // Per-classroom limit
            const currentCount = await ClassroomMembership.countDocuments({
                classroom: req.params.id,
                status: "approved",
            });
            if (classroom && currentCount >= (classroom.settings?.maxStudents || 200)) {
                return res.status(403).json({ message: "Classroom is full. Cannot approve more students.", code: 'CLASSROOM_FULL' });
            }

            // Org-level student limit
            if (classroom?.organization_id) {
                const org = await Organization.findById(classroom.organization_id).select('plan planExpiresAt studentLimit').lean();
                if (org) {
                    const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
                    const limit = org.studentLimit || getStudentLimit(effectivePlan);
                    const orgClassrooms = await Classroom.find({ organization_id: classroom.organization_id }).select('_id').lean();
                    const orgClassroomIds = orgClassrooms.map(c => c._id);
                    const totalOrgStudents = await ClassroomMembership.countDocuments({
                        classroom: { $in: orgClassroomIds },
                        status: 'approved',
                    });
                    if (totalOrgStudents >= limit) {
                        return res.status(403).json({
                            message: `Organization student limit reached (${limit}). Contact admin to upgrade.`,
                            code: 'PLAN_LIMIT_REACHED',
                        });
                    }
                }
            }
        }

        membership.status = action === "approve" ? "approved" : "rejected";
        membership.respondedAt = new Date();
        membership.respondedBy = req.user._id;
        if (action === "reject" && rejectionReason) {
            membership.rejectionReason = rejectionReason;
        }

        await membership.save();

        // Update member count on classroom
        if (action === "approve") {
            await Classroom.findByIdAndUpdate(req.params.id, { $inc: { memberCount: 1 } });

            // Create Notification
            await Notification.create({
                recipient: membership.student,
                type: "request_approved",
                title: "Join Request Approved",
                message: `Your request to join "${req.classroom.name}" has been accepted by ${req.user.name}.`,
                link: `/view-classroom.html?id=${req.params.id}`,
                relatedId: req.params.id
            });

            // 📧 Fire-and-forget: email student about approval
            sendJoinApprovedEmail({ classroom: req.classroom, studentId: membership.student })
                .catch(err => console.error('[EmailNotification] join approved email error:', err.message));
        }

        res.json({
            message: `Request ${action}d successfully`,
            membership,
        });
    } catch (err) {
        console.error("Approve/reject error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// BULK APPROVE/REJECT REQUESTS (Teacher)
// ─────────────────────────────────────────────
router.put("/:id/requests-bulk", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { requestIds, action } = req.body;

        if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ message: "requestIds array required" });
        }

        if (!["approve", "reject"].includes(action)) {
            return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
        }

        // ── PLAN LIMIT CHECK on bulk approve ──
        if (action === "approve") {
            const classroom = await Classroom.findById(req.params.id).select('organization_id settings').lean();

            // Per-classroom limit
            const currentCount = await ClassroomMembership.countDocuments({
                classroom: req.params.id,
                status: "approved",
            });
            const maxStudents = classroom?.settings?.maxStudents || 200;
            const remainingSlots = Math.max(0, maxStudents - currentCount);

            if (requestIds.length > remainingSlots) {
                return res.status(403).json({
                    message: `Classroom can only accept ${remainingSlots} more students (limit: ${maxStudents}). Reduce the number of approvals.`,
                    code: 'CLASSROOM_FULL',
                });
            }

            // Org-level student limit
            if (classroom?.organization_id) {
                const org = await Organization.findById(classroom.organization_id).select('plan planExpiresAt studentLimit').lean();
                if (org) {
                    const effectivePlan = getEffectivePlan(org.plan, org.planExpiresAt);
                    const limit = org.studentLimit || getStudentLimit(effectivePlan);
                    const orgClassrooms = await Classroom.find({ organization_id: classroom.organization_id }).select('_id').lean();
                    const orgClassroomIds = orgClassrooms.map(c => c._id);
                    const totalOrgStudents = await ClassroomMembership.countDocuments({
                        classroom: { $in: orgClassroomIds },
                        status: 'approved',
                    });
                    const orgRemaining = Math.max(0, limit - totalOrgStudents);
                    if (requestIds.length > orgRemaining) {
                        return res.status(403).json({
                            message: `Organization student limit allows only ${orgRemaining} more students (limit: ${limit}). Reduce approvals or upgrade plan.`,
                            code: 'PLAN_LIMIT_REACHED',
                        });
                    }
                }
            }
        }

        const newStatus = action === "approve" ? "approved" : "rejected";

        // If approving, fetch pending memberships first to notify students
        let pendingMemberships = [];
        if (action === "approve") {
            pendingMemberships = await ClassroomMembership.find({
                _id: { $in: requestIds },
                classroom: req.params.id,
                status: "pending",
            });
        }

        const result = await ClassroomMembership.updateMany(
            {
                _id: { $in: requestIds },
                classroom: req.params.id,
                status: "pending",
            },
            {
                $set: {
                    status: newStatus,
                    respondedAt: new Date(),
                    respondedBy: req.user._id,
                },
            }
        );

        // Update member count & Notify
        if (action === "approve") {
            await Classroom.findByIdAndUpdate(req.params.id, {
                $inc: { memberCount: result.modifiedCount },
            });

            // Send Notifications
            if (pendingMemberships.length > 0) {
                const notifications = pendingMemberships.map(m => ({
                    recipient: m.student,
                    type: "request_approved",
                    title: "Join Request Approved",
                    message: `Your request to join "${req.classroom.name}" has been accepted by ${req.user.name}.`,
                    link: `/view-classroom.html?id=${req.params.id}`,
                    relatedId: req.params.id,
                    createdAt: new Date()
                }));
                await Notification.insertMany(notifications);
            }

            // 📧 Fire-and-forget: bulk email students about approval
            const approvedStudentIds = pendingMemberships.map(m => m.student);
            sendBulkJoinApprovedEmails({ classroom: req.classroom, studentIds: approvedStudentIds })
                .catch(err => console.error('[EmailNotification] bulk approved email error:', err.message));
        }

        res.json({
            message: `${result.modifiedCount} requests ${action}d`,
            modifiedCount: result.modifiedCount,
        });
    } catch (err) {
        console.error("Bulk action error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET CLASSROOM DETAILS (Members only)
// ─────────────────────────────────────────────
router.get("/:id", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id)
            .populate("teacher", "name email profilePicture subject qualification department bio")
            .lean();

        if (!classroom) {
            return res.status(404).json({ message: "Classroom not found" });
        }

        res.json({ classroom, isOwner: req.isClassroomOwner });
    } catch (err) {
        console.error("Get classroom error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// UPDATE CLASSROOM (Owner only)
// ─────────────────────────────────────────────
router.put("/:id", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const allowedUpdates = ["name", "description", "coverImage", "settings"];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const classroom = await Classroom.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { returnDocument: "after", runValidators: true }
        );

        res.json({ message: "Classroom updated", classroom });
    } catch (err) {
        console.error("Update classroom error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// DELETE CLASSROOM (Owner only)
// ─────────────────────────────────────────────
router.delete("/:id", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        // Delete all related data
        await Promise.all([
            ClassroomMembership.deleteMany({ classroom: req.params.id }),
            ActivityLog.deleteMany({ classroom: req.params.id }),
            Classroom.findByIdAndDelete(req.params.id),
        ]);

        res.json({ message: "Classroom deleted successfully" });
    } catch (err) {
        console.error("Delete classroom error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET MEMBERS (Owner only)
// ─────────────────────────────────────────────
router.get("/:id/members", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const members = await ClassroomMembership.find({
            classroom: req.params.id,
            status: "approved",
        })
            .populate({
                path: "student",
                select: "name email profilePicture role lastLoginAt prn isSandbox",
                match: { isSandbox: { $ne: true } }
            })
            .sort({ requestedAt: 1 })
            .lean();

        // Filter out memberships where student was excluded by the match condition
        const filteredMembers = members.filter(m => m.student != null);

        res.json({ members: filteredMembers, total: filteredMembers.length });
    } catch (err) {
        console.error("Get members error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// REMOVE MEMBER (Owner only)
// ─────────────────────────────────────────────
router.delete("/:id/members/:userId", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const result = await ClassroomMembership.findOneAndDelete({
            classroom: req.params.id,
            student: req.params.userId,
        });

        if (!result) {
            return res.status(404).json({ message: "Member not found" });
        }

        if (result.status === "approved") {
            await Classroom.findByIdAndUpdate(req.params.id, { $inc: { memberCount: -1 } });
        }

        res.json({ message: "Member removed" });
    } catch (err) {
        console.error("Remove member error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// ─────────────────────────────────────────────
// GENERATE SIGNED UPLOAD URLS (Avoids 413 & RLS)
// ─────────────────────────────────────────────
router.post("/:id/upload-urls", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { files } = req.body;
        if (!files || !Array.isArray(files)) return res.status(400).json({ message: "Files array required" });

        // Uses global supabase client

        const urls = [];
        for (const file of files) {
            const path = `${req.params.id}/${Date.now()}_${Math.floor(Math.random() * 1000)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const { signedUrl, fullPath } = await s3Storage.createSignedUploadUrl(path);
            const publicUrl = s3Storage.getPublicUrl(path);

            urls.push({
                originalname: file.name,
                path: fullPath,
                token: "s3-presigned",
                signedUrl: signedUrl,  // Full signed upload URL (correct project)
                publicUrl: publicUrl         // Public URL for after upload
            });
        }
        res.json({ urls });
    } catch (err) {
        console.error("Upload URL error:", err);
        res.status(500).json({ message: "Server error generating URLs" });
    }
});
// ─────────────────────────────────────────────
// CREATE CONTENT (Teacher / Owner only)
// ─────────────────────────────────────────────
// Conditionally apply multer: only parse multipart/form-data (quiz/announcement FormData).
// Materials now send JSON (files uploaded to Supabase first), so multer must NOT interfere.
const conditionalUpload = (req, res, next) => {
    if (req.is('multipart/form-data')) {
        return upload.array('files', 10)(req, res, next);
    }
    next();
};
router.post("/:id/content/:type", isAuthenticated, requireClassroomOwner, conditionalUpload, async (req, res) => {
    try {
        const { type } = req.params;
        if (!["materials", "announcements", "quizzes"].includes(type)) {
            return res.status(400).json({ message: "Invalid content type" });
        }

        const { title, description, message, tags, link, provider } = req.body;
        const classroomId = req.params.id;

        // Import classroomClient client
        // Uses global classroomClient client

        const classroom = await Classroom.findById(classroomId);
        if (!classroom) return res.status(404).json({ message: "Classroom not found" });

        const slug = classroom.subjectSlug || "general";
        let insertedItems = [];

        if (type === "materials") {
            const oldFiles = req.files || [];
            const uploadedFiles = req.body.uploaded_files || [];

            if (!oldFiles.length && !uploadedFiles.length) {
                return res.status(400).json({ message: "At least one file is required for materials" });
            }

            // Path A: Frontend uploaded to Supabase directly (Avoids 413 Payload Too Large)
            if (uploadedFiles.length > 0) {
                for (let i = 0; i < uploadedFiles.length; i++) {
                    const fileObj = uploadedFiles[i];

                    const dbData = {
                        title: (uploadedFiles.length === 1 && title) ? title : (title ? `${title} - ${fileObj.originalname}` : fileObj.originalname),
                        subject_slug: slug,
                        file_url: fileObj.fileurl,
                        uploaded_by: req.user.name,
                        type: fileObj.fileExt,
                        classroom_id: classroomId
                    };

                    const { data, error } = await classroomClient
                        .from(type)
                        .insert([dbData])
                        .select()
                        .single();

                    if (error) throw error;
                    insertedItems.push(data);
                }
            }
            // Path B: Fallback for old FormData requests (May fail with 413 on large files via Vercel)
            else if (oldFiles.length > 0) {
                for (let i = 0; i < oldFiles.length; i++) {
                    const file = oldFiles[i];
                    const fileExt = file.originalname.split('.').pop();
                    const fileName = `${classroomId}/${Date.now()}_${i}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

                    const { publicUrl } = await s3Storage.uploadFile(fileName, file.buffer, file.mimetype);

                    const dbData = {
                        title: (oldFiles.length === 1 && title) ? title : (title ? `${title} - ${file.originalname}` : file.originalname),
                        subject_slug: slug,
                        file_url: publicUrl,
                        uploaded_by: req.user.name,
                        type: fileExt,
                        classroom_id: classroomId
                    };

                    const { data, error } = await classroomClient
                        .from(type)
                        .insert([dbData])
                        .select()
                        .single();

                    if (error) throw error;
                    insertedItems.push(data);
                }
            }
        } else if (type === "quizzes") {
            if (!title || !link) return res.status(400).json({ message: "Title and link are required" });
            const dbData = {
                title,
                subject_slug: slug,
                quiz_url: link,
                provider: provider || 'Google Forms',
                classroom_id: classroomId
            };

            const { data, error } = await classroomClient
                .from(type)
                .insert([dbData])
                .select()
                .single();

            if (error) throw error;
            insertedItems.push(data);
        } else if (type === "announcements") {
            if (!message) return res.status(400).json({ message: "Message is required" });
            const dbData = {
                message,
                subject_slug: slug,
                posted_by: req.user.name,
                tags: tags ? (Array.isArray(tags) ? tags : [tags]) : ["General"],
                classroom_id: classroomId
            };

            const { data, error } = await classroomClient
                .from(type)
                .insert([dbData])
                .select()
                .single();

            if (error) throw error;
            insertedItems.push(data);
        }

        // Notify students (wrapped in try-catch so failures do not crash the file upload)
        try {
            const members = await ClassroomMembership.find({ classroom: classroomId, status: "approved" }).select("student");
            if (members.length > 0) {
                const notifTitle = type === 'materials'
                    ? `New Material${insertedItems.length > 1 ? 's' : ''}`
                    : type === 'quizzes' ? 'New Quiz' : 'New Announcement';
                const notifMsg = type === 'materials' && insertedItems.length > 1
                    ? `${insertedItems.length} new files uploaded to ${classroom.name}`
                    : `New content added to ${classroom.name}: ${title || (message && message.substring(0, 30) + '...') || 'Untitled'}`;

                const notifications = members.map(m => ({
                    recipient: m.student,
                    type: "content_update", // Added "content_update" to the enum in Notification.js
                    title: notifTitle,
                    message: notifMsg,
                    link: `/view-classroom.html?id=${classroomId}`,
                    relatedId: classroomId,
                    createdAt: new Date()
                }));
                await Notification.insertMany(notifications);
            }

            // 📧 Queue email notifications (reliable, with retry)
            const emailResult = await sendClassroomActivityEmails({
                classroom,
                faculty: req.user,
                contentType: type,
                title: title || (type === 'announcements' ? 'New Announcement' : 'Untitled'),
                preview: (message || description || ''),
            });

            // Track email status on notifications
            if (emailResult?.emailAttempted && members.length > 0) {
                try {
                    await Notification.updateMany(
                        {
                            relatedId: classroomId, type: "content_update", emailSent: false,
                            createdAt: { $gte: new Date(Date.now() - 10000) }
                        },
                        { $set: { emailSent: true, emailSentAt: new Date() } }
                    );
                } catch (trackErr) {
                    console.error('[EmailNotification] tracking update failed:', trackErr.message);
                }
            }

            console.log(`[Content] ${type} created in classroom ${classroomId}, emailJobsCreated=${emailResult?.jobsCreated || 0}`);
        } catch (notifErr) {
            console.error(`Failed to send notifications for ${type}:`, notifErr);
            // Do not throw the error; allow the upload to succeed
        }

        res.status(201).json({
            message: `${insertedItems.length} item(s) uploaded successfully`,
            items: insertedItems,
            item: insertedItems[0],
            emailJobsCreated: 0 // Will be overridden if available
        });

    } catch (err) {
        console.error(`Create ${req.params.type} error:`, err);
        res.status(500).json({ message: "Server error creating content" });
    }
});

// ─────────────────────────────────────────────
// RESEND FAILED EMAIL NOTIFICATIONS (Faculty)
// ─────────────────────────────────────────────
router.post("/:id/resend-notification", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { resendClassroomEmails } = await import("../services/email-queue.service.js");
        const { type } = req.body; // optional: filter by content type
        const resetCount = await resendClassroomEmails(req.params.id, type || null);

        if (resetCount === 0) {
            return res.json({ message: "No failed email jobs found for this classroom" });
        }

        console.log(`[Classroom] Faculty ${req.user._id} triggered resend for classroom ${req.params.id}, reset=${resetCount}`);
        res.json({
            message: `${resetCount} failed email(s) re-queued for delivery`,
            resetCount,
        });
    } catch (err) {
        console.error("Resend notification error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET CONTENT (Materials, Announcements, Quizzes)
// ─────────────────────────────────────────────
router.get("/:id/content/:type", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { type } = req.params;
        if (!["materials", "announcements", "quizzes"].includes(type)) {
            return res.status(400).json({ message: "Invalid content type" });
        }

        // Import classroomClient client
        // Uses global classroomClient client

        let content = [];
        let source = "classroom";

        // STRICT: Only fetch content that belongs to THIS classroom
        // No subject_slug fallback — prevents cross-classroom data leakage
        const { data, error } = await classroomClient
            .from(type)
            .select("*")
            .eq("classroom_id", req.params.id)
            .order("created_at", { ascending: false });

        if (!error && data) {
            content = data;
        }

        // Deduplicate by id to prevent the same item appearing twice
        const seen = new Set();
        content = content.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });

        // Normalize announcements: map "message" to "title"/"content" for frontend
        if (type === "announcements") {
            content = content.map(a => ({
                ...a,
                title: a.title || a.message || "",
                content: a.content || a.message || "",
            }));
        }

        res.json({ content, source });
    } catch (err) {
        console.error(`Get ${req.params.type} error:`, err);
        res.status(500).json({ message: "Server error fetching content" });
    }
});

// ─────────────────────────────────────────────
// SUMMARIZE MATERIAL (Members only)
// Now only handles caching; generation moved to frontend
// (chunkText and summarize logic removed from backend)
// ─────────────────────────────────────────────
router.post("/:id/content/materials/:materialId/summarize", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { materialId } = req.params;
        const classroomId = req.params.id;
        const { cachedSummary } = req.body; // Client can pass the generated summary to cache it

        // ── 1. Check cache first ──
        const { data: cached } = await classroomClient
            .from("material_summaries")
            .select("summary")
            .eq("material_id", materialId)
            .single();

        if (cached && cached.summary) {
            return res.json({ message: "Summary retrieved from cache", summary: cached.summary, cached: true });
        }

        // ── 2. If client provided a summary to cache, save it ──
        if (cachedSummary && typeof cachedSummary === 'string') {
            try {
                await classroomClient
                    .from("material_summaries")
                    .upsert({
                        material_id: materialId,
                        classroom_id: classroomId,
                        summary: cachedSummary,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: "material_id" });

                return res.json({ message: "Summary cached successfully", summary: cachedSummary, cached: false });
            } catch (cacheErr) {
                console.warn("[Summarize] Cache upsert failed:", cacheErr.message);
                return res.status(500).json({ message: "Failed when trying to cache summary" });
            }
        }

        // ── 3. If no cache and client didn't provide one, tell client to generate it ──
        return res.status(404).json({ message: "Summary not found in cache. Client must generate it.", error: "not_cached" });

    } catch (err) {
        console.error("Summarize API Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ─────────────────────────────────────────────
// NOTIFY CLASSROOM MEMBERS (Owner only)
// ─────────────────────────────────────────────
router.post("/:id/notify", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { title, message, type, link } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: "Title and message are required" });
        }

        // Get all approved members
        const members = await ClassroomMembership.find({
            classroom: req.params.id,
            status: "approved"
        }).select("student");

        if (members.length === 0) {
            return res.json({ message: "No members to notify" });
        }

        const notifications = members.map(m => ({
            recipient: m.student,
            type: type || "system",
            title,
            message,
            link: link || `/view-classroom.html?id=${req.params.id}`,
            relatedId: req.params.id,
            createdAt: new Date()
        }));

        await Notification.insertMany(notifications);

        res.json({ message: "Notifications sent", count: members.length });
    } catch (err) {
        console.error("Notify classroom error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET STUDENTS LIST (Any member can see classmates)
// ─────────────────────────────────────────────
router.get("/:id/students", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const members = await ClassroomMembership.find({
            classroom: req.params.id,
            status: "approved",
        })
            .populate({
                path: "student",
                select: "name email profilePicture role prn isSandbox",
                match: { isSandbox: { $ne: true } }
            })
            .sort({ joinedAt: 1 })
            .lean();

        // Filter out memberships where student was excluded by the match condition
        const filteredMembers = members.filter(m => m.student != null);

        const students = filteredMembers.map(m => ({
            _id: m.student?._id,
            name: m.student?.name || 'Unknown',
            email: m.student?.email || '',
            profilePicture: m.student?.profilePicture || '',
            role: m.student?.role || 'student',
            prn: m.student?.prn || null,
            joinedAt: m.joinedAt || m.requestedAt
        }));

        res.json({ students, total: students.length });
    } catch (err) {
        console.error("Get students error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// UPDATE CONTENT (Teacher / Owner only)
// ─────────────────────────────────────────────
router.put("/:id/content/:type/:contentId", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { type, contentId } = req.params;
        if (!["materials", "announcements", "quizzes"].includes(type)) {
            return res.status(400).json({ message: "Invalid content type" });
        }

        // Build update object from ONLY allowed fields
        // IMPORTANT: 'content' is NOT a real Supabase column for announcements — use 'message'
        const updates = {};
        const allowedFields = {
            materials: ["title", "file_url"],
            announcements: ["message"],
            quizzes: ["title", "link"]
        };

        (allowedFields[type] || []).forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        // SAFETY: If frontend accidentally sends 'content' for announcements,
        // map it to 'message' (the real Supabase column) and never send 'content'
        if (type === "announcements" && req.body.content && !updates.message) {
            updates.message = req.body.content;
        }
        // Never allow 'content' to reach Supabase
        delete updates.content;

        console.log(`[UPDATE ${type}] ID=${contentId}, fields=`, JSON.stringify(updates));

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const { data, error } = await classroomClient
            .from(type)
            .update(updates)
            .eq("id", contentId)
            .select()
            .single();

        if (error) throw error;

        res.json({ message: "Content updated", item: data });
    } catch (err) {
        console.error(`Update ${req.params.type} error:`, err);
        res.status(500).json({ message: "Server error updating content" });
    }
});

// ─────────────────────────────────────────────
// DELETE CONTENT (Teacher / Owner only)
// ─────────────────────────────────────────────
router.delete("/:id/content/:type/:contentId", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { type, contentId } = req.params;
        if (!["materials", "announcements", "quizzes"].includes(type)) {
            return res.status(400).json({ message: "Invalid content type" });
        }

        // Uses global classroomClient client

        const { error } = await classroomClient
            .from(type)
            .delete()
            .eq("id", contentId);

        if (error) throw error;

        res.json({ message: "Content deleted successfully" });
    } catch (err) {
        console.error(`Delete ${req.params.type} error:`, err);
        res.status(500).json({ message: "Server error deleting content" });
    }
});

export default router;
