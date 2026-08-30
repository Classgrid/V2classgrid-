import PaymentRequest from "../models/PaymentRequest.js";
import OrganizationPending from "../models/OrganizationPending.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import { PLANS } from "../config/plan.config.js";
import { sendEmail } from "../services/aws-ses.service.js";
import { getPlanActivationHtml, getPlanActivationPlainText } from "../services/email-templates.service.js";
import connectDB from "../../config/db.js";

// ─────────────────────────────────────────────
// POST /api/payments/manual-request (Public — rate limited)
// Called after a PRO application is submitted
// ─────────────────────────────────────────────
export const createManualRequest = async (req, res) => {
    try {
        await connectDB();

        const { applicationId, planRequested, transactionId, screenshotUrl } = req.body;

        if (!applicationId || !transactionId) {
            return res.status(400).json({ message: "Missing required fields (applicationId, transactionId)" });
        }

        // Validate application exists and is in pending_payment status
        const application = await OrganizationPending.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (application.applicationStatus !== "pending_payment") {
            return res.status(400).json({ message: "This application is not awaiting payment" });
        }

        // Prevent duplicate pending payments for the same application
        const existingPending = await PaymentRequest.findOne({ applicationId, status: 'pending' });
        if (existingPending) {
            return res.status(400).json({ message: "A payment request is already pending for this application. Please wait for verification." });
        }

        const plan = application.planRequested || "PRO";
        const planConfig = PLANS[plan];
        const amount = planConfig ? planConfig.priceINR : 0;

        const request = new PaymentRequest({
            applicationId,
            planRequested: plan,
            amount,
            transactionId: transactionId.trim(),
            screenshotUrl: screenshotUrl || null,
        });

        await request.save();

        // Link paymentRequestId back to application
        application.paymentRequestId = request._id;
        await application.save();

        res.status(201).json({
            message: "Payment proof submitted successfully.",
            paymentRequestId: request._id,
        });
    } catch (err) {
        console.error("[Payment] Create manual request error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ─────────────────────────────────────────────
// GET /api/payments/requests (Super Admin)
// Supports ?status=pending|approved|rejected
// ─────────────────────────────────────────────
export const getRequests = async (req, res) => {
    try {
        await connectDB();
        const status = req.query.status || 'pending';

        let query = PaymentRequest.find({ status })
            .populate('applicationId', 'institute_name owner_name owner_email planRequested applicationStatus')
            .populate({
                path: 'organizationId',
                select: 'name plan planExpiresAt planActivatedAt owner_id',
                populate: { path: 'owner_id', select: 'name email phone' }
            })
            .sort({ createdAt: -1 });

        const requests = await query;
        res.json({ requests });
    } catch (err) {
        console.error("[Payment] Get requests error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ─────────────────────────────────────────────
// POST /api/payments/approve/:id (Super Admin)
// Approves payment → marks application as approved
// Does NOT create org — admin uses approve-organization for that
// ─────────────────────────────────────────────
export const approveRequest = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        const request = await PaymentRequest.findById(id);
        if (!request) return res.status(404).json({ message: "Payment request not found" });

        if (request.status !== 'pending') {
            return res.status(400).json({ message: "Request is already processed" });
        }

        // Update PaymentRequest
        request.status = 'approved';
        request.processedAt = new Date();
        await request.save();

        if (request.organizationId && !request.applicationId) {
            // Existing Organization Upgrade Flow
            const org = await Organization.findById(request.organizationId);
            if (org) {
                org.plan = 'PRO';
                org.planActivatedAt = new Date();
                const expiry = new Date();
                expiry.setFullYear(expiry.getFullYear() + 1);
                org.planExpiresAt = expiry;
                await org.save();
            }
            return res.json({ message: "Payment verified. Organization has been upgraded to PRO plan." });
        } else if (request.applicationId) {
            // New Application Flow
            const application = await OrganizationPending.findById(request.applicationId);
            if (application) {
                application.applicationStatus = "approved";
                application.status = "pending"; // Keep legacy status as pending — approval creates the org
                await application.save();
            }
            return res.json({ message: "Payment verified and approved. You can now approve the organization." });
        }

        res.json({ message: "Payment verified and approved." });
    } catch (err) {
        console.error("[Payment] Approve request error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ─────────────────────────────────────────────
// POST /api/payments/reject/:id (Super Admin)
// ─────────────────────────────────────────────
export const rejectRequest = async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;

        const request = await PaymentRequest.findById(id);
        if (!request) return res.status(404).json({ message: "Payment request not found" });

        if (request.status !== 'pending') {
            return res.status(400).json({ message: "Request is already processed" });
        }

        request.status = 'rejected';
        request.processedAt = new Date();
        await request.save();

        if (request.applicationId) {
            // Revert application to pending_payment so applicant can resubmit
            const application = await OrganizationPending.findById(request.applicationId);
            if (application) {
                application.paymentRequestId = null;
                await application.save();
                // applicationStatus stays pending_payment — they can submit a new payment proof
            }
        }

        res.json({ message: "Payment request rejected" });
    } catch (err) {
        console.error("[Payment] Reject request error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
