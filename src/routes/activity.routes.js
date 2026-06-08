import express from "express";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import { requireClassroomMember, requireClassroomOwner } from "../middleware/classroom.middleware.js";
import ActivityLog from "../models/ActivityLog.js";
import ClassroomMembership from "../models/ClassroomMembership.js";

const router = express.Router();

// ─────────────────────────────────────────────
// LOG AN ACTIVITY (Any authenticated member)
// ─────────────────────────────────────────────
router.post("/log", isAuthenticated, async (req, res) => {
    try {
        const { classroomId, action, targetType, targetId, targetTitle, metadata } = req.body;

        if (!classroomId || !action || !targetType) {
            return res.status(400).json({ message: "classroomId, action, and targetType required" });
        }

        // Verify user is a member (or teacher) — lightweight check
        const isMember = await ClassroomMembership.exists({
            classroom: classroomId,
            student: req.user._id,
            status: "approved",
        });

        // Also check if user is the teacher (they won't have a membership record)
        if (!isMember) {
            const Classroom = (await import("../models/Classroom.js")).default;
            const isTeacher = await Classroom.exists({
                _id: classroomId,
                teacher: req.user._id,
            });
            if (!isTeacher) {
                return res.status(403).json({ message: "Not a member of this classroom" });
            }
        }

        const log = await ActivityLog.create({
            user: req.user._id,
            classroom: classroomId,
            action,
            targetType,
            targetId: targetId || null,
            targetTitle: targetTitle || "",
            metadata: metadata || {},
        });

        res.json({ message: "Activity logged", logId: log._id });
    } catch (err) {
        console.error("Log activity error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET CLASSROOM ACTIVITY LOG (Teacher only)
// ─────────────────────────────────────────────
router.get("/classroom/:id", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const { action, limit = 100, skip = 0 } = req.query;
        const filter = { classroom: req.params.id };
        if (action) filter.action = action;

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .populate("user", "name email profilePicture")
                .sort({ timestamp: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments(filter),
        ]);

        res.json({ logs, total, hasMore: total > parseInt(skip) + parseInt(limit) });
    } catch (err) {
        console.error("Get activity error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET ENGAGEMENT ANALYTICS (Teacher only)
// ─────────────────────────────────────────────
router.get("/classroom/:id/analytics", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const classroomId = req.params.id;
        const { days = 30 } = req.query;
        const sinceDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

        // Get approved members
        const members = await ClassroomMembership.find({
            classroom: classroomId,
            status: "approved",
        })
            .populate("student", "name email profilePicture lastLoginAt")
            .lean();

        const memberIds = members.map(m => m.student._id);

        // Get all activity logs in the period
        const logs = await ActivityLog.find({
            classroom: classroomId,
            timestamp: { $gte: sinceDate },
        }).lean();

        // --- Compute analytics ---

        // 1. Total views per content
        const contentViews = {};
        logs.forEach(log => {
            if (log.targetId) {
                if (!contentViews[log.targetId]) {
                    contentViews[log.targetId] = {
                        targetId: log.targetId,
                        targetTitle: log.targetTitle,
                        targetType: log.targetType,
                        viewCount: 0,
                        uniqueViewers: new Set(),
                    };
                }
                contentViews[log.targetId].viewCount++;
                contentViews[log.targetId].uniqueViewers.add(log.user.toString());
            }
        });

        // Convert Sets to counts
        const contentAnalytics = Object.values(contentViews).map(cv => ({
            ...cv,
            uniqueViewerCount: cv.uniqueViewers.size,
            uniqueViewers: undefined, // remove Set
        }));

        // 2. Per-student engagement
        const studentEngagement = {};
        logs.forEach(log => {
            const uid = log.user.toString();
            if (!studentEngagement[uid]) {
                studentEngagement[uid] = {
                    userId: uid,
                    totalActions: 0,
                    actions: {},
                    lastActive: null,
                    viewedContent: new Set(),
                };
            }
            studentEngagement[uid].totalActions++;
            studentEngagement[uid].actions[log.action] = (studentEngagement[uid].actions[log.action] || 0) + 1;
            if (!studentEngagement[uid].lastActive || log.timestamp > studentEngagement[uid].lastActive) {
                studentEngagement[uid].lastActive = log.timestamp;
            }
            if (log.targetId) {
                studentEngagement[uid].viewedContent.add(log.targetId);
            }
        });

        // Enrich with member info
        const memberMap = {};
        members.forEach(m => { memberMap[m.student._id.toString()] = m.student; });

        const studentAnalytics = Object.values(studentEngagement).map(se => ({
            ...se,
            student: memberMap[se.userId] || { name: "Unknown", email: "" },
            viewedContentCount: se.viewedContent.size,
            viewedContent: undefined,
        }));

        // 3. Who has NOT viewed any content
        const activeStudentIds = new Set(Object.keys(studentEngagement));
        const inactiveStudents = members
            .filter(m => !activeStudentIds.has(m.student._id.toString()))
            .map(m => m.student);

        // 4. Daily activity trend
        const dailyActivity = {};
        logs.forEach(log => {
            const day = log.timestamp.toISOString().split("T")[0];
            dailyActivity[day] = (dailyActivity[day] || 0) + 1;
        });

        // 5. Action breakdown
        const actionBreakdown = {};
        logs.forEach(log => {
            actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
        });

        res.json({
            summary: {
                totalMembers: members.length,
                activeStudents: activeStudentIds.size,
                inactiveStudents: inactiveStudents.length,
                totalInteractions: logs.length,
                periodDays: parseInt(days),
            },
            contentAnalytics: contentAnalytics.sort((a, b) => b.viewCount - a.viewCount),
            studentAnalytics: studentAnalytics.sort((a, b) => b.totalActions - a.totalActions),
            inactiveStudents,
            dailyActivity,
            actionBreakdown,
        });
    } catch (err) {
        console.error("Analytics error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET CONTENT VIEWERS (Teacher — who viewed specific content)
// ─────────────────────────────────────────────
router.get("/classroom/:id/content/:targetId", isAuthenticated, requireClassroomOwner, async (req, res) => {
    try {
        const viewers = await ActivityLog.find({
            classroom: req.params.id,
            targetId: req.params.targetId,
            action: { $in: ["view_material", "view_announcement", "view_quiz"] },
        })
            .populate("user", "name email profilePicture")
            .sort({ timestamp: -1 })
            .lean();

        // Unique viewers only
        const seen = new Set();
        const uniqueViewers = viewers.filter(v => {
            const uid = v.user._id.toString();
            if (seen.has(uid)) return false;
            seen.add(uid);
            return true;
        });

        res.json({
            viewers: uniqueViewers,
            totalViews: viewers.length,
            uniqueViewerCount: uniqueViewers.length,
        });
    } catch (err) {
        console.error("Content viewers error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
