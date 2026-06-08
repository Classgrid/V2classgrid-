const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function processDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // 1. Remove localStorage.setItem('jwt_token', ...)
            content = content.replace(/localStorage\.setItem\(['"]jwt_token['"]\s*,\s*[^)]+\);?/g, '');

            // 2. Replace localStorage.getItem('jwt_token') with null
            content = content.replace(/localStorage\.getItem\(['"]jwt_token['"]\)/g, 'null');

            // 3. Remove Authorization header lines
            // Matches 'Authorization': `Bearer ${...}`, or "Authorization": "Bearer " + ...
            // Also absorbs any following comma and whitespace
            const authRegex = /['"]?Authorization['"]?\s*:\s*(`Bearer \$\{[^}]+\}`|['"]Bearer ['"]\s*\+\s*[a-zA-Z0-9_\.()]+)\s*,?/g;
            content = content.replace(authRegex, '');

            // 4. Sometimes this leaves `{ , 'Content-Type'` which is a syntax error in some strict JSON parsers (if used inside JSON.parse, though these are JS objects).
            // Actually JS allows trailing commas but NOT `{ , "foo": "bar" }`.
            // Let's clean up `{ ,` to `{ `
            content = content.replace(/\{\s*,/g, '{');

            if (content !== originalContent) {
                console.log('Modified:', fullPath);
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    });
}

processDir(publicDir);
console.log('Done!');
