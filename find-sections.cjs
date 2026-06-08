const fs = require('fs');
const text = fs.readFileSync('public/org-admin-dashboard.html', 'utf8');

let depth = 0;
const lines = text.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const opens = (l.match(/<div(>|\s)/g) || []).length;
    const closes = (l.match(/<\/div>/g) || []).length;
    depth += (opens - closes);

    if (l.includes('<main')) console.log(`main open: line ${i + 1}, depth=${depth}`);
    if (l.includes('class="page-section"')) console.log(`section ${l.trim()}: line ${i + 1}, depth=${depth}`);
    if (l.includes('</main>')) console.log(`main closed: line ${i + 1}, depth=${depth}`);
}
console.log(`Final depth: ${depth}`);
