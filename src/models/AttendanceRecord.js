import mongoose from "mongoose";

/**
 * AttendanceRecord — one per student per session.
 * Only stores PRESENT records. Absence = total sessions - present count.
 * status "present_suspicious" = marked but flagged for review.
 */
const attendanceRecordSchema = new mongoose.Schema(
    {
        session: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AttendanceSession",
            required: true,
        },
        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        markedAt: {
            type: Date,
            default: Date.now,
        },

        // ── Attendance validity status ───────────────────────────
        // present          → clean mark, no flags
        // present_suspicious → flagged (paste, fast typing, GPS mismatch)
        status: {
            type: String,
            enum: ["present", "present_suspicious"],
            default: "present",
        },

        // ── Student GPS at time of marking ───────────────────────
        studentLat: {
            type: Number,
            default: null,
        },
        studentLng: {
            type: Number,
            default: null,
        },
        // Calculated Haversine distance from teacher's GPS (meters)
        distanceMeters: {
            type: Number,
            default: null,
        },

        // ── Fraud signals ────────────────────────────────────────
        // Whether frontend reported a paste event on the code field
        pasteDetected: {
            type: Boolean,
            default: false,
        },
        // Time (ms) from first keypress to submit — short = suspicious
        typingDurationMs: {
            type: Number,
            default: null,
        },

        // ── Device binding ───────────────────────────────────────
        // SHA-256 of userAgent + IP (matches trustedDevices fingerprint)
        deviceFingerprint: {
            type: String,
            default: null,
        },

        // ── Suspicious reason(s) for audit clarity ───────────────
        // e.g. ["paste_detected", "typing_too_fast", "gps_far"]
        suspicionReasons: {
            type: [String],
            default: [],
        },

        // ── Advanced Device & Location Metadata ──────────────────
        // Captured from Vercel headers (IP, City, Country, OS/Browser)
        deviceMetadata: {
            type: Object,
            default: {},
        },
    },
    { timestamps: true }
);

// One mark per student per session (anti-cheat, DB-enforced)
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

// Fast student attendance lookups
attendanceRecordSchema.index({ student: 1, classroom: 1 });
attendanceRecordSchema.index({ classroom: 1, session: 1 });

// Suspicious records lookup for faculty review
attendanceRecordSchema.index({ classroom: 1, status: 1 });

export default mongoose.models.AttendanceRecord ||
    mongoose.model("AttendanceRecord", attendanceRecordSchema);
