import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
    {
        name: {
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
        owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        ownerName: { type: String, default: "" },
        ownerEmail: { type: String, default: "" },
        contactNumber: { type: String, default: "" },
        website: { type: String, default: "" },
        designation: { type: String, default: "" },
        plan: {
            type: String,
            enum: ["free", "pro", "plus", "FREE", "PLUS", "PRO"],
            default: "FREE",
        },
        planExpiresAt: {
            type: Date,
            default: null,
        },
        planActivatedAt: {
            type: Date,
            default: null,
        },
        razorpayCustomerId: {
            type: String,
            default: "",
        },
        razorpaySubscriptionId: {
            type: String,
            default: "",
        },
        razorpayOrderId: {
            type: String,
            default: "",
        },
        paymentMethod: {
            type: String,
            enum: ["razorpay", "manual", ""],
            default: "",
        },
        paymentAmount: {
            type: Number,
            default: 0,
        },
        studentLimit: {
            type: Number,
            default: 60,
        },
        faculty_limit: {
            type: Number,
            default: 5,
        },
        // Legacy code — kept for backward compat; new orgs use organizationCode
        private_code: {
            type: String,
            required: true,
            unique: true,
        },
        // 🏫 Organization Code — used by FACULTY to onboard (12-char uppercase alphanumeric)
        organizationCode: {
            type: String,
            unique: true,
            sparse: true,  // allow null for legacy orgs
        },
        // 🎓 Honor Code — used by STUDENTS to join the organization directly (12-char uppercase alphanumeric)
        honorCode: {
            type: String,
            unique: true,
            sparse: true,  // allow null for legacy orgs
        },
        is_active: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["active", "suspended", "blocked"],
            default: "active",
        },
        // 🆔 Label for student identifier — displayed as "PRN" or "Roll No"
        rollNumberLabel: {
            type: String,
            enum: ["PRN", "Roll No"],
            default: "PRN",
        },
    },
    {
        timestamps: true, // Adds created_at and updated_at
        optimisticConcurrency: true,
    }
);

organizationSchema.index({ owner_id: 1 });
organizationSchema.index({ status: 1 });
// NOTE: organizationCode and honorCode indexes are created automatically
// via { unique: true, sparse: true } on the field definition above.
// Do NOT add schema.index() for them here — that causes duplicate index warnings.

export default mongoose.models.Organization || mongoose.model("Organization", organizationSchema);
