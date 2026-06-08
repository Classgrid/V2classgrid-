import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public');
const files = fs.readdirSync(dir);

for (const f of files) {
  if (!f.endsWith('.html') && !f.endsWith('.css')) continue;
  const file = path.join(dir, f);
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Let's replace ONLY those associated with logo identifiers specifically, one by one.
  const tests = [
    /\.logo-container[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.logo-container\s+img[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.nav-brand[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.nav-brand\s+img[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.brand[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.brand\s+img[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.footer-logo-img[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.logo-img[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.logo[^{]*{[^}]*?(border-radius:\s*)50%/gi,
    /\.f-logo[^{]*{[^}]*?(border-radius:\s*)50%/gi
  ];

  for (const regex of tests) {
    content = content.replace(regex, (match) => {
      return match.replace(/50%/gi, '8px');
    });
  }
  
  // also inline style replacements
  const inlineStyles = [
    /(<img[^>]*class=["'][^"']*(logo|brand)[^"']*["'][^>]*style=["'][^"']*?border-radius:\s*)50%/gi,
    /(<img[^>]*style=["'][^"']*?border-radius:\s*)50%([^"']*["'][^>]*class=["'][^"']*(logo|brand)[^"']*["'])/gi,
  ];

  for (const regex of inlineStyles) {
    content = content.replace(regex, (match) => {
        return match.replace(/50%/gi, '8px');
    });
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed CSS target blocks in:', f);
  }
}
