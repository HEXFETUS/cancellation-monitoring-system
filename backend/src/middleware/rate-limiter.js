import rateLimit from "express-rate-limit";

/**
 * Auth (login) rate limiter — 3 failed attempts per 3 minutes per IP.
 * Tighter limit specifically for the login endpoint to prevent brute-force attacks.
 * Only failed responses (status >= 400) count toward the limit, so legitimate
 * users who mistype a password can still log in once they get it right.
 */
export const authLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 3, // 3 failed attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    requestWasSuccessful: (req, res) => res.statusCode < 400,
    message: {
        error: "rate_limited",
        message: "Too many login attempts. Please wait 3 minutes before trying again.",
    },
});
