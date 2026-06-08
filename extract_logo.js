
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, 'public', 'logo-animation.html');
const outputFile = path.join(__dirname, 'public', 'Classgrid_transparent.png');

try {
    const htmlContent = fs.readFileSync(inputFile, 'utf8');
    // Using a more flexible regex to capture the base64 string
    const match = htmlContent.match(/logoImg\.src\s*=\s*["']data:image\/png;base64,([^"']+)["']/);

    if (match && match[1]) {
        const base64Data = match[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(outputFile, buffer);
        console.log(`Successfully extracted logo to ${outputFile}`);
    } else {
        console.error('Could not find base64 image data in logo-animation.html');
        process.exit(1);
    }
} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
