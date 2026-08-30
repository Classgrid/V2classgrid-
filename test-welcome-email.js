import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

async function runTest() {
    const { sendEmail } = await import('./src/services/aws-ses.service.js');
    const { getFacultyWelcomeEmailHtml, getFacultyWelcomePlainText, getStudentWelcomeEmailHtml, getStudentWelcomePlainText, getPlanActivationHtml, getPlanActivationPlainText } = await import('./src/services/email-templates.service.js');

    const facultyUserName = "Danny Perna (Faculty Test)";
    const studentUserName = "Danny Perna (Student Test)";
    const orgName = "Classgrid University";
    const dashboardUrl = "http://localhost:3000/classroom";

    const facultyHtml = getFacultyWelcomeEmailHtml(facultyUserName, orgName, dashboardUrl);
    const facultyText = getFacultyWelcomePlainText(facultyUserName, orgName, dashboardUrl);

    const studentHtml = getStudentWelcomeEmailHtml(studentUserName, dashboardUrl);
    const studentText = getStudentWelcomePlainText(studentUserName, dashboardUrl);

    const proActivationDate = new Date();
    const proExpiryDate = new Date();
    proExpiryDate.setDate(proExpiryDate.getDate() + 31);
    const proHtml = getPlanActivationHtml("PRO", proActivationDate, proExpiryDate, "7,500", "Danny Perna (Admin Test)", 31);
    const proText = getPlanActivationPlainText("PRO", proActivationDate, proExpiryDate, "7,500", "Danny Perna (Admin Test)", 31);

    const toEmail = "nikhilsubsun123@gmail.com";

    console.log(`Sending all 3 test emails to ${toEmail}...`);

    try {
        await sendEmail({
            to: toEmail,
            subject: "🎉 Welcome to Classgrid - Faculty Account",
            html: facultyHtml,
            text: facultyText
        });
        console.log("✅ Faculty test email sent successfully!");

        await sendEmail({
            to: toEmail,
            subject: "🎉 Welcome to Classgrid - Student Account",
            html: studentHtml,
            text: studentText
        });
        console.log("✅ Student test email sent successfully!");

        /*
        await sendEmail({
            to: toEmail,
            subject: "Classgrid PRO Activated (Template Test)",
            html: proHtml,
            text: proText
        });
        console.log("✅ PRO activation test email sent successfully!");
        */
    } catch (err) {
        console.error("❌ Failed to send emails:", err.message);
    }
}

runTest();
