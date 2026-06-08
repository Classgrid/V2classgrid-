import mongoose from "mongoose";

const orgSubjectSchema = new mongoose.Schema(
    {
        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },

        // Optional: link subject to a specific classroom/class
        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            default: null,
        },

        subjectName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        maxMarks: {
            type: Number,
            required: true,
            min: 1,
            default: 20,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Unique subject name per org (same subject can't be added twice in one org)
orgSubjectSchema.index(
    { organization_id: 1, subjectName: 1 },
    { unique: true, collation: { locale: "en", strength: 2 } }
);

// Fast lookup by org
orgSubjectSchema.index({ organization_id: 1, isActive: 1 });

export default mongoose.model("OrgSubject", orgSubjectSchema);
