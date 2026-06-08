import express from "express";
import {
    applyOrganization,
    addFaculty,
    removeFaculty,
    getOrganizationDetails,
    getOrgPublicInfo,
    getFaculties,
    getStudents,
    getClassrooms,
    validateOrganization,
    resetFacultyPassword,
    verifyOrgCode,
    requestDeleteOrganization,
    verifyDeleteOrganization,
    getOrganizationAnalytics,
    updateFaculty,
    updateFacultyRole,
    removeStudent,
    createOrganizationAnnouncement,
    getOrganizationAnnouncements,
    updateOrganizationAnnouncement,
    deleteOrganizationAnnouncement,
    getOrganizationAnnouncementStats,
    getAttendanceAnalytics,
    changeOrgAdminPassword,
    archiveClassroomByAdmin,
    getStudentPerformance,
    getOrgAuditLog,
    createUpgradeRequest,
    updateOrgLogo,
    getTestAccounts,
    createTestAccount,
    resetTestAccountPassword,
    deleteTestAccount
} from "../controllers/organization.controller.js";

import { validateOrganizationAnnouncement } from "../middleware/validation.middleware.js";
import {
    getOrgPendingNotes,
    approveOrgNote,
    rejectOrgNote,
} from "../controllers/admin.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import { validateOrganization as joiValidateOrg, validateApplyOrg, validateFaculty, validateOrgCode, validateVerifyCode } from "../middleware/validation.middleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiter for code verification — 10 attempts per 15 minutes per IP
const verifyCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: "Too many verification attempts. Please wait 15 minutes before trying again.", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

// Rate limiter for org applications — 5 attempts per 30 minutes per IP
const applyLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 5,
    message: { message: "Too many application attempts. Please wait before trying again.", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public: Apply for a new organization (rate limited)
router.post("/apply", applyLimiter, validateApplyOrg, applyOrganization);

// POST /api/org/verify-code — NEW dual code verification (faculty OR student)
// Authenticated + Rate limited
router.post("/verify-code", isAuthenticated, verifyCodeLimiter, validateVerifyCode, verifyOrgCode);

// POST /api/organization/validate — legacy endpoint (kept for backward compat)
router.post("/validate", isAuthenticated, validateOrgCode, validateOrganization);

// Org Admin + Super Admin routes (requirePasswordSet blocks org_admin if mustResetPassword=true)
router.post("/add-faculty", isAuthenticated, requireRole("super_admin", "org_admin"), validateFaculty, addFaculty);
router.delete("/remove-faculty/:id", isAuthenticated, requireRole("super_admin", "org_admin"), removeFaculty);
router.put("/faculty/:id", isAuthenticated, requireRole("super_admin", "org_admin"), updateFaculty);
router.put("/faculty/:id/role", isAuthenticated, requireRole("super_admin", "org_admin"), updateFacultyRole);
router.post("/reset-faculty-password", isAuthenticated, requireRole("super_admin", "org_admin"), resetFacultyPassword);
router.get("/me", isAuthenticated, requireRole("super_admin", "org_admin"), getOrganizationDetails);
router.get("/public-info", isAuthenticated, getOrgPublicInfo);
router.get("/faculties", isAuthenticated, requireRole("super_admin", "org_admin"), getFaculties);

router.delete("/remove-student/:id", isAuthenticated, requireRole("super_admin", "org_admin"), removeStudent);
router.get("/students", isAuthenticated, requireRole("super_admin", "org_admin"), getStudents);
router.get("/classrooms", isAuthenticated, requireRole("super_admin", "org_admin"), getClassrooms);
router.get("/analytics", isAuthenticated, requireRole("super_admin", "org_admin"), getOrganizationAnalytics);
router.get("/attendance-analytics", isAuthenticated, requireRole("super_admin", "org_admin"), getAttendanceAnalytics);

// Announcements (Smart Broadcast System)
router.post("/announcements", isAuthenticated, requireRole("super_admin", "org_admin"), validateOrganizationAnnouncement, createOrganizationAnnouncement);
router.get("/announcements", isAuthenticated, getOrganizationAnnouncements); // Accessible by faculty/students too, filtered inside controller
router.put("/announcements/:id", isAuthenticated, requireRole("super_admin", "org_admin"), validateOrganizationAnnouncement, updateOrganizationAnnouncement);
router.delete("/announcements/:id", isAuthenticated, requireRole("super_admin", "org_admin"), deleteOrganizationAnnouncement);
router.get("/announcements/:id/stats", isAuthenticated, requireRole("super_admin", "org_admin"), getOrganizationAnnouncementStats);

// Organisation deletion (Org Admin email verification flow)
router.post("/request-delete", isAuthenticated, requireRole("org_admin"), requestDeleteOrganization);
router.get("/verify-delete", verifyDeleteOrganization); // Public — accessed via email link

// Org Admin — Notes Review (scoped to their organization)
router.get("/notes/pending", isAuthenticated, requireRole("org_admin"), getOrgPendingNotes);
router.post("/notes/:id/approve", isAuthenticated, requireRole("org_admin"), approveOrgNote);
router.post("/notes/:id/reject", isAuthenticated, requireRole("org_admin"), rejectOrgNote);

// Org Admin — Change own password (in-dashboard)
router.post("/change-password", isAuthenticated, requireRole("org_admin", "super_admin"), changeOrgAdminPassword);

// Org Admin — Archive a classroom in their org (org-level admin action)
router.post("/archive-classroom/:id", isAuthenticated, requireRole("org_admin", "super_admin"), archiveClassroomByAdmin);

// Org Admin — Student Performance Snapshot (top 10, 5-min cached)
router.get("/student-performance", isAuthenticated, requireRole("org_admin", "super_admin"), getStudentPerformance);

// Org Admin — Admin Audit Log (last 50, this org only)
router.get("/audit-log", isAuthenticated, requireRole("org_admin"), getOrgAuditLog);

// Org Admin — Upgrade to PRO plan
router.post("/upgrade-request", isAuthenticated, requireRole("org_admin"), createUpgradeRequest);

// Org Admin — Update organization logo
router.put("/logo", isAuthenticated, requireRole("org_admin", "super_admin"), updateOrgLogo);

// Org Admin - Test Accounts (Role Sandbox)
router.get("/test-accounts", isAuthenticated, requireRole("org_admin", "super_admin"), getTestAccounts);
router.post("/test-accounts", isAuthenticated, requireRole("org_admin", "super_admin"), createTestAccount);
router.post("/test-accounts/:id/reset", isAuthenticated, requireRole("org_admin", "super_admin"), resetTestAccountPassword);
router.delete("/test-accounts/:id", isAuthenticated, requireRole("org_admin", "super_admin"), deleteTestAccount);

export default router;
