import crypto from "crypto";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET must be configured in production");
    }
    // This fallback is deliberately development-only. A restart invalidates all
    // development sessions, which is safer than a hard-coded repository secret.
    return secret || "development-only-session-secret-change-me";
}

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(value) {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(encodedPayload) {
    return crypto
        .createHmac("sha256", sessionSecret())
        .update(`${TOKEN_VERSION}.${encodedPayload}`)
        .digest("base64url");
}

export function createAssetFileSignature(mediaId, expiresAt) {
    return crypto.createHmac("sha256", sessionSecret())
        .update(`asset-file.${mediaId}.${expiresAt}`)
        .digest("base64url");
}

export function createAssetFileUrl(mediaId) {
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const signature = createAssetFileSignature(mediaId, expiresAt);
    return `/api/files/assets/${mediaId}?expires=${expiresAt}&signature=${signature}`;
}

export function verifyAssetFileSignature(mediaId, expiresAt, signature) {
    if (!Number.isSafeInteger(Number(mediaId)) || !Number.isSafeInteger(Number(expiresAt)) ||
        Number(expiresAt) < Math.floor(Date.now() / 1000) || typeof signature !== "string") return false;
    const expected = createAssetFileSignature(mediaId, expiresAt);
    const supplied = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");
    return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

export function createPrivateUploadUrl(filename) {
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const signature = crypto.createHmac("sha256", sessionSecret())
        .update(`private-upload.${filename}.${expiresAt}`)
        .digest("base64url");
    return `/api/files/private/${encodeURIComponent(filename)}?expires=${expiresAt}&signature=${signature}`;
}

export function verifyPrivateUploadSignature(filename, expiresAt, signature) {
    if (!/^(msg|bulletin)-[\w.-]+$/i.test(filename) || !Number.isSafeInteger(Number(expiresAt)) ||
        Number(expiresAt) < Math.floor(Date.now() / 1000) || typeof signature !== "string") return false;
    const expected = crypto.createHmac("sha256", sessionSecret())
        .update(`private-upload.${filename}.${expiresAt}`)
        .digest("base64url");
    const supplied = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");
    return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

/** Create a short-lived, tamper-evident bearer token for an authenticated user. */
export function createSessionToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: Number(user.id),
        role: user.usertype,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
    };
    const encodedPayload = encode(payload);
    return `${TOKEN_VERSION}.${encodedPayload}.${sign(encodedPayload)}`;
}

export function authenticate(req, res, next) {
    const authorization = req.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) {
        return res.status(401).json({ error: "authentication_required" });
    }

    try {
        const [version, encodedPayload, suppliedSignature, ...extra] = match[1].split(".");
        if (version !== TOKEN_VERSION || !encodedPayload || !suppliedSignature || extra.length) {
            throw new Error("malformed token");
        }

        const expectedSignature = sign(encodedPayload);
        const supplied = Buffer.from(suppliedSignature, "base64url");
        const expected = Buffer.from(expectedSignature, "base64url");
        if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
            throw new Error("invalid signature");
        }

        const payload = decode(encodedPayload);
        if (!Number.isSafeInteger(payload.sub) || typeof payload.role !== "string" ||
            !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
            throw new Error("expired or invalid token");
        }

        req.user = { id: payload.sub, usertype: payload.role };
        return next();
    } catch {
        return res.status(401).json({ error: "invalid_or_expired_session" });
    }
}

/** Use where an operation is reserved to a specific set of authenticated roles. */
export function requireRoles(...roles) {
    const allowed = new Set(roles);
    return (req, res, next) => {
        if (!req.user || !allowed.has(req.user.usertype)) {
            return res.status(403).json({ error: "forbidden" });
        }
        return next();
    };
}

/**
 * Server-side role policy mirroring the application's established workflows.
 * This is deliberately default-deny for non-admin roles: adding a new API
 * route requires explicitly deciding which role can use it.
 */
export function authorizeRole(req, res, next) {
    const role = req.user?.usertype;
    const path = req.path;
    const method = req.method;
    if (role === "admin") return next();

    const isOwnUserEndpoint = /^\/users\/(\d+)\/(name|profile-picture|password)$/.exec(path);
    if (path === "/users/me" || (isOwnUserEndpoint && Number(isOwnUserEndpoint[1]) === req.user.id)) {
        return next();
    }

    const isRead = method === "GET";
    const common =
        path.startsWith("/messages") ||
        path.startsWith("/bulletin") ||
        path === "/announcements" ||
        path.startsWith("/admin-announcements/view") ||
        path.startsWith("/admin-announcements/summary");
    if (common) return next();

    if (role === "purchaser" && (
        path.startsWith("/assets") || path.startsWith("/asset-codes") ||
        path.startsWith("/payout-stations") || path.startsWith("/office-departments")
    )) return next();

    if (role === "csr" && (
        path.startsWith("/repair-records") || path.startsWith("/diagnosis-list") ||
        path.startsWith("/diagnosis-logs") || path.startsWith("/released-logs") ||
        path.startsWith("/posts") || path.startsWith("/events-news") ||
        (path.startsWith("/pos") && isRead) || path === "/dashboard/admin-stats"
    )) return next();

    if (role === "operator" && (
        path.startsWith("/booth-change-requests") ||
        path.startsWith("/operator-change-requests") ||
        path.startsWith("/booth-operator-change-requests") ||
        path.startsWith("/cp-booth-change-requests") ||
        path.startsWith("/cp-operator-change-requests") ||
        path.startsWith("/cellphones") ||
        (path.startsWith("/pos") && isRead)
    )) {
        if (isOperatorRequestRoute(path)) {
            return enforceOperatorRequestScope(req, res, next);
        }
        return enforceOperatorIdentity(req, res, next);
    }

    return res.status(403).json({ error: "role_not_authorized" });
}

function isOperatorRequestRoute(path) {
    return [
        "/booth-change-requests",
        "/operator-change-requests",
        "/booth-operator-change-requests",
        "/cp-booth-change-requests",
        "/cp-operator-change-requests",
    ].some((prefix) => path.startsWith(prefix));
}

function enforceOperatorRequestScope(req, res, next) {
    // Decision endpoints are exclusively administrative, even though they
    // share the same route family as an operator's submit/cancel endpoints.
    if (/\/(approve|reject)$/.test(req.path)) {
        return res.status(403).json({ error: "role_not_authorized" });
    }

    if (req.method === "GET") {
        const requestedId = req.query?.userId ?? req.query?.user_id;
        if (requestedId === undefined || Number(requestedId) !== req.user.id) {
            return res.status(403).json({ error: "ownership_required" });
        }
        return next();
    }

    if (req.method === "POST") {
        const body = req.body || {};
        const requestedId = body.user_id ?? body.userId ?? body.requested_by_user_id ?? body.requestedByUserId;
        if (requestedId === undefined || Number(requestedId) !== req.user.id) {
            return res.status(403).json({ error: "ownership_required" });
        }
    }
    return next();
}

function enforceOperatorIdentity(req, res, next) {
    const fields = ["user_id", "userId", "requested_by_user_id", "requestedByUserId", "added_by_user_id", "addedByUserId"];
    for (const source of [req.query, req.body]) {
        if (!source) continue;
        for (const field of fields) {
            const value = source[field];
            if (value !== undefined && value !== null && value !== "" && Number(value) !== req.user.id) {
                return res.status(403).json({ error: "ownership_required" });
            }
        }
    }
    return next();
}
