// Shape of a payload produced by `generateQrPayload` in asset-code.routes.js:
//   ASSET-{ITEM_CODE}-{8 hex chars}
//   or, if itemCode is empty:
//   ASSET-{8 hex chars}
//
// ITEM_CODE is forced to uppercase and stripped to [A-Z0-9-]+ before insertion.
// Anything that doesn't match this layout is either an unrelated QR (URL,
// vCard, plain text) or a tampered/legacy payload, so we reject it up front
// instead of leaking the lookup as a 404.
//
// Constraints chosen to be permissive enough for any legacy payload that
// might exist in production but tight enough to filter out "random text":
//   - must start with ASSET-
//   - max 200 chars total (defense against pathological input)
//   - allowed chars: A-Z, 0-9, hyphen
//   - must end with at least 4 hex chars (the random suffix)
const PAYLOAD_REGEX = /^ASSET-[A-Z0-9-]*[A-F0-9]{4,}$/;
const MAX_PAYLOAD_LENGTH = 200;

export function isQrPayloadValid(payload) {
    if (typeof payload !== "string") return false;
    if (payload.length === 0 || payload.length > MAX_PAYLOAD_LENGTH) return false;
    return PAYLOAD_REGEX.test(payload);
}

/**
 * Returns null when valid, otherwise a short reason code.
 * Reasons stay machine-friendly so callers can map them to localized
 * messages without parsing prose.
 */
export function validateQrPayload(payload) {
    if (typeof payload !== "string" || payload.length === 0) {
        return "EMPTY_PAYLOAD";
    }
    if (payload.length > MAX_PAYLOAD_LENGTH) {
        return "PAYLOAD_TOO_LONG";
    }
    if (!PAYLOAD_REGEX.test(payload)) {
        return "PAYLOAD_FORMAT_INVALID";
    }
    return null;
}

export const QR_PAYLOAD_CONFIG = {
    regex: PAYLOAD_REGEX,
    maxLength: MAX_PAYLOAD_LENGTH,
    prefix: "ASSET-",
};
