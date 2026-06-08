import express from "express";
import { requirePlan } from "../middleware/plan.middleware.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import NoteView from "../models/NoteView.js";
import Quiz from "../models/Quiz.js";
import { verifyAndSummarize, generateQuizFromContent } from "../services/notes-ai.service.js";

import { studentNotesClient } from "../config/supabaseClient.js"; // Needed for student notes

const router = express.Router();

// ─────────────────────────────────────────────
// STUDENT NOTES — Upload URL (Organization scope)
// ─────────────────────────────────────────────
router.post("/upload-url", isAuthenticated, async (req, res) => {
    try {
        const { fileName, fileSize } = req.body;
        if (!fileName) return res.status(400).json({ message: "fileName required" });

        // 25MB limit
        if (fileSize && fileSize > 25 * 1024 * 1024) {
            return res.status(400).json({ message: "File size must be under 25MB" });
        }

        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "User must belong to an organization" });

        const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `student-notes/${orgId}/${Date.now()}_${Math.floor(Math.random() * 1000)}_${sanitized}`;

        const { data, error } = await studentNotesClient.storage
            .from('notes-files')
            .createSignedUploadUrl(path, 60);

        if (error) throw error;

        res.json({ path, token: data.token, signedUrl: data.signedUrl });
    } catch (err) {
        console.error("Student note upload-url error:", err);
        res.status(500).json({ message: "Server error generating upload URL" });
    }
});

// ─────────────────────────────────────────────
// STUDENT NOTES — Create metadata (after upload), Pending Review
// ─────────────────────────────────────────────
router.post("/", isAuthenticated, async (req, res) => {
    try {
        const { title, description, filePath, note_type } = req.body;
        if (!title || !filePath) return res.status(400).json({ message: "title and filePath required" });

        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "User must belong to an organization" });

        // Validate note_type
        const VALID_NOTE_TYPES = ['self_made', 'teacher', 'buyed', 'university'];
        const noteType = VALID_NOTE_TYPES.includes(note_type) ? note_type : 'self_made';

        // Get public URL
        const { data: { publicUrl } } = studentNotesClient.storage
            .from('notes-files')
            .getPublicUrl(filePath);

        const noteData = {
            title: title.substring(0, 200),
            description: (description || '').substring(0, 500),
            file_url: publicUrl,
            file_path: filePath,
            organization_id: orgId.toString(),
            uploaded_by: req.user.name,
            uploader_id: req.user._id.toString(),
            uploader_role: req.user.role || 'student',
            note_type: noteType,
            status: 'pending', // Requires super-admin review
            created_at: new Date().toISOString(),
        };

        const { data, error } = await studentNotesClient
            .from('student_notes')
            .insert([noteData])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ message: "Note uploaded successfully and is pending review.", note: data });
    } catch (err) {
        console.error("Student note create error:", err);
        res.status(500).json({ message: "Server error saving note" });
    }
});

// ─────────────────────────────────────────────
// STUDENT NOTES — List approved notes for user's Organization
// ─────────────────────────────────────────────
router.get("/org", isAuthenticated, async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        if (!orgId) return res.status(400).json({ message: "User must belong to an organization" });

        console.log("Notes /org: Querying for orgId:", orgId.toString());

        const { data: notes, error } = await studentNotesClient
            .from('student_notes')
            .select('*')
            .eq('organization_id', orgId.toString())
            .eq('status', 'approved') // Only show approved notes
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error("Supabase student_notes query error:", JSON.stringify(error));
            throw error;
        }

        res.json({ notes: notes || [], total: notes?.length || 0 });
    } catch (err) {
        console.error("Student notes list error:", err.message || err);
        res.status(500).json({ message: "Server error loading notes", detail: err.message || "Unknown error" });
    }
});

