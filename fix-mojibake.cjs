const fs = require('fs');
const path = require('path');

function decodeWin1252(str) {
    const win1252 = {
        '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
        '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
        '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
        '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
        '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
        '\u017E': 0x9E, '\u0178': 0x9F
    };

    let bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        let code = char.charCodeAt(0);
        if (win1252[char]) bytes[i] = win1252[char];
        else bytes[i] = code;
    }

    try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return decoded;
    } catch (e) {
        return str; // In case it wasn't valid UTF-8, don't corrupt it further.
    }
}

// Since the whole file wasn't corrupted in one go, but chunk by chunk, 
// wait! The entire file content was converted to string via Get-Content and written back.
// If it's pure ASCII, the bytes and chars match.
// So decoding the entire file string is safe.

const filesToFix = [
    'public/org-admin-dashboard.html',
    'public/super-admin-dashboard.html',
    'public/js/super-admin.js'
];

for (const file of filesToFix) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('â€')) {
            console.log(`Fixing corrupted encoding in ${file}...`);
            const fixed = decodeWin1252(content);
            if (fixed !== content) {
                fs.writeFileSync(fullPath, fixed, 'utf8');
                console.log(`Fixed ${file}`);
            } else {
                console.log(`${file} had no valid decodable bytes despite matching pattern.`);
            }
        }
    }
}
