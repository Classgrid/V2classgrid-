import Organization from "../models/Organization.js";
import connectDB from "../../config/db.js";
import { normalizePlan, PLAN_RANK, planHasFeature } from "../config/plan.config.js";

/**
 * Middleware factory: requirePlan('PRO')
 * Checks that the user's organization is on the required plan (or higher).
 * Must be used AFTER isAuthenticated.
 *
 * Returns 403 if plan is insufficient.
 * Returns 400 if user has no organization.
 */
export function requirePlan(minimumPlan) {
    const minRank = PLAN_RANK[minimumPlan] ?? 0;

    return async (req, res, next) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(400).json({
                    message: "No organization linked. Please join an organization first.",
                });
            }

            await connectDB();
            const org = await Organization.findById(req.user.organization_id)
                .select("plan planExpiresAt")
                .lean();

            if (!org) {
                return res.status(404).json({ message: "Organization not found" });
            }

            const currentPlan = normalizePlan(org.plan);
            const currentRank = PLAN_RANK[currentPlan] ?? 0;

            // Check if plan has expired
            if (org.planExpiresAt && new Date(org.planExpiresAt) < new Date()) {
                // Plan expired — treat as FREE
                if (minRank > PLAN_RANK.FREE) {
                    return res.status(403).json({
                        message: `This feature requires the ${minimumPlan} plan. Your plan has expired.`,
                        requiredPlan: minimumPlan,
                        currentPlan: "FREE (expired)",
                    });
                }
            }

            if (currentRank < minRank) {
                return res.status(403).json({
                    message: `This feature requires the ${minimumPlan} plan. Your organization is on the ${currentPlan} plan.`,
                    requiredPlan: minimumPlan,
                    currentPlan,
                });
            }

            req.orgPlan = currentPlan;
            next();
        } catch (err) {
            console.error("[PlanMiddleware] Error:", err.message);
            res.status(500).json({ message: "Server error checking plan" });
        }
    };
}

/**
 * Middleware: requireFeature('attendance')
 * Checks that the org's plan includes a specific feature.
 */
export function requireFeature(feature) {
    return async (req, res, next) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(400).json({ message: "No organization linked." });
            }

            await connectDB();
            const org = await Organization.findById(req.user.organization_id)
                .select("plan")
                .lean();

            if (!org) {
                return res.status(404).json({ message: "Organization not found" });
            }

            const plan = normalizePlan(org.plan);

            if (!planHasFeature(plan, feature)) {
                return res.status(403).json({
                    message: `The "${feature}" feature requires a plan upgrade.`,
                    currentPlan: plan,
                });
            }

            req.orgPlan = plan;
            next();
        } catch (err) {
            console.error("[FeatureMiddleware] Error:", err.message);
            res.status(500).json({ message: "Server error checking feature access" });
        }
    };
}
