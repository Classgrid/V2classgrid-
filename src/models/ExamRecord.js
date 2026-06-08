import mongoose from "mongoose";

const examRecordSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },

        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        organization_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },

        examType: {
            type: String,
            enum: ["unit_test", "assignment", "midterm", "final", "practical", "other"],
            default: "other",
        },

        // Multi-subject support: array of subjects linked to this exam
        subjects: [{
            subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "OrgSubject", default: null },
            subjectName: { type: String, required: true },
            maxMarks: { type: Number, required: true, min: 1 },
        }],

        // Total marks across all subjects (computed sum)
        totalMarks: {
            type: Number,
            required: true,
            min: 1,
        },

        passingMarks: {
            type: Number,
            default: 0,
        },

        // Uploaded file metadata
        uploadedFile: {
            originalName: { type: String, default: "" },
            uploadedAt: { type: Date, default: Date.now },
        },

        // Mapping stats from Excel processing
        mappingStats: {
            totalRows: { type: Number, default: 0 },
            matched: { type: Number, default: 0 },
            unmatched: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
        },

        // Pre-computed analytics (updated on confirm + mark edits)
        analytics: {
            classAverage: { type: Number, default: 0 },
            classMedian: { type: Number, default: 0 },
            highest: { type: Number, default: 0 },
            lowest: { type: Number, default: 0 },
            passCount: { type: Number, default: 0 },
            failCount: { type: Number, default: 0 },
            passPercentage: { type: Number, default: 0 },
            standardDeviation: { type: Number, default: 0 },
            gradeDistribution: {
                A: { type: Number, default: 0 },
                B: { type: Number, default: 0 },
                C: { type: Number, default: 0 },
                D: { type: Number, default: 0 },
                F: { type: Number, default: 0 },
            },
        },

        status: {
            type: String,
            enum: ["draft", "verified", "published", "locked", "processing", "active", "archived"],
            default: "draft",
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for fast queries
examRecordSchema.index({ classroom: 1, createdAt: -1 });
examRecordSchema.index({ teacher: 1 });
examRecordSchema.index({ organization_id: 1 });
examRecordSchema.index({ classroom: 1, title: 1 }); // duplicate detection

export default mongoose.model("ExamRecord", examRecordSchema);
