/**
 * Classgrid — Notification Email Service (v2.0 — Queue-Based)
 *
 * All email functions now ENQUEUE jobs into the email_jobs collection
 * instead of sending directly. The background worker (cron) processes
 * them with retry logic.
 *
 * All functions are defensive: they never throw, only log errors.
 * Uses enqueueBulkEmails() for batch job creation.
 */

import {
    enqueueEmail,
    enqueueBulkEmails,
} from "./email-queue.service.js";
import {
    getClassroomActivityEmailHtml,
    getClassroomActivityEmailPlainText,
    getJoinRequestEmailHtml,
    getJoinRequestEmailPlainText,
    getJoinApprovedEmailHtml,
    getJoinApprovedEmailPlainText,
    getAttendanceStartedEmailHtml,
    getAttendanceStartedEmailPlainText,
    getAbsenceNotificationEmailHtml,
    getAbsenceNotificationEmailPlainText,
} from "./email-templates.service.js";
import ClassroomMembership from "../models/ClassroomMembership.js";
import Classroom from "../models/Classroom.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";

const COOLDOWN_MS = 60_000; // 60 seconds

const FRONTEND_URL = () =>
    process.env.FRONTEND_URL?.trim() ||
    (process.env.NODE_ENV === "production"
        ? "https://classgrid.in"
        : "http://localhost:3000");

