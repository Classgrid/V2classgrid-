const fs = require('fs');
['public/index.html', 'public/classroom.html', 'public/dashboard.html', 'public/device-setup.html'].forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/<script src=\"\/auth-check\.js(\?v=\d+)?\"><\/script>/g, '<script src=\"/auth-check.js?v=3\"></script>');
    fs.writeFileSync(file, code);
  }
});
