import User from "../models/User.js";
import Verification from "../models/Verification.js";
import DeviceVerification from "../models/DeviceVerification.js";
import Organization from "../models/Organization.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "../services/aws-ses.service.js";
import connectDB from "../../config/db.js";
import { checkAndRegisterDevice, getDeviceFingerprint } from "../services/device-fingerprint.service.js";
import {
    getFacultyWelcomeEmailHtml,
    getFacultyWelcomePlainText,
    getStudentWelcomeEmailHtml,
    getStudentWelcomePlainText,
    getLoginNotificationHtml,
    getLoginNotificationPlainText,
    getVerificationEmailHtml,
    getPasswordResetEmailHtml,
    getVerificationEmailPlainText,
    getPasswordResetEmailPlainText,
} from "../services/email-templates.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const getFrontendUrl = () => {
    return process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
};

const FRONTEND_URL = getFrontendUrl();

// Helper: Token Generator (standardized — all tokens carry id, role, organizationId)
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role, organizationId: user.organization_id || null },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
};

// Helper: Set Cookie
const setTokenCookie = (res, token) => {
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("jwt", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

// ─────────────────────────────────────────────
// Helper: Send Welcome Email (First Login)
// ─────────────────────────────────────────────
const sendWelcomeEmail = async (user, provider = "manual") => {
    try {
        const dashboardUrl = `${getFrontendUrl()}/classroom`;
        let html, text;

        // Use organization name if available (otherwise generic org name for unassigned students)
        let orgName = "Classgrid";
        if (user.organization_id) {
            const org = await Organization.findById(user.organization_id).select('name');
            orgName = org ? org.name : "Classgrid";
        }

        if (user.role === 'faculty' || user.role === 'teacher') {
            html = getFacultyWelcomeEmailHtml(user.name, orgName, dashboardUrl);
            text = getFacultyWelcomePlainText(user.name, orgName, dashboardUrl);
        } else {
            // Default to Student welcome for any other role
            html = getStudentWelcomeEmailHtml(user.name, dashboardUrl);
            text = getStudentWelcomePlainText(user.name, dashboardUrl);
        }

        await sendEmail({
            to: user.email,
            subject: "🎉 Welcome to Classgrid - Account Created Successfully",
            html: html,
            text: text,
        });
        console.log(`📧 Welcome email sent to ${user.email} (${provider})`);
    } catch (err) {
        console.error("Welcome Email Error (non-critical):", err.message);
    }
};

// ─────────────────────────────────────────────
// Helper: Send Login Notification (New Device Only)
// ─────────────────────────────────────────────
const sendLoginNotification = async (user, provider = "manual") => {
    try {
        await sendEmail({
            to: user.email,
            subject: "🔐 Classgrid - Account Login Notification",
            html: getLoginNotificationHtml(user, provider),
            text: getLoginNotificationPlainText(user, provider),
        });
        console.log(`📧 Login notification sent to ${user.email} (${provider})`);
    } catch (err) {
        console.error("Login Notification Error (non-critical):", err.message);
    }
};

/* ==================== PUBLIC CONFIG ==================== */
export const getSystemConfig = async (req, res) => {
    try {
        await connectDB();
        const { default: SystemSettings } = await import("../models/SystemSettings.js");
        const settings = await SystemSettings.findOne();
        res.status(200).json({
            maintenanceMode: settings?.maintenanceMode || false,
            disableRegistrations: settings?.disableRegistrations || false,
            aiFeatures: settings?.aiFeatures ?? true,
            notesSystem: settings?.notesSystem ?? true,
            chatSystem: settings?.chatSystem ?? true
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

/* ==================== MANUAL AUTH ==================== */

// Initiate Signup (Step 1: Email & Name)
export const initiateSignup = async (req, res) => {
    try {
        await connectDB(); // Guard against cold-start DB not ready

        const { default: SystemSettings } = await import("../models/SystemSettings.js");
        const settings = await SystemSettings.findOne();
        if (settings && settings.disableRegistrations) {
            return res.status(403).json({ message: "New registrations are currently disabled by the Super Admin." });
        }

        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        // Check if a VERIFIED user already exists with this email
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(400).json({ message: "Email already registered. Please login." });
        }

        // If an unverified user exists (from incomplete signup), delete them so we can redo
        if (existingUser && !existingUser.isEmailVerified) {
            await User.deleteOne({ _id: existingUser._id });
        }

        // Check if a verification is already pending
        let verification = await Verification.findOne({ email });
        const token = uuidv4();

        if (verification) {
            // Rate limit: max 2 sends per hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentSendCount = (verification.lastResentAt && verification.lastResentAt > oneHourAgo)
                ? verification.resendCount
                : 0;

            if (recentSendCount >= 2) {
                return res.status(429).json({
                    message: "Verification email already sent. Please wait before requesting again (max 2 per hour)."
                });
            }

            // Update existing verification
            verification.verificationToken = token;
            verification.name = name;
            verification.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            verification.resendCount = recentSendCount + 1;
            verification.lastResentAt = new Date();
            await verification.save();
        } else {
            // Create new verification
            verification = await Verification.create({
                name,
                email,
                verificationToken: token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                resendCount: 1,
                lastResentAt: new Date(),
            });
        }

        // Send Verification Email (with logo)
        const apiVerifyLink = `${FRONTEND_URL}/api/auth/verify-token/${token}`;

        await sendEmail({
            to: email,
            subject: "📧 Verify Email - Classgrid",
            html: getVerificationEmailHtml(name, apiVerifyLink),
            text: getVerificationEmailPlainText(name, apiVerifyLink),
        });

        res.json({ message: "Verification email sent. Please check your inbox." });

    } catch (err) {
        console.error("Initiate Signup Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Minimal Safe Admin Validation for Smart Email-First Login Flow
export const checkAdminStatus = async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });
        email = email.toLowerCase().trim();

        // Find user by email and select mustResetPassword to check activation status
        const user = await User.findOne({ email }).select("role mustResetPassword");

        // If not found, or not an org_admin, return isOrgAdmin: false
        if (!user || user.role !== "org_admin") {
            return res.json({ isOrgAdmin: false });
        }

        // isOrgAdmin is true. 'isActivated' means they have completed setup (mustResetPassword is false)
        const isActivated = !user.mustResetPassword;

        return res.json({
            isOrgAdmin: true,
            isActivated
        });
    } catch (err) {
        console.error("Check Admin Status Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/auth/validate-activation-token
// Validates if an activation token is valid and unused
export const validateActivationToken = async (req, res) => {
    try {
        await connectDB();
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Token is required." });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            activationToken: hashedToken,
            activationTokenExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: "This activation link is invalid or has expired." });
        }

        if (user.role !== "org_admin") {
            return res.status(403).json({ message: "This activation link is not valid for your account type." });
        }

        if (!user.mustResetPassword) {
            return res.status(400).json({ message: "This account has already been activated. Please sign in." });
        }

        return res.status(200).json({ valid: true });
    } catch (err) {
        console.error("Validate Activation Token Error:", err);
        res.status(500).json({ message: "Server error during validation." });
    }
};

// POST /api/auth/activate-admin
// Validates activation token, sets password, marks admin as activated, auto-logs in
export const activateAdmin = async (req, res) => {
    try {
        await connectDB();
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and password are required." });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters." });
        }

        // Hash the incoming raw token to compare with stored hash
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            activationToken: hashedToken,
            activationTokenExpires: { $gt: new Date() }
        }).select("+password");

        if (!user) {
            return res.status(400).json({ message: "This activation link is invalid or has expired. Please request a new one." });
        }

        if (user.role !== "org_admin") {
            return res.status(403).json({ message: "This activation link is not valid for your account type." });
        }

        if (!user.mustResetPassword) {
            return res.status(400).json({ message: "This account has already been activated. Please sign in." });
        }

        // Set password, mark activated, clear token (single-use)
        user.password = await bcrypt.hash(password, 10);
        user.mustResetPassword = false;
        user.isEmailVerified = true;
        user.activationToken = null;
        user.activationTokenExpires = null;
        if (!user.linkedProviders) user.linkedProviders = [];
        if (!user.linkedProviders.includes("manual")) user.linkedProviders.push("manual");
        user.authProvider = "manual";
        user.lastLoginAt = new Date();
        await user.save();

        // Send activated confirmation email
        const { getOrgAdminActivatedHtml, getOrgAdminActivatedPlainText } = await import("../services/email-templates.service.js");
        const frontendUrl = getFrontendUrl();
        const org = user.organization_id
            ? await Organization.findById(user.organization_id).select("name").lean()
            : null;
        const orgNameFormatted = org?.name
            ? encodeURIComponent(org.name.replace(/\s+/g, "-").toLowerCase())
            : "dashboard";
        const dashboardLink = `${frontendUrl}/org/${orgNameFormatted}/admin`;
        const adminLoginLink = `${frontendUrl}/admin/login`;

        try {
            await sendEmail({
                to: user.email,
                subject: "Your Classgrid Admin Account is Active",
                html: getOrgAdminActivatedHtml(user.name, dashboardLink, adminLoginLink),
                text: getOrgAdminActivatedPlainText(user.name, dashboardLink, adminLoginLink),
            });
        } catch (emailErr) {
            console.error("Activation email send error (non-critical):", emailErr.message);
        }

        // Auto login — generate JWT exactly like normal login does
        const jwtToken = generateToken(user);
        setTokenCookie(res, jwtToken);

        res.status(200).json({
            message: "Account activated successfully",
            token: jwtToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture || "",
                photoURL: user.profilePicture || "",
                organization_id: user.organization_id || null,
                organization: org ? { name: org.name } : null,
                authProvider: "manual",
            }
        });
    } catch (err) {
        console.error("Activate Admin Error:", err);
        res.status(500).json({ message: "Server error during activation." });
    }
};

