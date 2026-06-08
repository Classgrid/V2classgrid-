import mongoose from "mongoose";

const classroomMembershipSchema = new mongoose.Schema(
    {
        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },

        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },

        // When the student requested to join
        requestedAt: {
            type: Date,
            default: Date.now,
        },

        // When the teacher approved/rejected
        respondedAt: {
            type: Date,
            default: null,
        },

        // Teacher who responded
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Optional message from student
        requestMessage: {
            type: String,
            default: "",
            maxlength: 300,
        },

        // Optional reason for rejection
        rejectionReason: {
            type: String,
            default: "",
            maxlength: 300,
        },
    },
    {
        timestamps: true,
    }
);

// One membership record per student per classroom
classroomMembershipSchema.index(
    { classroom: 1, student: 1 },
    { unique: true }
);

// Fast lookups for teacher dashboard
classroomMembershipSchema.index({ classroom: 1, status: 1 });

// Fast lookups for student's classrooms
classroomMembershipSchema.index({ student: 1, status: 1 });

export default mongoose.model("ClassroomMembership", classroomMembershipSchema);