// ─────────────────────────────────────────────────
// 1. CLASSROOM ACTIVITY EMAILS
//    Called when faculty posts announcement / notes / quiz
//    Returns { emailAttempted, jobsCreated }
// ─────────────────────────────────────────────────
export async function sendClassroomActivityEmails({
    classroom,
    faculty,
    contentType,
    title,
    preview,
}) {
    try {
        // ── Defensive role check ────────────────────────────
        if (
            faculty.role !== "faculty" &&
            faculty.role !== "teacher"
        ) {
            console.warn(
                "[EmailNotification] Skipped: non-faculty/teacher role attempted to trigger emails",
                { userId: faculty._id, role: faculty.role }
            );
            return { emailAttempted: false, jobsCreated: 0 };
        }

        // ── Faculty preference check ────────────────────────
        if (faculty.emailNotifications?.emailOnPost === false) {
            console.log(
                "[EmailNotification] Faculty disabled emailOnPost",
                { facultyId: faculty._id }
            );
            return { emailAttempted: false, jobsCreated: 0 };
        }
        if (faculty.emailNotifications?.global === false) {
            console.log(
                "[EmailNotification] Faculty global email disabled",
                { facultyId: faculty._id }
            );
            return { emailAttempted: false, jobsCreated: 0 };
        }

        // ── DB-backed cooldown check (serverless-safe) ──────
        const freshClassroom = await Classroom.findById(classroom._id)
            .select("lastEmailSentAt lastEmailType name organization_id")
            .lean();

        if (freshClassroom) {
            const lastSent = freshClassroom.lastEmailSentAt;
            const lastType = freshClassroom.lastEmailType;
            if (
                lastSent &&
                lastType === contentType &&
                Date.now() - new Date(lastSent).getTime() < COOLDOWN_MS
            ) {
                console.log(
                    "[EmailNotification] Cooldown active, skipping",
                    { classroomId: classroom._id?.toString(), contentType, cooldownMs: COOLDOWN_MS }
                );
                return { emailAttempted: false, jobsCreated: 0 };
            }
        }

        // ── Map content type to student preference key ──────
        const prefKeyMap = {
            announcements: "announcements",
            materials: "notes",
            quizzes: "quizzes",
        };
        const prefKey = prefKeyMap[contentType];
        if (!prefKey) {
            console.warn("[EmailNotification] Unknown contentType:", contentType);
            return { emailAttempted: false, jobsCreated: 0 };
        }

        // ── Map content type to email job type ──────────────
        const jobTypeMap = {
            announcements: "announcement",
            materials: "notes",
            quizzes: "quiz",
        };

        // ── Fetch all approved student members in ONE query ─
        const memberships = await ClassroomMembership.find({
            classroom: classroom._id,
            status: "approved",
        })
            .populate("student", "name email emailNotifications")
            .lean();

        if (!memberships.length) return { emailAttempted: false, jobsCreated: 0 };

        // ── Filter students: instant mode + relevant pref ON ──
        const eligibleStudents = memberships
            .map((m) => m.student)
            .filter((s) => {
                if (!s || !s.email) return false;
                if (s.emailNotifications?.global === false) return false;
                if (s.emailNotifications?.[prefKey] === false) return false;
                const mode = s.emailNotifications?.digestMode || 'instant';
                if (mode !== 'instant') return false;
                return true;
            });

        if (!eligibleStudents.length) return { emailAttempted: false, jobsCreated: 0 };

        // ── Fetch organization name ─────────────────────────
        let orgName = "Classgrid";
        const orgId = freshClassroom?.organization_id || classroom.organization_id;
        if (orgId) {
            try {
                const org = await Organization.findById(orgId)
                    .select("name")
                    .lean();
                if (org) orgName = org.name;
            } catch {
                // Non-critical — fall back to "Classgrid"
            }
        }

        const classroomUrl = `${FRONTEND_URL()}/view-classroom.html?id=${classroom._id}`;

        // ── Build email payloads ────────────────────────────
        const templateData = {
            orgName,
            classroomName: freshClassroom?.name || classroom.name,
            facultyName: faculty.name,
            contentType,
            title: title || "Untitled",
            preview: (preview || "").substring(0, 150),
            classroomUrl,
        };

        const emailPayloads = eligibleStudents.map((student) => ({
            to: student.email,
            subject: `${templateData.title} — ${templateData.classroomName} | Classgrid`,
            html: getClassroomActivityEmailHtml(templateData),
            text: getClassroomActivityEmailPlainText(templateData),
            type: jobTypeMap[contentType] || "other",
            userId: student._id,
            classroomId: classroom._id,
        }));

        // ── Update cooldown BEFORE enqueueing (prevent race) ─
        await Classroom.updateOne(
            { _id: classroom._id },
            { $set: { lastEmailSentAt: new Date(), lastEmailType: contentType } }
        ).catch(() => { }); // Non-critical

        // ── Enqueue email jobs ──────────────────────────────
        console.log(
            `[EmailNotification] Enqueueing ${emailPayloads.length} email jobs for ${contentType}`,
            { classroomId: classroom._id?.toString() }
        );
        const jobs = await enqueueBulkEmails(emailPayloads);

        console.log(
            `[EmailNotification] Classroom activity emails queued: jobsCreated=${jobs.length}`,
            { classroomId: classroom._id?.toString(), contentType }
        );
        return { emailAttempted: true, jobsCreated: jobs.length };
    } catch (err) {
        console.error("[EmailNotification] classroom activity failed:", {
            classroomId: classroom?._id?.toString(),
            facultyId: faculty?._id?.toString(),
            contentType,
            error: err.message,
        });
        return { emailAttempted: false, jobsCreated: 0 };
    }
}

// ─────────────────────────────────────────────────
// 2. JOIN REQUEST EMAIL (to Faculty)
//    Called when a student requests to join
// ─────────────────────────────────────────────────
export async function sendJoinRequestEmail({ classroom, student }) {
    try {
        // Fetch the faculty user to check preferences
        const faculty = await User.findById(classroom.teacher)
            .select("name email emailNotifications")
            .lean();

        if (!faculty || !faculty.email) return;

        // Global check
        if (faculty.emailNotifications?.global === false) return;

        const reviewUrl = `${FRONTEND_URL()}/manage-classroom.html?id=${classroom._id}&tab=requests`;

        const html = getJoinRequestEmailHtml({
            studentName: student.name,
            classroomName: classroom.name,
            reviewUrl,
        });
        const text = getJoinRequestEmailPlainText({
            studentName: student.name,
            classroomName: classroom.name,
            reviewUrl,
        });

        await enqueueEmail({
            to: faculty.email,
            subject: `Join Request: ${student.name} → ${classroom.name} | Classgrid`,
            html,
            text,
            type: "join_request",
            userId: faculty._id,
            classroomId: classroom._id,
        });

        console.log("[EmailNotification] Join request email queued", {
            classroomId: classroom._id?.toString(),
            facultyEmail: faculty.email,
        });
    } catch (err) {
        console.error("[EmailNotification] join request email failed:", {
            classroomId: classroom?._id?.toString(),
            studentId: student?._id?.toString(),
            error: err.message,
        });
    }
}

