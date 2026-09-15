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
    console.log("o. Email sent to:", to);
    console.log("[SMTP] Response:", info);
    
    // --- GLOBAL FCM NOTIFICATION INTERCEPTOR ---
    try {
        const lowerSubject = (subject || "").toLowerCase();
        if (!lowerSubject.includes("otp") && !lowerSubject.includes("setup code") && !lowerSubject.includes("verification")) {
            // Dynamically import to avoid circular dependencies
            const mongoose = await import("mongoose");
            const User = mongoose.model("User");
            const { sendPushNotification } = await import("./firebase.service.js");
            
            // Find user by email
            const user = await User.findOne({ email: to.toLowerCase().trim() }).select("fcmToken").lean();
            
            if (user && user.fcmToken) {
                let bodyText = text ? (text.length > 100 ? text.substring(0, 100) + "..." : text) : "Check your dashboard for details.";
                
                await sendPushNotification({
                    fcmToken: user.fcmToken,
                    title: subject,
                    body: bodyText,
                    data: { route: "/" },
                    icon: "classgrid_logo"
                });
                console.log("[FCM] Global push notification sent for email:", subject);
            }
        }
    } catch (fcmErr) {
        console.error("[FCM] Failed to send global push notification for email:", fcmErr.message);
    }
    // ------------------------------------------

    return info;
  } catch (err) {
    console.error("=== EMAIL ERROR ===", err);
    console.error("❌ Email error:", err.message);
    throw err;
  }
};
