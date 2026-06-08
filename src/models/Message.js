import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            required: true,
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Null for group messages, set for private messages
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        content: {
            type: String,
            required: true,
            maxlength: 2000,
            trim: true,
        },

        messageType: {
            type: String,
            enum: ["group", "private"],
            default: "group",
        },

        // For read receipts (future feature)
        readBy: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            readAt: { type: Date, default: Date.now },
        }],

        // Soft delete
        isDeleted: {
            type: Boolean,
            default: false,
        },

        // For reply threading (future feature)
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Group chat messages — sorted by time, scoped to classroom
messageSchema.index({ classroom: 1, messageType: 1, createdAt: -1 });

// Private messages — between two users in a classroom
messageSchema.index({ classroom: 1, sender: 1, receiver: 1, createdAt: -1 });

// For polling new messages (after a certain timestamp)
messageSchema.index({ classroom: 1, messageType: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
