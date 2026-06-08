/**
 * Classgrid — Cryptographically Secure Code Generator
 *
 * Generates exactly 12-character uppercase alphanumeric codes.
 * Uses crypto.randomBytes for true randomness (CSPRNG-backed).
 *
 * Charset: A-Z + 0-9  (36 characters) = ~62-bit entropy for 12-char codes.
 * This is computationally infeasible to brute-force.
 */

import crypto from "crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 12;

/**
 * Generate a single cryptographically random 12-char code.
 * @returns {string} e.g. "K7X9P4L2M8Q1"
 */
export const generateSecureCode = () => {
    const bytes = crypto.randomBytes(CODE_LENGTH * 2); // Extra bytes to reject modulo bias
    let code = "";
    let i = 0;
    while (code.length < CODE_LENGTH) {
        const byte = bytes[i++];
        // Reject bytes that would create modulo bias (256 % 36 = 4 biased values)
        if (byte < 252) {
            code += CHARSET[byte % CHARSET.length];
        }
        if (i >= bytes.length) {
            // Refill if needed (extremely rare)
            const extra = crypto.randomBytes(CODE_LENGTH * 2);
            extra.copy(bytes, 0);
            i = 0;
        }
    }
    return code;
};

/**
 * Generate a pair of unique codes, verifying no collision in the DB.
 * @param {import('mongoose').Model} OrgModel - The Organization Mongoose model
 * @returns {Promise<{ organizationCode: string, honorCode: string }>}
 */
export const generateUniqueDualCodes = async (OrgModel) => {
    let organizationCode, honorCode;
    let attempts = 0;

    while (true) {
        attempts++;
        if (attempts > 20) {
            throw new Error("Unable to generate unique org codes after 20 attempts. This is extremely unlikely.");
        }

        organizationCode = generateSecureCode();
        honorCode = generateSecureCode();

        // Ensure they are different from each other
        if (organizationCode === honorCode) continue;

        // Check DB uniqueness for both codes simultaneously
        const [orgCodeExists, honorCodeExists] = await Promise.all([
            OrgModel.exists({
                $or: [
                    { organizationCode },
                    { honorCode },
                    { private_code: organizationCode },
                ]
            }),
            OrgModel.exists({
                $or: [
                    { honorCode },
                    { organizationCode: honorCode },
                ]
            }),
        ]);

        if (!orgCodeExists && !honorCodeExists) break;
    }

    return { organizationCode, honorCode };
};
