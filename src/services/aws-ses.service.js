import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 14,
  maxMessages: 10000,
  host: process.env.AWS_SES_SMTP_HOST?.replace(/^=/, "")?.trim(),
  port: Number(process.env.AWS_SES_SMTP_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.AWS_SES_SMTP_USER?.replace(/^=/, "")?.trim(),
    pass: process.env.AWS_SES_SMTP_PASS?.replace(/^=/, "")?.trim(),
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ AWS SES SMTP error:", err.message);
  } else {
    console.log("✅ AWS SES SMTP ready");
  }
});

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log("=== EMAIL FUNCTION ENTERED ===");
    console.log("TO:", to);
    console.log("SUBJECT:", subject);
    console.log(`[SMTP] Attempting to send email to: ${to}`);

    const cleanEnv = (val, defaultVal) => (val || defaultVal).replace(/^=/, "").trim();
    const senderName = cleanEnv(process.env.AWS_SES_SENDER_NAME, "Classgrid");
    const senderEmail = cleanEnv(process.env.AWS_SES_SENDER_EMAIL, "noreply@classgrid.in");
    const replyToEmail = cleanEnv(process.env.AWS_SES_REPLY_TO, "support@classgrid.in");

    console.log("=== CALLING transporter.sendMail ===");
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      replyTo: replyToEmail,
      to,
      subject,
      text, // Ensures deliverability by including plain text version
      html,
    });

    console.log("=== EMAIL SENT SUCCESSFULLY ===");
    console.log("✅ Email sent to:", to);
    console.log("[SMTP] Response:", info);
    return info;
  } catch (err) {
    console.error("=== EMAIL ERROR ===", err);
    console.error("❌ Email error:", err.message);
    throw err;
  }
};
