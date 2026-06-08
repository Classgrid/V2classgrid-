import fs from 'fs';
import path from 'path';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir('./public');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('https://formspree.io/f/mwvpkjzn')) {
        content = content.replace(/https:\/\/formspree\.io\/f\/mwvpkjzn/g, 'https://formspree.io/f/xwvjoojo');
        changed = true;
    }

    if (content.includes("window.location.href = '/super-admin-dashboard'")) {
        content = content.replace(/window\.location\.href = '\/super-admin-dashboard'/g, "window.location.href = 'https://v2.superadmin.classgrid.in'");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
    }
});
