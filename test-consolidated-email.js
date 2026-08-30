import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

async function runTest() {
    const { sendEmail } = await import('./src/services/aws-ses.service.js');
    const { getConsolidatedApprovalEmailHtml, getConsolidatedApprovalEmailPlainText } = await import('./src/services/email-templates.service.js');

    const activationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 31);

    const baseParams = {
        adminName: "Test Admin",
        orgName: "Demo Institution",
        organizationCode: "FAC-TEST-CODE",
        honorCode: "STU-HONOR-CODE",
        studentLimit: 7500,
        activationLink: "https://classgrid.in/admin/activate?token=DEMO_TOKEN_12345",
        activationDate,
        expiryDate,
        planDuration: 31,
    };

    const recipients = ["nikhil.shinde@classgrid.in", "nikhilsubsun321@gmail.com"];

    // ── PRO EMAIL ──
    const proHtml = getConsolidatedApprovalEmailHtml({ ...baseParams, plan: "PRO" });
    const proText = getConsolidatedApprovalEmailPlainText({ ...baseParams, plan: "PRO" });
    fs.writeFileSync('preview_consolidated_pro.html', proHtml);
    console.log("✅ Wrote preview_consolidated_pro.html");

    for (const to of recipients) {
        try {
            await sendEmail({
                to,
                subject: "Activate Your Classgrid Admin Account – PRO Plan Active",
                html: proHtml,
                text: proText,
            });
            console.log(`✅ PRO email sent to ${to}`);
        } catch (err) {
            console.error(`❌ PRO email failed for ${to}:`, err.message);
        }
    }

    // ── FREE EMAIL ──
    const freeHtml = getConsolidatedApprovalEmailHtml({ ...baseParams, plan: "FREE", expiryDate: null });
    const freeText = getConsolidatedApprovalEmailPlainText({ ...baseParams, plan: "FREE", expiryDate: null });
    fs.writeFileSync('preview_consolidated_free.html', freeHtml);
    console.log("✅ Wrote preview_consolidated_free.html");

    for (const to of recipients) {
        try {
            await sendEmail({
                to,
                subject: "Activate Your Classgrid Admin Account – FREE Plan",
                html: freeHtml,
                text: freeText,
            });
            console.log(`✅ FREE email sent to ${to}`);
        } catch (err) {
            console.error(`❌ FREE email failed for ${to}:`, err.message);
        }
    }

    console.log("\n✅ All test emails dispatched.");
}

runTest();
