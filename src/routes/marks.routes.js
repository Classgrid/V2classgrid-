import express from "express";
import multer from "multer";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import { requirePlan } from "../middleware/plan.middleware.js";
import { requireClassroomOwner } from "../middleware/classroom.middleware.js";
import ExamRecord from "../models/ExamRecord.js";
import StudentMark from "../models/StudentMark.js";
import Classroom from "../models/Classroom.js";
import ClassroomMembership from "../models/ClassroomMembership.js";
import ResultAuditLog from "../models/ResultAuditLog.js";
import Organization from "../models/Organization.js";
import OrgSubject from "../models/OrgSubject.js";
import User from "../models/User.js";
import connectDB from "../../config/db.js";
import {
    parseExcelFile,
    autoDetectColumns,
    mapStudentsToExcel,
    calculateGrade,
    assignRanks,
    calculateAnalytics,
} from "../services/marks.service.js";
import { studentNotesClient } from "../config/supabaseClient.js";

const router = express.Router();

// Multer config — 5MB max, xlsx/xls/csv only
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
            "application/vnd.ms-excel", // .xls
            "text/csv",
            "application/csv",
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Only .xlsx, .xls, and .csv files are supported"));
        }
    },
});

// ─────────────────────────────────────────────────────────
// POST /upload/:classroomId — Upload Excel, parse, return preview
// ─────────────────────────────────────────────────────────
router.post(
    "/upload/:classroomId",
    isAuthenticated,
    requirePlan("PRO"),
    requireClassroomOwner,
    upload.single("file"),
    async (req, res) => {
        try {
            await connectDB();
            const { classroomId } = req.params;
            const { title, examType, totalMarks, passingMarks, prnColumn, marksColumn, nameColumn } = req.body;

            if (!req.file) return res.status(400).json({ message: "No file uploaded" });
            if (!title || !title.trim()) return res.status(400).json({ message: "Exam title is required" });

            const total = parseFloat(totalMarks);
            if (!total || total <= 0) return res.status(400).json({ message: "Total marks must be a positive number" });

            // Parse the Excel file
            const parsed = parseExcelFile(req.file.buffer, req.file.originalname);

            // Detect or use provided column mappings
            const detected = autoDetectColumns(parsed.headers);
            const prnCol = prnColumn || detected.prnColumn;
            const marksCol = marksColumn || detected.marksColumn;
            const nameCol = nameColumn || detected.nameColumn;

            if (!prnCol) {
                return res.status(400).json({
                    message: "Could not detect PRN/Roll No column. Please specify column names.",
                    headers: parsed.headers,
                    detectedColumns: detected,
                });
            }

            if (!marksCol) {
                return res.status(400).json({
                    message: "Could not detect Marks column. Please specify column names.",
                    headers: parsed.headers,
                    detectedColumns: detected,
                });
            }

            // Match students
            const orgId = req.user.organization_id;
            const mapping = await mapStudentsToExcel(parsed.rows, prnCol, marksCol, nameCol, classroomId, orgId);

            // Create ExamRecord in "processing" state
            const examRecord = await ExamRecord.create({
                title: title.trim(),
                classroom: classroomId,
                teacher: req.user._id,
                organization_id: orgId,
                examType: examType || "other",
                totalMarks: total,
                passingMarks: parseFloat(passingMarks) || 0,
                uploadedFile: {
                    originalName: req.file.originalname,
                    uploadedAt: new Date(),
                },
                mappingStats: {
                    totalRows: parsed.totalRows,
                    matched: mapping.matched.length,
                    unmatched: mapping.unmatched.length,
                    skipped: mapping.duplicates.length,
                },
                status: "processing",
            });

            res.json({
                message: "File parsed successfully. Review the preview and confirm.",
                examId: examRecord._id,
                fileName: req.file.originalname,
                detectedColumns: { prnColumn: prnCol, marksColumn: marksCol, nameColumn: nameCol },
                headers: parsed.headers,
                stats: {
                    totalRows: parsed.totalRows,
                    matched: mapping.matched.length,
                    unmatched: mapping.unmatched.length,
                    duplicates: mapping.duplicates.length,
                    totalStudentsInClass: mapping.totalStudentsInClass,
                },
                matched: mapping.matched,
                unmatched: mapping.unmatched,
                duplicates: mapping.duplicates,
            });
        } catch (err) {
            // Multer errors
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({ message: "File too large. Max 5MB allowed." });
                }
                return res.status(400).json({ message: err.message });
            }
            console.error("[Marks] Upload error:", err);
            res.status(500).json({ message: err.message || "Server error processing file" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// POST /confirm/:examId — Finalize marks from preview
// ─────────────────────────────────────────────────────────
router.post(
    "/confirm/:examId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId);

            if (!exam) return res.status(404).json({ message: "Exam record not found" });
            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }
            if (exam.status !== "processing") {
                return res.status(400).json({ message: "This exam has already been confirmed" });
            }

            const { matched } = req.body;
            if (!matched || !Array.isArray(matched) || matched.length === 0) {
                return res.status(400).json({ message: "No matched students to save" });
            }

            // Create StudentMark records
            const markDocs = matched.map(m => ({
                examRecord: exam._id,
                student: m.studentId,
                classroom: exam.classroom,
                organization_id: exam.organization_id,
                prn: m.studentPRN || m.rawPRN || "",
                marksObtained: m.marksObtained,
                totalMarks: exam.totalMarks,
                percentage: Math.round((m.marksObtained / exam.totalMarks) * 10000) / 100,
                grade: calculateGrade((m.marksObtained / exam.totalMarks) * 100),
                isPassed: exam.passingMarks > 0
                    ? m.marksObtained >= exam.passingMarks
                    : (m.marksObtained / exam.totalMarks) * 100 >= 45,
            }));

            // Assign ranks
            const ranked = assignRanks(markDocs);

            // Bulk insert
            await StudentMark.insertMany(ranked);

            // Calculate and store analytics
            const analytics = calculateAnalytics(ranked, exam.totalMarks, exam.passingMarks);
            exam.analytics = analytics;
            exam.status = "active";
            await exam.save();

            res.json({
                message: "Marks saved successfully!",
                examId: exam._id,
                totalSaved: ranked.length,
                analytics,
            });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ message: "Some marks already exist for this exam. Delete the exam first and re-upload." });
            }
            console.error("[Marks] Confirm error:", err);
            res.status(500).json({ message: "Server error saving marks" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /classroom/:classroomId — List all exams for a classroom
// ─────────────────────────────────────────────────────────
router.get(
    "/classroom/:classroomId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const { classroomId } = req.params;

            // Verify access — teacher or member
            const classroom = await Classroom.findById(classroomId).lean();
            if (!classroom) return res.status(404).json({ message: "Classroom not found" });

            const isTeacher = classroom.teacher.toString() === req.user._id.toString();
            if (!isTeacher) {
                // Check if student is a member
                const membership = await ClassroomMembership.findOne({
                    classroom: classroomId,
                    student: req.user._id,
                    status: "approved",
                }).lean();
                if (!membership) return res.status(403).json({ message: "Not authorized" });
            }

            const exams = await ExamRecord.find({
                classroom: classroomId,
                status: { $in: ["active", "processing"] },
            })
                .sort({ createdAt: -1 })
                .select("title examType totalMarks passingMarks status analytics.classAverage analytics.highest mappingStats createdAt")
                .lean();

            res.json({ exams, total: exams.length });
        } catch (err) {
            console.error("[Marks] List exams error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /exam/:examId — Full exam details + all marks
// ─────────────────────────────────────────────────────────
router.get(
    "/exam/:examId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId).lean();
            if (!exam) return res.status(404).json({ message: "Exam not found" });

            // Verify teacher
            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const marks = await StudentMark.find({ examRecord: exam._id })
                .populate("student", "name email prn")
                .sort({ rank: 1 })
                .lean();

            res.json({ exam, marks, totalStudents: marks.length });
        } catch (err) {
            console.error("[Marks] Exam detail error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /exam/:examId/analytics — Class analytics for one exam
// ─────────────────────────────────────────────────────────
router.get(
    "/exam/:examId/analytics",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId)
                .select("title analytics totalMarks passingMarks classroom teacher")
                .lean();
            if (!exam) return res.status(404).json({ message: "Exam not found" });

            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            res.json({ examId: exam._id, title: exam.title, analytics: exam.analytics });
        } catch (err) {
            console.error("[Marks] Analytics error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /student/me — Student's own marks across all exams
// ─────────────────────────────────────────────────────────
router.get(
    "/student/me",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const marks = await StudentMark.find({
                student: req.user._id,
                organization_id: req.user.organization_id,
            })
                .populate({
                    path: "examRecord",
                    select: "title examType totalMarks passingMarks createdAt status",
                    match: { status: { $in: ["published", "locked", "active"] } } // "active" included for legacy support
                })
                .populate("classroom", "name subject")
                .sort({ createdAt: -1 })
                .lean();

            // Filter out marks where examRecord is null (because it didn't match the status)
            const validMarks = marks.filter(m => m.examRecord != null);

            // Group by classroom
            const grouped = {};
            for (const mark of validMarks) {
                const cid = mark.classroom?._id?.toString() || "unknown";
                if (!grouped[cid]) {
                    grouped[cid] = {
                        classroomId: cid,
                        classroomName: mark.classroom?.name || "Unknown",
                        subject: mark.classroom?.subject || "",
                        marks: [],
                    };
                }
                grouped[cid].marks.push({
                    examTitle: mark.examRecord?.title || "Unknown Exam",
                    examType: mark.examRecord?.examType || "other",
                    marksObtained: mark.marksObtained,
                    totalMarks: mark.totalMarks,
                    percentage: mark.percentage,
                    grade: mark.grade,
                    rank: mark.rank,
                    isPassed: mark.isPassed,
                    subjectMarks: mark.subjectMarks || [],
                    date: mark.examRecord?.createdAt,
                });
            }

            // Fetch org info for result sheet header
            let organization = {};
            try {
                const org = await Organization.findById(req.user.organization_id)
                    .select("name logo_url address")
                    .lean();
                if (org) organization = { name: org.name, logoUrl: org.logo_url, address: org.address };
            } catch (e) { /* non-critical */ }

            res.json({
                totalExams: marks.length,
                classrooms: Object.values(grouped),
                organization,
                student: { name: req.user.name, prn: req.user.prn, email: req.user.email },
            });
        } catch (err) {
            console.error("[Marks] Student marks error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /student/:studentId — Specific student's marks (teacher)
// ─────────────────────────────────────────────────────────
router.get(
    "/student/:studentId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const { studentId } = req.params;
            const { classroomId } = req.query;

            if (!classroomId) return res.status(400).json({ message: "classroomId query param is required" });

            // Verify teacher owns this classroom
            const classroom = await Classroom.findById(classroomId).lean();
            if (!classroom || classroom.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const marks = await StudentMark.find({
                student: studentId,
                classroom: classroomId,
            })
                .populate("examRecord", "title examType totalMarks createdAt")
                .sort({ createdAt: -1 })
                .lean();

            res.json({ marks, total: marks.length });
        } catch (err) {
            console.error("[Marks] Student detail error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// PUT /exam/:examId/mark/:markId — Edit individual mark
// ─────────────────────────────────────────────────────────
router.put(
    "/exam/:examId/mark/:markId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId);
            if (!exam) return res.status(404).json({ message: "Exam not found" });
            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const { subjectMarks } = req.body;
            if (!subjectMarks || !Array.isArray(subjectMarks)) {
                return res.status(400).json({ message: "subjectMarks array is required" });
            }

            const mark = await StudentMark.findById(req.params.markId);
            if (!mark || mark.examRecord.toString() !== exam._id.toString()) {
                return res.status(404).json({ message: "Mark not found" });
            }

            // Push old state to history
            mark.history.push({
                updatedAt: new Date(),
                updatedBy: req.user._id,
                subjectMarks: [...mark.subjectMarks],
                marksObtained: mark.marksObtained,
                percentage: mark.percentage,
                grade: mark.grade,
                cgpa: mark.cgpa,
                isPassed: mark.isPassed
            });

            // Calculate new totals
            let newTotalObt = 0;
            const updatedSubjectMarks = mark.subjectMarks.map(sm => {
                const update = subjectMarks.find(usm => usm.subjectId === sm.subjectId?.toString() || usm.subjectName === sm.subjectName);
                if (update && update.marksObtained !== undefined) {
                    newTotalObt += Number(update.marksObtained);
                    return { ...sm, marksObtained: Number(update.marksObtained) };
                }
                newTotalObt += Number(sm.marksObtained);
                return sm;
            });

            const totalMax = mark.totalMarks;
            const pct = totalMax > 0 ? Math.round((newTotalObt / totalMax) * 10000) / 100 : 0;

            // Fetch policy from Supabase for new grades
            const { data: policy } = await studentNotesClient
                .from("OrgResultPolicy")
                .select("*")
                .eq("org_id", req.user.organization_id)
                .single();

            const calcMethod = policy?.calculationMethod || 'percentage';
            const passPct = policy?.passPercentage || 40;
            const rules = policy?.gradeRules || [];

            let grade = "F";
            let cgpa = null;
            if (calcMethod === 'grade' || calcMethod === 'cgpa') {
                for (const r of rules) {
                    if (pct >= r.minPct && pct <= r.maxPct) {
                        grade = r.grade;
                        if (calcMethod === 'cgpa') cgpa = r.gradePoint || null;
                        break;
                    }
                }
            } else {
                grade = pct >= passPct ? "Pass" : "Fail";
            }

            // Apply updates
            mark.subjectMarks = updatedSubjectMarks;
            mark.marksObtained = newTotalObt;
            mark.percentage = pct;
            mark.grade = grade;
            mark.cgpa = cgpa;
            mark.isPassed = pct >= passPct;
            mark.version += 1;

            await mark.save();

            // Log Audit
            await ResultAuditLog.create({
                examRecord: exam._id,
                organization_id: exam.organization_id,
                user: req.user._id,
                action: "mark_overridden",
                details: `Mark updated for student ${mark.student} from ${mark.history[mark.history.length - 1].marksObtained} to ${newTotalObt}`
            });

            // Recalculate ranks + analytics
            const allMarks = await StudentMark.find({ examRecord: exam._id }).lean();
            const ranked = assignRanks(allMarks);
            for (const r of ranked) {
                await StudentMark.updateOne({ _id: r._id }, { $set: { rank: r.rank } });
            }

            const analytics = calculateAnalytics(allMarks, exam.totalMarks, exam.passingMarks);
            exam.analytics = analytics;
            await exam.save();

            res.json({ message: "Mark updated", mark, analytics });
        } catch (err) {
            console.error("[Marks] Edit mark error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// DELETE /exam/:examId — Delete exam + all marks (orphan cleanup)
// ─────────────────────────────────────────────────────────
router.delete(
    "/exam/:examId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId);
            if (!exam) return res.status(404).json({ message: "Exam not found" });
            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            // Delete all marks first (orphan prevention)
            const deleted = await StudentMark.deleteMany({ examRecord: exam._id });

            // Then delete the exam
            await ExamRecord.findByIdAndDelete(exam._id);

            res.json({
                message: "Exam and all marks deleted",
                deletedMarks: deleted.deletedCount,
            });
        } catch (err) {
            console.error("[Marks] Delete error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /download-template — Download sample Excel template
// ─────────────────────────────────────────────────────────
router.get(
    "/download-template",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            const { default: XLSX } = await import("xlsx");

            const sampleData = [
                { "PRN": "2024001", "Student Name": "John Doe", "Marks Obtained": 85 },
                { "PRN": "2024002", "Student Name": "Jane Smith", "Marks Obtained": 72 },
                { "PRN": "2024003", "Student Name": "Alex Kumar", "Marks Obtained": 91 },
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(sampleData);
            XLSX.utils.book_append_sheet(wb, ws, "Marks");

            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=classgrid_marks_template.xlsx");
            res.send(buf);
        } catch (err) {
            console.error("[Marks] Template error:", err);
            res.status(500).json({ message: "Server error generating template" });
        }
    }
);
// ═══════════════════════════════════════════════════════════
// MULTI-SUBJECT RESULT SYSTEM — Subject Config, Exam CRUD
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// GET /policy — Get Result Calculation Policy
// ─────────────────────────────────────────────────────────
router.get(
    "/policy",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            const { data, error } = await studentNotesClient
                .from("OrgResultPolicy")
                .select("*")
                .eq("org_id", req.user.organization_id)
                .single();

            // If no policy yet, return a default
            if (error && error.code === 'PGRST116') {
                return res.json({
                    policy: {
                        calculationMethod: 'percentage',
                        passPercentage: 40,
                        gradeRules: []
                    }
                });
            }
            if (error) throw error;
            res.json({ policy: data });
        } catch (err) {
            console.error("[Marks] Get Policy error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// PUT /policy — Upsert Result Calculation Policy
// ─────────────────────────────────────────────────────────
router.put(
    "/policy",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            const { calculationMethod, passPercentage, gradeRules } = req.body;

            // Check if policy exists
            const { data: existing } = await studentNotesClient
                .from("OrgResultPolicy")
                .select("id")
                .eq("org_id", req.user.organization_id)
                .single();

            let result;
            if (existing) {
                result = await studentNotesClient
                    .from("OrgResultPolicy")
                    .update({ calculationMethod, passPercentage, gradeRules, updated_at: new Date() })
                    .eq("org_id", req.user.organization_id)
                    .select()
                    .single();
            } else {
                result = await studentNotesClient
                    .from("OrgResultPolicy")
                    .insert([{
                        org_id: req.user.organization_id,
                        calculationMethod,
                        passPercentage,
                        gradeRules
                    }])
                    .select()
                    .single();
            }

            if (result.error) throw result.error;
            res.json({ message: "Policy saved", policy: result.data });
        } catch (err) {
            console.error("[Marks] Save Policy error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /subjects — List all subjects for the org
// ─────────────────────────────────────────────────────────
router.get(
    "/subjects",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const subjects = await OrgSubject.find({
                organization_id: req.user.organization_id,
                isActive: true,
            }).sort({ subjectName: 1 }).lean();
            res.json({ subjects });
        } catch (err) {
            console.error("[Marks] List subjects error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// POST /subjects — Create a new subject for the org
// ─────────────────────────────────────────────────────────
router.post(
    "/subjects",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const { subjectName, maxMarks, classroomId } = req.body;
            if (!subjectName?.trim()) return res.status(400).json({ message: "Subject name is required" });
            const mm = parseInt(maxMarks) || 20;
            if (mm <= 0) return res.status(400).json({ message: "Max marks must be positive" });

            const subject = await OrgSubject.create({
                organization_id: req.user.organization_id,
                subjectName: subjectName.trim(),
                maxMarks: mm,
                classroom: classroomId || null,
            });
            res.status(201).json({ message: "Subject created", subject });
        } catch (err) {
            if (err.code === 11000) return res.status(409).json({ message: "Subject already exists in your organization" });
            console.error("[Marks] Create subject error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// PUT /subjects/:id — Update a subject
// ─────────────────────────────────────────────────────────
router.put(
    "/subjects/:id",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const subject = await OrgSubject.findOne({
                _id: req.params.id,
                organization_id: req.user.organization_id,
            });
            if (!subject) return res.status(404).json({ message: "Subject not found" });

            if (req.body.subjectName) subject.subjectName = req.body.subjectName.trim();
            if (req.body.maxMarks) subject.maxMarks = parseInt(req.body.maxMarks);
            await subject.save();
            res.json({ message: "Subject updated", subject });
        } catch (err) {
            if (err.code === 11000) return res.status(409).json({ message: "Subject name already exists" });
            console.error("[Marks] Update subject error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// DELETE /subjects/:id — Soft-delete a subject
// ─────────────────────────────────────────────────────────
router.delete(
    "/subjects/:id",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const result = await OrgSubject.updateOne(
                { _id: req.params.id, organization_id: req.user.organization_id },
                { $set: { isActive: false } }
            );
            if (result.matchedCount === 0) return res.status(404).json({ message: "Subject not found" });
            res.json({ message: "Subject deleted" });
        } catch (err) {
            console.error("[Marks] Delete subject error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// POST /create-exam — Create exam linked to subjects (Admin Only)
// ─────────────────────────────────────────────────────────
router.post(
    "/create-exam",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const { title, examType, classroomId, subjectIds, examDate, passingMarks } = req.body;

            if (!title?.trim()) return res.status(400).json({ message: "Exam title is required" });
            if (!classroomId) return res.status(400).json({ message: "Classroom is required" });
            if (!subjectIds?.length) return res.status(400).json({ message: "At least one subject is required" });

            // Verify classroom belongs to organization
            const classroom = await Classroom.findById(classroomId).lean();
            if (!classroom || classroom.organization_id.toString() !== req.user.organization_id.toString()) {
                return res.status(403).json({ message: "Not authorized for this classroom" });
            }

            // Fetch subjects
            const subjects = await OrgSubject.find({
                _id: { $in: subjectIds },
                organization_id: req.user.organization_id,
                isActive: true,
            }).lean();

            if (subjects.length === 0) return res.status(400).json({ message: "No valid subjects found" });

            const subjectsArray = subjects.map(s => ({
                subjectId: s._id,
                subjectName: s.subjectName,
                maxMarks: s.maxMarks,
            }));
            const totalMarks = subjectsArray.reduce((sum, s) => sum + s.maxMarks, 0);

            const exam = await ExamRecord.create({
                title: title.trim(),
                classroom: classroomId,
                teacher: req.user._id,
                organization_id: req.user.organization_id,
                examType: examType || "other",
                classroomId: classroom._id,
                subjects: subjectsArray,
                totalMarks: totalMarks,
                passingMarks: passingMarks || Math.round(totalMarks * 0.4), // Default 40% passing
                status: 'draft' // Phase G: Initial status is draft
            });

            res.status(201).json({ message: "Exam created", exam });
        } catch (err) {
            console.error("[Marks] Create exam error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /classroom-exams/:classroomId — For Teachers
// ─────────────────────────────────────────────────────────
router.get(
    "/classroom-exams/:classroomId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            // Verify teacher membership in classroom
            const isMember = await ClassroomMembership.findOne({
                classroom: req.params.classroomId,
                user: req.user._id,
                role: 'teacher'
            });
            const classroom = await Classroom.findById(req.params.classroomId).lean();
            if (!classroom) return res.status(404).json({ message: "Classroom not found" });
            if (classroom.teacher.toString() !== req.user._id.toString() && !isMember) {
                return res.status(403).json({ message: "Not authorized for this classroom" });
            }

            const exams = await ExamRecord.find({
                classroomId: req.params.classroomId,
                organization_id: req.user.organization_id,
            }).sort({ createdAt: -1 }).lean();

            res.json({ exams });
        } catch (err) {
            console.error("[Marks] List classroom exams error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// POST /upload-multi/:examId — Upload multi-subject Excel
// ─────────────────────────────────────────────────────────
router.post(
    "/upload-multi/:examId",
    isAuthenticated,
    requirePlan("PRO"),
    upload.single("file"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId);
            if (!exam) return res.status(404).json({ message: "Exam not found" });

            // Verify teacher in classroom
            const isMember = await ClassroomMembership.findOne({
                classroom: exam.classroomId,
                user: req.user._id,
                role: 'teacher'
            });
            const classroom = await Classroom.findById(exam.classroomId).lean();
            if (!classroom || (classroom.teacher.toString() !== req.user._id.toString() && !isMember)) {
                return res.status(403).json({ message: "Not authorized for this classroom" });
            }

            if (!req.file) return res.status(400).json({ message: "No file uploaded" });

            // Parse Excel
            const parsed = parseExcelFile(req.file.buffer, req.file.originalname);

            // Detect PRN column
            const detected = autoDetectColumns(parsed.headers);
            const prnCol = detected.prnColumn;
            const nameCol = detected.nameColumn;

            if (!prnCol) {
                return res.status(400).json({
                    message: "Could not detect PRN/Roll No column",
                    headers: parsed.headers,
                });
            }

            // Match Excel headers to exam subjects (case-insensitive)
            const subjectColumns = [];
            for (const subj of exam.subjects) {
                const matchedHeader = parsed.headers.find(
                    h => h.toLowerCase().trim() === subj.subjectName.toLowerCase().trim()
                );
                if (matchedHeader) {
                    subjectColumns.push({
                        header: matchedHeader,
                        subjectId: subj.subjectId,
                        subjectName: subj.subjectName,
                        maxMarks: subj.maxMarks,
                    });
                }
            }

            if (subjectColumns.length === 0) {
                return res.status(400).json({
                    message: "No subject columns matched. Excel headers must match configured subject names.",
                    excelHeaders: parsed.headers,
                    expectedSubjects: exam.subjects.map(s => s.subjectName),
                });
            }

            // Get classroom students
            const memberships = await ClassroomMembership.find({
                classroom: exam.classroom,
                status: "approved",
            }).select("student").lean();

            const studentIds = memberships.map(m => m.student);
            const students = await User.find({
                _id: { $in: studentIds },
                organization_id: exam.organization_id,
            }).select("_id name email prn").lean();

            // Build PRN map
            const { normalizePRN } = await import("../services/marks.service.js");
            const prnMap = new Map();
            for (const s of students) {
                if (s.prn) prnMap.set(normalizePRN(s.prn), s);
            }

            // Process each row
            const matched = [];
            const unmatched = [];
            const seenPRNs = new Set();

            for (let i = 0; i < parsed.rows.length; i++) {
                const row = parsed.rows[i];
                const rawPrn = row[prnCol];
                const name = nameCol ? row[nameCol] : "";

                if (!rawPrn && rawPrn !== 0) {
                    unmatched.push({ rowIndex: i + 1, prn: "(empty)", name, reason: "No PRN" });
                    continue;
                }

                const norm = normalizePRN(rawPrn);
                if (seenPRNs.has(norm)) {
                    unmatched.push({ rowIndex: i + 1, prn: String(rawPrn), name, reason: "Duplicate PRN in Excel" });
                    continue;
                }
                seenPRNs.add(norm);

                const student = prnMap.get(norm);
                if (!student) {
                    unmatched.push({ rowIndex: i + 1, prn: String(rawPrn), name, reason: "Student not found" });
                    continue;
                }

                // Extract per-subject marks
                const subjMarks = [];
                let valid = true;
                for (const sc of subjectColumns) {
                    const val = parseFloat(row[sc.header]);
                    if (isNaN(val) || val < 0) {
                        unmatched.push({ rowIndex: i + 1, prn: String(rawPrn), name: student.name, reason: `Invalid marks for ${sc.subjectName}` });
                        valid = false;
                        break;
                    }
                    if (val > sc.maxMarks) {
                        unmatched.push({ rowIndex: i + 1, prn: String(rawPrn), name: student.name, reason: `Marks (${val}) exceed max (${sc.maxMarks}) for ${sc.subjectName}` });
                        valid = false;
                        break;
                    }
                    subjMarks.push({
                        subjectId: sc.subjectId,
                        subjectName: sc.subjectName,
                        marksObtained: val,
                        maxMarks: sc.maxMarks,
                    });
                }
                if (!valid) continue;

                const totalObt = subjMarks.reduce((s, m) => s + m.marksObtained, 0);
                const totalMax = subjMarks.reduce((s, m) => s + m.maxMarks, 0);

                matched.push({
                    studentId: student._id,
                    studentName: student.name,
                    studentPRN: student.prn,
                    prn: String(rawPrn),
                    subjectMarks: subjMarks,
                    totalObtained: totalObt,
                    totalMax: totalMax,
                });
            }

            // Update exam mapping stats
            exam.mappingStats = {
                totalRows: parsed.totalRows,
                matched: matched.length,
                unmatched: unmatched.length,
                skipped: 0,
            };
            exam.uploadedFile = { originalName: req.file.originalname, uploadedAt: new Date() };
            await exam.save();

            res.json({
                message: "File parsed. Review and confirm.",
                examId: exam._id,
                subjectColumns: subjectColumns.map(s => s.subjectName),
                stats: { totalRows: parsed.totalRows, matched: matched.length, unmatched: unmatched.length },
                matched,
                unmatched,
            });
        } catch (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "File too large. Max 5MB." });
                return res.status(400).json({ message: err.message });
            }
            console.error("[Marks] Multi-upload error:", err);
            res.status(500).json({ message: err.message || "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// POST /confirm-multi/:examId — Confirm multi-subject marks
// ─────────────────────────────────────────────────────────
router.post(
    "/confirm-multi/:examId",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId);
            if (!exam) return res.status(404).json({ message: "Exam not found" });
            if (exam.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const { matched } = req.body;
            if (!matched?.length) return res.status(400).json({ message: "No matched students" });

            // Fetch policy from Supabase
            const { data: policy } = await studentNotesClient
                .from("OrgResultPolicy")
                .select("*")
                .eq("org_id", req.user.organization_id)
                .single();

            const calcMethod = policy?.calculationMethod || 'percentage';
            const passPct = policy?.passPercentage || 40;
            const rules = policy?.gradeRules || [];

            // Helper to calculate grade/cgpa based on rules
            const evaluateResult = (pct) => {
                let grade = "F";
                let cgpa = null;
                if (calcMethod === 'grade' || calcMethod === 'cgpa') {
                    for (const r of rules) {
                        if (pct >= r.minPct && pct <= r.maxPct) {
                            grade = r.grade;
                            if (calcMethod === 'cgpa') cgpa = r.gradePoint || null;
                            break;
                        }
                    }
                } else {
                    grade = pct >= passPct ? "Pass" : "Fail";
                }
                return { grade, cgpa };
            };

            // Create StudentMark records
            const markDocs = matched.map(m => {
                const totalObt = m.subjectMarks.reduce((s, sm) => s + sm.marksObtained, 0);
                const totalMax = m.subjectMarks.reduce((s, sm) => s + sm.maxMarks, 0);
                const pct = totalMax > 0 ? Math.round((totalObt / totalMax) * 10000) / 100 : 0;

                const { grade, cgpa } = evaluateResult(pct);

                return {
                    examRecord: exam._id,
                    student: m.studentId,
                    classroom: exam.classroom,
                    organization_id: exam.organization_id,
                    prn: m.studentPRN || m.prn || "",
                    subjectMarks: m.subjectMarks,
                    marksObtained: totalObt,
                    totalMarks: totalMax,
                    percentage: pct,
                    grade: grade,
                    cgpa: cgpa,
                    isPassed: pct >= passPct,
                };
            });
            // Assign ranks
            const ranked = assignRanks(markDocs);
            await StudentMark.insertMany(ranked);

            // Analytics
            const analytics = calculateAnalytics(ranked, exam.totalMarks, exam.passingMarks);
            exam.analytics = analytics;
            exam.status = "draft"; // Keep as draft until admin publishes
            await exam.save();

            // Audit Log
            await ResultAuditLog.create({
                examRecord: exam._id,
                organization_id: exam.organization_id,
                user: req.user._id,
                action: "marks_uploaded",
                details: `Uploaded marks for ${ranked.length} students`
            });

            res.json({ message: "Marks saved!", totalSaved: ranked.length, analytics });
        } catch (err) {
            if (err.code === 11000) return res.status(409).json({ message: "Marks already exist. Delete exam first." });
            console.error("[Marks] Confirm multi error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// PUT /exams/:id/status — Admin changes exam status
// ─────────────────────────────────────────────────────────
router.put(
    "/exams/:id/status",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const { status } = req.body;
            const validStatuses = ["draft", "verified", "published", "locked"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status" });
            }

            const exam = await ExamRecord.findOne({
                _id: req.params.id,
                organization_id: req.user.organization_id
            });
            if (!exam) return res.status(404).json({ message: "Exam not found" });

            const oldStatus = exam.status;
            exam.status = status;
            await exam.save();

            await ResultAuditLog.create({
                examRecord: exam._id,
                organization_id: exam.organization_id,
                user: req.user._id,
                action: "status_changed",
                details: `Status changed from ${oldStatus} to ${status}`
            });

            res.json({ message: `Exam marked as ${status}`, exam });
        } catch (err) {
            console.error("[Marks] Change status error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /exams — List all exams for the org (org admin)
// ─────────────────────────────────────────────────────────
router.get(
    "/exams",
    isAuthenticated,
    requirePlan("PRO"),
    async (req, res) => {
        try {
            await connectDB();
            const exams = await ExamRecord.find({
                organization_id: req.user.organization_id,
                status: { $in: ["active", "processing"] },
            })
                .populate("classroom", "name")
                .sort({ createdAt: -1 })
                .lean();
            res.json({ exams });
        } catch (err) {
            console.error("[Marks] List exams error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// ─────────────────────────────────────────────────────────
// GET /exams/:examId/export — Export marks to Excel
// ─────────────────────────────────────────────────────────
router.get(
    "/exams/:examId/export",
    isAuthenticated,
    requirePlan("PRO"),
    requireRole("super_admin", "org_admin"),
    async (req, res) => {
        try {
            await connectDB();
            const exam = await ExamRecord.findById(req.params.examId).populate("classroom", "name");
            if (!exam) return res.status(404).json({ message: "Exam not found" });
            if (exam.organization_id.toString() !== req.user.organization_id.toString()) {
                return res.status(403).json({ message: "Not authorized" });
            }

            const marks = await StudentMark.find({ examRecord: exam._id })
                .populate("student", "name email prn")
                .sort({ rank: 1 })
                .lean();

            // Prepare data for Excel
            const rows = marks.map(m => {
                const row = {
                    "Rank": m.rank,
                    "PRN": m.student?.prn || m.prn || "",
                    "Student Name": m.student?.name || "Unknown",
                };

                // Add subject columns
                if (m.subjectMarks && m.subjectMarks.length > 0) {
                    m.subjectMarks.forEach(sm => {
                        row[sm.subjectName] = sm.marksObtained;
                    });
                }

                row["Total Obtained"] = m.marksObtained;
                row["Total Max"] = m.totalMarks;
                row["Percentage"] = m.percentage + "%";
                row["Grade"] = m.grade;
                if (m.cgpa !== null && m.cgpa !== undefined) {
                    row["CGPA"] = m.cgpa;
                }
                row["Status"] = m.isPassed ? "Pass" : "Fail";

                return row;
            });

            const { utils, write } = await import("xlsx");
            const worksheet = utils.json_to_sheet(rows);
            // Auto width for columns
            const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(12, k.length) }));
            worksheet['!cols'] = colWidths;

            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, "Results");

            const buffer = write(workbook, { type: "buffer", bookType: "xlsx" });

            res.setHeader('Content-Disposition', `attachment; filename="Results_${exam.title.replace(/\s+/g, "_")}.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (err) {
            console.error("[Marks] Export error:", err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

export default router;
