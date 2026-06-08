import "./env.js";
import { sendEmail } from "./src/services/brevo.service.js";
import { getPasswordResetEmailHtml, getPasswordResetEmailPlainText } from "./src/services/email-templates.service.js";

const run = async () => {
    try {
        const resetLink = "https://classgrid.in/reset-password?token=test";
        const email = "nikhilnick5050@gmail.com";

        console.log("SENDING EMAIL WITH ACTUAL TEMPLATE...");

        const info = await sendEmail({
            to: email,
            subject: "🔑 Reset Your Password - Classgrid",
            html: getPasswordResetEmailHtml(resetLink),
            text: getPasswordResetEmailPlainText(resetLink)
        });

        console.log("SUCCESS!", info);
    } catch (err) {
        console.error("FAIL!", err);
    }
    process.exit(0);
};

run();
