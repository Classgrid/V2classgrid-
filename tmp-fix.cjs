const fs = require('fs');
let lines = fs.readFileSync('public/super-admin-dashboard.html', 'utf8').split('\n');

// Find the start line of Top Students block
const topStart = lines.findIndex(l => l.includes('<!-- Top Students Card -->'));
if (topStart !== -1) {
    console.log('Found Top Students at line ' + (topStart + 1));
    const topEnd = topStart + 11; // 12 lines total

    // Extract the block
    const block = lines.splice(topStart, 12);

    // Update the Audit Log Title which previously aggregated both
    const auditTitleLine = lines.findIndex(l => l.includes('<div class="section-title">Top Students + Admin Actions</div>'));
    if (auditTitleLine !== -1) {
        lines[auditTitleLine] = lines[auditTitleLine].replace('Top Students + Admin Actions', 'Admin Actions History');
        console.log('Fixed Audit title');
    }

    // Wrap the top students block in a new cmd-section
    const newSection = [
        '                <!-- TOP PERFORMING STUDENTS PLATFORM-WIDE -->',
        '                <div class="cmd-section visible" style="margin-top:1.5rem;">',
        '                    <div class="section-header">',
        '                        <div class="section-num">Analytics — Performance</div>',
        '                        <div class="section-title">Platform Top Students</div>',
        '                    </div>'
    ].concat(block).concat(['                </div>']);

    // Find the ideal insertion point in section-analytics
    const storageHeader = lines.findIndex(l => l.includes('<!-- STORAGE TRACKING -->'));
    if (storageHeader !== -1) {
        // Insert right before storage tracking
        lines.splice(storageHeader, 0, ...newSection);
        console.log('Inserted new section before Storage Tracking');
    }

    fs.writeFileSync('public/super-admin-dashboard.html', lines.join('\n'));
    console.log('Layout repaired successfully!');
} else {
    console.log('Could not find Top Students block.');
}
