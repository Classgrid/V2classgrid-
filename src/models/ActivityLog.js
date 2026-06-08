import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },

        // What action was performed
        action: {
            type: String,
            required: true,
            enum: [
                "view_material",
                "view_announcement",
                "view_quiz",
                "submit_quiz",
                "open_chat",
                "send_message",
                "join_classroom",
                "download_material",
                "note_upload",
                "note_approved",
                "login",
                "announcement_created"
            ],
        },

        // Type of content interacted with
        targetType: {
            type: String,
            required: true,
            enum: ["material", "announcement", "quiz", "chat", "classroom", "note", "system", "org_announcement"],
        },

        // ID of the content (could be Supabase UUID or Mongo ObjectId)
        targetId: {
            type: String,
            default: null,
        },

        // Human-readable title for display
        targetTitle: {
            type: String,
            default: "",
        },

        // Flexible metadata for future features
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },

        // When this activity happened
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for analytics queries
activityLogSchema.index({ classroom: 1, action: 1, timestamp: -1 });
activityLogSchema.index({ classroom: 1, user: 1, timestamp: -1 });
activityLogSchema.index({ classroom: 1, targetId: 1, user: 1 });

// TTL index — auto-delete logs older than 1 year (optional, for scalability)
// activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("ActivityLog", activityLogSchema);
