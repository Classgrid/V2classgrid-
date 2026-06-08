import dotenv from 'dotenv';
dotenv.config();

const TO = "nikhilsubsun321@gmail.com";

async function runAllPlanEmails() {
    const { sendEmail } = await import('./src/services/brevo.service.js');
    const templates = await import('./src/services/email-templates.service.js');

    const now = new Date();
    const expiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    const frontendUrl = "https://classgrid.in";

    let sent = 0;
    let failed = 0;

    async function send(subject, html, text) {
        try {
            await sendEmail({ to: TO, subject, html, text });
            console.log(`  ✅ Sent: ${subject}`);
            sent++;
        } catch (err) {
            console.error(`  ❌ Failed: ${subject} — ${err.message}`);
            failed++;
        }
    }

    // ═══════════════════════════════════════════════════
    // 1. APPLICATION RECEIVED — FREE
    // ═══════════════════════════════════════════════════
    console.log("\n── 1. Application Received (FREE) ──");
    await send(
        "Application Received — Demo Free School",
        templates.getOrgApplicationConfirmationHtml("Nikhil", "Demo Free School", "FREE"),
        templates.getOrgApplicationConfirmationPlainText("Nikhil", "Demo Free School", "FREE")
    );

    // ═══════════════════════════════════════════════════
    // 2. APPLICATION RECEIVED — PRO
    // ═══════════════════════════════════════════════════
    console.log("\n── 2. Application Received (PRO) ──");
    await send(
        "Application Received — Demo Pro Academy",
        templates.getOrgApplicationConfirmationHtml("Nikhil", "Demo Pro Academy", "PRO"),
        templates.getOrgApplicationConfirmationPlainText("Nikhil", "Demo Pro Academy", "PRO")
    );

    // ═══════════════════════════════════════════════════
    // 3. CONSOLIDATED APPROVAL — FREE
    // ═══════════════════════════════════════════════════
    console.log("\n── 3. Consolidated Approval + Activation (FREE) ──");
    await send(
        "🎉 Demo Free School is now live — FREE Plan",
        templates.getConsolidatedApprovalEmailHtml({
            adminName: "Nikhil",
            orgName: "Demo Free School",
            organizationCode: "FAC-DEMO-FREE",
            honorCode: "STU-DEMO-FREE",
            plan: "FREE",
            studentLimit: 600,
            activationLink: `${frontendUrl}/admin/activate?token=DEMO_FREE_TOKEN`,
            activationDate: now,
            expiryDate: null,
            planDuration: 0,
        }),
        templates.getConsolidatedApprovalEmailPlainText({
            adminName: "Nikhil",
            orgName: "Demo Free School",
            organizationCode: "FAC-DEMO-FREE",
            honorCode: "STU-DEMO-FREE",
            plan: "FREE",
            studentLimit: 600,
            activationLink: `${frontendUrl}/admin/activate?token=DEMO_FREE_TOKEN`,
            activationDate: now,
            expiryDate: null,
            planDuration: 0,
        })
    );

    // ═══════════════════════════════════════════════════
    // 4. CONSOLIDATED APPROVAL — PRO
    // ═══════════════════════════════════════════════════
    console.log("\n── 4. Consolidated Approval + Activation (PRO) ──");
    await send(
        "🎉 Demo Pro Academy is now live — PRO Plan Active",
        templates.getConsolidatedApprovalEmailHtml({
            adminName: "Nikhil",
            orgName: "Demo Pro Academy",
            organizationCode: "FAC-DEMO-PRO",
            honorCode: "STU-DEMO-PRO",
            plan: "PRO",
            studentLimit: 7500,
            activationLink: `${frontendUrl}/admin/activate?token=DEMO_PRO_TOKEN`,
            activationDate: now,
            expiryDate: expiry,
            planDuration: 31,
        }),
        templates.getConsolidatedApprovalEmailPlainText({
            adminName: "Nikhil",
            orgName: "Demo Pro Academy",
            organizationCode: "FAC-DEMO-PRO",
            honorCode: "STU-DEMO-PRO",
            plan: "PRO",
            studentLimit: 7500,
            activationLink: `${frontendUrl}/admin/activate?token=DEMO_PRO_TOKEN`,
            activationDate: now,
            expiryDate: expiry,
            planDuration: 31,
        })
    );

    // ═══════════════════════════════════════════════════
    // 5. PLAN ACTIVATION EMAIL — PRO (sent after payment via webhook)
    // ═══════════════════════════════════════════════════
    console.log("\n── 5. Pro Plan Activation (post-payment) ──");
    await send(
        "🎉 Pro Plan Activated — Demo Pro Academy",
        templates.getPlanActivationHtml("PRO", now, expiry, 7500, "Nikhil", 31),
        templates.getPlanActivationPlainText("PRO", now, expiry, 7500, "Nikhil", 31)
    );

    // ═══════════════════════════════════════════════════
    // 6. ORG ADMIN INVITE (activation token email)
    // ═══════════════════════════════════════════════════
    console.log("\n── 6. Org Admin Invite (Activation Link) ──");
    await send(
        "Activate Your Classgrid Admin Account",
        templates.getOrgAdminInviteHtml("Nikhil", "Demo Pro Academy", `${frontendUrl}/admin/activate?token=DEMO_INVITE_TOKEN`),
        templates.getOrgAdminInvitePlainText("Nikhil", "Demo Pro Academy", `${frontendUrl}/admin/activate?token=DEMO_INVITE_TOKEN`)
    );

    // ═══════════════════════════════════════════════════
    // 7. ORG ADMIN ACTIVATED (account setup complete)
    // ═══════════════════════════════════════════════════
    console.log("\n── 7. Org Admin Account Activated ──");
    await send(
        "Your Classgrid Admin Account is Active",
        templates.getOrgAdminActivatedHtml("Nikhil", `${frontendUrl}/org/demo-pro-academy/admin`, `${frontendUrl}/admin/login`),
        templates.getOrgAdminActivatedPlainText("Nikhil", `${frontendUrl}/org/demo-pro-academy/admin`, `${frontendUrl}/admin/login`)
    );

    // ═══════════════════════════════════════════════════
    // 8. ORG APPROVAL (legacy format)
    // ═══════════════════════════════════════════════════
    console.log("\n── 8. Org Approval (legacy format) ──");
    await send(
        "Organization Approved — Demo Free School",
        templates.getOrgApprovalEmailHtml("Demo Free School", "Nikhil", "FAC-LEGACY-CODE", "STU-LEGACY-CODE", 5, frontendUrl),
        templates.getOrgApprovalEmailPlainText("Demo Free School", "Nikhil", "FAC-LEGACY-CODE", "STU-LEGACY-CODE", 5, frontendUrl)
    );

    // ═══════════════════════════════════════════════════
    // 9. APPLICATION REJECTED
    // ═══════════════════════════════════════════════════
    console.log("\n── 9. Application Rejected ──");
    await send(
        "Application Update — Demo Rejected School",
        templates.getOrgRejectionEmailHtml("Nikhil", "Demo Rejected School", "Incomplete institutional documentation."),
        templates.getOrgRejectionEmailPlainText("Nikhil", "Demo Rejected School", "Incomplete institutional documentation.")
    );

    // ═══════════════════════════════════════════════════
    // 10. PLAN EXPIRY REMINDER
    // ═══════════════════════════════════════════════════
    console.log("\n── 10. Plan Expiry Reminder ──");
    await send(
        "⚠️ Pro Plan Expiring Soon — Demo Pro Academy",
        templates.getPlanExpiryReminderHtml("Demo Pro Academy", "Nikhil", "PRO", expiry, 2),
        templates.getPlanExpiryReminderPlainText("Demo Pro Academy", "Nikhil", "PRO", expiry, 2)
    );

    // ═══════════════════════════════════════════════════
    console.log(`\n════════════════════════════════════`);
    console.log(`📧 Total sent: ${sent} | ❌ Failed: ${failed}`);
    console.log(`📬 All sent to: ${TO}`);
    console.log(`════════════════════════════════════\n`);
}

runAllPlanEmails();
