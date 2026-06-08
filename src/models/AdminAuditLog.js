import mongoose from "mongoose";

/**
 * AdminAuditLog — immutable record of every admin action.
 * Actor fields are ALWAYS derived server-side from req.user.
 * NEVER accept actorName / actorRole / organization_id from the request body.
 */
const adminAuditLogSchema = new mongoose.Schema(
    {
        // ── Actor (who did it) ──────────────────────────────────
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        actorName: { type: String, required: true },
        actorRole: {
            type: String,
            enum: ["org_admin", "super_admin"],
            required: true,
        },

        // ── Scope ──────────────────────────────────────────────
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null,
        },
        organizationName: { type: String, default: "" },

        // ── Action ─────────────────────────────────────────────
        action: {
            type: String,
            required: true,
            enum: [
                "add_faculty",
                "remove_faculty",
                "remove_student",
                "change_role",
                "archive_classroom",
                "restore_classroom",
                "approve_note",
                "reject_note",
                "create_announcement",
                "delete_announcement",
                "approve_org",
                "reject_org",
                "suspend_org",
                "block_org",
                "reactivate_org",
                "delete_org",
                "suspend_user",
                "block_user",
                "delete_user",
                "reactivate_user",
                "change_password",
                "login_as_demo",
                // ── Attendance security actions ─────────────────
                "attendance_suspicious",       // student flagged during mark
                "attendance_manual_override",  // teacher manually marks/unmarks
            ],
        },

        // ── Target (what was affected) ─────────────────────────
        targetId: { type: String, default: null },
        targetName: { type: String, default: "" },
        targetType: {
            type: String,
            enum: ["faculty", "student", "classroom", "note", "announcement", "organization", "user", "demo", "AttendanceSession", "AttendanceRecord"],
            required: true,
        },

        // ── Extra diff metadata (old → new role, etc.) ─────────
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        // ── Request context (security) ──────────────────────────
        ip: { type: String, default: "" },
        userAgent: { type: String, default: "" },

        // ── Timestamp (indexed for fast time-range queries) ────
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false, // using custom `timestamp` field
    }
);

// Compound indexes for dashboard queries
adminAuditLogSchema.index({ organization_id: 1, timestamp: -1 });
adminAuditLogSchema.index({ actorId: 1, timestamp: -1 });
adminAuditLogSchema.index({ action: 1, timestamp: -1 });

// TTL: auto-delete logs older than 2 years
// adminAuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 }); // Commented out to prevent "duplicate index" crash on startup

export default mongoose.models.AdminAuditLog ||
    mongoose.model("AdminAuditLog", adminAuditLogSchema);
