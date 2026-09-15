const fs = require('fs');
const files = ['public/login.html', 'public/admin-login.html', 'public/superadmin-login.html'];
const css = `
    /* Native App / Mobile Tweaks */
    ::-webkit-scrollbar {
      display: none;
    }
    @media (max-width: 992px) {
      .brand-panel {
        display: none !important;
      }
      .grecaptcha-badge {
        display: none !important;
      }
    }
`;

files.forEach(file => {
    if(fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace('</style>', css + '</style>');
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});
