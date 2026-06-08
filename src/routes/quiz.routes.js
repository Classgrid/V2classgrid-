import express from "express";
import connectDB from "../../config/db.js";
import QuizSession from "../models/QuizSession.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * POST /api/quiz/save
 * Save a completed quiz session
 */
router.post("/save", isAuthenticated, async (req, res) => {
    try {
        await connectDB();
        const userId = req.user._id || req.user.id;
        const { subject, topic, difficulty, totalQuestions, questions, score, percentage, timeTaken, classroomId } = req.body;

        if (!subject || !topic || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const session = await QuizSession.create({
            userId,
            subject,
            topic,
            difficulty: difficulty || "medium",
            totalQuestions: totalQuestions || questions.length,
            questions,
            score: score || 0,
            percentage: percentage || 0,
            timeTaken: timeTaken || 0,
            classroomId: classroomId || "",
        });

        res.json({ success: true, message: "Quiz saved", sessionId: session._id });
    } catch (err) {
        console.error("Quiz save error:", err);
        res.status(500).json({ success: false, message: "Failed to save quiz" });
    }
});

/**
 * GET /api/quiz/history
 * Get quiz history for the logged-in user (last 20)
 */
router.get("/history", isAuthenticated, async (req, res) => {
    try {
        await connectDB();
        const userId = req.user._id || req.user.id;

        const history = await QuizSession.find({ userId })
            .sort({ completedAt: -1 })
            .limit(20)
            .select("subject topic difficulty score totalQuestions percentage timeTaken completedAt")
            .lean();

        res.json({ success: true, history });
    } catch (err) {
        console.error("Quiz history error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch quiz history" });
    }
});

export default router;
