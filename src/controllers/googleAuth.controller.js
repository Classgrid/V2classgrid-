import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Verification from "../models/Verification.js";
import { sendEmail } from "../services/aws-ses.service.js";
import {
    getFacultyWelcomeEmailHtml,
    getFacultyWelcomePlainText,
    getStudentWelcomeEmailHtml,
    getStudentWelcomePlainText,
    getLoginNotificationHtml,
    getLoginNotificationPlainText,
} from "../services/email-templates.service.js";
import { checkAndRegisterDevice } from "../services/device-fingerprint.service.js";
import Organization from "../models/Organization.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Function to get the correct frontend URL based on environment
const getFrontendUrl = () => {
    return process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
};

// ─────────────────────────────────────────────
// Email helpers using centralized templates
// ─────────────────────────────────────────────

const sendFirstGoogleLoginEmail = async (user) => {
    try {
        const dashboardUrl = `${getFrontendUrl()}/classroom`;
        let html, text;

        // Fetch organization name if available
        let orgName = "Classgrid";
        if (user.organization_id) {
            const org = await Organization.findById(user.organization_id).select('name');
            orgName = org ? org.name : "Classgrid";
        }

        if (user.role === 'faculty' || user.role === 'teacher') {
            html = getFacultyWelcomeEmailHtml(user.name, orgName, dashboardUrl);
            text = getFacultyWelcomePlainText(user.name, orgName, dashboardUrl);
        } else {
            // Default to Student welcome
            html = getStudentWelcomeEmailHtml(user.name, dashboardUrl);
            text = getStudentWelcomePlainText(user.name, dashboardUrl);
        }

        await sendEmail({
            to: user.email,
            subject: "🎉 Welcome to Classgrid - Account Created Successfully",
            html: html,
            text: text,
        });
        console.log("📧 Google welcome email sent to:", user.email);
    } catch (err) {
        console.error("Google Welcome Email Error:", err.message);
    }
};

const sendGoogleLoginNotification = async (user) => {
    try {
        await sendEmail({
            to: user.email,
            subject: "🔐 Classgrid - Account Login Notification",
            html: getLoginNotificationHtml(user, "google"),
            text: getLoginNotificationPlainText(user, "google"),
        });
        console.log("📧 Google login notification sent to:", user.email);
    } catch (err) {
        console.error("Google Login Notification Error:", err.message);
    }
};

// ─────────────────────────────────────────────
// Provider Isolation Check
// ─────────────────────────────────────────────

const checkGoogleOAuthBlock = async (email) => {
    console.log(`🔍 Checking Google OAuth permissions for: ${email}`);

    // Block if pending verification exists (manual signup in progress)
    const pendingVerification = await Verification.findOne({ email });
    if (pendingVerification) {
        console.log("🚫 BLOCKED: Email has pending verification");
        throw new Error(
            "Email verification pending. Please complete email verification first."
        );
    }

    console.log("✅ Google OAuth permitted for this email");
    return true;
};

// ─────────────────────────────────────────────
// Google OAuth Callback (custom handler)
// ─────────────────────────────────────────────

