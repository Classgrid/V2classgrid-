import nodemailer from "nodemailer";



const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: Number(process.env.BREVO_SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ Brevo SMTP error:", err.message);
  } else {
    console.log("✅ Brevo SMTP ready");
  }
});

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log("=== EMAIL FUNCTION ENTERED ===");
    console.log("TO:", to);
    console.log("SUBJECT:", subject);
    console.log(`[SMTP] Attempting to send email to: ${to}`);

    console.log("=== CALLING transporter.sendMail ===");
    const info = await transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
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
