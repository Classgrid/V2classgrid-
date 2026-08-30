import express from "express";
import connectDB from "../../config/db.js";
import Organization from "../models/Organization.js";
import { sendEmail } from "../services/aws-ses.service.js";
import {
    getPlanExpiryReminderHtml,
    getPlanExpiryReminderPlainText,
} from "../services/email-templates.service.js";

const router = express.Router();

/**
 * GET /api/cron/plan-expiry-check
 * 
 * Checks for organizations whose paid plans expire within 1 day
 * and sends reminder emails to the org admin.
 * 
 * Secured by a CRON_SECRET header to prevent unauthorized access.
 * Can be triggered by Vercel Cron Jobs, external schedulers, or manually.
 */
router.get("/plan-expiry-check", async (req, res) => {
    try {
        // Verify cron secret (skip in dev if not set)
        const cronSecret = process.env.CRON_SECRET;
        const querySecret = req.query.secret;
        const authHeader = req.headers["authorization"];

        if (cronSecret && querySecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        await connectDB();

        const now = new Date();
        // Find orgs whose plan expires within the next 48 hours (2 days) but hasn't expired yet
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

        const expiringOrgs = await Organization.find({
            plan: { $in: ["PRO", "pro", "PLUS", "plus"] },
            planExpiresAt: {
                $gte: now,
                $lte: twoDaysFromNow,
            },
            is_active: true,
        }).lean();

        let sentCount = 0;
        const errors = [];

        for (const org of expiringOrgs) {
            try {
                const expiryDate = new Date(org.planExpiresAt);
                const msRemaining = expiryDate.getTime() - now.getTime();
                const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
                const planName = (org.plan || "PRO").toUpperCase();
                const ownerName = org.ownerName || "Admin";
                const ownerEmail = org.ownerEmail;

                if (!ownerEmail) {
                    errors.push(`Org "${org.name}" has no owner email`);
                    continue;
                }

                const html = getPlanExpiryReminderHtml(org.name, ownerName, planName, expiryDate, daysRemaining);
                const text = getPlanExpiryReminderPlainText(org.name, ownerName, planName, expiryDate, daysRemaining);

                await sendEmail({
                    to: ownerEmail,
                    subject: `⚠️ Your Classgrid ${planName} Plan Expires ${daysRemaining <= 0 ? 'Today' : `in ${daysRemaining} Day${daysRemaining !== 1 ? 's' : ''}`} — ${org.name}`,
                    html,
                    text,
                });

                // Also notify super admin
                const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";
                try {
                    await sendEmail({
                        to: superAdminEmail,
                        subject: `⏰ Plan Expiry: ${org.name} (${planName}) — ${daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining}d left`}`,
                        html: `<h2>Plan Expiry Alert</h2>
                            <table style="border-collapse:collapse;width:100%;max-width:500px;">
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Organization</td><td style="padding:8px;border:1px solid #ddd;">${org.name}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Plan</td><td style="padding:8px;border:1px solid #ddd;">${planName}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Expires</td><td style="padding:8px;border:1px solid #ddd;">${expiryDate.toLocaleDateString('en-IN')}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Days Left</td><td style="padding:8px;border:1px solid #ddd;color:${daysRemaining <= 0 ? '#ef4444' : '#f59e0b'};font-weight:bold;">${daysRemaining <= 0 ? 'EXPIRED' : daysRemaining}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Admin Email</td><td style="padding:8px;border:1px solid #ddd;">${ownerEmail}</td></tr>
                            </table>
                            <p style="color:#666;margin-top:16px;">Org admin has been sent a renewal reminder email.</p>`,
                        text: `Plan Expiry: ${org.name} (${planName}) — ${daysRemaining <= 0 ? 'EXPIRED' : `${daysRemaining} days left`}. Admin: ${ownerEmail}.`,
                    });
                } catch (saErr) {
                    console.warn(`[Cron] Failed to notify super admin about ${org.name} expiry:`, saErr.message);
                }

                sentCount++;
                console.log(`[Cron] Expiry reminder sent to ${ownerEmail} for org "${org.name}" (${daysRemaining}d remaining)`);
            } catch (emailErr) {
                errors.push(`Failed to email ${org.ownerEmail}: ${emailErr.message}`);
                console.error(`[Cron] Expiry email error for ${org.name}:`, emailErr.message);
            }
        }

        res.json({
            message: `Plan expiry check complete. ${sentCount} reminder(s) sent.`,
            checked: expiringOrgs.length,
            sent: sentCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err) {
        console.error("[Cron] Plan expiry check error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/**
 * GET /api/cron/process-email-queue
 * 
 * Processes pending email jobs from the MongoDB queue.
 * Runs every minute via Vercel cron.
 * 
 * Safeguards:
 *  - Max 10 emails per run (Vercel 10s limit)
 *  - 8-second execution time guard
 *  - Atomic job locking (prevents duplicate sends)
 *  - Exponential backoff retry on failure
 */
router.get("/process-email-queue", async (req, res) => {
    const cronStart = Date.now();
    try {
        // Verify cron secret — accept query param OR Authorization header
        const cronSecret = process.env.CRON_SECRET;
        const querySecret = req.query.secret;
        const authHeader = req.headers["authorization"];

        if (cronSecret && querySecret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        await connectDB();

        // ── 1. GLOBAL ATTENDANCE SWEEP ──
        // Check for ANY attendance sessions that expired while Vercel was asleep
        const AttendanceSession = (await import("../models/AttendanceSession.js")).default;
        const Classroom = (await import("../models/Classroom.js")).default;
        const { sendAbsenceNotificationEmails } = await import("../services/notification-email.service.js");

        const staleSessions = await AttendanceSession.find({
            status: "active",
            expiresAt: { $lte: new Date() }
        }).lean();

        if (staleSessions.length > 0) {
            console.log(`[Cron] Found ${staleSessions.length} globally expired attendance sessions.`);
            await AttendanceSession.updateMany(
                { _id: { $in: staleSessions.map(s => s._id) } },
                { $set: { status: "expired" } }
            );

            for (const session of staleSessions) {
                const classroom = await Classroom.findById(session.classroom).select("name").lean();
                if (classroom) {
                    try {
                        await sendAbsenceNotificationEmails({ classroom, session });
                    } catch (err) {
                        console.error("[Cron] Absence email queue error:", err.message);
                    }
                }
            }
        }

        // ── 2. PROCESS EMAIL QUEUE ──
        const { processEmailQueue } = await import("../services/email-queue.service.js");

        console.log("[Cron] Email queue processing triggered");
        const stats = await processEmailQueue(112);

        const totalDuration = Date.now() - cronStart;
        console.log(
            `[Cron] Email queue run complete: fetched=${stats.fetched} sent=${stats.sent} failed=${stats.failed} duration=${totalDuration}ms`
        );

        res.json({
            message: "Email queue processed",
            ...stats,
            cronDurationMs: totalDuration,
        });
    } catch (err) {
        const totalDuration = Date.now() - cronStart;
        console.error("[Cron] Email queue error:", err.message, `duration=${totalDuration}ms`);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

export default router;
