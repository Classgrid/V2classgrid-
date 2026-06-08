/**
 * GPS Service — server-side location utilities for attendance security
 *
 * Haversine formula gives great-circle distance between two GPS points.
 * Used exclusively on the backend — never trust client-provided distance.
 */

const EARTH_RADIUS_M = 6_371_000; // metres

/**
 * Convert degrees to radians
 */
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculate straight-line distance between two GPS coordinates (metres).
 * Uses the Haversine formula — accurate for small distances like classrooms.
 *
 * @param {number} lat1 - Teacher latitude
 * @param {number} lng1 - Teacher longitude
 * @param {number} lat2 - Student latitude
 * @param {number} lng2 - Student longitude
 * @returns {number} Distance in metres (rounded to 2 decimal places)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((EARTH_RADIUS_M * c).toFixed(2));
}

/**
 * Check if student is within the allowed radius of the teacher.
 *
 * @param {{ lat: number, lng: number }} teacherCoords
 * @param {{ lat: number, lng: number }} studentCoords
 * @param {number} radiusMeters - Maximum allowed distance
 * @returns {{ withinRadius: boolean, distanceMeters: number }}
 */
export function checkRadius(teacherCoords, studentCoords, radiusMeters) {
    const distanceMeters = haversineDistance(
        teacherCoords.lat,
        teacherCoords.lng,
        studentCoords.lat,
        studentCoords.lng
    );
    return {
        withinRadius: distanceMeters <= radiusMeters,
        distanceMeters,
    };
}

/**
 * Validate that GPS coordinates are real numbers in valid range.
 * Rejects 0,0 (common fake value), null, or out-of-range values.
 *
 * @param {*} lat
 * @param {*} lng
 * @returns {boolean}
 */
export function isValidCoords(lat, lng) {
    if (lat == null || lng == null) return false;
    const la = parseFloat(lat);
    const lo = parseFloat(lng);
    if (isNaN(la) || isNaN(lo)) return false;
    if (la === 0 && lo === 0) return false; // null island
    if (la < -90 || la > 90) return false;
    if (lo < -180 || lo > 180) return false;
    return true;
}

/**
 * Adaptive typing suspicious threshold.
 * Minimum realistic typing time = codeLength * 200ms.
 * Anything shorter is suspiciously fast.
 *
 * @param {string} code - The attendance code student typed
 * @param {number} typingDurationMs - Measured typing time in ms
 * @returns {boolean} true if typing was suspiciously fast
 */
export function isTypingTooFast(code, typingDurationMs) {
    if (!typingDurationMs || typingDurationMs <= 0) return false;
    const minExpectedMs = (code?.length || 6) * 200;
    return typingDurationMs < minExpectedMs;
}
