import mongoose from "mongoose";

// Tracks which students viewed which notes
const noteViewSchema = new mongoose.Schema(
    {
        noteId: {
            type: String, // Supabase note ID
            required: true,
        },
        noteTitle: {
            type: String,
            required: true,
        },
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        studentName: {
            type: String,
            required: true,
        },
        studentEmail: {
            type: String,
            required: true,
        },
        uploadedBy: {
            type: String, // Teacher's email or name
            required: true,
        },
        viewedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Compound index: one view record per student per note
noteViewSchema.index({ noteId: 1, studentId: 1 }, { unique: true });

export default mongoose.model("NoteView", noteViewSchema);
