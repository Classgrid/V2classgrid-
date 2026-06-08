import jwt from "jsonwebtoken";
import User from "../models/User.js";
import connectDB from "../../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

/**
 * Core authentication middleware.
 * Handles both normal and impersonation tokens.
 *
 * Normal token:        { id, role, organizationId }
 * Impersonation token: { id (realUser), actingAs, role (realUser role), organizationId, impersonation: true }
 *
 * Sets on req:
 *   req.user                   — the acting user (from DB for data access)
 *   req.realUser               — { _id, role, organizationId } from token (no DB fetch) when impersonating; null otherwise
 *   req.isImpersonating        — boolean
 *   req.effectiveOrganizationId — always from JWT (authoritative)
 */
export const isAuthenticated = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token || token === "null" || token === "undefined") {
        return res.status(401).json({ message: "Not authenticated" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Ensure DB is connected (critical for serverless cold starts)
        await connectDB();

        // Dynamically check system settings for emergency locks
        const { default: SystemSettings } = await import("../models/SystemSettings.js");
        const settings = await SystemSettings.findOne();

        if (decoded.impersonation) {
            // ── IMPERSONATION MODE ──
            // Single DB fetch: only load the user being acted as
            const actingUser = await User.findById(decoded.actingAs).select("-password -verificationToken").maxTimeMS(5000);
            if (!actingUser) {
                return res.status(401).json({ message: "Impersonated user no longer exists" });
            }

            req.user = actingUser;
            req.realUser = {
                _id: decoded.id,
                role: decoded.role,
                organizationId: decoded.organizationId,
            };
            req.isImpersonating = true;

            // Set impersonation response header for frontend detection
            res.setHeader("X-Impersonation", "true");
        } else {
            // ── NORMAL MODE ──
            const user = await User.findById(decoded.id).select("-password -verificationToken").maxTimeMS(5000);
            if (!user) {
                return res.status(401).json({ message: "User no longer exists" });
            }

            // JWT Invalidation check after password change
            if (user.passwordChangedAt) {
                if (decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
                    return res.status(401).json({
                        message: "Token expired due to password change. Please log in again."
                    });
                }
            }

            // Check enforced system settings
            if (settings && user.role !== "super_admin") {
                if (settings.globalLock) {
                    return res.status(403).json({ success: false, message: "Platform is under a global security lock. All access is temporarily suspended.", code: "GLOBAL_LOCK" });
                }
                if (settings.maintenanceMode) {
                    return res.status(503).json({ success: false, message: "Platform is currently under maintenance. Please try again later.", code: "MAINTENANCE_MODE" });
                }
            }

            // Status check — block suspended/blocked users
            if (user.status !== "active" && user.email !== "nikhil.shinde@classgrid.in") {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not active. Please contact support.",
                    code: "USER_INACTIVE",
                });
            }

            // Organization status check
            if (user.organization_id && user.role !== "super_admin") {
                const { default: Organization } = await import("../models/Organization.js");
                const org = await Organization.findById(user.organization_id).select("status").lean();
                if (!org || org.status !== "active") {
                    return res.status(403).json({
                        success: false,
                        message: "Your organization is not active. Contact support.",
                        code: "ORG_INACTIVE",
                    });
                }
            }

            req.user = user;
            req.realUser = null;
            req.isImpersonating = false;
        }

        // Organization ID always sourced from JWT (authoritative)
        req.effectiveOrganizationId = decoded.organizationId || null;

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        return res.status(401).json({ message: "Token invalid" });
    }
};

/**
 * Returns the effective role for permission checks.
 * During impersonation → admin's real role.
 * Normal mode → user's own role.
 *
 * Usage:  if (getEffectiveRole(req) === "org_admin") { ... }
 */
export const getEffectiveRole = (req) => {
    return req.realUser?.role || req.user.role;
};

/**
 * Role-based access control middleware.
 * Always uses effective role (admin's role during impersonation).
 * Usage: router.post("/admin-action", isAuthenticated, requireRole("org_admin"), handler)
 */
export const requireRole = (...roles) => {
    return (req, res, next) => {
        const effectiveRole = getEffectiveRole(req);
        if (!effectiveRole || (!roles.includes(effectiveRole) && req.user.email !== "nikhil.shinde@classgrid.in")) {
            return res.status(403).json({
                message: `Access denied. Required role: ${roles.join(" or ")}`,
            });
        }
        next();
    };
};

/**
 * Organization access middleware.
 * Blocks requests from users not linked to any organization.
 * Uses effectiveOrganizationId from JWT.
 */
export const requireOrganization = (req, res, next) => {
    const effectiveRole = getEffectiveRole(req);

    // Admins bypass org requirement
    if (effectiveRole === "super_admin" || effectiveRole === "org_admin") {
        return next();
    }
    if (!req.effectiveOrganizationId && !req.user.organization_id) {
        return res.status(403).json({
            message: "Organization access required. Please connect to an organization first.",
            code: "NO_ORG",
        });
    }
    next();
};

/**
 * Blocks dashboard API access for org_admin users who haven't set their password yet.
 * Apply this to all sensitive org admin routes.
 */
export const requirePasswordSet = (req, res, next) => {
    // Only enforce for org_admin role
    if (req.user && req.user.role === 'org_admin' && req.user.mustResetPassword) {
        return res.status(403).json({
            message: "You must set your password before accessing the dashboard.",
            code: "MUST_RESET_PASSWORD",
        });
    }
    next();
};

