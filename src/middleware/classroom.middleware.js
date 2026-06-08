import mongoose from "mongoose";
import ClassroomMembership from "../models/ClassroomMembership.js";
import Classroom from "../models/Classroom.js";
import connectDB from "../../config/db.js";

/**
 * Middleware: Require user to be an approved member of the classroom
 * Expects :classroomId in route params
 */
export const requireClassroomMember = async (req, res, next) => {
    try {
        await connectDB();
        const classroomId = req.params.classroomId || req.params.id;

        console.log(`[ClassroomMW] Checking access for classroomId=${classroomId}, userId=${req.user?._id}, role=${req.user?.role}`);

        if (!classroomId) {
            return res.status(400).json({ message: "Classroom ID required" });
        }

        // Validate ObjectId format to prevent BSONError
        if (!mongoose.Types.ObjectId.isValid(classroomId)) {
            return res.status(400).json({ message: "Invalid classroom ID" });
        }

        // Teachers who own the classroom always have access
        const classroom = await Classroom.findById(classroomId);
        console.log(`[ClassroomMW] Classroom.findById result:`, classroom ? `Found "${classroom.name}"` : "NOT FOUND");
        if (!classroom) {
            return res.status(404).json({ message: "Classroom not found" });
        }

        req.classroom = classroom;

        // If user is the classroom owner (teacher), grant access
        if (classroom.teacher.toString() === req.user._id.toString()) {
            req.isClassroomOwner = true;
            return next();
        }

        // Check if student has approved membership
        const membership = await ClassroomMembership.findOne({
            classroom: classroomId,
            student: req.user._id,
            status: "approved",
        });

        if (!membership) {
            return res.status(403).json({
                message: "You are not an approved member of this classroom",
            });
        }

        req.membership = membership;
        req.isClassroomOwner = false;
        next();
    } catch (err) {
        console.error("Classroom access check error:", err);
        res.status(500).json({ message: "Server error checking classroom access" });
    }
};

/**
 * Middleware: Require user to be the classroom owner (teacher)
 * Must be used AFTER isAuthenticated
 */
export const requireClassroomOwner = async (req, res, next) => {
    try {
        await connectDB();
        const classroomId = req.params.classroomId || req.params.id;

        if (!classroomId) {
            return res.status(400).json({ message: "Classroom ID required" });
        }

        // Validate ObjectId format to prevent BSONError
        if (!mongoose.Types.ObjectId.isValid(classroomId)) {
            return res.status(400).json({ message: "Invalid classroom ID" });
        }

        const classroom = await Classroom.findById(classroomId);
        if (!classroom) {
            return res.status(404).json({ message: "Classroom not found" });
        }

        if (classroom.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Only the classroom owner can perform this action",
            });
        }

        req.classroom = classroom;
        req.isClassroomOwner = true;
        next();
    } catch (err) {
        console.error("Classroom owner check error:", err);
        res.status(500).json({ message: "Server error checking ownership" });
    }
};
