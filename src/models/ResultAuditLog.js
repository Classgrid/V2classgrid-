import mongoose from "mongoose";

const resultAuditLogSchema = new mongoose.Schema(
    {
        examRecord: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ExamRecord",
            required: true,
        },
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: {
            type: String,
            required: true,
        },
        details: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

resultAuditLogSchema.index({ examRecord: 1, createdAt: -1 });
resultAuditLogSchema.index({ organization_id: 1 });

export default mongoose.models.ResultAuditLog || mongoose.model("ResultAuditLog", resultAuditLogSchema);
