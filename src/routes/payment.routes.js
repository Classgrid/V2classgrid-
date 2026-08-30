import express from "express";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import Organization from "../models/Organization.js";
import connectDB from "../../config/db.js";
import { PLANS, normalizePlan, PAYMENT_CONFIG } from "../config/plan.config.js";
import {
    isPaymentEnabled,
    createOrder,
    verifyPaymentSignature,
    verifyWebhookSignature,
} from "../services/payment.service.js";

import {
    createManualRequest,
    getRequests,
    approveRequest,
    rejectRequest
} from "../controllers/payment.controller.js";

import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiter for manual payment requests — 3 per 30 min per IP
const manualPaymentLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 3,
    message: { message: "Too many payment submissions. Please wait before trying again.", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─────────────────────────────────────────────
// GET /config — Public payment config for a plan
// ─────────────────────────────────────────────
router.get("/config", (req, res) => {
    const planType = req.query.plan ? req.query.plan.toUpperCase() : "PRO";
    const plan = PLANS[planType];

    if (!plan) {
        return res.status(400).json({ message: "Invalid plan" });
    }

    res.json({
        plan: planType,
        price: `₹${plan.priceINR}`,
        priceINR: plan.priceINR,
        upiId: PAYMENT_CONFIG.upiId,
        qrImageUrl: PAYMENT_CONFIG.qrImageUrl,
        studentLimit: plan.studentLimit,
    });
});

// ─────────────────────────────────────────────
// MANUAL PAYMENT ROUTES (Phase 1)
// ─────────────────────────────────────────────

// Public: Submit manual payment proof (rate limited, no auth — applicant has no account yet)
router.post("/manual-request", manualPaymentLimiter, createManualRequest);

// Super Admin: View pending, approved, or rejected requests
router.get("/requests", isAuthenticated, requireRole("super_admin"), getRequests);

// Super Admin: Approve request
router.post("/approve/:id", isAuthenticated, requireRole("super_admin"), approveRequest);

// Super Admin: Reject request
router.post("/reject/:id", isAuthenticated, requireRole("super_admin"), rejectRequest);

// ─────────────────────────────────────────────
// GET /plans — Public plan info
// ─────────────────────────────────────────────
router.get("/plans", (req, res) => {
    const plans = Object.entries(PLANS).map(([key, val]) => ({
        id: key,
        label: val.label,
        studentLimit: val.studentLimit,
        priceINR: val.priceINR,
        features: val.features,
    }));

    res.json({
        plans,
        paymentEnabled: isPaymentEnabled(),
    });
});

// ─────────────────────────────────────────────
// POST /create-order-for-application — Public: Create Razorpay order for PRO application
// Accepts form data directly — NO PendingOrg is created until payment succeeds (via webhook)
// ─────────────────────────────────────────────
router.post("/create-order-for-application", async (req, res) => {
    try {
        if (!isPaymentEnabled()) {
            return res.status(503).json({ message: "Payments not configured." });
        }

        const { institute_name, address, owner_name, owner_email, phone, logo_base64, website, designation } = req.body;

        // Validate required fields
        if (!institute_name || !address || !owner_name || !owner_email || !phone) {
            return res.status(400).json({ message: "All required fields must be filled." });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
            return res.status(400).json({ message: "Invalid email address." });
        }

        await connectDB();

        // Check for existing approved org with same email
        const { default: User } = await import("../models/User.js");
        const existingAdmin = await User.findOne({ email: owner_email.toLowerCase().trim(), role: "org_admin" });
        if (existingAdmin && existingAdmin.organization_id) {
            return res.status(400).json({ message: "An organization with this admin email already exists." });
        }

        // Upload logo to Supabase if provided
        let finalLogoUrl = "";
        if (logo_base64) {
            // 100MB limit
            if (logo_base64.length > 137000000) {
                return res.status(400).json({ message: "Logo file exceeds 100 MB limit." });
            }
            const match = logo_base64.match(/^data:image\/(png|jpeg|webp);base64,/);
            if (!match) {
                return res.status(400).json({ message: "Invalid image type. Only PNG, JPEG, and WEBP are allowed." });
            }
            try {
                const { s3Storage } = await import("../services/s3-storage.service.js");
                const ext = match[1];
                const base64Data = logo_base64.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                const filename = `org_${Date.now()}.${ext}`;
                const { publicUrl } = await s3Storage.uploadFile(`logos/${filename}`, buffer, `image/${ext}`);
                finalLogoUrl = publicUrl;
            } catch (storageErr) {
                console.error("[Payment] Logo upload error:", storageErr.message);
                // Continue without logo — not a blocker for payment
            }
        }

        // Create Razorpay order
        const plan = PLANS["PRO"];
        const order = await createOrder("PRO", `temp_${Date.now()}`);

        // Save form data to TempProApplication (auto-expires in 1 hour)
        const TempProApplication = (await import("../models/TempProApplication.js")).default;
        await TempProApplication.create({
            institute_name,
            address,
            logo_url: finalLogoUrl,
            website: website || "",
            designation: designation || "",
            owner_name,
            owner_email: owner_email.toLowerCase().trim(),
            phone,
            razorpayOrderId: order.id,
        });

        console.log(`[Payment] PRO order created: ${order.id} for ${owner_email} (temp app saved)`);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        const errorMsg = err.error?.description || err.message || JSON.stringify(err);
        console.error("[Payment] Create order for application error:", errorMsg);
        res.status(500).json({ message: errorMsg || "Server error" });
    }
});

// ─────────────────────────────────────────────
// POST /create-order — Create Razorpay order (authenticated — dashboard upgrade)
// ─────────────────────────────────────────────
router.post("/create-order", isAuthenticated, async (req, res) => {
    try {
        if (!isPaymentEnabled()) {
            return res.status(503).json({
                message: "Payments not configured. Please try again later.",
            });
        }

        const { planType } = req.body;
        if (!planType || !PLANS[normalizePlan(planType)]) {
            return res.status(400).json({ message: "Invalid plan type" });
        }

        const normalized = normalizePlan(planType);
        if (normalized === "FREE") {
            return res.status(400).json({ message: "Cannot create order for free plan" });
        }

        // Only org admin can upgrade
        if (!req.user.organization_id) {
            return res.status(400).json({ message: "No organization linked" });
        }

        await connectDB();
        const org = await Organization.findById(req.user.organization_id);
        if (!org) return res.status(404).json({ message: "Organization not found" });

        if (org.owner_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only the organization admin can upgrade" });
        }

        const order = await createOrder(normalized, org._id.toString());

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            planType: normalized,
            keyId: process.env.RAZORPAY_KEY_ID, // safe: this is the publishable key
        });
    } catch (err) {
        console.error("[Payment] Create order error:", err.message);
        res.status(500).json({ message: err.message || "Server error" });
    }
});