export const googleCallback = async (req, res) => {
    const FRONTEND_URL = getFrontendUrl();

    try {
        console.log("=== GOOGLE AUTHENTICATION START ===");

        if (!req.user) {
            console.error("❌ No user data received from Google");
            return res.redirect(`${FRONTEND_URL}/login?error=no_user_data`);
        }

        const { id, displayName, emails, photos } = req.user;
        const email = emails && emails[0] ? emails[0].value : null;
        const name = displayName || "Google User";
        const picture = photos && photos[0] ? photos[0].value : "";

        if (!email) {
            return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
        }

        if (!id) {
            return res.redirect(`${FRONTEND_URL}/login?error=no_google_id`);
        }

        // Check if Google OAuth should be blocked (provider isolation)
        try {
            await checkGoogleOAuthBlock(email);
        } catch (blockError) {
            console.error("🚫 Google OAuth blocked:", blockError.message);
            return res.redirect(
                `${FRONTEND_URL}/login?error=google_blocked&message=${encodeURIComponent(blockError.message)}`
            );
        }

        // Find user by googleId first, then by email (to allow linking)
        let user = await User.findOne({
            $or: [{ googleId: id }, { email: email }],
        });

        if (!user) {
            // ──── NEW USER ────
            console.log("👤 Creating new Google user");
            user = new User({
                name,
                email,
                authProvider: "google",
                linkedProviders: ["google"],
                googleId: id,
                isEmailVerified: true,
                lastLoginAt: new Date(),
            });

            await user.save();
            console.log("✅ Google user created successfully");

            // Send welcome email (non-blocking)
            sendFirstGoogleLoginEmail(user);

        } else {
            // ──── EXISTING USER (OR ACCOUNT LINKING) ────
            console.log("👤 Updating existing user via Google Login");

            const isFirstLogin = !user.lastLoginAt;

            // Set current session provider
            user.authProvider = "google";

            // Link Google if not already linked
            if (!user.linkedProviders.includes("google")) {
                console.log("🔗 Linking Google to existing account");
                user.linkedProviders.push("google");
            }

            user.googleId = id;
            user.isEmailVerified = true;
            user.lastLoginAt = new Date();

            if (picture && !user.profilePicture) {
                user.profilePicture = picture;
            }
            if (!user.name && name) {
                user.name = name;
            }

            // Check device fingerprint BEFORE save
            const isKnownDevice = await checkAndRegisterDevice(user, req);

            await user.save();

            // Send welcome email on first login only
            if (isFirstLogin) {
                sendFirstGoogleLoginEmail(user);
            }
        }

        // Generate JWT token (standardized shape: id, role, organizationId)
        const token = jwt.sign(
            { id: user._id.toString(), role: user.role, organizationId: user.organization_id || null },
            JWT_SECRET,
            { expiresIn: "7d" }
        );
        console.log("✅ JWT token generated");

        let redirectUrl = `${FRONTEND_URL}/classroom?token=${token}&google_auth=true`;

        // Faculty with no org must enter org code first
        if (['faculty', 'teacher'].includes(user.role) && !user.organization_id) {
            redirectUrl = `${FRONTEND_URL}/enter-org-code.html?token=${token}&google_auth=true`;
        }

        console.log("=== GOOGLE AUTHENTICATION END ===");

        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.redirect(redirectUrl);

    } catch (error) {
        console.error("❌ Google authentication error:", error.message);
        const errorUrl = `${FRONTEND_URL}/login?error=google_auth_failed&message=${encodeURIComponent(error.message)}`;
        res.redirect(errorUrl);
    }
};

// Test endpoint for debugging
export const testGoogleAuth = async (req, res) => {
    res.json({
        status: "Google Authentication API operational",
        timestamp: new Date().toISOString(),
        frontendUrl: getFrontendUrl(),
        googleClientId: process.env.GOOGLE_CLIENT_ID ? "CONFIGURED" : "NOT CONFIGURED",
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL ? "YES" : "NO",
    });
};

// Get Google OAuth URL
export const getGoogleAuthUrl = async (req, res) => {
    try {
        const backendUrl = process.env.BACKEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim() || `${backendUrl}/api/auth/google/callback`;

        const clientId = process.env.GOOGLE_CLIENT_ID;

        if (!clientId) {
            return res.status(500).json({ error: "Google Client ID not configured" });
        }

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=profile email&access_type=offline&prompt=select_account`;

        res.json({
            authUrl,
            callbackUrl,
            clientId: clientId.substring(0, 10) + "...",
        });
    } catch (error) {
        console.error("Error generating Google auth URL:", error);
        res.status(500).json({ error: "Failed to generate authentication URL" });
    }
};
