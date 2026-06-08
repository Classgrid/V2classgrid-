import express from "express";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import { requireClassroomMember, requireClassroomOwner } from "../middleware/classroom.middleware.js";
import Message from "../models/Message.js";

const router = express.Router();

// ─────────────────────────────────────────────
// SEND MESSAGE (Group or Private)
// ─────────────────────────────────────────────
router.post("/:classroomId", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { content, receiverId, messageType } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Message content required" });
        }

        const msgData = {
            classroom: req.params.classroomId,
            sender: req.user._id,
            content: content.trim(),
            messageType: messageType || "group",
        };

        // If private message, set receiver
        if (messageType === "private" && receiverId) {
            msgData.receiver = receiverId;
        }

        const message = await Message.create(msgData);

        // Populate sender info for immediate return
        const populated = await Message.findById(message._id)
            .populate("sender", "name email profilePicture role")
            .populate("receiver", "name email profilePicture role")
            .lean();

        res.status(201).json({ message: populated });
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET GROUP MESSAGES (with pagination & polling)
// ─────────────────────────────────────────────
router.get("/:classroomId", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { limit = 50, before, after } = req.query;
        const filter = {
            classroom: req.params.classroomId,
            messageType: "group",
            isDeleted: false,
        };

        // For pagination: get messages before a certain date
        if (before) {
            filter.createdAt = { $lt: new Date(before) };
        }

        // For polling: get messages after a certain date
        if (after) {
            filter.createdAt = { ...(filter.createdAt || {}), $gt: new Date(after) };
        }

        const messages = await Message.find(filter)
            .populate("sender", "name email profilePicture role")
            .sort({ createdAt: after ? 1 : -1 }) // ascending for polling, descending for pagination
            .limit(parseInt(limit))
            .lean();

        // Reverse if fetching older messages (for correct display order)
        if (!after) messages.reverse();

        res.json({
            messages,
            hasMore: messages.length >= parseInt(limit),
        });
    } catch (err) {
        console.error("Get messages error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// GET PRIVATE MESSAGES (Between two users)
// ─────────────────────────────────────────────
router.get("/:classroomId/private/:userId", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const { limit = 50, before, after } = req.query;
        const myId = req.user._id;
        const otherId = req.params.userId;

        const filter = {
            classroom: req.params.classroomId,
            messageType: "private",
            isDeleted: false,
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId },
            ],
        };

        if (before) filter.createdAt = { $lt: new Date(before) };
        if (after) filter.createdAt = { ...(filter.createdAt || {}), $gt: new Date(after) };

        const messages = await Message.find(filter)
            .populate("sender", "name email profilePicture role")
            .populate("receiver", "name email profilePicture role")
            .sort({ createdAt: after ? 1 : -1 })
            .limit(parseInt(limit))
            .lean();

        if (!after) messages.reverse();

        res.json({ messages, hasMore: messages.length >= parseInt(limit) });
    } catch (err) {
        console.error("Get private messages error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// LIST PRIVATE THREADS (Teacher sees all threads)
// ─────────────────────────────────────────────
router.get("/:classroomId/threads", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const myId = req.user._id;

        // Find all private messages where I am sender or receiver
        const threads = await Message.aggregate([
            {
                $match: {
                    classroom: req.classroom._id,
                    messageType: "private",
                    isDeleted: false,
                    $or: [{ sender: myId }, { receiver: myId }],
                },
            },
            {
                // Determine the "other" user in the conversation
                $addFields: {
                    otherUser: {
                        $cond: [{ $eq: ["$sender", myId] }, "$receiver", "$sender"],
                    },
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: "$otherUser",
                    lastMessage: { $first: "$content" },
                    lastMessageAt: { $first: "$createdAt" },
                    messageCount: { $sum: 1 },
                },
            },
            {
                $sort: { lastMessageAt: -1 },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: "$user",
            },
            {
                $project: {
                    userId: "$_id",
                    name: "$user.name",
                    email: "$user.email",
                    profilePicture: "$user.profilePicture",
                    role: "$user.role",
                    lastMessage: 1,
                    lastMessageAt: 1,
                    messageCount: 1,
                },
            },
        ]);

        res.json({ threads });
    } catch (err) {
        console.error("Get threads error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ─────────────────────────────────────────────
// DELETE MESSAGE (Sender or classroom owner)
// ─────────────────────────────────────────────
router.delete("/:classroomId/:messageId", isAuthenticated, requireClassroomMember, async (req, res) => {
    try {
        const message = await Message.findOne({
            _id: req.params.messageId,
            classroom: req.params.classroomId,
        });

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Only sender or classroom owner can delete
        const isSender = message.sender.toString() === req.user._id.toString();
        if (!isSender && !req.isClassroomOwner) {
            return res.status(403).json({ message: "Cannot delete this message" });
        }

        message.isDeleted = true;
        message.content = "[Message deleted]";
        await message.save();

        res.json({ message: "Message deleted" });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
