const fs = require('fs');

const mappings = {
    '\u20ac\u201d': '—',
    '\u008f\u00ab': '🔑',
    '\u017d\u201c': '🎓',
    '\u0161\u00a0\u00ef\u00b8\u008f': '⚠️',
    '\u0153\u201c': '✅',
    '\u20ac\u00a6': '…',
    '\u201a\u00b9': '₹',
    '\u201c\u00a7': '✨',
    '\u2022\u0090': '─',
    '\u2022\u201d': '└',
    '\u2022\u2018': '│',
    '\u2022\u0161': '├',
    '\u0161\u00a0\u00ef\u00b8': '⚠️',
    '\ufeff': '' // BOM removal if present
};

const file = 'public/org-admin-dashboard.html';
if (fs.existsSync(file)) {
    let text = fs.readFileSync(file, 'utf8');
    let originalText = text;

    for (const [bad, good] of Object.entries(mappings)) {
        text = text.split(bad).join(good);
    }

    if (text !== originalText) {
        fs.writeFileSync(file, text, 'utf8');
        console.log('Successfully repaired org-admin-dashboard.html');
    } else {
        console.log('No matches found.');
    }
}
