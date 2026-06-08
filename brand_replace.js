import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');

const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

const replacements = [
    {
        regex: /Advanced Chemical Database Platform for research and learning\. Empowering students with/gi,
        replacement: "An AI-powered intelligent classroom ecosystem that combines structured academic management with real-time collaboration and embedded artificial intelligence."
    },
    {
        regex: /Advanced chemical database and research platform for students, researchers, and professionals worldwide\./gi,
        replacement: "An AI-powered intelligent classroom ecosystem that combines structured academic management with real-time collaboration and embedded artificial intelligence."
    },
    {
        regex: /Advanced Chemical Database Platform/gi,
        replacement: "Intelligent Classroom Ecosystem"
    },
    {
        regex: /Advanced chemical database/gi,
        replacement: "Intelligent classroom ecosystem"
    },
    {
        regex: /Advanced Chemical Database/gi,
        replacement: "Intelligent Classroom Ecosystem"
    },
    {
        regex: /chemical databases/gi,
        replacement: "classroom ecosystems"
    },
    {
        regex: /Chemical databases/gi,
        replacement: "Classroom ecosystems"
    },
    {
        regex: /Chemical Database/gi,
        replacement: "Classroom"
    },
    {
        regex: /chemical database/gi,
        replacement: "classroom ecosystem"
    },
    {
        regex: /Advanced Chemical Solutions/gi,
        replacement: "Classgrid Classroom"
    }
];

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    replacements.forEach(r => {
        content = content.replace(r.regex, r.replacement);
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});

console.log('Done replacing strings.');