// ─────────────────────────────────────────────
// POST /verify — Verify payment + upgrade org + send emails
// ─────────────────────────────────────────────
router.post("/verify", isAuthenticated, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planType) {
            return res.status(400).json({ message: "Missing payment details" });
        }

        const isValid = verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({ message: "Payment verification failed" });
        }

        // Upgrade organization
        await connectDB();
        const normalized = normalizePlan(planType);
        const plan = PLANS[normalized];

        const org = await Organization.findById(req.user.organization_id);
        if (!org) return res.status(404).json({ message: "Organization not found" });

        const activatedNow = new Date();
        const expiresAt = new Date(activatedNow.getTime() + 31 * 24 * 60 * 60 * 1000);

        org.plan = normalized;
        org.studentLimit = plan.studentLimit;
        org.planExpiresAt = expiresAt;
        org.planActivatedAt = activatedNow;
        org.razorpaySubscriptionId = razorpay_payment_id;
        await org.save();

        console.log(`[Payment] Org ${org._id} upgraded to ${normalized} via checkout verify`);

        // Send emails (non-blocking — don't fail the response if emails fail)
        const { sendEmail } = await import("../services/aws-ses.service.js");
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";

        // Email 1: Super admin notification
        try {
            await sendEmail({
                to: superAdminEmail,
                subject: `💳 Payment Verified — ${org.name} upgraded to ${normalized}`,
                html: `<h2>Payment Verified & Auto-Upgraded</h2>
                    <table style="border-collapse:collapse;width:100%;max-width:500px;">
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Organization</td><td style="padding:8px;border:1px solid #ddd;">${org.name}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Plan</td><td style="padding:8px;border:1px solid #ddd;">${normalized}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payment ID</td><td style="padding:8px;border:1px solid #ddd;">${razorpay_payment_id}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Order ID</td><td style="padding:8px;border:1px solid #ddd;">${razorpay_order_id}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Admin Email</td><td style="padding:8px;border:1px solid #ddd;">${org.ownerEmail || req.user.email || 'N/A'}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Activated</td><td style="padding:8px;border:1px solid #ddd;">${activatedNow.toLocaleDateString('en-IN')}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Expires</td><td style="padding:8px;border:1px solid #ddd;">${expiresAt.toLocaleDateString('en-IN')}</td></tr>
                    </table>
                    <p style="color:#666;margin-top:16px;">This upgrade was verified via Razorpay Checkout SDK. No manual action needed.</p>`,
                text: `Payment Verified: ${org.name} upgraded to ${normalized}. Payment ID: ${razorpay_payment_id}.`,
            });
        } catch (emailErr) {
            console.warn("[Payment] Failed to send super admin notification:", emailErr.message);
        }

        // Email 2: Org admin plan activation with onboarding instructions
        if (org.ownerEmail || req.user.email) {
            try {
                const { getPlanActivationHtml, getPlanActivationPlainText } = await import("../services/email-templates.service.js");
                const ownerName = org.ownerName || req.user.name || "Admin";
                await sendEmail({
                    to: org.ownerEmail || req.user.email,
                    subject: `🎉 Pro Plan Activated — ${org.name}`,
                    html: getPlanActivationHtml(normalized, activatedNow, expiresAt, plan.studentLimit, ownerName, 31),
                    text: getPlanActivationPlainText(normalized, activatedNow, expiresAt, plan.studentLimit, ownerName, 31),
                });
            } catch (emailErr) {
                console.warn("[Payment] Failed to send org admin confirmation:", emailErr.message);
            }
        }

        res.json({
            message: `Plan upgraded to ${plan.label} successfully!`,
            plan: normalized,
            studentLimit: plan.studentLimit,
            expiresAt: org.planExpiresAt,
        });
    } catch (err) {
        console.error("[Payment] Verify error:", err.message);
        res.status(500).json({ message: "Server error verifying payment" });
    }
});

