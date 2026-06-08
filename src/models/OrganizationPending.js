import mongoose from "mongoose";

const organizationPendingSchema = new mongoose.Schema(
    {
        institute_name: {
            type: String,
            required: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
        },
        logo_url: {
            type: String,
            default: "",
        },
        website: {
            type: String,
            default: "",
        },
        designation: {
            type: String,
            default: "",
        },
        photo_url: {
            type: String,
            default: "",
        },
        owner_name: {
            type: String,
            required: true,
        },
        owner_email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
        },
        // Legacy status field — kept for backward compat
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        // ─── Plan-aware fields ───────────────────────
        planRequested: {
            type: String,
            enum: ["FREE", "PRO"],
            default: "FREE",
        },
        applicationStatus: {
            type: String,
            enum: ["pending_review", "pending_payment", "approved", "rejected"],
            default: "pending_review",
        },
        // ─── PRO payment fields ──────────────────────
        transactionId: {
            type: String,
            default: "",
        },
        paymentScreenshotUrl: {
            type: String,
            default: "",
        },
        paymentRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PaymentRequest",
            default: null,
        },
    },
    {
        timestamps: true, // Adds created_at and updated_at
    }
);

export default mongoose.model("OrganizationPending", organizationPendingSchema);
