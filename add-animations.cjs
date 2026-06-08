const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'super-admin-dashboard.html');
let html = fs.readFileSync(filePath, 'utf8');

// Replace stat cards
html = html.replace(/class="stat-card"/g, 'class="stat-card anim-card reveal"');

// Replace info cards
html = html.replace(/class="info-card"/g, 'class="info-card anim-card reveal"');

// Add stagger delays to stat-cards sequentially within their grids
const grids = html.split('class="stats-grid"');
let newHtml = grids[0];

for (let i = 1; i < grids.length; i++) {
    let gridContent = grids[i];
    let counter = 1;
    gridContent = gridContent.replace(/class="stat-card anim-card reveal"/g, (match) => {
        let replacement = `class="stat-card anim-card reveal stagger-${Math.min(counter, 3)}"`;
        counter++;
        return replacement;
    });
    newHtml += 'class="stats-grid"' + gridContent;
}

html = newHtml;

fs.writeFileSync(filePath, html);
console.log('Successfully injected animation classes into super-admin-dashboard.html');
