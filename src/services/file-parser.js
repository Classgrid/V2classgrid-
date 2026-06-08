import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// IMPORTANT: pdf-parse v2 eagerly loads @napi-rs/canvas and DOMMatrix polyfills
// at require() time. These don't exist in Vercel's serverless Node.js environment,
// causing an immediate crash (ReferenceError: DOMMatrix is not defined).
// By lazy-loading inside the function, we avoid crashing at cold start.

// Cache the module once loaded successfully
let pdfModule = null;

export async function parsePDF(buffer) {
    try {
        if (!pdfModule) {
            pdfModule = require('pdf-parse');
        }
        const data = await pdfModule(buffer);
        // Limit to ~5 pages worth of text (roughly 15,000 chars) to prevent context overflow
        return data.text.substring(0, 15000);
    } catch (error) {
        console.error('PDF Parse Error:', error);

        // If it's the DOMMatrix/canvas error, give a clear message
        if (error.message && (error.message.includes('DOMMatrix') || error.message.includes('@napi-rs/canvas'))) {
            throw new Error('PDF parsing is not available in this environment. Please try a text-based upload instead.');
        }

        throw new Error('Failed to parse PDF file');
    }
}

