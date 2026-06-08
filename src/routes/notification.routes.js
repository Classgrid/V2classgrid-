import express from "express";
import Notification from "../models/Notification.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET all notifications for current user
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        const notifications = await Notification.find({
            recipient: req.user._id,
            createdAt: { $gte: threeDaysAgo }
        })
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false,
            createdAt: { $gte: threeDaysAgo }
        });

        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error("Fetch notifications error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Mark notification as read
router.put("/:id/read", isAuthenticated, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ message: "Marked read" });
    } catch (err) {
        console.error("Mark read error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Mark all as read
router.put("/read-all", isAuthenticated, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
        res.json({ message: "All marked read" });
    } catch (err) {
        console.error("Mark all read error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
