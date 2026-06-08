const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'org-admin.js');
let js = fs.readFileSync(filePath, 'utf8');

// Replace standard stats assignment: document.getElementById('X').textContent = Y
js = js.replace(/document\.getElementById\((['"`])([^'"`]+)\1\)\.textContent\s*=\s*([^;]+);/g, (match, quote, id, val) => {
    // Only animate stat identifiers
    if (id.startsWith('stat') || id.startsWith('growth') || id.startsWith('notesStat') || id.startsWith('analytics') || id.startsWith('usage') || id.startsWith('org') || id.startsWith('sec') || id.startsWith('sys') || id.startsWith('m') || id.startsWith('rev')) {
        return `if(window.UIAnim){ UIAnim.animateValue(document.getElementById('${id}'), 0, parseFloat(${val})||0); } else { document.getElementById('${id}').textContent = ${val}; }`;
    }
    return match;
});

// Append initScrollAnimations to the bottom wrapper
if (!js.includes('UIAnim.initScrollAnimations()')) {
    js += `\n\n// Initialize scroll animations
window.addEventListener('scroll', () => {
    if (window.UIAnim && !window._uiAnimInit) {
        window._uiAnimInit = true;
        UIAnim.initScrollAnimations();
    }
});
setTimeout(() => {
    if(window.UIAnim) UIAnim.initScrollAnimations();
}, 500);
`;
}

fs.writeFileSync(filePath, js);
console.log('Successfully injected animateValue into org-admin.js');
