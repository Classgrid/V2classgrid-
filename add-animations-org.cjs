const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'org-admin-dashboard.html');
let html = fs.readFileSync(filePath, 'utf8');

// Link CSS
if (!html.includes('ui-animations.css')) {
    html = html.replace('<link rel="stylesheet" href="/css/org-admin.css">', '<link rel="stylesheet" href="/css/org-admin.css">\n    <link rel="stylesheet" href="/css/ui-animations.css">');
}

// Link JS
if (!html.includes('ui-animations.js')) {
    html = html.replace('<script src="/js/org-admin.js"></script>', '<script src="/js/ui-animations.js"></script>\n    <script src="/js/org-admin.js"></script>');
}

// Replace stat cards
html = html.replace(/class="stat-card"/g, 'class="stat-card anim-card reveal"');

// Replace info cards
html = html.replace(/class="info-card"/g, 'class="info-card anim-card reveal"');

// Replace settings cards
html = html.replace(/class="settings-card"/g, 'class="settings-card anim-card reveal"');

// Replace table empty states spinners with skeletons
html = html.replace(/<td colspan="(\d+)" class="empty-state">\s*<div class="spinner"><\/div>\s*<\/td>/g,
    '<td colspan="$1">\n                                            <div class="skeleton" style="height:35px;width:100%;margin-bottom:8px;"></div>\n                                            <div class="skeleton" style="height:35px;width:100%;margin-bottom:8px;"></div>\n                                            <div class="skeleton" style="height:35px;width:100%;"></div>\n                                        </td>');

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

fs.writeFileSync(filePath, newHtml);
console.log('Successfully injected animations/skeletons into org-admin-dashboard.html');
