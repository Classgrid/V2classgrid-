import mongoose from "mongoose";

const organizationAnnouncementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ["announcement", "notice", "event", "holiday", "emergency"],
        default: "announcement",
    },
    organization_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    target_type: {
        type: String,
        enum: ["specific", "all"],
        default: "specific",
    },
    target_classrooms: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Classroom",
    }],
    plan_snapshot: {
        type: String,
        // The plan of the organization at the time of creation
        // This is useful for historical analytics or if the org downgrades later
        default: "FREE",
    },
    status: {
        type: String,
        enum: ["draft", "scheduled", "published"],
        default: "published",
    },
    sent_at: {
        type: Date,
        default: Date.now,
    },
    expires_at: {
        type: Date,
    },
    views_count: {
        type: Number,
        default: 0,
    }
}, { timestamps: true });

// Prevent targeted classrooms if target_type is 'all'
organizationAnnouncementSchema.pre("save", function () {
    if (this.target_type === "all") {
        this.target_classrooms = [];
    }
});

const OrganizationAnnouncement = mongoose.model("OrganizationAnnouncement", organizationAnnouncementSchema);
export default OrganizationAnnouncement;
