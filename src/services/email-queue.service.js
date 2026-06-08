/**
 * Classgrid — Email Queue Service
 *
 * MongoDB-backed email job queue with:
 *  - Atomic job locking (pending → processing via findOneAndUpdate)
 *  - Exponential backoff retry (2^attempt * 30s, max 3 attempts)
 *  - 8-second execution time guard (Vercel Hobby 10s limit)
 *  - Batch size capped at 10 jobs per run
 */

import EmailJob from "../models/EmailJob.js";
import { sendEmail } from "./brevo.service.js";

const MAX_BATCH_SIZE = 10;
const MAX_RUNTIME_MS = 8000; // 8 seconds — leave 2s buffer for Vercel's 10s limit
const BACKOFF_BASE_MS = 30_000; // 30 seconds

// ─────────────────────────────────────────────────
// ENQUEUE: Create a single email job
// ─────────────────────────────────────────────────
export async function enqueueEmail({
    to,
    subject,
    html,
    text = "",
    type = "other",
    userId = null,
    classroomId = null,
    organizationId = null,
}) {
    try {
        const job = await EmailJob.create({
            to,
            subject,
            html,
            text,
            type,
            userId,
            classroomId,
            organizationId,
            status: "pending",
            attempts: 0,
            nextRetryAt: new Date(),
        });
        console.log(`[EmailQueue] Job created: ${job._id} → ${to} (${type})`);
        return job;
    } catch (err) {
        console.error("[EmailQueue] Failed to enqueue email:", {
            to,
            type,
            error: err.message,
        });
        return null;
    }
}

// ─────────────────────────────────────────────────
// ENQUEUE BULK: Create multiple email jobs at once
// ─────────────────────────────────────────────────
export async function enqueueBulkEmails(payloads) {
    if (!payloads || !payloads.length) return [];

    try {
        const docs = payloads.map((p) => ({
            to: p.to,
            subject: p.subject,
            html: p.html,
            text: p.text || "",
            type: p.type || "other",
            userId: p.userId || null,
            classroomId: p.classroomId || null,
            organizationId: p.organizationId || null,
            status: "pending",
            attempts: 0,
            nextRetryAt: new Date(),
        }));

        const jobs = await EmailJob.insertMany(docs, { ordered: false });
        console.log(
            `[EmailQueue] Bulk enqueued ${jobs.length} jobs (type: ${payloads[0]?.type || "other"})`
        );
        return jobs;
    } catch (err) {
        console.error("[EmailQueue] Bulk enqueue failed:", {
            count: payloads.length,
            error: err.message,
        });
        return [];
    }
}

// ─────────────────────────────────────────────────
// PROCESS: Worker that sends pending emails
// Called by cron endpoint every ~1 minute
// ─────────────────────────────────────────────────
export async function processEmailQueue(batchSize = MAX_BATCH_SIZE) {
    const startTime = Date.now();
    const effectiveBatch = Math.min(batchSize, MAX_BATCH_SIZE);
    const stats = { fetched: 0, sent: 0, failed: 0, skipped: 0, durationMs: 0 };

    try {
        console.log(`[EmailQueue] Processing started (batchSize=${effectiveBatch})`);

        for (let i = 0; i < effectiveBatch; i++) {
            // ── Time guard: stop if approaching Vercel limit ──
            const elapsed = Date.now() - startTime;
            if (elapsed >= MAX_RUNTIME_MS) {
                console.log(
                    `[EmailQueue] Time guard hit at ${elapsed}ms — stopping after ${stats.sent + stats.failed} jobs`
                );
                break;
            }

            // ── Atomic lock: pending → processing ────────────
            const job = await EmailJob.findOneAndUpdate(
                {
                    status: { $in: ["pending", "failed"] },
                    nextRetryAt: { $lte: new Date() },
                    attempts: { $lt: 3 },
                },
                {
                    $set: { status: "processing" },
                    $inc: { attempts: 1 },
                },
                {
                    sort: { nextRetryAt: 1 }, // oldest first
                    returnDocument: "after",
                }
            );

            if (!job) {
                // No more jobs to process
                break;
            }

            stats.fetched++;

            try {
                // ── Send the email ────────────────────────────
                await sendEmail({
                    to: job.to,
                    subject: job.subject,
                    html: job.html,
                    text: job.text,
                });

                // ── Mark as sent ─────────────────────────────
                await EmailJob.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            status: "sent",
                            processedAt: new Date(),
                            error: null,
                        },
                    }
                );
                stats.sent++;
                console.log(
                    `[EmailQueue] ✅ Sent: ${job._id} → ${job.to} (attempt ${job.attempts})`
                );
            } catch (sendErr) {
                // ── Handle send failure ───────────────────────
                const isLastAttempt = job.attempts >= job.maxAttempts;
                const nextStatus = isLastAttempt ? "failed" : "pending";
                const backoffMs = Math.pow(2, job.attempts) * BACKOFF_BASE_MS;
                const nextRetry = isLastAttempt
                    ? job.nextRetryAt
                    : new Date(Date.now() + backoffMs);

                await EmailJob.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            status: nextStatus,
                            error: sendErr.message || "Unknown error",
                            nextRetryAt: nextRetry,
                        },
                    }
                );

                stats.failed++;
                console.error(
                    `[EmailQueue] ❌ Failed: ${job._id} → ${job.to} (attempt ${job.attempts}/${job.maxAttempts})`,
                    { error: sendErr.message, nextStatus, nextRetry: nextRetry.toISOString() }
                );
            }
        }
    } catch (err) {
        console.error("[EmailQueue] Worker error:", err.message);
    }

    stats.durationMs = Date.now() - startTime;
    console.log(
        `[EmailQueue] Processing complete: fetched=${stats.fetched} sent=${stats.sent} failed=${stats.failed} duration=${stats.durationMs}ms`
    );
    return stats;
}

