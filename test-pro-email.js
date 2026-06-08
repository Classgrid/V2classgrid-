import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

async function runTest() {
    const planName = "PRO";
    const activationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 31);
    const studentLimit = "7,500";
    const userName = "Danny Perna (Test Admin)";
    const planDuration = 31;

    const { sendEmail } = await import('./src/services/brevo.service.js');
    const { getPlanActivationHtml, getPlanActivationPlainText } = await import('./src/services/email-templates.service.js');

    const html = getPlanActivationHtml(planName, activationDate, expiryDate, studentLimit, userName, planDuration);
    const text = getPlanActivationPlainText(planName, activationDate, expiryDate, studentLimit, userName, planDuration);

    // Write to a local HTML file so we can view it
    fs.writeFileSync('preview_pro_email.html', html);
    console.log("✅ Wrote preview_pro_email.html for local preview.");

    const toEmail = process.env.SUPER_ADMIN_EMAIL || "nikhil.shinde@classgrid.in";

    console.log(`Sending test email to ${toEmail}...`);

    try {
        await sendEmail({
            to: toEmail,
            subject: "Classgrid PRO Activated (Template Test)",
            html: html,
            text: text
        });
        console.log("✅ Test email sent successfully!");
    } catch (err) {
        console.error("❌ Failed to send email:", err.message);
    }
}

runTest();