// POST /api/auth/resend-activation
// Rate-limited: regenerates activation token and resends invite email for unactivated org admins
export const resendActivation = async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required." });
        email = email.toLowerCase().trim();

        const user = await User.findOne({ email });

        // Always return the same safe message to prevent enumeration
        const safeResponse = () => res.json({ message: "If that email is a pending admin account, a new activation link has been sent." });

        if (!user || user.role !== "org_admin" || !user.mustResetPassword) {
            return safeResponse();
        }

        // Rate limit: only allow resend if existing token was issued more than 5 minutes ago
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (user.activationTokenExpires && user.activationTokenExpires > new Date(Date.now() + (5 * 60 * 1000) - (2 * 60 * 1000))) {
            // Token was issued less than 2 minutes ago (still near-full 5min remaining)
            return res.status(429).json({ message: "Please wait a few minutes before requesting another activation email." });
        }

        // Generate new token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.activationToken = hashedToken;
        user.activationTokenExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await user.save();

        const frontendUrl = getFrontendUrl();
        const activationLink = `${frontendUrl}/admin/activate?token=${rawToken}`;

        const org = user.organization_id
            ? await Organization.findById(user.organization_id).select("name").lean()
            : null;
        const orgName = org?.name || "your organization";

        const { getOrgAdminInviteHtml, getOrgAdminInvitePlainText } = await import("../services/email-templates.service.js");

        try {
            await sendEmail({
                to: user.email,
                subject: "Activate Your Classgrid Admin Account",
                html: getOrgAdminInviteHtml(user.name, orgName, activationLink),
                text: getOrgAdminInvitePlainText(user.name, orgName, activationLink),
            });
        } catch (emailErr) {
            console.error("Resend activation email error:", emailErr.message);
            return res.status(500).json({ message: "Failed to send activation email. Please try again." });
        }

        return safeResponse();
    } catch (err) {
        console.error("Resend Activation Error:", err);
        res.status(500).json({ message: "Server error." });
    }
};