// ─────────────────────────────────────────────
// POST /webhook — Razorpay webhook handler (backup)
// ─────────────────────────────────────────────
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        console.log(`[Payment] Webhook received — body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}, length: ${req.body?.length || 0}`);
        const signature = req.headers["x-razorpay-signature"];
        if (!signature) {
            console.warn("[Payment] Webhook: Missing X-Razorpay-Signature header");
            return res.status(400).json({ message: "Missing signature" });
        }

        const isValid = verifyWebhookSignature(req.body, signature);
        if (!isValid) {
            console.error("[Payment] Webhook: Signature verification FAILED");
            return res.status(400).json({ message: "Invalid signature" });
        }
        console.log("[Payment] Webhook: Signature verified ✅");

        const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : req.body;
        const event = typeof bodyStr === "string" ? JSON.parse(bodyStr) : bodyStr;
        const eventType = event.event;

        console.log("[Payment] Webhook event:", eventType);

        // ── payment.captured — Auto-upgrade org + send emails ──
        if (eventType === "payment.captured" || eventType === "order.paid") {
            const payment = event.payload?.payment?.entity;
            if (!payment) {
                console.log("[Payment] No payment entity in webhook payload");
                return res.json({ status: "ok" });
            }

            await connectDB();
            const { sendEmail } = await import("../services/aws-ses.service.js");
            const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";

            const payerEmail = payment.email || "N/A";
            const payerPhone = payment.contact || "N/A";
            const amountINR = (payment.amount / 100).toFixed(2);
            const paymentId = payment.id || "N/A";
            const method = payment.method || "N/A";

            // Case 0: PRO application payment — look up temp form data by Razorpay order ID
            const noteOrgId = payment.notes?.orgId || "";
            if (noteOrgId.startsWith("temp_") && payment.notes?.planType) {
                const razorpayOrderId = payment.order_id || "";
                console.log(`[Payment] Webhook: Processing PRO application payment (order: ${razorpayOrderId})`);

                const TempProApplication = (await import("../models/TempProApplication.js")).default;
                const OrganizationPending = (await import("../models/OrganizationPending.js")).default;
                const User = (await import("../models/User.js")).default;
                const crypto = (await import("crypto")).default;
                const { generateUniqueDualCodes } = await import("../services/code-generator.service.js");

                // Find temp application by Razorpay order ID
                const tempApp = await TempProApplication.findOne({ razorpayOrderId });
                if (!tempApp) {
                    console.warn(`[Payment] Temp application not found for order ${razorpayOrderId}`);
                    return res.json({ status: "ok" });
                }

                // Check for duplicate processing (idempotency)
                const existingOrg = await Organization.findOne({ razorpayOrderId });
                if (existingOrg) {
                    console.log(`[Payment] Order ${razorpayOrderId} already processed — skipping`);
                    await TempProApplication.deleteOne({ _id: tempApp._id });
                    return res.json({ status: "ok" });
                }

                const normalized = normalizePlan(payment.notes.planType);
                const planConfig = PLANS[normalized];

                // Generate codes
                const privateCode = crypto.randomBytes(8).toString("hex").toUpperCase();
                const { organizationCode, honorCode } = await generateUniqueDualCodes(Organization);

                // Create/update org admin user
                let orgAdmin = await User.findOne({ email: tempApp.owner_email });
                if (!orgAdmin) {
                    orgAdmin = new User({
                        name: tempApp.owner_name,
                        email: tempApp.owner_email,
                        role: "org_admin",
                        password: null,
                        mustResetPassword: true,
                        isEmailVerified: true,
                        authProvider: "manual",
                        linkedProviders: ["manual"],
                    });
                    await orgAdmin.save();
                } else {
                    orgAdmin.role = "org_admin";
                    orgAdmin.isEmailVerified = true;
                    await orgAdmin.save();
                }

                // Create organization with Razorpay payment details
                const activatedNow = new Date();
                const expiresAt = new Date(activatedNow.getTime() + 31 * 24 * 60 * 60 * 1000);

                const newOrg = new Organization({
                    name: tempApp.institute_name,
                    address: tempApp.address,
                    logo_url: tempApp.logo_url,
                    owner_id: orgAdmin._id,
                    ownerName: tempApp.owner_name,
                    ownerEmail: tempApp.owner_email,
                    contactNumber: tempApp.phone,
                    website: tempApp.website || "",
                    designation: tempApp.designation || "",
                    private_code: privateCode,
                    organizationCode,
                    honorCode,
                    plan: normalized,
                    studentLimit: planConfig.studentLimit,
                    planExpiresAt: expiresAt,
                    planActivatedAt: activatedNow,
                    faculty_limit: planConfig.maxFaculty || 5,
                    razorpaySubscriptionId: paymentId,
                    razorpayOrderId,
                    paymentMethod: "razorpay",
                    paymentAmount: payment.amount || 0,
                });
                const savedOrg = await newOrg.save();

                // Create PendingOrg record (approved) for historical tracking
                await OrganizationPending.create({
                    institute_name: tempApp.institute_name,
                    address: tempApp.address,
                    logo_url: tempApp.logo_url,
                    owner_name: tempApp.owner_name,
                    owner_email: tempApp.owner_email,
                    phone: tempApp.phone,
                    website: tempApp.website || "",
                    designation: tempApp.designation || "",
                    planRequested: normalized,
                    status: "approved",
                    applicationStatus: "approved",
                });

                // Link user to org + generate activation token
                orgAdmin.organization_id = savedOrg._id;
                const rawActivationToken = crypto.randomBytes(32).toString("hex");
                const hashedActivationToken = crypto.createHash("sha256").update(rawActivationToken).digest("hex");
                orgAdmin.activationToken = hashedActivationToken;
                orgAdmin.activationTokenExpires = new Date(Date.now() + 5 * 60 * 1000);
                orgAdmin.mustResetPassword = true;
                await orgAdmin.save();

                // Delete temp application — no longer needed
                await TempProApplication.deleteOne({ _id: tempApp._id });

                const frontendUrl = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
                const activationLink = `${frontendUrl}/admin/activate?token=${rawActivationToken}`;

                console.log(`[Payment] Auto-approved: ${savedOrg.name} (${normalized}) — Payment: ₹${amountINR}`);

                // Send consolidated approval email to org admin (codes + activation + PRO details)
                try {
                    const { getConsolidatedApprovalEmailHtml, getConsolidatedApprovalEmailPlainText } = await import("../services/email-templates.service.js");
                    await sendEmail({
                        to: tempApp.owner_email,
                        subject: `🎉 ${savedOrg.name} is now live — PRO Plan Active`,
                        html: getConsolidatedApprovalEmailHtml({
                            adminName: tempApp.owner_name,
                            orgName: savedOrg.name,
                            organizationCode,
                            honorCode,
                            plan: normalized,
                            studentLimit: planConfig.studentLimit,
                            activationLink,
                            activationDate: activatedNow,
                            expiryDate: expiresAt,
                            planDuration: 31,
                        }),
                        text: getConsolidatedApprovalEmailPlainText({
                            adminName: tempApp.owner_name,
                            orgName: savedOrg.name,
                            organizationCode,
                            honorCode,
                            plan: normalized,
                            studentLimit: planConfig.studentLimit,
                            activationLink,
                            activationDate: activatedNow,
                            expiryDate: expiresAt,
                            planDuration: 31,
                        }),
                    });
                } catch (emailErr) {
                    console.warn("[Payment] Failed to send org admin approval email:", emailErr.message);
                }

                // Notify super admin
                try {
                    await sendEmail({
                        to: superAdminEmail,
                        subject: `💳 PRO Payment → Auto-Approved: ${savedOrg.name}`,
                        html: `<h2>PRO Application Auto-Approved via Razorpay</h2>
                            <table style="border-collapse:collapse;width:100%;max-width:500px;">
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Organization</td><td style="padding:8px;border:1px solid #ddd;">${savedOrg.name}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Owner</td><td style="padding:8px;border:1px solid #ddd;">${tempApp.owner_name} (${tempApp.owner_email})</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${tempApp.phone}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Plan</td><td style="padding:8px;border:1px solid #ddd;">${normalized}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Amount</td><td style="padding:8px;border:1px solid #ddd;">₹${amountINR}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payment ID</td><td style="padding:8px;border:1px solid #ddd;">${paymentId}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Order ID</td><td style="padding:8px;border:1px solid #ddd;">${razorpayOrderId}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Faculty Code</td><td style="padding:8px;border:1px solid #ddd;">${organizationCode}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Honor Code</td><td style="padding:8px;border:1px solid #ddd;">${honorCode}</td></tr>
                            </table>
                            <p style="color:#666;margin-top:16px;">⚡ This org was auto-created and approved because Razorpay payment was confirmed. No manual action needed.</p>`,
                        text: `PRO Auto-Approved: ${savedOrg.name} by ${tempApp.owner_name}. Payment: ₹${amountINR}. ID: ${paymentId}.`,
                    });
                } catch (emailErr) {
                    console.warn("[Payment] Failed to send super admin notification:", emailErr.message);
                }

                return res.json({ status: "ok" });
            }

            // Case 1: Known org (in-app checkout with notes — dashboard upgrade)
            if (payment.notes?.orgId && payment.notes?.planType) {
                const normalized = normalizePlan(payment.notes.planType);
                const plan = PLANS[normalized];

                // Check if already upgraded (prevents duplicate emails from /verify + webhook)
                const existingOrg = await Organization.findById(payment.notes.orgId);
                if (existingOrg?.plan === normalized && existingOrg?.razorpaySubscriptionId === paymentId) {
                    console.log(`[Payment] Webhook: Org ${payment.notes.orgId} already upgraded to ${normalized} — skipping duplicate`);
                    return res.json({ status: "ok" });
                }

                const activatedNow = new Date();
                const expiresAt = new Date(activatedNow.getTime() + 31 * 24 * 60 * 60 * 1000);

                const org = await Organization.findByIdAndUpdate(payment.notes.orgId, {
                    plan: normalized,
                    studentLimit: plan.studentLimit,
                    planExpiresAt: expiresAt,
                    planActivatedAt: activatedNow,
                    razorpaySubscriptionId: paymentId,
                }, { new: true });

                console.log(`[Payment] Webhook: Org ${payment.notes.orgId} upgraded to ${normalized}`);

                // Send email to super admin
                try {
                    await sendEmail({
                        to: superAdminEmail,
                        subject: `💳 Payment Received — ${org?.name || 'Unknown Org'} upgraded to ${normalized}`,
                        html: `<h2>Payment Received & Auto-Upgraded</h2>
                            <table style="border-collapse:collapse;width:100%;max-width:500px;">
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Organization</td><td style="padding:8px;border:1px solid #ddd;">${org?.name || 'Unknown'}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Plan</td><td style="padding:8px;border:1px solid #ddd;">${normalized}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Amount</td><td style="padding:8px;border:1px solid #ddd;">₹${amountINR}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payment ID</td><td style="padding:8px;border:1px solid #ddd;">${paymentId}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Method</td><td style="padding:8px;border:1px solid #ddd;">${method}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payer Email</td><td style="padding:8px;border:1px solid #ddd;">${payerEmail}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${payerPhone}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Activated</td><td style="padding:8px;border:1px solid #ddd;">${activatedNow.toLocaleDateString('en-IN')}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Expires</td><td style="padding:8px;border:1px solid #ddd;">${expiresAt.toLocaleDateString('en-IN')}</td></tr>
                            </table>
                            <p style="color:#666;margin-top:16px;">This upgrade was auto-applied via webhook. No manual action needed.</p>`,
                        text: `Payment Received: ${org?.name || 'Unknown'} upgraded to ${normalized}. Amount: ₹${amountINR}. Payment ID: ${paymentId}.`,
                    });
                } catch (emailErr) {
                    console.warn("[Payment] Failed to send super admin notification:", emailErr.message);
                }

                // Send confirmation email to org admin
                if (org?.ownerEmail || payerEmail !== "N/A") {
                    try {
                        const { getPlanActivationHtml, getPlanActivationPlainText } = await import("../services/email-templates.service.js");
                        const ownerName = org?.ownerName || "Admin";
                        await sendEmail({
                            to: org?.ownerEmail || payerEmail,
                            subject: `🎉 Pro Plan Activated — ${org?.name || 'Your Organization'}`,
                            html: getPlanActivationHtml(normalized, activatedNow, expiresAt, plan.studentLimit, ownerName, 31),
                            text: getPlanActivationPlainText(normalized, activatedNow, expiresAt, plan.studentLimit, ownerName, 31),
                        });
                    } catch (emailErr) {
                        console.warn("[Payment] Failed to send org admin confirmation:", emailErr.message);
                    }
                }
            }
            // Case 2: Payment Link payment (no notes.orgId) — notify super admin
            else {
                console.log(`[Payment] Razorpay Payment Link payment: ₹${amountINR} from ${payerEmail}`);

                try {
                    await sendEmail({
                        to: superAdminEmail,
                        subject: `💳 Razorpay Payment Received — ₹${amountINR} from ${payerEmail}`,
                        html: `<h2>New Payment via Razorpay Payment Link</h2>
                            <table style="border-collapse:collapse;width:100%;max-width:500px;">
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Amount</td><td style="padding:8px;border:1px solid #ddd;">₹${amountINR}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payment ID</td><td style="padding:8px;border:1px solid #ddd;">${paymentId}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Method</td><td style="padding:8px;border:1px solid #ddd;">${method}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Payer Email</td><td style="padding:8px;border:1px solid #ddd;">${payerEmail}</td></tr>
                            <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${payerPhone}</td></tr>
                            </table>
                            <p style="color:#666;margin-top:16px;">This payment came via the hosted Razorpay Payment Link. Please match this to the correct organization in the Super Admin dashboard.</p>`,
                        text: `Payment received via Razorpay Link: ₹${amountINR} from ${payerEmail}. Payment ID: ${paymentId}. Please match in dashboard.`,
                    });
                } catch (emailErr) {
                    console.warn("[Payment] Failed to send super admin link payment notification:", emailErr.message);
                }
            }
        }

        // ── payment.failed — Log and notify ──
        if (eventType === "payment.failed") {
            const payment = event.payload?.payment?.entity;
            const reason = payment?.error_description || payment?.error_reason || "Unknown";
            console.warn(`[Payment] Failed: ${payment?.id || 'unknown'} — ${reason}`);
        }

        res.json({ status: "ok" });
    } catch (err) {
        console.error("[Payment] Webhook error:", err.message);
        res.status(500).json({ message: "Webhook processing error" });
    }
});

export default router;