// ─────────────────────────────────────────────────
// 3. JOIN APPROVED EMAIL (to Student)
//    Called when faculty approves a join request
// ─────────────────────────────────────────────────
export async function sendJoinApprovedEmail({ classroom, studentId }) {
    try {
        const student = await User.findById(studentId)
            .select("name email emailNotifications")
            .lean();

        if (!student || !student.email) return;

        // Global check
        if (student.emailNotifications?.global === false) return;
        // Per-type check
        if (student.emailNotifications?.joinApproval === false) return;

        const classroomUrl = `${FRONTEND_URL()}/view-classroom.html?id=${classroom._id}`;

        const html = getJoinApprovedEmailHtml({
            classroomName: classroom.name,
            classroomUrl,
        });
        const text = getJoinApprovedEmailPlainText({
            classroomName: classroom.name,
            classroomUrl,
        });

        await enqueueEmail({
            to: student.email,
            subject: `Joined: ${classroom.name} | Classgrid`,
            html,
            text,
            type: "join_approved",
            userId: student._id,
            classroomId: classroom._id,
        });

        console.log("[EmailNotification] Join approved email queued", {
            classroomId: classroom._id?.toString(),
            studentEmail: student.email,
        });
    } catch (err) {
        console.error("[EmailNotification] join approved email failed:", {
            classroomId: classroom?._id?.toString(),
            studentId: studentId?.toString(),
            error: err.message,
        });
    }
}

// ─────────────────────────────────────────────────
// 4. BULK JOIN APPROVED EMAILS (to multiple Students)
//    Called when faculty bulk-approves join requests
// ─────────────────────────────────────────────────
export async function sendBulkJoinApprovedEmails({ classroom, studentIds }) {
    try {
        if (!studentIds || !studentIds.length) return;

        const students = await User.find({
            _id: { $in: studentIds },
        })
            .select("name email emailNotifications")
            .lean();

        const classroomUrl = `${FRONTEND_URL()}/view-classroom.html?id=${classroom._id}`;

        const emailPayloads = students
            .filter((s) => {
                if (!s.email) return false;
                if (s.emailNotifications?.global === false) return false;
                if (s.emailNotifications?.joinApproval === false) return false;
                return true;
            })
            .map((student) => ({
                to: student.email,
                subject: `Joined: ${classroom.name} | Classgrid`,
                html: getJoinApprovedEmailHtml({
                    classroomName: classroom.name,
                    classroomUrl,
                }),
                text: getJoinApprovedEmailPlainText({
                    classroomName: classroom.name,
                    classroomUrl,
                }),
                type: "join_approved",
                userId: student._id,
                classroomId: classroom._id,
            }));

        if (!emailPayloads.length) return;

        const jobs = await enqueueBulkEmails(emailPayloads);
        console.log(
            `[EmailNotification] Bulk join approved: jobsCreated=${jobs.length}`,
            { classroomId: classroom._id?.toString() }
        );
    } catch (err) {
        console.error("[EmailNotification] bulk join approved failed:", {
            classroomId: classroom?._id?.toString(),
            error: err.message,
        });
    }
}

