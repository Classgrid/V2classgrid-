import rateLimit from "express-rate-limit";

// Limits for login (5 attempts per 15 mins)
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const resetTime = req.rateLimit?.resetTime;
        const secondsLeft = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 900;
        const minutesLeft = Math.ceil(secondsLeft / 60);
        res.status(429).json({
            success: false,
            message: `Too many login attempts. Please try again after ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            code: "RATE_LIMIT_EXCEEDED",
            retryAfterSeconds: secondsLeft,
        });
    },
});

// Limit for email check (5 per minute per IP — student email-first flow)
export const emailCheckLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests. Please wait a minute before trying again.",
            code: "RATE_LIMIT_EXCEEDED",
        });
    },
});

// Limits for forgot password (10 attempts per 15 mins)
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many password reset requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limit for reset password / faculty activation (4 attempts per 5 mins)
// Validation errors (422) are NOT counted — only actual token attempts count.
export const resetPasswordLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 4,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip counting requests that returned 422 (validation errors like weak password)
    skipFailedRequests: false,
    requestWasSuccessful: (req, res) => res.statusCode !== 422,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        const resetTime = req.rateLimit?.resetTime;
        const secondsLeft = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 300;
        const minutesLeft = Math.ceil(secondsLeft / 60);
        res.status(429).json({
            success: false,
            message: `Too many attempts. Please try again after ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
            code: "RATE_LIMIT_EXCEEDED",
            retryAfterSeconds: secondsLeft,
        });
    },
});

// Limit for joining classroom (10 attempts per hour)
export const joinClassroomLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many join attempts. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limit for AI endpoints (100 requests per day)
export const aiLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 100,
    message: { success: false, message: "Daily AI request limit exceeded.", code: "RATE_LIMIT_EXCEEDED" },
    standardHeaders: true,
    legacyHeaders: false,
});

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { success: false, message: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
    standardHeaders: true,
    legacyHeaders: false,
});
