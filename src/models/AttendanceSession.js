import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * AttendanceSession — one per lecture per classroom.
 * Faculty starts it, students mark attendance using code + GPS.
 */
const attendanceSessionSchema = new mongoose.Schema(
    {
        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },
        faculty: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        codeHash: {
            type: String,
            required: true, // bcrypt hash of the attendance code
        },

        // ── Session window ───────────────────────────────────────
        startsAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        // Teacher-selected duration in seconds (default 90s, max 600s)
        durationSeconds: {
            type: Number,
            default: 90,
            min: 30,
            max: 600,
        },

        // ── Single-use session token (returned to frontend) ──────
        // Prevents raw API attacks — mark must supply this token
        sessionToken: {
            type: String,
            default: () => uuidv4(),
        },

        // ── Teacher GPS anchor ───────────────────────────────────
        teacherLat: {
            type: Number,
            default: null,
        },
        teacherLng: {
            type: Number,
            default: null,
        },
        locationName: {
            type: String,
            default: null, // Reverse geocoded text (e.g. "PCCOE College")
        },
        // Captured from Vercel headers for the teacher
        teacherMetadata: {
            type: Object,
            default: {},
        },

        // ── Configurable radius (default 25m, test in real classroom first) ──
        radiusMeters: {
            type: Number,
            default: 25,
        },

        status: {
            type: String,
            enum: ["active", "expired"],
            default: "active",
        },
        presentCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Fast lookup: active sessions for a classroom
attendanceSessionSchema.index({ classroom: 1, status: 1 });
attendanceSessionSchema.index({ classroom: 1, createdAt: -1 });
// expireStale() queries: { classroom, status, expiresAt }
attendanceSessionSchema.index({ classroom: 1, status: 1, expiresAt: 1 });
// Token lookup for mark validation
attendanceSessionSchema.index({ sessionToken: 1 }, { sparse: true });

export default mongoose.models.AttendanceSession ||
    mongoose.model("AttendanceSession", attendanceSessionSchema);
