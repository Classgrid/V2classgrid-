import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

async function runTest() {
    const { sendEmail } = await import('./src/services/aws-ses.service.js');
    const { getLoginNotificationHtml, getLoginNotificationPlainText } = await import('./src/services/email-templates.service.js');

    const fakeUser = {
        name: "Danny Perna (Global Style Test)",
        email: "nikhilsubsun123@gmail.com"
    };

    const html = getLoginNotificationHtml(fakeUser);
    const text = getLoginNotificationPlainText(fakeUser);

    // Write to local HTML files for screenshotting if needed
    fs.writeFileSync('preview_global_template.html', html);
    console.log("✅ Wrote preview_global_template.html for local preview.");

    try {
        await sendEmail({
            to: fakeUser.email,
            subject: "Global Theme Test - Login Notification",
            html: html,
            text: text
        });
        console.log("✅ Global theme test email sent successfully!");
    } catch (err) {
        console.error("❌ Failed to send emails:", err.message);
    }
}

runTest();
