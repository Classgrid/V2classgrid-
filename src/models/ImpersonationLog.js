import mongoose from "mongoose";

const impersonationLogSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        actingAsId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null,
        },
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

impersonationLogSchema.index({ adminId: 1 });
impersonationLogSchema.index({ organizationId: 1 });

export default mongoose.models.ImpersonationLog ||
    mongoose.model("ImpersonationLog", impersonationLogSchema);
