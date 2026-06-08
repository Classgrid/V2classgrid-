const fs = require('fs');

const file = 'public/super-admin-dashboard.html';
const text = fs.readFileSync(file, 'utf8');

// The section we want to move is from '        <!-- AUDIT LOG + TOP STUDENTS SECTION (Super Admin - all orgs) -->'
// to the end of its div, up to '    <!-- TOAST -->'
const auditLogRegex = /([ \t]*<!-- AUDIT LOG \+ TOP STUDENTS SECTION[\s\S]*?<div class="page-section" id="section-audit-log">[\s\S]*?<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)\s*(?=<!-- TOAST -->)/;

const match = text.match(auditLogRegex);
if (match) {
    const auditLogContent = match[1];
    let newText = text.replace(match[0], ''); // remove it from the bottom

    // now inject it right before </main>
    newText = newText.replace('    </main>', auditLogContent + '\n    </main>');

    fs.writeFileSync(file, newText, 'utf8');
    console.log("Successfully moved section-audit-log inside <main>");
} else {
    console.log("Regex did not match.");
}
