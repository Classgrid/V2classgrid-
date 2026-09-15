const fs = require('fs');
const files = ['public/login.html', 'public/admin-login.html', 'public/superadmin-login.html'];

files.forEach(file => {
    if(fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(
            /<a href="https:\/\/x\.com\/classgrid_cg" class="social-link" target="_blank" aria-label="X">\s*<i\s*class="fab fa-x-twitter"><\/i><\/a>/g,
            '<a href="https://www.linkedin.com/company/classgrid/?viewAsMember=true" class="social-link" target="_blank" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>'
        );
        fs.writeFileSync(file, content);
        console.log('Updated LinkedIn in ' + file);
    }
});
