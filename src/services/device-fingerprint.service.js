import crypto from "crypto";

/**
 * Parse basic browser and OS info from a User-Agent string.
 * Lightweight — no external dependency needed.
 */
function parseUserAgent(ua) {
    if (!ua) return { browser: "Unknown", os: "Unknown" };

    // ── OS detection ──
    let os = "Unknown";
    if (/Windows NT 10/i.test(ua)) os = "Windows 10/11";
    else if (/Windows NT/i.test(ua)) os = "Windows";
    else if (/Mac OS X/i.test(ua)) os = "macOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad/i.test(ua)) os = "iOS";
    else if (/Linux/i.test(ua)) os = "Linux";
    else if (/CrOS/i.test(ua)) os = "Chrome OS";

    // ── Browser detection ──
    let browser = "Unknown";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Chrome\//i.test(ua)) browser = "Chrome";
    else if (/Safari\//i.test(ua)) browser = "Safari";

    return { browser, os };
}

/**
 * Generate a device fingerprint from the request.
 * Combines userAgent + IP into a SHA-256 hash for privacy-safe comparison.
 *
 * @param {import('express').Request} req
 * @returns {{ fingerprint: string, browser: string, os: string, ipHash: string, userAgent: string }}
 */
export function getDeviceFingerprint(req) {
    const userAgent = req.headers["user-agent"] || "";
    const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";

    // Fingerprint based on User-Agent ONLY (not IP).
    // IP is excluded because it changes frequently on serverless platforms
    // (Vercel/Cloudflare edge rotation, IPv4↔IPv6 switching, mobile networks).
    // Using IP in the fingerprint caused EVERY login to be treated as a new device.
    const fingerprint = crypto
        .createHash("sha256")
        .update(userAgent)
        .digest("hex");

    // IP hash is stored as metadata for logging, NOT used for device matching.
    const ipHash = crypto
        .createHash("sha256")
        .update(ip)
        .digest("hex");

    const { browser, os } = parseUserAgent(userAgent);

    return { fingerprint, browser, os, ipHash, userAgent };
}

/**
 * Check if the current device is already trusted for a user.
 * If not trusted, add it to the trustedDevices array (capped at 10).
 *
 * @param {object} user - Mongoose User document (must be a full document, not lean)
 * @param {import('express').Request} req - Express request object
 * @returns {Promise<boolean>} true if the device was already trusted, false if it's new
 */
export async function checkAndRegisterDevice(user, req) {
    const { fingerprint, browser, os, ipHash } = getDeviceFingerprint(req);

    // Check if this fingerprint already exists in trusted devices
    const existingDevice = (user.trustedDevices || []).find(
        (d) => d.fingerprint === fingerprint
    );

    if (existingDevice) {
        // Device is already trusted — no email needed
        return true;
    }

    // New device — add to trusted list (cap at 10, evict oldest)
    if (!user.trustedDevices) user.trustedDevices = [];

    if (user.trustedDevices.length >= 10) {
        // Remove the oldest device
        user.trustedDevices.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
        user.trustedDevices.shift();
    }

    user.trustedDevices.push({
        fingerprint,
        browser,
        os,
        ipHash,
        addedAt: new Date(),
    });

    // Save is handled by the caller (login flow already calls user.save())
    return false;
}