// ─────────────────────────────────────────────────
// RESEND: Reset a failed job back to pending
// ─────────────────────────────────────────────────
export async function resendEmailJob(jobId) {
    const job = await EmailJob.findOneAndUpdate(
        { _id: jobId, status: "failed" },
        {
            $set: {
                status: "pending",
                attempts: 0,
                error: null,
                nextRetryAt: new Date(),
            },
        },
        { returnDocument: "after" }
    );

    if (job) {
        console.log(`[EmailQueue] Job ${jobId} reset to pending for resend`);
    }
    return job;
}

// ─────────────────────────────────────────────────
// RESEND BY CLASSROOM: Reset all failed jobs for a classroom+type
// ─────────────────────────────────────────────────
export async function resendClassroomEmails(classroomId, type = null) {
    const filter = { classroomId, status: "failed" };
    if (type) filter.type = type;

    const result = await EmailJob.updateMany(filter, {
        $set: {
            status: "pending",
            attempts: 0,
            error: null,
            nextRetryAt: new Date(),
        },
    });

    console.log(
        `[EmailQueue] Reset ${result.modifiedCount} failed jobs for classroom ${classroomId}`
    );
    return result.modifiedCount;
}

// ─────────────────────────────────────────────────
// STATS: Get email delivery statistics
// ─────────────────────────────────────────────────
export async function getEmailStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, sent, failed, pending, todaySent, todayFailed] =
        await Promise.all([
            EmailJob.countDocuments(),
            EmailJob.countDocuments({ status: "sent" }),
            EmailJob.countDocuments({ status: "failed" }),
            EmailJob.countDocuments({
                status: { $in: ["pending", "processing"] },
            }),
            EmailJob.countDocuments({
                status: "sent",
                processedAt: { $gte: todayStart },
            }),
            EmailJob.countDocuments({
                status: "failed",
                updatedAt: { $gte: todayStart },
            }),
        ]);

    const successRate =
        sent + failed > 0
            ? Math.round((sent / (sent + failed)) * 100 * 10) / 10
            : 100;

    return {
        total,
        sent,
        failed,
        pending,
        successRate,
        today: { sent: todaySent, failed: todayFailed },
    };
}

// ─────────────────────────────────────────────────
// LOGS: Paginated email job list
// ─────────────────────────────────────────────────
export async function getEmailLogs({
    page = 1,
    limit = 50,
    status = null,
    classroomId = null,
    type = null,
} = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (classroomId) filter.classroomId = classroomId;
    if (type) filter.type = type;

    const skip = (page - 1) * limit;

    const [jobs, totalCount] = await Promise.all([
        EmailJob.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-html -text") // Exclude heavy fields from list view
            .lean(),
        EmailJob.countDocuments(filter),
    ]);

    return {
        jobs,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
    };
}
