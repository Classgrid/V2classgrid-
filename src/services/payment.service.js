import { PLANS, normalizePlan } from "../config/plan.config.js";
import crypto from "crypto";

/**
 * Razorpay Payment Service
 *
 * Graceful when keys are missing — does NOT crash the server.
 * All functions check isPaymentEnabled() before proceeding.
 */

let razorpayInstance = null;

async function getRazorpay() {
    if (razorpayInstance) return razorpayInstance;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) return null;

    try {
        const Razorpay = (await import("razorpay")).default;
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        });
        return razorpayInstance;
    } catch (err) {
        console.warn("[PaymentService] Razorpay SDK not available:", err.message);
        return null;
    }
}

/**
 * Check if Razorpay keys are configured.
 */
export function isPaymentEnabled() {
    return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/**
 * Create a Razorpay order for a plan upgrade.
 * @param {string} planType - 'PLUS' or 'PRO'
 * @param {string} orgId - Organization ID (for receipt)
 * @returns {object} Razorpay order object
 */
export async function createOrder(planType, orgId) {
    const rz = await getRazorpay();
    if (!rz) throw new Error("Payments not configured");

    const plan = PLANS[normalizePlan(planType)];
    if (!plan || plan.priceAmountPaise === 0) {
        throw new Error("Invalid plan for payment");
    }

    const order = await rz.orders.create({
        amount: plan.priceAmountPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        notes: {
            orgId,
            planType: normalizePlan(planType),
        },
    });

    return order;
}

/**
 * Verify Razorpay payment signature.
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature from client
 * @returns {boolean} Whether signature is valid
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

    return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature.
 * @param {string|Buffer} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @returns {boolean}
 */
export function verifyWebhookSignature(body, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[Payment] RAZORPAY_WEBHOOK_SECRET not set — cannot verify webhook");
        return false;
    }

    // express.raw() provides a Buffer; crypto.createHmac().update() natively handles both Buffer and string
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

    return expectedSignature === signature;
}