// ─────────────────────────────────────────────
// MY NOTES — User's own uploads (all statuses)
// ─────────────────────────────────────────────
router.get("/my-notes", isAuthenticated, async (req, res) => {
    try {
        const userId = req.user._id.toString();

        const { data: notes, error } = await studentNotesClient
            .from('student_notes')
            .select('*')
            .eq('uploader_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({ notes: notes || [], total: notes?.length || 0 });
    } catch (err) {
        console.error("My notes error:", err.message || err);
        res.status(500).json({ message: "Server error loading your notes" });
    }
});

// ─────────────────────────────────────────────
// TRACK NOTE VIEW (Student opened a note)
// ─────────────────────────────────────────────
router.post("/view", isAuthenticated, async (req, res) => {
    try {
        const { noteId, noteTitle, uploadedBy } = req.body;

        if (!noteId || !noteTitle) {
            return res.status(400).json({ message: "noteId and noteTitle required" });
        }

        // Upsert: update viewedAt if already viewed, create if not
        await NoteView.findOneAndUpdate(
            { noteId, studentId: req.user._id },
            {
                noteId,
                noteTitle,
                studentId: req.user._id,
                studentName: req.user.name,
                studentEmail: req.user.email,
                uploadedBy: uploadedBy || "Unknown",
                viewedAt: new Date(),
            },
            { upsert: true, returnDocument: "after" }
        );

        res.json({ message: "View tracked" });
    } catch (err) {
        console.error("Track view error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET NOTE VIEWERS (Teacher/Faculty sees who viewed)
// ─────────────────────────────────────────────
router.get("/views/:noteId", isAuthenticated, requireRole("teacher", "faculty"), async (req, res) => {
    try {
        const views = await NoteView.find({ noteId: req.params.noteId })
            .sort({ viewedAt: -1 })
            .lean();

        res.json({ views, total: views.length });
    } catch (err) {
        console.error("Get views error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET ALL VIEWS FOR A TEACHER (engagement overview)
// ─────────────────────────────────────────────
router.get("/my-views", isAuthenticated, requireRole("teacher", "faculty"), async (req, res) => {
    try {
        const views = await NoteView.find({ uploadedBy: req.user.email })
            .sort({ viewedAt: -1 })
            .lean();

        // Group by noteId
        const grouped = {};
        views.forEach((v) => {
            if (!grouped[v.noteId]) {
                grouped[v.noteId] = { noteTitle: v.noteTitle, noteId: v.noteId, viewers: [] };
            }
            grouped[v.noteId].viewers.push({
                name: v.studentName,
                email: v.studentEmail,
                viewedAt: v.viewedAt,
            });
        });

        res.json({
            totalViews: views.length,
            uniqueStudents: [...new Set(views.map((v) => v.studentEmail))].length,
            notes: Object.values(grouped),
        });
    } catch (err) {
        console.error("My views error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// AI VERIFY & SUMMARIZE NOTE
// ─────────────────────────────────────────────
router.post("/verify", isAuthenticated, requireRole("teacher", "faculty"), async (req, res) => {
    try {
        const { noteContent, noteTitle } = req.body;

        if (!noteContent || !noteTitle) {
            return res.status(400).json({ message: "noteContent and noteTitle required" });
        }

        const result = await verifyAndSummarize(noteContent, noteTitle);
        res.json(result);
    } catch (err) {
        console.error("AI verify error:", err);
        res.status(500).json({ message: "AI verification failed" });
    }
});

// ─────────────────────────────────────────────
// AI GENERATE QUIZ FROM NOTE
// ─────────────────────────────────────────────
router.post("/generate-quiz", isAuthenticated, requireRole("teacher", "faculty"), async (req, res) => {
    try {
        const { noteContent, noteTitle, noteId } = req.body;

        if (!noteContent || !noteTitle || !noteId) {
            return res.status(400).json({ message: "noteContent, noteTitle, and noteId required" });
        }

        // Check if quiz already exists for this note
        let quiz = await Quiz.findOne({ noteId });
        if (quiz) {
            return res.json({ quiz, existing: true, message: "Quiz already exists for this note" });
        }

        // Generate via AI
        const questions = await generateQuizFromContent(noteContent, noteTitle);

        // Save to DB
        quiz = await Quiz.create({
            noteId,
            noteTitle,
            createdBy: req.user._id,
            questions,
        });

        res.json({ quiz, existing: false, message: "Quiz generated successfully" });
    } catch (err) {
        console.error("Generate quiz error:", err);
        res.status(500).json({ message: "Quiz generation failed" });
    }
});

// ─────────────────────────────────────────────
// GET QUIZ FOR A NOTE
// ─────────────────────────────────────────────
router.get("/quiz/:noteId", isAuthenticated, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ noteId: req.params.noteId });
        if (!quiz) {
            return res.status(404).json({ message: "No quiz found for this note" });
        }
        res.json({ quiz });
    } catch (err) {
        console.error("Get quiz error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// SUBMIT QUIZ (Student submits answers)
// ─────────────────────────────────────────────
router.post("/quiz/:noteId/submit", isAuthenticated, async (req, res) => {
    try {
        const { answers } = req.body;
        const quiz = await Quiz.findOne({ noteId: req.params.noteId });

        if (!quiz) {
            return res.status(404).json({ message: "Quiz not found" });
        }

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ message: "Answers array required" });
        }

        // Grade the quiz
        let score = 0;
        const results = quiz.questions.map((q, i) => {
            const studentAnswer = answers[i] || "";
            const isCorrect = studentAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            if (isCorrect) score++;
            return {
                question: q.question,
                studentAnswer,
                correctAnswer: q.correctAnswer,
                isCorrect,
                explanation: q.explanation,
            };
        });

        const percentage = Math.round((score / quiz.questions.length) * 100);

        // Save attempt
        quiz.attempts.push({
            studentId: req.user._id,
            studentName: req.user.name,
            score,
            totalQuestions: quiz.questions.length,
            percentage,
            answers,
        });
        await quiz.save();

        res.json({ score, total: quiz.questions.length, percentage, results });
    } catch (err) {
        console.error("Submit quiz error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET QUIZ ANALYTICS (Teacher/Faculty)
// ─────────────────────────────────────────────
router.get("/quiz-analytics/:noteId", isAuthenticated, requirePlan("PRO"), requireRole("teacher", "faculty"), async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ noteId: req.params.noteId });
        if (!quiz) {
            return res.status(404).json({ message: "No quiz found" });
        }

        const attempts = quiz.attempts || [];
        const avgScore = attempts.length > 0
            ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length)
            : 0;

        const topPerformers = [...attempts]
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        res.json({
            totalAttempts: attempts.length,
            averageScore: avgScore,
            passRate: attempts.length > 0
                ? Math.round((attempts.filter((a) => a.percentage >= 50).length / attempts.length) * 100)
                : 0,
            topPerformers,
            attempts,
        });
    } catch (err) {
        console.error("Quiz analytics error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
