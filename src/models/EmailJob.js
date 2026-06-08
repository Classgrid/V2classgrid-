/**
 * Classgrid — EmailJob Model
 *
 * MongoDB-backed email job queue. Each document represents a single
 * email to be sent. The background worker picks up pending jobs,
 * sends them, and updates status. Failed jobs are retried with
 * exponential backoff (max 3 attempts).
 */

import mongoose from "mongoose";

const emailJobSchema = new mongoose.Schema(
    {
        // ── Recipient & Content ─────────────────────────
        to: { type: String, required: true },
        subject: { type: String, required: true },
        html: { type: String, required: true },
        text: { type: String, default: "" },

        // ── Classification ──────────────────────────────
        type: {
            type: String,
            enum: [
                "announcement",
                "quiz",
                "notes",
                "join_request",
                "join_approved",
                "attendance",
                "absence",
                "other",
            ],
            default: "other",
        },

        // ── References ──────────────────────────────────
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
        organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },

        // ── Job State ───────────────────────────────────
        status: {
            type: String,
            enum: ["pending", "processing", "sent", "failed"],
            default: "pending",
        },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 },
        error: { type: String, default: null },
        nextRetryAt: { type: Date, default: Date.now },
        processedAt: { type: Date, default: null },
    },
    {
        timestamps: true, // adds createdAt, updatedAt
    }
);

// ── Indexes for worker queries & monitoring ─────────
emailJobSchema.index({ status: 1, nextRetryAt: 1 });
emailJobSchema.index({ classroomId: 1, type: 1, createdAt: -1 });
emailJobSchema.index({ userId: 1, createdAt: -1 });
emailJobSchema.index({ organizationId: 1, createdAt: -1 });
emailJobSchema.index({ type: 1 });

const EmailJob = mongoose.model("EmailJob", emailJobSchema);

export default EmailJob;
