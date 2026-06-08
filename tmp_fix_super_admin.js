const fs = require('fs');
const file = 'c:/Users/nikhi/OneDrive/Documents/Classgrid/classgrid_platform/public/js/super-admin.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\{\s*headers:\s*\{\s*\}\s*\}/g, "{ credentials: 'include' }");
fs.writeFileSync(file, content);
console.log('Fixed super-admin.js');
