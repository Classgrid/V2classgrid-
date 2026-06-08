/**
 * Classgrid — Digest Email Service (Phase 1.5)
 *
 * Sends daily and weekly digest emails to users who prefer batched delivery.
 * Uses lastDigestSentAt for reliable tracking — never loses notifications
 * even if a cron run is missed.
 */

import { sendEmail } from "./brevo.service.js";
import {
    getDailyDigestEmailHtml,
    getDailyDigestEmailPlainText,
} from "./email-templates.service.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const BATCH_SIZE = 50;
const FRONTEND_URL = () =>
    process.env.FRONTEND_URL?.trim() ||
    (process.env.NODE_ENV === "production"
        ? "https://classgrid.in"
        : "http://localhost:3000");

// ─────────────────────────────────────────────────
// HELPER: Send emails in batches
// ─────────────────────────────────────────────────
async function sendInBatches(emailPayloads) {
    const results = { sent: 0, failed: 0 };
    for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
        const batch = emailPayloads.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(
            batch.map((p) => sendEmail(p))
        );
        settled.forEach((r) => {
            if (r.status === "fulfilled") results.sent++;
            else results.failed++;
        });
    }
    return results;
}

// ─────────────────────────────────────────────────
// DAILY DIGEST
// Queries unread notifications since lastDigestSentAt
// ─────────────────────────────────────────────────
export async function sendDailyDigests() {
    try {
        // Find all users with digestMode = 'daily' and global enabled
        const users = await User.find({
            "emailNotifications.digestMode": "daily",
            "emailNotifications.global": { $ne: false },
            is_demo: { $ne: true },
        })
            .select("name email emailNotifications")
            .lean();

        if (!users.length) {
            console.log("[Digest] No daily digest users found");
            return { total: 0, sent: 0, failed: 0 };
        }

        const emailPayloads = [];

        for (const user of users) {
            if (!user.email) continue;

            // Query from lastDigestSentAt (or last 24h fallback)
            const since = user.emailNotifications?.lastDigestSentAt
                ? new Date(user.emailNotifications.lastDigestSentAt)
                : new Date(Date.now() - 24 * 60 * 60 * 1000);

            const notifications = await Notification.find({
                recipient: user._id,
                createdAt: { $gte: since },
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();

            if (!notifications.length) continue;

            // Group by type for summary
            const grouped = {};
            for (const n of notifications) {
                const key = n.type || "other";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(n);
            }

            const settingsUrl = `${FRONTEND_URL()}/settings`;

            emailPayloads.push({
                userId: user._id,
                to: user.email,
                subject: `Daily Summary: ${notifications.length} update${notifications.length > 1 ? "s" : ""} | Classgrid`,
                html: getDailyDigestEmailHtml({
                    userName: user.name,
                    notifications,
                    grouped,
                    totalCount: notifications.length,
                    settingsUrl,
                    frontendUrl: FRONTEND_URL(),
                }),
                text: getDailyDigestEmailPlainText({
                    userName: user.name,
                    notifications,
                    totalCount: notifications.length,
                    settingsUrl,
                }),
            });
        }

        if (!emailPayloads.length) {
            console.log("[Digest] No pending notifications for daily digest users");
            return { total: 0, sent: 0, failed: 0 };
        }

        // Send all digests
        const results = await sendInBatches(emailPayloads);

        // Update lastDigestSentAt for successful users
        const userIds = emailPayloads.map((p) => p.userId);
        await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { "emailNotifications.lastDigestSentAt": new Date() } }
        ).catch((err) => {
            console.error("[Digest] Failed to update lastDigestSentAt:", err.message);
        });

        console.log(
            `[Digest] Daily: ${results.sent} sent, ${results.failed} failed, ${emailPayloads.length} total`
        );
        return { total: emailPayloads.length, ...results };
    } catch (err) {
        console.error("[Digest] Daily digest failed:", err.message);
        return { total: 0, sent: 0, failed: 0 };
    }
}

// ─────────────────────────────────────────────────
// WEEKLY DIGEST
// Same as daily but for weekly users, queries from lastDigestSentAt
// ─────────────────────────────────────────────────
export async function sendWeeklyDigests() {
    try {
        const users = await User.find({
            "emailNotifications.digestMode": "weekly",
            "emailNotifications.global": { $ne: false },
            is_demo: { $ne: true },
        })
            .select("name email emailNotifications")
            .lean();

        if (!users.length) {
            console.log("[Digest] No weekly digest users found");
            return { total: 0, sent: 0, failed: 0 };
        }

        const emailPayloads = [];

        for (const user of users) {
            if (!user.email) continue;

            const since = user.emailNotifications?.lastDigestSentAt
                ? new Date(user.emailNotifications.lastDigestSentAt)
                : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const notifications = await Notification.find({
                recipient: user._id,
                createdAt: { $gte: since },
            })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean();

            if (!notifications.length) continue;

            const grouped = {};
            for (const n of notifications) {
                const key = n.type || "other";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(n);
            }

            const settingsUrl = `${FRONTEND_URL()}/settings`;

            emailPayloads.push({
                userId: user._id,
                to: user.email,
                subject: `Weekly Summary: ${notifications.length} update${notifications.length > 1 ? "s" : ""} | Classgrid`,
                html: getDailyDigestEmailHtml({
                    userName: user.name,
                    notifications,
                    grouped,
                    totalCount: notifications.length,
                    settingsUrl,
                    frontendUrl: FRONTEND_URL(),
                    isWeekly: true,
                }),
                text: getDailyDigestEmailPlainText({
                    userName: user.name,
                    notifications,
                    totalCount: notifications.length,
                    settingsUrl,
                    isWeekly: true,
                }),
            });
        }

        if (!emailPayloads.length) {
            console.log("[Digest] No pending notifications for weekly digest users");
            return { total: 0, sent: 0, failed: 0 };
        }

        const results = await sendInBatches(emailPayloads);

        const userIds = emailPayloads.map((p) => p.userId);
        await User.updateMany(
            { _id: { $in: userIds } },
            { $set: { "emailNotifications.lastDigestSentAt": new Date() } }
        ).catch((err) => {
            console.error("[Digest] Failed to update lastDigestSentAt:", err.message);
        });

        console.log(
            `[Digest] Weekly: ${results.sent} sent, ${results.failed} failed, ${emailPayloads.length} total`
        );
        return { total: emailPayloads.length, ...results };
    } catch (err) {
        console.error("[Digest] Weekly digest failed:", err.message);
        return { total: 0, sent: 0, failed: 0 };
    }
}
