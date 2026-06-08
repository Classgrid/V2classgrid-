import AdminAuditLog from "../models/AdminAuditLog.js";
import Organization from "../models/Organization.js";

/**
 * logAdminAction — fire-and-forget audit writer.
 * Call after any successful admin mutation.
 *
 * SECURITY: actorId, actorName, actorRole, organization_id
 * are ALWAYS derived from req.user — never from request body.
 *
 * @param {object} req         - Express request (provides user + IP + UA)
 * @param {string} action      - Action enum value from AdminAuditLog schema
 * @param {string} targetType  - Type of entity affected
 * @param {string|null} targetId   - ID of affected entity
 * @param {string} targetName  - Human-readable name of affected entity
 * @param {object} metadata    - Optional diff info { oldRole, newRole, etc. }
 */
export async function logAdminAction(req, action, targetType, targetId = null, targetName = "", metadata = {}) {
    try {
        const actor = req.user;
        if (!actor) return; // should never happen, but be safe

        let orgName = "";
        if (actor.organization_id) {
            const org = await Organization.findById(actor.organization_id).select("name").lean();
            orgName = org?.name || "";
        }

        const ip =
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket?.remoteAddress ||
            "";

        const userAgent = (req.headers["user-agent"] || "").substring(0, 300);

        await AdminAuditLog.create({
            actorId: actor._id,
            actorName: actor.name || actor.email || "Unknown",
            actorRole: actor.role,
            organization_id: actor.organization_id || null,
            organizationName: orgName,
            action,
            targetId: targetId ? String(targetId) : null,
            targetName: String(targetName || ""),
            targetType,
            metadata,
            ip,
            userAgent,
            timestamp: new Date(),
        });
    } catch (err) {
        // Audit log failure must NEVER break the main flow
        console.error("[AuditLog] Failed to write audit log:", err.message);
    }
}
