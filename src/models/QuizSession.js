import mongoose from "mongoose";

const quizSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        subject: { type: String, required: true },
        topic: { type: String, required: true },
        difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
        totalQuestions: { type: Number, required: true },
        questions: [
            {
                type: { type: String, enum: ["mcq", "written"], required: true },
                question: { type: String, required: true },
                options: [String], // MCQ only
                correctAnswer: { type: String, required: true },
                studentAnswer: { type: String, default: "" },
                isCorrect: { type: Boolean, default: false },
                explanation: { type: String, default: "" },
            },
        ],
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        timeTaken: { type: Number, default: 0 }, // seconds
        classroomId: { type: String, default: "" },
        completedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default mongoose.model("QuizSession", quizSessionSchema);