// ─────────────────────────────────────────────────
// 5. ATTENDANCE STARTED EMAILS (to Students)
//    Called when faculty starts an attendance session
//    No cooldown — attendance is time-critical (4 min)
// ─────────────────────────────────────────────────
export async function sendAttendanceStartedEmails({ classroom, faculty }) {
    try {
        // ── Fetch all approved student members ──────────────
        const memberships = await ClassroomMembership.find({
            classroom: classroom._id,
            status: "approved",
        })
            .populate("student", "name email emailNotifications")
            .lean();

        if (!memberships.length) return { emailAttempted: false, jobsCreated: 0 };

        // ── Filter students: global toggle + instant mode ───
        const eligibleStudents = memberships
            .map((m) => m.student)
            .filter((s) => {
                if (!s || !s.email) return false;
                if (s.emailNotifications?.global === false) return false;
                const mode = s.emailNotifications?.digestMode || 'instant';
                if (mode !== 'instant') return false;
                return true;
            });

        if (!eligibleStudents.length) return { emailAttempted: false, jobsCreated: 0 };

        const classroomUrl = `${FRONTEND_URL()}/view-classroom.html?id=${classroom._id}#attendance`;

        const emailPayloads = eligibleStudents.map((student) => ({
            to: student.email,
            subject: `Attendance Open — ${classroom.name} | Classgrid`,
            html: getAttendanceStartedEmailHtml({
                classroomName: classroom.name,
                facultyName: faculty.name,
                classroomUrl,
            }),
            text: getAttendanceStartedEmailPlainText({
                classroomName: classroom.name,
                facultyName: faculty.name,
                classroomUrl,
            }),
            type: "attendance",
            userId: student._id,
            classroomId: classroom._id,
        }));

        // ── Enqueue email jobs ──────────────────────────────
        const jobs = await enqueueBulkEmails(emailPayloads);
        console.log(
            `[EmailNotification] Attendance started emails queued: jobsCreated=${jobs.length}`,
            { classroomId: classroom._id?.toString() }
        );
        return { emailAttempted: true, jobsCreated: jobs.length };
    } catch (err) {
        console.error("[EmailNotification] attendance started emails failed:", {
            classroomId: classroom?._id?.toString(),
            error: err.message,
        });
        return { emailAttempted: false, jobsCreated: 0 };
    }
}

// ─────────────────────────────────────────────────
// 6. ABSENCE NOTIFICATION EMAILS (to Students)
//    Called after an attendance session expires.
//    Finds students who did NOT mark attendance and emails them.
// ─────────────────────────────────────────────────
export async function sendAbsenceNotificationEmails({ classroom, session }) {
    try {
        const AttendanceRecord = (await import("../models/AttendanceRecord.js")).default;

        // Get all approved members
        const memberships = await ClassroomMembership.find({
            classroom: classroom._id,
            status: "approved",
        })
            .populate("student", "name email emailNotifications")
            .lean();

        if (!memberships.length) return { emailAttempted: false, jobsCreated: 0 };

        // Get students who DID attend
        const records = await AttendanceRecord.find({ session: session._id }).select("student").lean();
        const presentSet = new Set(records.map(r => r.student.toString()));

        // Filter absent + email-eligible students
        const absentStudents = memberships
            .map(m => m.student)
            .filter(s => {
                if (!s || !s.email) return false;
                if (presentSet.has(s._id.toString())) return false; // was present
                if (s.emailNotifications?.global === false) return false;
                const mode = s.emailNotifications?.digestMode || 'instant';
                if (mode !== 'instant') return false;
                return true;
            });

        if (!absentStudents.length) return { emailAttempted: false, jobsCreated: 0 };

        const sessionDate = new Date(session.createdAt || session.startsAt)
            .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const classroomUrl = `${FRONTEND_URL()}/view-classroom.html?id=${classroom._id}#attendance`;

        const emailPayloads = absentStudents.map(student => ({
            to: student.email,
            subject: `Absent — ${classroom.name} | Classgrid`,
            html: getAbsenceNotificationEmailHtml({
                classroomName: classroom.name,
                sessionDate,
                classroomUrl,
            }),
            text: getAbsenceNotificationEmailPlainText({
                classroomName: classroom.name,
                sessionDate,
                classroomUrl,
            }),
            type: "absence",
            userId: student._id,
            classroomId: classroom._id,
        }));

        const jobs = await enqueueBulkEmails(emailPayloads);
        console.log(
            `[EmailNotification] Absence emails queued: jobsCreated=${jobs.length}`,
            { classroomId: classroom._id?.toString(), sessionId: session._id?.toString() }
        );
        return { emailAttempted: true, jobsCreated: jobs.length };
    } catch (err) {
        console.error("[EmailNotification] absence notification emails failed:", {
            classroomId: classroom?._id?.toString(),
            error: err.message,
        });
        return { emailAttempted: false, jobsCreated: 0 };
    }
}