// Login (Manual)
export const login = async (req, res) => {
    try {
        await connectDB();
        let { email, password, expectedLoginType, loginTab, deviceFingerprint } = req.body;

        // Prioritize stable cookie fingerprint if it exists
        if (req.cookies && req.cookies.client_device_fp) {
            deviceFingerprint = req.cookies.client_device_fp;
        }

        if (email) email = email.toLowerCase().trim();

        // Explicitly select password and mustResetPassword
        const user = await User.findOne({ email }).select("+password +mustResetPassword +isSandbox");
        if (!user) return res.status(401).json({ message: "Invalid credentials" });

        // Strict role validation based on login page source
        const roleLabels = { student: 'Student', teacher: 'Faculty', faculty: 'Faculty', org_admin: 'Organization Admin', super_admin: 'Super Admin' };
        const userRoleLabel = roleLabels[user.role] || user.role;

        if (expectedLoginType === 'superadmin' && user.role !== 'super_admin') {
            return res.status(403).json({ message: `This account is registered as ${userRoleLabel}. Please use the correct login portal for your role.` });
        }
        if (expectedLoginType === 'admin' && user.role !== 'org_admin') {
            return res.status(403).json({ message: `This account is registered as ${userRoleLabel}. Please use the ${['student', 'faculty', 'teacher'].includes(user.role) ? 'Student/Faculty' : 'correct'} login portal.` });
        }
        if (expectedLoginType === 'standard' && !['student', 'faculty', 'teacher'].includes(user.role)) {
            return res.status(403).json({ message: `This account is registered as ${userRoleLabel}. Please use the Admin Login portal instead.` });
        }

        // Strict tab enforcement — prevent wrong-tab logins
        if (loginTab === 'student' && !['student'].includes(user.role)) {
            return res.status(403).json({ message: `This account is registered as ${userRoleLabel}. Please switch to the Faculty tab to sign in.`, wrongTab: true, correctTab: 'teacher' });
        }
        if (loginTab === 'teacher' && !['faculty', 'teacher'].includes(user.role)) {
            return res.status(403).json({ message: `This account is registered as ${userRoleLabel}. Please switch to the Student tab to sign in.`, wrongTab: true, correctTab: 'student' });
        }

        // Check password existence & handle First-Time Admin Login
        if (!user.password) {
            // Normal failure for others
            const primaryProv = user.linkedProviders[0] || user.authProvider;
            return res.status(400).json({
                message: `This account does not have a password set. Please login using ${primaryProv} or use 'Forgot Password' to set a password.`
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Status check — block suspended/blocked users
        if (user.status === "suspended" || user.status === "blocked") {
            return res.status(403).json({ message: "Your account is suspended. Please contact support." });
        }

        const { default: SystemSettings } = await import("../models/SystemSettings.js");
        const settings = await SystemSettings.findOne();

        if (settings && settings.maintenanceMode && user.role !== "super_admin") {
            return res.status(503).json({ message: "The platform is currently in maintenance mode." });
        }

        // Organization status check — block if org is suspended/blocked
        if (user.organization_id && ["org_admin", "faculty", "teacher"].includes(user.role)) {
            const org = await Organization.findById(user.organization_id).select("status").lean();
            if (org && (org.status === "suspended" || org.status === "blocked")) {
                return res.status(403).json({ message: "Your organization is suspended. Please contact your administrator." });
            }
        }

        // Email verification gate — admin-invited faculty are pre-verified (isEmailVerified=true set on creation)
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in.",
                code: "EMAIL_NOT_VERIFIED"
            });
        }

        const isFirstLogin = !user.lastLoginAt;
        const mustReset = !!user.mustResetPassword;

        // --- DEVICE BINDING LOGIC (ALL ROLES) ---
        // Sandbox/test accounts skip device verification — they have fake emails with no real inbox
        if (deviceFingerprint && !user.isSandbox) {
            const isKnownDevice = user.trustedDevices && user.trustedDevices.some(d => d.fingerprint === deviceFingerprint);

            if (!isKnownDevice) {
                // New device: Require OTP
                const existingVerification = await DeviceVerification.findOne({ email: user.email });
                if (existingVerification && existingVerification.lastResentAt && Date.now() - existingVerification.lastResentAt.getTime() < 60000) {
                    return res.status(429).json({
                        message: 'Please wait 60 seconds before requesting a new OTP.',
                        needsDeviceOtp: true
                    });
                }

                const otp = Math.floor(100000 + Math.random() * 900000).toString();

                await DeviceVerification.findOneAndUpdate(
                    { email: user.email },
                    {
                        deviceFingerprint,
                        otp,
                        isUsed: false,
                        failedAttempts: 0,
                        lastResentAt: new Date(),
                        expiresAt: new Date(Date.now() + 30 * 1000) // 30 secs
                    },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );

                const { getNewDeviceOtpHtml, getNewDeviceOtpPlainText } = await import("../services/email-templates.service.js");

                try {
                    await sendEmail({
                        to: user.email,
                        subject: "security alert: New Device Detected",
                        html: getNewDeviceOtpHtml ? getNewDeviceOtpHtml(user.name, otp) : `<p>Your Classgrid verification code is: <strong>${otp}</strong></p>`,
                        text: getNewDeviceOtpPlainText ? getNewDeviceOtpPlainText(user.name, otp) : `Your Classgrid verification code is: ${otp}`,
                    });
                } catch (emailErr) {
                    console.error("Failed to send device OTP:", emailErr);
                }

                return res.status(403).json({
                    message: "Unrecognized device. Please complete OTP verification.",
                    needsDeviceOtp: true
                });
            }
        }
        // -----------------------------

        const token = generateToken(user);
        setTokenCookie(res, token);

        // Track soft devices (used for OAuth alerts, separate from strict fingerprinting)
        await checkAndRegisterDevice(user, req);

        // Track last auth provider
        user.lastLoginAt = new Date();
        user.authProvider = "manual";
        if (!user.linkedProviders) user.linkedProviders = [];
        if (!user.linkedProviders.includes("manual")) user.linkedProviders.push("manual");
        await user.save();

        // Send welcome email on first login only
        if (isFirstLogin && !mustReset) {
            await sendWelcomeEmail(user, "manual");
        }

        // Detect if faculty/teacher needs to enter org code
        const needsOrgCode = ['faculty', 'teacher'].includes(user.role) && !user.organization_id;

        res.json({
            message: "Login successful",
            token,
            firstLogin: isFirstLogin,
            mustResetPassword: mustReset,
            needsOrgCode,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture || "",
                photoURL: user.profilePicture || "",
                organization_id: user.organization_id || null,
                authProvider: user.authProvider,
            },
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server error during login" });
    }
};


// Verify Signup Token (Step 2: Link Clicked)
export const verifySignupToken = async (req, res) => {
    try {
        const { token } = req.params;
        const FRONTEND_URL = getFrontendUrl();

        // Standard signup verification processing
        const verification = await Verification.findOne({ verificationToken: token });

        if (!verification) {
            return res.redirect(`${FRONTEND_URL}/login?error=InvalidToken`);
        }

        if (verification.isUsed) {
            return res.redirect(`${FRONTEND_URL}/login?error=TokenAlreadyUsed`);
        }

        if (verification.expiresAt < new Date()) {
            return res.redirect(`${FRONTEND_URL}/login?error=TokenExpired`);
        }

        // Redirect to new intermediate success page Instead of straight to password
        res.redirect(`${FRONTEND_URL}/verify-email.html?token=${token}&email=${encodeURIComponent(verification.email)}&name=${encodeURIComponent(verification.name)}`);

    } catch (err) {
        console.error("Verify Token Error:", err);
        const FRONTEND_URL = getFrontendUrl();
        res.redirect(`${FRONTEND_URL}/login?error=ServerError`);
    }
};

// Complete Signup (Step 3: Set Password)
export const completeSignup = async (req, res) => {
    try {
        const { token, password, role } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and password are required" });
        }

        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!strongPassword.test(password)) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
            });
        }

        // Validate role if provided
        const validRoles = ["student", "teacher"];
        const userRole = validRoles.includes(role) ? role : "student";

        // Step 1: Atomically find valid token and mark it as used to prevent race-condition reuse
        const updatedVerification = await Verification.findOneAndUpdate(
            {
                verificationToken: token,
                isUsed: false,
                expiresAt: { $gt: new Date() }
            },
            { $set: { isUsed: true } },
            { returnDocument: 'after' }
        );

        if (!updatedVerification) {
            // Document is invalid, already used, or expired
            return res.status(400).json({ message: "Token is invalid, expired, or has already been used" });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        const user = await User.create({
            name: updatedVerification.name,
            email: updatedVerification.email,
            password: hashedPassword,
            role: userRole,
            authProvider: "manual",
            linkedProviders: ["manual"],
            isEmailVerified: true,
            lastLoginAt: new Date(),
            passwordChangedAt: Date.now()
        });

        // Delete verification doc
        await Verification.deleteOne({ _id: updatedVerification._id });

        // Send Welcome Email
        await sendWelcomeEmail(user, "manual");

        // Auto Login
        const jwtToken = generateToken(user);
        setTokenCookie(res, jwtToken);

        // Detect if faculty/teacher needs to enter org code
        const needsOrgCode = ['faculty', 'teacher'].includes(user.role) && !user.organization_id;

        res.json({
            message: "Account created successfully",
            token: jwtToken,
            firstLogin: true,
            needsOrgCode,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture || "",
                photoURL: user.profilePicture || "",
                organization_id: user.organization_id || null,
                authProvider: "manual"
            }
        });

    } catch (err) {
        console.error("Complete Signup Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

/* ==================== OAUTH CALLBACKS ==================== */

// Common OAuth callback handler (used by Google, GitHub, Facebook)
export const oauthCallback = async (req, res) => {
    // Passport populates req.user
    if (!req.user) {
        return res.redirect(`${FRONTEND_URL}/login?error=AuthFailed`);
    }

    // Status checks
    if (req.user.status === "suspended" || req.user.status === "blocked") {
        return res.redirect(`${FRONTEND_URL}/login?error=account_suspended`);
    }

    // Tab enforcement for Google OAuth (state param carries loginTab)
    const loginTab = req.query.state || null;
    const oauthRoleLabels = { student: 'Student', teacher: 'Faculty', faculty: 'Faculty', org_admin: 'Organization Admin', super_admin: 'Super Admin' };
    const oauthUserRoleLabel = oauthRoleLabels[req.user.role] || req.user.role;

    if (loginTab === 'student' && req.user.role !== 'student') {
        return res.redirect(`${FRONTEND_URL}/login?error=wrong_tab&tab=teacher&message=${encodeURIComponent(`This account is registered as ${oauthUserRoleLabel}. Please use the Faculty tab to sign in.`)}`);
    }
    if (loginTab === 'teacher' && !['faculty', 'teacher'].includes(req.user.role)) {
        return res.redirect(`${FRONTEND_URL}/login?error=wrong_tab&tab=student&message=${encodeURIComponent(`This account is registered as ${oauthUserRoleLabel}. Please use the Student tab to sign in.`)}`);
    }
    if (loginTab === 'org_admin' && req.user.role !== 'org_admin') {
        return res.redirect(`${FRONTEND_URL}/admin/login?error=wrong_role&message=${encodeURIComponent(`This account is registered as ${oauthUserRoleLabel}. Please use the ${req.user.role === 'student' ? 'Student' : 'Faculty'} login portal instead.`)}`);
    }

    const { default: SystemSettings } = await import("../models/SystemSettings.js");
    const settings = await SystemSettings.findOne();

    if (settings && settings.maintenanceMode && req.user.role !== "super_admin") {
        return res.redirect(`${FRONTEND_URL}/login?error=maintenance_mode`);
    }

    let orgName = 'dashboard';
    if (req.user.organization_id && req.user.role !== "super_admin") {
        const { default: Organization } = await import("../models/Organization.js");
        const org = await Organization.findById(req.user.organization_id).select("name status").lean();
        if (org && (org.status === "suspended" || org.status === "blocked")) {
            return res.redirect(`${FRONTEND_URL}/login?error=org_suspended`);
        }
        if (org && org.name) {
            orgName = org.name;
        }
    }

    // Determine provider
    const provider = req.user.authProvider || "social";

    // If org_admin logs in with Google (social), remove forced password setup
    if (req.user.role === 'org_admin' && provider !== 'manual') {
        req.user.mustResetPassword = false;
    }

    // Check First Login
    const isFirstLogin = !req.user.lastLoginAt;

    // --- DEVICE OTP CHECK FOR OAUTH (ALL PROVIDERS) ---
    // Skip device check for first-ever login (new users shouldn't be blocked) and sandbox accounts
    if (!isFirstLogin && !req.user.isSandbox) {
        const { fingerprint: serverFingerprint } = getDeviceFingerprint(req);
        const isKnownDevice = req.user.trustedDevices && req.user.trustedDevices.some(d => d.fingerprint === serverFingerprint);

        if (!isKnownDevice) {
            // Unknown device — send OTP and redirect to verification page
            const userEmail = req.user.email;
            try {
                // Rate limit: check if OTP was sent within last 60 seconds
                const existingVerification = await DeviceVerification.findOne({ email: userEmail });
                if (existingVerification && existingVerification.lastResentAt && Date.now() - existingVerification.lastResentAt.getTime() < 60000) {
                    // OTP was sent recently, just redirect to the verify page
                    return res.redirect(`${FRONTEND_URL}/login.html?device_verify=true&email=${encodeURIComponent(userEmail)}&provider=${provider}`);
                }

                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                await DeviceVerification.findOneAndUpdate(
                    { email: userEmail },
                    {
                        deviceFingerprint: serverFingerprint,
                        otp,
                        isUsed: false,
                        failedAttempts: 0,
                        lastResentAt: new Date(),
                        expiresAt: new Date(Date.now() + 30 * 1000) // 30 secs
                    },
                    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
                );

                const { getNewDeviceOtpHtml, getNewDeviceOtpPlainText } = await import("../services/email-templates.service.js");
                try {
                    await sendEmail({
                        to: userEmail,
                        subject: "Security Alert: New Device Detected",
                        html: getNewDeviceOtpHtml ? getNewDeviceOtpHtml(req.user.name, otp) : `<p>Your Classgrid verification code is: <strong>${otp}</strong></p>`,
                        text: getNewDeviceOtpPlainText ? getNewDeviceOtpPlainText(req.user.name, otp) : `Your Classgrid verification code is: ${otp}`,
                    });
                } catch (emailErr) {
                    console.error("Failed to send OAuth device OTP:", emailErr);
                }

                return res.redirect(`${FRONTEND_URL}/login.html?device_verify=true&email=${encodeURIComponent(userEmail)}&provider=${provider}`);
            } catch (deviceErr) {
                console.error("OAuth device check error (non-blocking):", deviceErr);
                // If device check fails, STILL allow login rather than breaking OAuth entirely
            }
        }
    }
    // --- END DEVICE OTP CHECK ---

    // Device registration (soft — track devices for future checks)
    await checkAndRegisterDevice(req.user, req);

    // Update last login
    req.user.lastLoginAt = new Date();
    await req.user.save();

    const token = generateToken(req.user);
    setTokenCookie(res, token);

    // Send welcome email on first login only
    if (isFirstLogin) {
        await sendWelcomeEmail(req.user, provider);
    }

    // Role-based redirect
    let target;
    if (req.user.role === 'super_admin') {
        target = '/superadmin/login';
    } else if (req.user.role === 'org_admin') {
        if (req.user.organization_id) {
            target = `/org/${encodeURIComponent(orgName.replace(/\s+/g, '-').toLowerCase())}/admin`;
        } else {
            target = '/enter-org-code.html';
        }
    } else if (['faculty', 'teacher'].includes(req.user.role) && !req.user.organization_id) {
        // Faculty with no org must enter org code first
        target = '/enter-org-code.html';
    } else {
        target = '/classroom';
    }

    const qs = isFirstLogin ? `?welcome=true&token=${token}` : `?token=${token}`;
    res.redirect(`${FRONTEND_URL}${target}${qs}`);
};

// Forgot Password
export const forgotPassword = async (req, res) => {
    try {
        await connectDB();
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Security: always return the same message to prevent user enumeration
        const safeResponse = () => res.json({ message: "If that email is registered, a password reset link has been sent." });

        if (!user) return safeResponse();

        // Only gate on email verification for standard signup users (not admin-invited faculty)
        // Admin-invited faculty are pre-verified (isEmailVerified = true) — always let through
        if (!user.isEmailVerified) return safeResponse();

        // Generate a cryptographically secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
        await user.save();

        const resetLink = `${getFrontendUrl()}/reset-password?token=${rawToken}`;

        await sendEmail({
            to: email,
            subject: "🔑 Reset Your Password - Classgrid",
            html: getPasswordResetEmailHtml(resetLink),
            text: getPasswordResetEmailPlainText(resetLink)
        });

        return safeResponse();

    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Reset token is required." });
        }

        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!password || !strongPassword.test(password)) {
            return res.status(422).json({
                message: "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
            });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOneAndUpdate(
            {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: Date.now() }
            },
            {
                $set: {
                    password: await bcrypt.hash(password, 10),
                    isEmailVerified: true,
                    mustResetPassword: false,
                    passwordChangedAt: Date.now()
                },
                $unset: {
                    resetPasswordToken: "",
                    resetPasswordExpires: ""
                },
                $addToSet: {
                    linkedProviders: "manual"
                }
            },
            { returnDocument: "after" }
        );

        if (!user) {
            return res.status(400).json({ message: "This link has expired or has already been used. Please request a new one." });
        }

        res.json({
            message: "Password reset successful. You can now log in with your new password.",
            role: user.role
        });

    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Faculty Activation (Unified Flow)
export const facultyActivate = async (req, res) => {
    try {
        await connectDB();
        const { token, password, orgCode } = req.body;

        if (!token) return res.status(400).json({ message: "Activation token is required." });
        if (!orgCode) return res.status(400).json({ message: "Faculty Organization Code is required." });

        const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
        if (!password || !strongPassword.test(password)) {
            return res.status(422).json({
                message: "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character."
            });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // 1. Validate Organization Code first
        const org = await Organization.findOne({
            $or: [{ private_code: orgCode }, { organizationCode: orgCode }]
        });

        if (!org) {
            return res.status(400).json({ message: "Invalid Faculty Organization Code. Please check the code provided in your invitation." });
        }

        // 2. Perform Atomic Activation
        const user = await User.findOneAndUpdate(
            {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: Date.now() },
                role: { $in: ['faculty', 'teacher'] },
                organization_id: org._id // Security check enforces correct org natively
            },
            {
                $set: {
                    password: await bcrypt.hash(password, 10),
                    isEmailVerified: true,
                    mustResetPassword: false,
                    passwordChangedAt: Date.now()
                },
                $unset: {
                    resetPasswordToken: "",
                    resetPasswordExpires: ""
                },
                $addToSet: {
                    linkedProviders: "manual"
                }
            },
            { returnDocument: "after" }
        );

        if (!user) {
            return res.status(400).json({ message: "This link has expired or has already been used. Please request a new one." });
        }

        res.json({
            message: "Faculty account activated successfully. You are now linked to your organization."
        });

    } catch (err) {
        console.error("Faculty Activation Error:", err);
        res.status(500).json({ message: "Server error during activation" });
    }
};

// Logout
export const logout = (req, res) => {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
};

// Setup Org Admin Account String (Custom login flow for new org admins)
export const setupOrgAdmin = async (req, res) => {
    try {
        await connectDB();
        const { email, orgCode, password } = req.body;

        if (!email || !orgCode || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const org = await Organization.findOne({ private_code: orgCode });
        if (!org) {
            return res.status(404).json({ message: "Invalid Organization Code" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Admin user not found" });
        }

        if (user.organization_id.toString() !== org._id.toString()) {
            return res.status(403).json({ message: "You do not belong to this organization or invalid code." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.isEmailVerified = true;
        user.mustResetPassword = false; // Password has been set — clear the flag
        if (!user.linkedProviders) user.linkedProviders = [];
        if (!user.linkedProviders.includes("manual")) user.linkedProviders.push("manual");
        user.lastLoginAt = new Date();
        user.authProvider = "manual";

        await user.save();

        org.is_active = true;
        await org.save();

        const { getOrgAdminActivatedHtml, getOrgAdminActivatedPlainText } = await import("../services/email-templates.service.js");
        const FRONTEND_URL = getFrontendUrl();
        const orgNameFormatted = org.name ? encodeURIComponent(org.name.replace(/\s+/g, '-').toLowerCase()) : 'dashboard';
        const dashboardLink = `${FRONTEND_URL}/org/${orgNameFormatted}/admin`;
        const adminLoginLink = `${FRONTEND_URL}/admin/login`;

        // Attempt to send email, fail activation if email fails to prevent silent failure
        await sendEmail({
            to: email,
            subject: "Your Classgrid Admin Account is Active",
            html: getOrgAdminActivatedHtml(user.name, dashboardLink, adminLoginLink),
            text: getOrgAdminActivatedPlainText(user.name, dashboardLink, adminLoginLink),
        });

        // Generate JWT Token exactly as normal login does
        const token = generateToken(user);
        setTokenCookie(res, token);

        res.status(200).json({
            message: "Account activated successfully",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                organization: { name: org.name }
            }
        });
    } catch (err) {
        console.error("Setup Org Admin Error:", err);
        res.status(500).json({ message: "Server error during admin setup" });
    }
};

// Get Me
export const getCurrentUser = async (req, res) => {
    try {
        // req.user is already fully populated by isAuthenticated middleware
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        // Optional: fetch org data only if needed, safely — never let this crash the auth check
        let orgData = null;
        if (req.user.organization_id) {
            try {
                const userWithOrg = await User.findById(req.user._id)
                    .populate("organization_id")
                    .maxTimeMS(4000);
                if (userWithOrg && userWithOrg.organization_id) {
                    orgData = {
                        id: userWithOrg.organization_id._id,
                        name: userWithOrg.organization_id.name,
                        logo_url: userWithOrg.organization_id.logo_url,
                        plan: userWithOrg.organization_id.plan,
                        faculty_limit: userWithOrg.organization_id.faculty_limit,
                        rollNumberLabel: userWithOrg.organization_id.rollNumberLabel || "PRN"
                    };
                }
            } catch (orgErr) {
                // Non-fatal — org data is optional for auth check
                console.warn("GetMe: Could not fetch org data (non-fatal):", orgErr.message);
            }
        }

        res.json({
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            department: req.user.department || "",
            subject: req.user.subject || null,
            profilePicture: req.user.profilePicture || "",
            phoneNumber: req.user.phoneNumber || "",
            authProvider: req.user.authProvider,
            linkedProviders: req.user.linkedProviders,
            lastLoginAt: req.user.lastLoginAt,
            createdAt: req.user.createdAt,
            prn: req.user.prn || null,
            organization: orgData,
            mustResetPassword: req.user.mustResetPassword || false,
            // Impersonation state
            isImpersonating: req.isImpersonating || false,
            realUser: req.realUser ? {
                id: req.realUser._id,
                role: req.realUser.role,
            } : null,
            token: generateToken(req.user)
        });
    } catch (err) {
        console.error("GetMe Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/auth/force-reset-password
export const forceResetPassword = async (req, res) => {
    try {
        await connectDB();
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long." });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (!user.mustResetPassword) {
            return res.status(400).json({ message: "You are not required to reset your password." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.mustResetPassword = false;

        await user.save();

        res.json({ message: "Password updated successfully. You can now access your dashboard." });
    } catch (err) {
        console.error("Force Reset Password Error:", err);
        res.status(500).json({ message: "Server error updating password." });
    }
};

// POST /api/auth/verify-device
// Step 2 of Device Binding: verify the OTP and issue the token
export const verifyDeviceOtp = async (req, res) => {
    try {
        await connectDB();
        const { email, otp, deviceFingerprint } = req.body;

        if (!email || !otp || !deviceFingerprint) {
            return res.status(400).json({ message: "Missing required fields." });
        }

        const verification = await DeviceVerification.findOne({
            email: email.toLowerCase().trim()
        }).sort({ createdAt: -1 }); // get most recent OTP for this email

        if (!verification) {
            return res.status(400).json({ message: "No pending OTP request found." });
        }

        // Check code
        if (verification.otp !== otp) {
            // Increment failed attempts
            await DeviceVerification.updateOne({ _id: verification._id }, { $inc: { failedAttempts: 1 } });
            return res.status(400).json({ message: "Invalid OTP code." });
        }

        // Atomically verify expiry, usage, and attempt limits, then mark as used
        const updatedVerification = await DeviceVerification.findOneAndUpdate(
            {
                _id: verification._id,
                isUsed: false,
                expiresAt: { $gt: new Date() },
                failedAttempts: { $lt: 5 }
            },
            { $set: { isUsed: true } },
            { returnDocument: 'after' }
        );

        if (!updatedVerification) {
            return res.status(400).json({ message: "OTP has expired, already been used, or max attempts reached." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ message: "User not found." });

        // Capture isFirstLogin BEFORE updating lastLoginAt
        const isFirstLogin = !user.lastLoginAt;

        // OTP is valid! Add device to trusted array
        if (!user.trustedDevices) user.trustedDevices = [];
        // Store client-side fingerprint (used by manual login check)
        user.trustedDevices.push({
            fingerprint: deviceFingerprint,
            addedAt: new Date(),
            browser: req.headers['user-agent'] || ""
        });

        // Also store server-side fingerprint (used by OAuth login check)
        // This ensures the device is recognized by BOTH manual and OAuth login flows
        const { fingerprint: serverFp } = getDeviceFingerprint(req);
        const serverAlreadyTrusted = user.trustedDevices.some(d => d.fingerprint === serverFp);
        if (!serverAlreadyTrusted) {
            user.trustedDevices.push({
                fingerprint: serverFp,
                addedAt: new Date(),
                browser: req.headers['user-agent'] || ""
            });
        }

        user.lastLoginAt = new Date();
        user.authProvider = "manual";
        await user.save();

        // Clean up verification doc
        await DeviceVerification.deleteOne({ _id: verification._id });

        const token = generateToken(user);
        setTokenCookie(res, token);

        // Store the approved fingerprint in a stable cookie to prevent future mismatch loops
        const isProd = process.env.NODE_ENV === "production";
        res.cookie("client_device_fp", deviceFingerprint, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "None" : "Lax",
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        });

        const mustReset = !!user.mustResetPassword;
        const needsOrgCode = ['faculty', 'teacher'].includes(user.role) && !user.organization_id;

        // Fetch org name for role-based redirect support
        let orgName = null;
        if (user.organization_id) {
            const org = await Organization.findById(user.organization_id).select('name').lean();
            orgName = org ? org.name : null;
        }
        res.json({
            message: "Device verified and login successful",
            token,
            firstLogin: isFirstLogin,
            mustResetPassword: mustReset,
            needsOrgCode,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture || "",
                photoURL: user.profilePicture || "",
                organization_id: user.organization_id || null,
                organization: orgName ? { name: orgName } : null,
                authProvider: user.authProvider,
            },
        });
    } catch (err) {
        console.error("Device Verification Error:", err);
        res.status(500).json({ message: "Server error during verification." });
    }
};

// ─────────────────────────────────────────────
// Check Student Email (Email-First Flow)
// POST /api/auth/check-email
// Returns { exists: true } if student account found,
// otherwise sends a verification email + returns { exists: false }
// ─────────────────────────────────────────────
export const checkStudentEmail = async (req, res) => {
    try {
        await connectDB();
        const { email, recaptchaToken, name } = req.body;

        if (!email) {
            console.error("DEBUG checkStudentEmail empty email. Body:", req.body, "Headers:", req.headers);
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        // reCAPTCHA verification (skip in dev if key not set)
        if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
            try {
                const params = new URLSearchParams({
                    secret: process.env.RECAPTCHA_SECRET_KEY,
                    response: recaptchaToken,
                });
                const capRes = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
                    method: "POST",
                    body: params,
                });
                const capData = await capRes.json();
                if (!capData.success || capData.score < 0.5) {
                    return res.status(403).json({ success: false, message: "Security check failed. Please try again." });
                }
            } catch (_) { /* network error — allow in dev */ }
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists with student role
        const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });

        if (existingUser) {
            // Reject if account exists but is not a student
            if (existingUser.role !== "student") {
                return res.status(403).json({ success: false, message: "This email is registered under a different account type. Please use the correct login tab." });
            }
            return res.status(200).json({ success: true, exists: true });
        }

        // ── Step 1 call (existsCheck: true) — just tell frontend email is new, no email sent yet ──
        if (req.body.existsCheck === true) {
            return res.status(200).json({ success: true, exists: false });
        }

        // ── Step 2 call (name provided) — send verification email with student's actual name ──
        const displayName = (name || "").trim();
        if (!displayName || displayName.length < 2) {
            return res.status(400).json({ success: false, message: "Please provide your full name." });
        }

        const existingVerification = await Verification.findOne({ email: normalizedEmail });
        if (existingVerification && existingVerification.expiresAt > new Date() && existingVerification.name === displayName) {
            return res.status(200).json({ success: true, exists: false, message: "Verification email already sent. Check your inbox." });
        }

        // Generate token and send verification email
        const verifyToken = uuidv4();
        const verifyLink = `${FRONTEND_URL}/api/auth/verify-token/${verifyToken}`;

        await Verification.findOneAndUpdate(
            { email: normalizedEmail },
            {
                email: normalizedEmail,
                verificationToken: verifyToken,
                name: displayName,
                role: "student",
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                resendCount: 0,
            },
            { upsert: true, returnDocument: 'after' }
        );

        // Send verification email with student's actual name
        const html = getVerificationEmailHtml(displayName, verifyLink);
        const text = getVerificationEmailPlainText(displayName, verifyLink);
        await sendEmail({
            to: normalizedEmail,
            subject: "Verify your Classgrid account",
            html,
            text,
        });

        return res.status(200).json({ success: true, exists: false });
    } catch (err) {
        console.error("checkStudentEmail Error:", err);
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};

