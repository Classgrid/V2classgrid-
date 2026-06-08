import express from "express";
import passport from "passport";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = express.Router();

const getFrontendUrl = () => {
    return process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
};

import { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter, emailCheckLimiter } from "../middleware/rateLimiter.js";

// Public System Config
router.get("/system-config", authController.getSystemConfig);

// Email-first flow (student check)
router.post("/check-email", emailCheckLimiter, authController.checkStudentEmail);

// Manual Auth
router.post("/signup-init", authController.initiateSignup);
router.get("/verify-token/:token", authController.verifySignupToken);
router.post("/signup-complete", authController.completeSignup);
router.post("/check-admin-status", authController.checkAdminStatus);
router.post("/validate-activation-token", authController.validateActivationToken);
router.post("/activate-admin", authController.activateAdmin);
router.post("/resend-activation", authController.resendActivation);

router.post("/login", loginLimiter, authController.login);
router.post("/verify-device", authController.verifyDeviceOtp);
router.post("/setup-org-admin", authController.setupOrgAdmin); // kept for backward compat
router.post("/logout", authController.logout);

router.get("/me", isAuthenticated, authController.getCurrentUser);

router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
router.post("/faculty-activate", resetPasswordLimiter, authController.facultyActivate);
router.post("/force-reset-password", isAuthenticated, authController.forceResetPassword);

// Google OAuth
router.get(
    "/google",
    (req, res, next) => {
        const loginTab = req.query.loginTab || 'student';
        passport.authenticate("google", {
            scope: ["profile", "email"],
            state: loginTab  // survives the round-trip through Google OAuth
        })(req, res, next);
    }
);
router.get(
    "/google/callback",
    (req, res, next) => {
        const FRONTEND_URL = getFrontendUrl();
        passport.authenticate("google", { session: false }, (err, user) => {
            if (err) {
                console.error("Google OAuth Error:", err.message);
                return res.redirect(`${FRONTEND_URL}/login?error=google_blocked&message=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${FRONTEND_URL}/login?error=AuthFailed`);
            }
            req.user = user;
            next();
        })(req, res, next);
    },
    authController.oauthCallback
);

// Facebook OAuth
router.get(
    "/facebook",
    passport.authenticate("facebook")
);
router.get(
    "/facebook/callback",
    (req, res, next) => {
        const FRONTEND_URL = getFrontendUrl();
        passport.authenticate("facebook", { session: false }, (err, user) => {
            if (err) {
                console.error("Facebook OAuth Error:", err.message);
                return res.redirect(`${FRONTEND_URL}/login?error=facebook_blocked&message=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${FRONTEND_URL}/login?error=AuthFailed`);
            }
            req.user = user;
            next();
        })(req, res, next);
    },
    authController.oauthCallback
);

// GitHub OAuth
router.get(
    "/github",
    passport.authenticate("github", { scope: ["user:email"] })
);
router.get(
    "/github/callback",
    (req, res, next) => {
        const FRONTEND_URL = getFrontendUrl();
        passport.authenticate("github", { session: false }, (err, user) => {
            if (err) {
                console.error("GitHub OAuth Error:", err.message);
                return res.redirect(`${FRONTEND_URL}/login?error=github_blocked&message=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${FRONTEND_URL}/login?error=AuthFailed`);
            }
            req.user = user;
            next();
        })(req, res, next);
    },
    authController.oauthCallback
);

// LinkedIn OAuth
router.get(
    "/linkedin",
    passport.authenticate("linkedin", {
        session: false
    })
);

router.get(
    "/linkedin/callback",
    (req, res, next) => {
        const FRONTEND_URL = getFrontendUrl();
        passport.authenticate("linkedin", {
            session: false
        }, (err, user) => {
            if (err) {
                console.error("LinkedIn OAuth Error:", err.message);
                return res.redirect(`${FRONTEND_URL}/login?error=linkedin_blocked&message=${encodeURIComponent(err.message)}`);
            }
            if (!user) {
                return res.redirect(`${FRONTEND_URL}/login?error=AuthFailed`);
            }
            req.user = user;
            next();
        })(req, res, next);
    },
    authController.oauthCallback
);

export default router;
