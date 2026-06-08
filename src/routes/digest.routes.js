/**
 * Classgrid — Digest Cron Route (Phase 1.5)
 *
 * Called by Vercel Cron daily at 6 AM UTC.
 * Sends daily digests always, weekly digests on Mondays.
 * Secured by CRON_SECRET.
 */

import express from "express";
import { sendDailyDigests, sendWeeklyDigests } from "../services/digest-email.service.js";

const router = express.Router();

// GET /api/digest/daily — Vercel Cron endpoint
router.get("/daily", async (req, res) => {
    // Verify cron secret
    const secret = req.headers["authorization"]?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // Always run daily digests
        const dailyResult = await sendDailyDigests();

        // Run weekly digests if today is Monday (UTC)
        let weeklyResult = null;
        const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon
        if (dayOfWeek === 1) {
            weeklyResult = await sendWeeklyDigests();
        }

        res.json({
            message: "Digest cron complete",
            daily: dailyResult,
            weekly: weeklyResult || "Skipped (not Monday)",
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error("[Digest Cron] Failed:", err.message);
        res.status(500).json({ message: "Digest cron failed", error: err.message });
    }
});

export default router;
