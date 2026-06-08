const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'super-admin-dashboard.html');
let html = fs.readFileSync(filePath, 'utf8');

// Replace table empty states spinners with skeletons
html = html.replace(/<td colspan="(\d+)" class="empty-state">\s*<div class="spinner"><\/div>\s*<\/td>/g,
    '<td colspan="$1">\n                                            <div class="skeleton" style="height:35px;width:100%;margin-bottom:8px;"></div>\n                                            <div class="skeleton" style="height:35px;width:100%;margin-bottom:8px;"></div>\n                                            <div class="skeleton" style="height:35px;width:100%;"></div>\n                                        </td>');

// Replace orgList and pendingList empty states with skeletons
html = html.replace(/<div class="empty-state">\s*<div class="spinner"><\/div>\s*<p[^>]*>Loading (organizations|applications)\.\.\.<\/p>\s*<\/div>/g,
    '<div style="padding:1rem;">\n                            <div class="skeleton" style="height:80px;width:100%;margin-bottom:1rem;"></div>\n                            <div class="skeleton" style="height:80px;width:100%;margin-bottom:1rem;"></div>\n                            <div class="skeleton" style="height:80px;width:100%;"></div>\n                        </div>');

// Replace activity feed empty state spinner
html = html.replace(/<div class="empty-state">\s*<div class="spinner"><\/div>\s*<p>Loading activity feed\.\.\.<\/p>\s*<\/div>/g,
    '<div class="skeleton" style="height:40px;width:100%;margin-bottom:10px;"></div>\n                            <div class="skeleton" style="height:40px;width:80%;"></div>');

fs.writeFileSync(filePath, html);
console.log('Successfully injected skeletons into super-admin-dashboard.html');
