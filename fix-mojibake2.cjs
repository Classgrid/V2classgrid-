const fs = require('fs');

const mappings = {
    'â€”': '—',
    'â•‘': '║',
    'â•”': '╔',
    'â•—': '╗',
    'â•š': '╚',
    'â• ': '╝',
    'â• ': '═',
    'â˜…': '★',
    'âš ï¸ ': '⚠️',
    'âš ï¸': '⚠️',
    'âœ…': '✅',
    'ðŸ”‘': '🔑',
    'ðŸŽ“': '🎓',
    'CÂ°': 'C°',
    'â€œ': '“',
    'â€ ': '”',
    'Â·': '·',
    'â€“': '–',
    'ðŸ“ˆ': '📈',
    'ðŸ“š': '📚',
    'ðŸ§‘â€ ðŸ «': '🧑‍🏫',
    'ðŸ «': '🏫',
    'â€¦': '…',
    'ðŸ“„': '📄',
    'ðŸ“Œ': '📌',
    'ðŸŽ¯': '🎯',
    'ðŸ“¥': '📥',
    'ðŸ—“ï¸': '🗓️',
    'Â«': '«',
    'Â»': '»',
    'Ã—': '×'
};

const files = ['public/org-admin-dashboard.html', 'public/super-admin-dashboard.html', 'public/js/super-admin.js'];

for (const file of files) {
    if (fs.existsSync(file)) {
        let text = fs.readFileSync(file, 'utf8');
        let originalText = text;
        for (const [bad, good] of Object.entries(mappings)) {
            text = text.split(bad).join(good);
        }
        if (text !== originalText) {
            fs.writeFileSync(file, text, 'utf8');
            console.log('Fixed mojibake in ' + file);
        }
    }
}
