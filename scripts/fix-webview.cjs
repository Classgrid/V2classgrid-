/**
 * Batch fix all HTML files for Android WebView compatibility:
 * 1. Ensure correct viewport meta tag
 * 2. Add overflow-x: hidden + width: 100% + max-width: 100% to html, body
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Desired viewport content
const VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

// The CSS to inject if missing
const OVERFLOW_CSS = `
        /* WebView Fix: prevent horizontal overflow */
        html, body {
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
        }`;

function findHtmlFiles(dir) {
    let results = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            // Skip node_modules and hidden dirs
            if (item.name.startsWith('.') || item.name === 'node_modules') continue;
            results = results.concat(findHtmlFiles(fullPath));
        } else if (item.name.endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(PUBLIC_DIR, filePath);
    let changes = [];

    // 1. Fix viewport meta tag
    const viewportRegex = /<meta\s+name=["']viewport["']\s*(?:content=["'][^"']*["'])?\s*\/?>/i;
    const multiLineViewportRegex = /<meta\s+name=["']viewport["']\s*\n\s*content=["'][^"']*["']\s*\/?>/i;

    const targetViewport = `<meta name="viewport" content="${VIEWPORT_CONTENT}">`;

    if (multiLineViewportRegex.test(content)) {
        content = content.replace(multiLineViewportRegex, targetViewport);
        changes.push('viewport (multiline)');
    } else if (viewportRegex.test(content)) {
        const match = content.match(viewportRegex);
        if (match && !match[0].includes('viewport-fit=cover')) {
            content = content.replace(viewportRegex, targetViewport);
            changes.push('viewport');
        }
    }

    // 2. Check if overflow-x: hidden is already on html+body combo
    const hasHtmlBodyOverflow = /html\s*,\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/s.test(content) ||
        (/html\s*\{[^}]*overflow-x\s*:\s*hidden/s.test(content) && /body\s*\{[^}]*overflow-x\s*:\s*hidden/s.test(content));
    const hasMaxWidth = /html\s*,?\s*body\s*\{[^}]*max-width\s*:\s*100%/s.test(content) ||
        (/html\s*\{[^}]*max-width\s*:\s*100%/s.test(content) && /body\s*\{[^}]*max-width\s*:\s*100%/s.test(content));

    if (!hasHtmlBodyOverflow || !hasMaxWidth) {
        // Find the first <style> tag and inject right after the opening
        const styleRegex = /<style\s*>/i;
        if (styleRegex.test(content)) {
            content = content.replace(styleRegex, (match) => {
                return match + OVERFLOW_CSS;
            });
            changes.push('overflow CSS');
        }
    }

    // 3. Replace 100vw with 100% where it's a width property (not max-width calc)
    const vwReplacements = content.match(/\bwidth\s*:\s*100vw\b/g);
    if (vwReplacements && vwReplacements.length > 0) {
        content = content.replace(/\bwidth\s*:\s*100vw\b/g, 'width: 100%');
        changes.push(`100vw→100% (${vwReplacements.length}x)`);
    }

    if (changes.length > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ ${relPath}: ${changes.join(', ')}`);
    } else {
        console.log(`⏭️  ${relPath}: already OK`);
    }

    return changes.length > 0;
}

// Run
const files = findHtmlFiles(PUBLIC_DIR);
console.log(`Found ${files.length} HTML files\n`);

let fixed = 0;
for (const f of files) {
    if (fixFile(f)) fixed++;
}

console.log(`\nDone! Fixed ${fixed}/${files.length} files.`);
