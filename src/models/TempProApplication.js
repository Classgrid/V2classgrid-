import mongoose from "mongoose";

/**
 * Temporary storage for PRO application form data.
 * Created when the Razorpay order is generated, deleted when the webhook processes payment.
 * Auto-expires after 1 hour via TTL index (handles abandoned/cancelled payments).
 */
const tempProApplicationSchema = new mongoose.Schema(
    {
        institute_name: { type: String, required: true, trim: true },
        address: { type: String, required: true },
        logo_url: { type: String, default: "" },
        website: { type: String, default: "" },
        designation: { type: String, default: "" },
        owner_name: { type: String, required: true },
        owner_email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, required: true },
        razorpayOrderId: { type: String, required: true, index: true },
        createdAt: { type: Date, default: Date.now },
    }
);

// 24 hours — Razorpay can retry webhooks for up to 24 hours on failure
tempProApplicationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("TempProApplication", tempProApplicationSchema);
