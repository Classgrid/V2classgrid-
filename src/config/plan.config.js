/**
 * Plan Configuration — central source of truth for ALL plan limits and pricing.
 *
 * ┌────────────────────────┬──────────┬──────────┐
 * │ Limit                  │   FREE   │   PRO    │
 * ├────────────────────────┼──────────┼──────────┤
 * │ Max Faculty            │    5     │   10     │
 * │ Classrooms / Faculty   │    2     │    5     │
 * │ Students / Classroom   │   60     │  150     │
 * │ Org Student Cap        │  600     │ 7500     │
 * └────────────────────────┴──────────┴──────────┘
 */

export const PLANS = {
    FREE: {
        label: 'Free',
        maxFaculty: 5,
        maxClassroomsPerFaculty: 2,
        maxStudentsPerClassroom: 60,
        studentLimit: 600,        // org-wide cap: 5 × 2 × 60
        priceINR: 0,
        priceAmountPaise: 0,
        features: ['basic', 'materials', 'quizzes', 'announcements', 'chat'],
        featureDescriptions: [
            'Up to 5 faculty accounts',
            'Up to 2 classrooms per faculty',
            'Up to 60 students per classroom',
            'Classroom management',
            'Announcements & notes sharing',
            'AI academic assistant (standard)',
            'Basic classroom chat',
        ],
    },
    PRO: {
        label: 'Pro',
        maxFaculty: 10,
        maxClassroomsPerFaculty: 5,
        maxStudentsPerClassroom: 150,
        studentLimit: 7500,       // org-wide cap: 10 × 5 × 150
        priceINR: 100,
        priceAmountPaise: 10000,
        features: ['basic', 'materials', 'quizzes', 'announcements', 'chat', 'attendance', 'attendance_reports', 'attendance_summaries', 'analytics', 'reports', 'marks'],
        featureDescriptions: [
            'Up to 10 faculty accounts',
            'Up to 5 classrooms per faculty',
            'Up to 150 students per classroom',
            'Everything in Free plan',
            'Smart Attendance system',
            'Daily & weekly attendance reports',
            'Monthly attendance summaries',
            'Smart Excel Marks & Analytics',
            'Advanced classroom analytics',
            'Priority feature access',
        ],
    },
};

/** Plan hierarchy for comparison (higher = more features) */
export const PLAN_RANK = { FREE: 0, PRO: 1 };

/**
 * Normalize legacy plan values to uppercase.
 * Existing DB may have 'free' or 'pro' (lowercase).
 */
export function normalizePlan(plan) {
    if (!plan) return 'FREE';
    const upper = plan.toUpperCase();
    // Treat legacy PLUS orgs as PRO — PLUS plan no longer offered
    if (upper === 'PLUS') return 'PRO';
    return PLANS[upper] ? upper : 'FREE';
}

/**
 * Get the org-wide student limit for a given plan.
 */
export function getStudentLimit(plan) {
    const normalized = normalizePlan(plan);
    return PLANS[normalized]?.studentLimit || PLANS.FREE.studentLimit;
}

/**
 * Get the per-classroom student limit for a given plan.
 */
export function getMaxStudentsPerClassroom(plan) {
    const normalized = normalizePlan(plan);
    return PLANS[normalized]?.maxStudentsPerClassroom || PLANS.FREE.maxStudentsPerClassroom;
}

/**
 * Get the max faculty limit for a given plan.
 */
export function getMaxFaculty(plan) {
    const normalized = normalizePlan(plan);
    return PLANS[normalized]?.maxFaculty || PLANS.FREE.maxFaculty;
}

/**
 * Get the max classrooms per faculty for a given plan.
 */
export function getMaxClassroomsPerFaculty(plan) {
    const normalized = normalizePlan(plan);
    return PLANS[normalized]?.maxClassroomsPerFaculty || PLANS.FREE.maxClassroomsPerFaculty;
}

/**
 * Check if a plan has a specific feature.
 */
export function planHasFeature(plan, feature) {
    const normalized = normalizePlan(plan);
    return PLANS[normalized]?.features?.includes(feature) || false;
}

/**
 * Check if a plan has expired.
 * FREE plans never expire. Paid plans expire when planExpiresAt < now.
 */
export function isPlanExpired(plan, planExpiresAt) {
    const normalized = normalizePlan(plan);
    if (normalized === 'FREE') return false;
    if (!planExpiresAt) return true; // Paid plan with no expiry = expired
    return new Date(planExpiresAt) < new Date();
}

/**
 * Get the effective plan — if a paid plan is expired, fall back to FREE limits.
 */
export function getEffectivePlan(plan, planExpiresAt) {
    if (isPlanExpired(plan, planExpiresAt)) return 'FREE';
    return normalizePlan(plan);
}

/**
 * Manual payment configuration — used for the manual UPI payment flow.
 * Will be replaced by Razorpay config when integrated.
 */
export const PAYMENT_CONFIG = {
    upiId: process.env.PAYMENT_UPI_ID || "nikhilsubsun321@oksbi",
    qrImageUrl: process.env.PAYMENT_QR_URL || "https://cdn.classgrid.in/notes-files/gpay-qr.png",
};
