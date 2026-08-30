/**
 * Classgrid - Minimalist Transactional Email Templates
 */

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
};

const PLATFORM_LOGO_URL = "https://classgrid.in/Classgrid.png";

const providerConfig = {
  manual: { name: "Email & Password" },
  google: { name: "Google" },
  github: { name: "GitHub" },
  facebook: { name: "Facebook" }
};

const formatDate = (date) => {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Kolkata", timeZoneName: "short",
  });
};

const baseTemplate = ({ content, title = "Notification", ignoreText = null }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Classgrid</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body, html {
      margin: 0; padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f0f0f;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3 { 
      color: #ffffff; 
      margin-top: 0; 
      margin-bottom: 16px;
    }
    p { 
      margin: 0 0 20px; 
      color: #cccccc; 
      font-size: 14px; 
      line-height: 1.7; 
    }
    ul { 
      margin: 0 0 20px 20px; 
      color: #cccccc; 
      font-size: 14px; 
      padding: 0; 
      line-height: 1.7; 
    }
    li { margin-bottom: 8px; }
    strong { color: #ffffff; }
    a { color: #ffffff; text-decoration: underline; }
    
    .btn {
      display: inline-block;
      background-color: #ffffff;
      color: #000000 !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      margin: 10px 0;
      text-align: center;
    }
    .btn-danger {
      background-color: #dc2626;
      color: #ffffff !important;
    }
    .box {
      background-color: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .box p { margin-bottom: 8px; color: #cccccc; }
    .box p:last-child { margin-bottom: 0; }
    .box .meta {
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .box .code {
      font-family: monospace;
      font-size: 24px;
      color: #ffffff;
      letter-spacing: 4px;
      font-weight: bold;
      display: block;
      margin-top: 8px;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#0f0f0f;width:100%;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin:0 auto;max-width:600px;width:100%;">

<tr>
<td style="padding:30px;border-bottom:1px solid #2a2a2a;text-align:center;">
<img src="${PLATFORM_LOGO_URL}" alt="Classgrid" width="48" height="48" style="display:block;margin:0 auto 16px;border-radius:6px;">
<h1 style="color:#ffffff;margin:0;font-size:20px;">${title}</h1>
</td>
</tr>

<tr>
<td style="padding:30px;color:#cccccc;font-size:14px;line-height:1.7;">

${content}

<div style="margin-top:30px;">
<p style="color:#9ca3af;font-size:13px;margin:0;">
Need help? Contact <a href="mailto:support@classgrid.in" style="color:#ffffff;text-decoration:none;">support@classgrid.in</a>
</p>
</div>

</td>
</tr>

<tr>
<td style="padding:20px;text-align:center;border-top:1px solid #2a2a2a;color:#7a7a7a;font-size:12px;">
${ignoreText ? `<p style="margin-bottom:12px;color:#7a7a7a;font-size:12px;">${ignoreText}</p>` : ''}
© ${new Date().getFullYear()} Classgrid. All rights reserved.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
};

// ───────────── FACULTY WELCOME EMAIL ─────────────
export const getFacultyWelcomeEmailHtml = (userName, orgName, dashboardUrl) => {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#0f0f0f;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">

<tr>
<td style="padding:30px;border-bottom:1px solid #2a2a2a;text-align:center;">
<img src="${PLATFORM_LOGO_URL}" alt="Classgrid" width="48" height="48" style="display:block;margin:0 auto 16px;">
<h1 style="color:#ffffff;margin:0;font-size:22px;">Welcome to Classgrid</h1>
<p style="color:#9ca3af;margin-top:8px;font-size:13px;">
Organization: <strong style="color:#ffffff;">${orgName}</strong>
</p>
</td>
</tr>

<tr>
<td style="padding:30px;color:#cccccc;font-size:14px;line-height:1.7;">

<p>Hi <strong>${userName}</strong>,</p>

<p>Your faculty account has been successfully created. You're now ready to manage classrooms, deliver structured academic content, and engage students professionally.</p>

<h3 style="color:#ffffff;">Structured Content Delivery</h3>
<ul style="padding-left:20px;">
<li style="margin-bottom:6px;">Upload PDFs, documents, and study material to specific classrooms</li>
<li style="margin-bottom:6px;">Control student contributions through approval workflows</li>
<li style="margin-bottom:6px;">Notes remain isolated within your organization</li>
<li style="margin-bottom:6px;">Files securely stored via Supabase with signed URLs</li>
</ul>

<h3 style="color:#ffffff;margin-top:25px;">Smart Attendance (Pro Plan)</h3>
<ul style="padding-left:20px;">
<li style="margin-bottom:6px;">Start/stop attendance sessions inside classroom</li>
<li style="margin-bottom:6px;">Daily, weekly, and monthly attendance reports</li>
<li style="margin-bottom:6px;">Students track their attendance history</li>
</ul>

<h3 style="color:#ffffff;margin-top:25px;">Real-Time Classroom Chat</h3>
<ul style="padding-left:20px;">
<li style="margin-bottom:6px;">Live academic discussions</li>
<li style="margin-bottom:6px;">Faculty moderation tools</li>
<li style="margin-bottom:6px;">Online activity visibility</li>
</ul>

<div style="text-align:center;margin:30px 0;">
<a href="${dashboardUrl}" style="background:#ffffff;color:#000;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
Go to Dashboard
</a>
</div>

<p style="color:#9ca3af;font-size:13px;margin:0;">
Need help? Contact <a href="mailto:support@classgrid.in" style="color:#ffffff;text-decoration:none;">support@classgrid.in</a>
</p>

</td>
</tr>

<tr>
<td style="padding:20px;text-align:center;border-top:1px solid #2a2a2a;color:#7a7a7a;font-size:12px;">
© ${new Date().getFullYear()} Classgrid. All rights reserved.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
};

// ───────────── STUDENT WELCOME EMAIL ─────────────
export const getStudentWelcomeEmailHtml = (userName, dashboardUrl) => {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#0f0f0f;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">

<tr>
<td style="padding:30px;border-bottom:1px solid #2a2a2a;text-align:center;">
<img src="${PLATFORM_LOGO_URL}" alt="Classgrid" width="48" height="48" style="display:block;margin:0 auto 16px;">
<h1 style="color:#ffffff;margin:0;font-size:22px;">Welcome to Classgrid</h1>
<p style="color:#9ca3af;margin-top:8px;font-size:13px;">
Ready to start your academic journey
</p>
</td>
</tr>

<tr>
<td style="padding:30px;color:#cccccc;font-size:14px;line-height:1.7;">

<p>Hi <strong>${userName}</strong>,</p>

<p>Your account has been successfully created. You're now ready to begin your academic journey with Classgrid.</p>

<h3 style="color:#ffffff;">How to Join Your Organization</h3>
<ul style="padding-left:20px;">
<li style="margin-bottom:6px;">Enter your <strong>Honor Code</strong> to join your institution directly.</li>
<li style="margin-bottom:6px;">Or enter a <strong>Classroom Code</strong> provided by your subject faculty. Joining just one classroom automatically links you to the entire organization.</li>
<li style="margin-bottom:6px;">Once linked, you can browse and request to join other classrooms within your organization, or join them instantly using a code (no request needed).</li>
<li style="margin-bottom:6px;">You are managed by your organization. You cannot leave, browse, or request to join other organizations.</li>
</ul>

<h3 style="color:#ffffff;margin-top:25px;">What You Can Do</h3>
<ul style="padding-left:20px;">
<li style="margin-bottom:6px;">Access faculty-uploaded notes, classroom announcements, and quizzes (including Google Form links) instantly</li>
<li style="margin-bottom:6px;">Upload your notes to the dedicated student section and share knowledge across your organization</li>
<li style="margin-bottom:6px;">Notes require organization admin approval before visibility</li>
<li style="margin-bottom:6px;">All content is isolated within your organization</li>
<li style="margin-bottom:6px;">View your attendance history and participation (pro plan feature)</li>
<li style="margin-bottom:6px;">Participate in real-time classroom chat</li>
</ul>

<div style="text-align:center;margin:30px 0;">
<a href="${dashboardUrl}" style="background:#ffffff;color:#000;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
Join Classroom
</a>
</div>

<p style="color:#9ca3af;font-size:13px;margin:0;">
Need help? Contact <a href="mailto:support@classgrid.in" style="color:#ffffff;text-decoration:none;">support@classgrid.in</a>
</p>

</td>
</tr>

<tr>
<td style="padding:20px;text-align:center;border-top:1px solid #2a2a2a;color:#7a7a7a;font-size:12px;">
© ${new Date().getFullYear()} Classgrid. All rights reserved.
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
};

// ───────────── LOGIN NOTIFICATION ─────────────
export const getLoginNotificationHtml = (user, provider = "manual") => {
  const config = providerConfig[provider] || providerConfig.manual;
  const content = `
    <h1>New login to your account</h1>
    <p>Hi ${user.name},</p>
    <p>We noticed a new sign-in to your Classgrid account (${user.email}) on ${formatDate()} using ${config.name}.</p>
    <a href="${getFrontendUrl()}/reset-password" class="btn btn-danger">Secure My Account</a>
  `;
  return baseTemplate({
    content,
    title: "New Login Detected",
    ignoreText: "If this was you, you can safely ignore this email."
  });
};

// ───────────── VERIFICATION EMAIL ─────────────
export const getVerificationEmailHtml = (name, verifyLink) => {
  const content = `
    <h1>Verify your email</h1>
    <p>Hi ${name},</p>
    <p>Please verify your email address to complete your setup. This link expires in 24 hours.</p>
    <a href="${verifyLink}" class="btn">Verify Email</a>
  `;
  return baseTemplate({
    content,
    title: "Verify your email",
    ignoreText: "If you did not sign up for Classgrid, please ignore this email."
  });
};

// ───────────── PASSWORD RESET ─────────────
export const getPasswordResetEmailHtml = (resetLink) => {
  const content = `
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your Classgrid account. This link expires in <strong>5 minutes</strong>.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p style="margin-top:20px;font-size:13px;color:#9ca3af;">If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  `;
  return baseTemplate({
    content,
    title: "Password Reset",
    ignoreText: "If you did not request this, please ignore this email. Your password will remain unchanged."
  });
};

// ───────────── FACULTY INVITE ─────────────
export const getFacultyInviteEmailHtml = (facultyName, orgName, verifyLink, orgCode = null) => {
  const codeHtml = orgCode ? `
    <div style="background: #ffffff; color: #111111; margin-bottom: 24px; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
      <div style="color: #111111; font-weight: 600; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Faculty Organization Code</div>
      <div style="color: #111111; font-size: 24px; font-weight: 700; background: #f9f9f9; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #eaeaea; font-family: monospace; letter-spacing: 4px;">${orgCode}</div>
      <p style="margin: 12px 0 0; font-size: 13px; color: #111111;"><strong style="color: #111111;">MANDATORY:</strong> You will be required to enter this code after verifying your email and setting your password to officially join the organization.</p>
    </div>
  ` : '';

  const content = `
    <h1>You've been invited to ${orgName}</h1>
    <p>Hi ${facultyName},</p>
    <p>You have been invited to join <strong>${orgName}</strong> as a faculty member on Classgrid.</p>
    
    <div style="background: #ffffff; color: #111111; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #111111;">Getting Started — Next Steps</p>
      <p style="margin-bottom: 8px; font-size: 14px; color: #111111;">1. Click the button below to activate your Faculty account.</p>
      <p style="margin-bottom: 8px; font-size: 14px; color: #111111;">2. Set your secure password.</p>
      <p style="margin-bottom: 0; font-size: 14px; color: #111111;">3. Enter your <strong style="color: #111111;">Faculty Organization Code</strong> (shown below) on the same page to finalize linking.</p>
    </div>

    ${codeHtml}

    <a href="${verifyLink}" class="btn">Activate your Faculty account</a>
  `;
  return baseTemplate({
    content,
    title: "Faculty Invitation"
  });
};

// ───────────── ORG APPROVAL (New format requested by User) ─────────────
export const getOrgApprovalEmailHtml = (orgName, ownerName, organizationCode, honorCode, facultyLimit, frontendUrl) => {
  const content = `
    <h1>🎉 ${orgName} is now live on Classgrid</h1>
    
    <p>Hi ${ownerName || "Admin"},</p>
    
    <p>Congratulations — your organization has been successfully reviewed and approved. You can now begin onboarding your faculty and students to your official Classgrid workspace.</p>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #ffffff;">🔐 Admin Account Activation</p>
      <p style="margin-bottom: 12px;">You will receive a separate email containing your secure Admin Account activation link.</p>
      <p style="margin-bottom: 8px;">This activation email will:</p>
      <ul style="margin-top: 0; margin-bottom: 16px;">
        <li>Contain a unique, single-use activation link</li>
        <li>Be valid for 5 minutes</li>
        <li>Allow you to securely set your password</li>
        <li>Automatically log you into your Admin Dashboard after activation</li>
      </ul>
      <p style="margin-bottom: 8px; font-weight: 600; color: #ffffff;">For security reasons:</p>
      <ul style="margin-top: 0; margin-bottom: 16px;">
        <li>The activation link can only be used once</li>
        <li>It will expire after the validity period</li>
        <li>It must not be shared with anyone</li>
      </ul>
      <p style="margin-bottom: 0; font-size: 13px; color: #9ca3af;">If your activation link expires, you can request a new one from the Admin Login page.</p>
    </div>

    <h3 style="color:#ffffff; margin-top:32px;">🏫 Your Organization Codes</h3>

    <div class="box" style="margin-bottom: 16px;">
      <div class="meta">Faculty Organization Code</div>
      <div class="code" style="color: #60a5fa;">${organizationCode}</div>
      <p style="margin: 12px 0 4px; font-weight: 500; font-size: 14px; color: #ffffff;">Share this only with faculty members.</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #9ca3af;">This code is required when a faculty member joins your organization.</p>
      <p style="margin: 0; font-size: 14px; color: #ef4444;">Do not share this with students.</p>
    </div>

    <div class="box" style="margin-bottom: 24px;">
      <div class="meta">Student Honor Code</div>
      <div class="code" style="color: #34d399;">${honorCode}</div>
      <p style="margin: 12px 0 4px; font-weight: 500; font-size: 14px; color: #ffffff;">Share this with students.</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #9ca3af;">This allows students to connect directly to your organization without a classroom code.</p>
      <p style="margin: 0; font-size: 14px; color: #9ca3af;">This is not a classroom code.</p>
    </div>

    <h3 style="color:#ffffff; margin-top:32px;">🚀 Getting Started — Next Steps</h3>
    
    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">1️⃣ For Faculty</p>
    <p style="margin-bottom: 12px;">Send faculty invitations from your Admin Dashboard.</p>
    <p style="margin-bottom: 8px;">Each faculty member will:</p>
    <ul style="margin-bottom: 8px;">
      <li>Receive an invitation email</li>
      <li>Verify their account</li>
      <li>Set their password</li>
      <li>Enter the Faculty Organization Code</li>
    </ul>
    <p style="margin-bottom: 24px; font-size: 13px; color: #9ca3af;">After completion → redirected to Faculty Dashboard.</p>

    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">2️⃣ For Students</p>
    <p style="margin-bottom: 8px;">Students can join your organization in two ways:</p>
    <ul style="margin-bottom: 24px;">
      <li style="margin-bottom: 12px;"><strong>Enter the Student Honor Code</strong><br><span style="color: #9ca3af;">→ Directly connect to your organization</span></li>
      <li><strong>Enter a Classroom Code (created by faculty)</strong><br><span style="color: #9ca3af;">→ Join a specific classroom<br>→ Automatically linked to your organization</span></li>
    </ul>

    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">3️⃣ After Joining</p>
    <ul style="margin-bottom: 32px;">
      <li><strong>Faculty</strong> → Redirected to Faculty Dashboard</li>
      <li><strong>Students</strong> → Redirected to Student Dashboard</li>
    </ul>

    <div class="box" style="margin-bottom: 24px; border-left: 3px solid #3b82f6;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #ffffff;">📌 Quick Access Tip</p>
      <p style="margin-bottom: 16px;">Once your admin account is activated and you log in successfully, we recommend bookmarking your Admin Dashboard link in your browser for faster access.</p>
      <p style="margin-bottom: 12px;">Your Admin Dashboard allows you to manage:</p>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #9ca3af; margin-bottom: 16px;">
        <tr>
          <td valign="top" width="40%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Management</strong>
            01 — Overview<br>02 — Faculty<br>03 — Students<br>04 — Classrooms<br>05 — Notes<br>06 — Announcements
          </td>
          <td valign="top" width="30%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Insights</strong>
            07 — Analytics<br>08 — Attendance<br>09 — Billing
          </td>
          <td valign="top" width="30%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Settings</strong>
            10 — Organization<br>11 — Security<br>12 — Role Sandbox
          </td>
        </tr>
      </table>
      
      <p style="margin-bottom: 0; font-size: 13px; color: #9ca3af; font-style: italic;">Bookmarking ensures you can return directly without navigating through the main portal.</p>
    </div>

    <p style="font-size: 14px; color: #9ca3af; margin-bottom: 0;">If you need assistance during setup, our support team is always available at:<br><a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a></p>
  `;
  return baseTemplate({
    content,
    title: "Organization Approved",
    ignoreText: ""
  });
};

// ───────────── ORG ADMIN INVITE (activation token email) ─────────────
export const getOrgAdminInviteHtml = (adminName, orgName, activationLink) => {
  const content = `
    <h1>Activate Your Admin Account</h1>
    <p>Hi ${adminName},</p>
    <p>Your organization <strong>${orgName}</strong> has been approved on Classgrid.</p>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #ffffff;">&#x1F511; Set Up Your Account</p>
      <p style="margin-bottom: 8px;">Click the button below to securely activate your admin account and set your password.</p>
      <p style="margin-bottom: 0; font-size: 13px; color: #9ca3af;">&#x26A0;&#xFE0F; This link is <strong>single-use</strong> and expires in <strong>5 minutes</strong>. Do not share it.</p>
    </div>

    <a href="${activationLink}" class="btn">Activate Admin Account</a>

    <p style="margin-top: 28px; font-size: 13px; color: #9ca3af;">After activation, you can sign in anytime at <a href="${getFrontendUrl()}/admin/login" style="color:#ffffff;">/admin/login</a>.</p>
    <p style="font-size: 13px; color: #9ca3af;">If you did not apply for a Classgrid organization, please contact us at <a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a>.</p>
  `;
  return baseTemplate({
    content,
    title: "Activate Your Admin Account",
    ignoreText: "This link expires in 5 minutes and can only be used once."
  });
};

// ───────────── ADMIN: NEW ORG APPLICATION ─────────────
export const getAdminOrgApplicationNotificationHtml = (data) => {
  const content = `
    <h1>New Application: ${data.institute_name}</h1>
    <p>A new institution has applied and is pending review.</p>
    <ul>
      <li><strong>Owner:</strong> ${data.owner_name}</li>
      <li><strong>Email:</strong> ${data.owner_email}</li>
      <li><strong>Phone:</strong> ${data.phone}</li>
    </ul>
    <a href="${getFrontendUrl()}/superadmin/login" class="btn">Review Application</a>
  `;
  return baseTemplate({
    content,
    title: "New Organization Application"
  });
};

// ───────────── ADMIN: ORG APPROVED (INTERNAL) ─────────────
export const getAdminOrgApprovalNotificationHtml = (orgName, ownerEmail, organizationCode, honorCode, dashboardUrl) => {
  const content = `
    <h1>Organization Approved: ${orgName}</h1>
    <p>The organization (${ownerEmail}) has been approved.</p>
    <ul>
      <li><strong>Faculty Code:</strong> ${organizationCode}</li>
      <li><strong>Student Code:</strong> ${honorCode}</li>
    </ul>
    <a href="${dashboardUrl}" class="btn">View in Admin Panel</a>
  `;
  return baseTemplate({
    content,
    title: "Approval Confirmed"
  });
};

// ───────────── APPLICANT: APP RECEIVED ─────────────
export const getOrgApplicationConfirmationHtml = (ownerName, instituteName, plan = "FREE") => {
  const proPaymentBlock = plan === "PRO" ? `
    <div class="box" style="margin-bottom: 16px; border-left: 3px solid #a855f7;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #171717;">&#128179; Pro Plan — Payment via Razorpay</p>
      <p style="margin-bottom: 8px;">&#x2022; Complete your payment securely via <strong>Razorpay</strong> (UPI, cards, net banking, or wallets).</p>
      <p style="margin-bottom: 8px;">&#x2022; Once payment is confirmed, your <strong>Pro plan will be activated automatically</strong>.</p>
      <p style="margin-bottom: 0;">&#x2022; You will receive a confirmation email with your Pro plan details and dashboard access instructions.</p>
    </div>
  ` : '';

  const content = `
    <h1>Application Received &#128229;</h1>
    <p>Hello ${ownerName},</p>
    <p>Thank you for registering <strong>${instituteName}</strong> on Classgrid${plan === "PRO" ? ' with the <strong>Pro Plan</strong>' : ''}.</p>
    <p>We have successfully received your application. ${plan === "PRO" ? 'Complete your payment to instantly activate your organization.' : 'It is now under review by our platform administration team.'}</p>

    ${proPaymentBlock}

    ${plan === "FREE" ? `
    <div class="box" style="margin-bottom: 16px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #171717;">&#128270; What happens next?</p>
      <p style="margin-bottom: 8px;">&#x2022; Our team will verify your institution details.</p>
      <p style="margin-bottom: 8px;">&#x2022; We perform a security and compliance check.</p>
      <p style="margin-bottom: 0;">&#x2022; Review typically takes <strong>24&#x2013;48 hours</strong>.</p>
    </div>
    ` : ''}

    <p>You will receive another email once your organization is:</p>
    <p style="margin-bottom: 20px;">&#x2705; <strong>Approved and activated</strong></p>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #171717;">&#x1F9ED; After Approval</p>
      <p style="margin-bottom: 8px;">Once approved, you will receive:</p>
      <p style="margin-bottom: 6px;">&#x2022; Your <strong>Faculty Organization Code</strong></p>
      <p style="margin-bottom: 6px;">&#x2022; Your <strong>Student Honor Code</strong></p>
      <p style="margin-bottom: 0;">&#x2022; A link to access your <strong>Admin Dashboard</strong></p>
    </div>

    <p>We appreciate your interest in building a structured digital environment with Classgrid.</p>
    <p style="margin-bottom: 0;">Warm regards,<br><strong>The Classgrid Team</strong></p>
  `;
  return baseTemplate({
    content,
    title: `Application Received \u2014 ${instituteName}`
  });
};

// ───────────── APPLICANT: APP REJECTED ─────────────
export const getOrgRejectionEmailHtml = (ownerName, instituteName, reason = null) => {
  const content = `
    <h1>Application Update</h1>
    <p>Hi ${ownerName},</p>
    <p>We have reviewed your application for <strong>${instituteName}</strong>. Unfortunately, we are unable to approve it at this time.</p>
    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
  `;
  return baseTemplate({
    content,
    title: "Application Status"
  });
};

// ───────────── ADMIN: ACCOUNT ACTIVATED ─────────────
export const getOrgAdminActivatedHtml = (userName, dashboardLink, adminLoginLink) => {
  const content = `
    <h1>Your Admin Account is Activated</h1>
    <p>Hi ${userName},</p>
    <p>Your Organization Admin account on Classgrid is now active. You have full control over your organization.</p>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #171717;">What you can do now:</p>
      <p style="margin-bottom: 8px;">&#x2022; <strong>Create Classrooms</strong> — Set up classrooms and generate classroom codes for students.</p>
      <p style="margin-bottom: 8px;">&#x2022; <strong>Invite Faculty</strong> — Send invitations to faculty members who will teach in your organization.</p>
      <p style="margin-bottom: 8px;">&#x2022; <strong>Monitor Students</strong> — Track student enrollment and activity across classrooms.</p>
      <p style="margin-bottom: 0;">&#x2022; <strong>Manage Organization Settings</strong> — Configure your organization details, codes, and preferences.</p>
    </div>

    <a href="${dashboardLink}" class="btn">Go to Admin Dashboard</a>
  `;
  return baseTemplate({
    content,
    title: "Account Activated"
  });
};

// ───────────── ADMIN: SUPER ADMIN CREATED ─────────────
export const getSuperAdminCredentialsHtml = (name, email, password, loginLink) => {
  const content = `
    <h1>You have been assigned Super Admin access</h1>
    <p>Hi ${name},</p>
    <p>You have been granted elevated, platform-wide privileges on Classgrid. You are responsible for reviewing and approving organization applications, managing platform settings, and overseeing all activity across the system.</p>

    <div class="box" style="margin-bottom: 12px;">
      <div class="meta">Email</div>
      <p style="font-weight: 600; color: #171717; margin-bottom: 0;">${email}</p>
    </div>
    <div class="box" style="margin-bottom: 24px;">
      <div class="meta">Temporary Password</div>
      <p class="code" style="margin-bottom: 4px;">${password}</p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #dc2626; font-weight: 500;">&#x26A0;&#xFE0F; Change this password immediately after logging in. Do not share it.</p>
    </div>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #171717;">Your platform-level controls include:</p>
      <p style="margin-bottom: 8px;">&#x2022; Review and approve or reject organization applications.</p>
      <p style="margin-bottom: 8px;">&#x2022; Manage all registered organizations and their admin accounts.</p>
      <p style="margin-bottom: 0;">&#x2022; Monitor platform-wide activity and system health.</p>
    </div>

    <a href="${loginLink}" class="btn">Login to Super Admin Dashboard</a>
  `;
  return baseTemplate({
    content,
    title: "Super Admin Access"
  });
};

// ───────────── ORG DELETE VERIFICATION ─────────────
export const getOrgDeleteVerificationEmailHtml = (orgName, ownerName, verifyLink) => {
  const content = `
    <h1>Confirm Organization Deletion</h1>
    <p>Hi ${ownerName},</p>
    <p>We received a request to permanently delete <strong>${orgName}</strong>.</p>
    
    <div class="box">
      <p style="margin-bottom: 8px;"><strong>This will permanently delete:</strong></p>
      <ul style="margin-bottom: 0;">
        <li>All classrooms and student data</li>
        <li>All faculty accounts</li>
        <li>Stored materials and organization settings</li>
      </ul>
    </div>
    
    <p>This action is irreversible. This link expires in 30 minutes.</p>
    <a href="${verifyLink}" class="btn btn-danger">Permanently Delete</a>
  `;
  return baseTemplate({
    content,
    title: "Confirm Deletion",
    ignoreText: "If you did not request this, please secure your account immediately."
  });
};

// ───────────── PLAN ACTIVATION ─────────────
export const getPlanActivationHtml = (planName, activationDate, expiryDate, studentLimit, userName = 'User', planDuration = 31) => {
  const dashboardUrl = `${getFrontendUrl()}/admin/login`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Classgrid PRO Activated</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
<tr>
<td align="center">

<!-- Main Container -->
<table width="600" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">

<!-- Header -->
<tr>
<td style="padding:30px;text-align:center;border-bottom:1px solid #2a2a2a;">
<img src="${PLATFORM_LOGO_URL}" alt="Classgrid" width="48" height="48" style="display:block;margin:0 auto 16px;">
<h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:600;">
🎉 Your PRO Plan is Now Active
</h1>
<p style="margin:10px 0 0;font-size:13px;color:#9ca3af;">
Payment confirmed — premium features unlocked
</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:30px;">

<p style="font-size:15px;color:#e5e5e5;margin:0 0 18px;">
Dear <strong>${userName}</strong>,
</p>

<p style="font-size:14px;color:#bdbdbd;line-height:1.7;margin:0 0 25px;">
Great news! Your payment has been <strong style="color:#34d399;">successfully verified</strong> and your 
<strong style="color:#ffffff;">Classgrid ${planName} Plan</strong> is now active.
All premium features have been unlocked for your organization.
</p>

<!-- Subscription Details -->
<table width="100%" cellpadding="0" cellspacing="0" 
style="background:#111111;border:1px solid #2a2a2a;border-radius:10px;padding:20px;">
<tr>
<td>

<h3 style="margin:0 0 15px;font-size:15px;color:#ffffff;">
📋 Subscription Details
</h3>

<table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#cccccc;">
<tr>
<td><strong style="color:#9ca3af;">Plan Name</strong></td>
<td align="right" style="color:#a855f7;font-weight:600;">${planName}</td>
</tr>
<tr>
<td><strong style="color:#9ca3af;">Activation Date</strong></td>
<td align="right">${formatDate(activationDate)}</td>
</tr>
<tr>
<td><strong style="color:#9ca3af;">Expiry Date</strong></td>
<td align="right">${formatDate(expiryDate)}</td>
</tr>
<tr>
<td><strong style="color:#9ca3af;">Plan Duration</strong></td>
<td align="right">${planDuration} Days</td>
</tr>
<tr>
<td><strong style="color:#9ca3af;">Student Capacity</strong></td>
<td align="right">Up to ${studentLimit} Students</td>
</tr>
</table>

</td>
</tr>
</table>

<!-- PRO Features Unlocked -->
<table width="100%" cellpadding="0" cellspacing="0" 
style="background:#111111;border:1px solid #2a2a2a;border-radius:10px;padding:20px;margin-top:20px;">
<tr>
<td>

<h3 style="margin:0 0 15px;font-size:15px;color:#ffffff;">
⚡ PRO Features Now Unlocked
</h3>

<table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;color:#cccccc;">
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">150 Student Capacity</strong> — Expanded from 60</td>
</tr>
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">Smart Attendance</strong> — Live sessions, daily/weekly/monthly reports</td>
</tr>
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">Advanced Analytics</strong> — Student performance, engagement trends</td>
</tr>
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">10 Faculty Members</strong> — Expanded from 5</td>
</tr>
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">5 Classrooms per Faculty</strong> — Expanded from 2</td>
</tr>
<tr>
<td style="padding:4px 0;">✅ <strong style="color:#ffffff;">Priority Support</strong> — Faster response times</td>
</tr>
</table>

</td>
</tr>
</table>

<!-- Getting Started -->
<table width="100%" cellpadding="0" cellspacing="0" 
style="background:#0d1117;border:1px solid #1a3a5c;border-left:3px solid #3b82f6;border-radius:10px;padding:20px;margin-top:20px;">
<tr>
<td>

<h3 style="margin:0 0 15px;font-size:15px;color:#ffffff;">
🚀 How to Get Started
</h3>

<table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;color:#cccccc;">
<tr>
<td style="padding:6px 0;"><strong style="color:#60a5fa;">Step 1:</strong> Log in to your <strong style="color:#ffffff;">Organization Admin Dashboard</strong></td>
</tr>
<tr>
<td style="padding:6px 0;"><strong style="color:#60a5fa;">Step 2:</strong> Go to <strong style="color:#ffffff;">02 — Faculty</strong> section to invite your faculty members</td>
</tr>
<tr>
<td style="padding:6px 0;"><strong style="color:#60a5fa;">Step 3:</strong> Share your <strong style="color:#ffffff;">Student Honor Code</strong> with students (found in Overview)</td>
</tr>
<tr>
<td style="padding:6px 0;"><strong style="color:#60a5fa;">Step 4:</strong> Faculty creates classrooms → students join using classroom codes</td>
</tr>
<tr>
<td style="padding:6px 0;"><strong style="color:#60a5fa;">Step 5:</strong> Access <strong style="color:#ffffff;">07 — Analytics</strong> and <strong style="color:#ffffff;">08 — Attendance</strong> (PRO features!)</td>
</tr>
</table>

</td>
</tr>
</table>

<p style="font-size:13px;color:#9ca3af;margin-top:20px;">
Your PRO plan remains active for ${planDuration} days from the activation date.  
Please renew before expiry to maintain uninterrupted access.
</p>

<!-- CTA Buttons -->
<div style="text-align:center;margin:30px 0;">
<a href="${dashboardUrl}"
style="background:#ffffff;color:#000000;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;display:inline-block;">
Open Admin Dashboard
</a>
</div>

<div style="text-align:center;margin-bottom:20px;">
<a href="${getFrontendUrl()}"
style="background:transparent;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:500;display:inline-block;border:1px solid #2a2a2a;">
Visit Classgrid
</a>
</div>

<p style="font-size:14px;color:#bdbdbd;margin:0;">
Need assistance?  
</p>

<p style="font-size:14px;margin:5px 0 0;">
<a href="mailto:support@classgrid.in" style="color:#ffffff;text-decoration:none;">
support@classgrid.in
</a>
</p>

<p style="font-size:14px;color:#e5e5e5;margin-top:30px;">
Best regards,<br>
<strong>The Classgrid Team</strong>
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px;text-align:center;border-top:1px solid #2a2a2a;font-size:12px;color:#7a7a7a;">
© ${new Date().getFullYear()} Classgrid. All rights reserved.<br>
support@classgrid.in
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
};

export const getPlanActivationPlainText = (planName, activationDate, expiryDate, studentLimit, userName = 'User', planDuration = 31) => {
  return `🎉 Your Classgrid PRO Plan is Now Active

Payment confirmed — premium features unlocked

Dear ${userName},

Great news! Your payment has been successfully verified and your Classgrid ${planName} Plan is now active. All premium features have been unlocked for your organization.

--- SUBSCRIPTION DETAILS ---
Plan Name: ${planName}
Activation Date: ${formatDate(activationDate)}
Expiry Date: ${formatDate(expiryDate)}
Plan Duration: ${planDuration} Days
Student Capacity: Up to ${studentLimit} Students

--- PRO FEATURES NOW UNLOCKED ---
✅ 150 Student Capacity — Expanded from 60
✅ Smart Attendance — Live sessions, daily/weekly/monthly reports
✅ Advanced Analytics — Student performance, engagement trends
✅ 10 Faculty Members — Expanded from 5
✅ 5 Classrooms per Faculty — Expanded from 2
✅ Priority Support — Faster response times

--- HOW TO GET STARTED ---
Step 1: Log in to your Organization Admin Dashboard
Step 2: Go to "02 — Faculty" section to invite your faculty members
Step 3: Share your Student Honor Code with students (found in Overview)
Step 4: Faculty creates classrooms → students join using classroom codes
Step 5: Access "07 — Analytics" and "08 — Attendance" (PRO features!)

Your PRO plan remains active for ${planDuration} days from the activation date. Please renew before expiry to maintain uninterrupted access.

Open Admin Dashboard: ${getFrontendUrl()}/admin/login
Visit Classgrid: ${getFrontendUrl()}

Need assistance?
support@classgrid.in

Best regards,
The Classgrid Team

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};


// ───────────── PLAIN TEXT FALLBACKS ─────────────

export const getFacultyWelcomePlainText = (userName, orgName, dashboardUrl) => {
  return `Welcome to Classgrid

Organization: ${orgName}

Hi ${userName},

Your faculty account has been successfully created. You're now ready to manage classrooms, deliver structured academic content, and engage students professionally.

--- Structured Content Delivery ---
- Upload PDFs, documents, and study material to specific classrooms
- Control student contributions through approval workflows
- Notes remain isolated within your organization
- Files securely stored via Supabase with signed URLs

--- Smart Attendance (Pro Plan) ---
- Start/stop attendance sessions inside classroom
- Daily, weekly, and monthly attendance reports
- Students track their attendance history

--- Real-Time Classroom Chat ---
- Live academic discussions
- Faculty moderation tools
- Online activity visibility

Go to Dashboard: ${dashboardUrl}

Need help? Contact support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getStudentWelcomePlainText = (userName, dashboardUrl) => {
  return `Welcome to Classgrid

Ready to start your academic journey

Hi ${userName},

Your account has been successfully created. You're now ready to begin your academic journey with Classgrid.

--- How to Join Your Organization ---
- Enter your Honor Code to join your institution directly.
- Or enter a Classroom Code provided by your subject faculty. Joining just one classroom automatically links you to the entire organization.
- Once linked, you can browse and request to join other classrooms within your organization, or join them instantly using a code (no request needed).
- You are managed by your organization. You cannot leave, browse, or request to join other organizations.

--- What You Can Do ---
- Access faculty-uploaded notes instantly
- Upload peer notes to a dedicated student section
- Notes require faculty approval before visibility
- All content is isolated within your organization
- View your attendance history and participation
- Participate in real-time classroom chat

Join Classroom: ${dashboardUrl}

Need help? Contact support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getLoginNotificationPlainText = (user, provider = "manual") => {
  const config = providerConfig[provider] || providerConfig.manual;
  return `New login to your account

Hi ${user.name},
We noticed a new sign-in to your Classgrid account (${user.email}) on ${formatDate()} using ${config.name}.

Secure My Account: ${getFrontendUrl()}/reset-password

If this was you, you can safely ignore this email.

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getVerificationEmailPlainText = (name, verifyLink) => {
  return `Verify your email

Hi ${name},
Please verify your email address to complete your setup. This link expires in 24 hours.

Verify Email: ${verifyLink}

If you did not sign up for Classgrid, please ignore this email.

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getPasswordResetEmailPlainText = (resetLink) => {
  return `Reset your password

We received a request to reset the password for your Classgrid account. This link expires in 5 minutes.

Reset Password: ${resetLink}

If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getFacultyInviteEmailPlainText = (facultyName, orgName, verifyLink, orgCode = null) => {
  return `You've been invited to join ${orgName}

Hi ${facultyName},
You have been invited to join ${orgName} as a faculty member on Classgrid.

--- GETTING STARTED — NEXT STEPS ---

1. Click the link below to activate your Faculty account.
2. Set your secure password and enter your Faculty Organization Code on the same page.
3. Once activated, you will be redirected to your Faculty Dashboard.

${orgCode ? `--- YOUR ORGANIZATION CODE ---\n\nFaculty Organization Code: ${orgCode}\n(MANDATORY: You will be required to enter this code after setting your password. Do not share with students.)\n\n` : ''}--- VERIFY YOUR ACCOUNT ---

Activate your Faculty account: ${verifyLink}
(This link expires in 5 minutes.)

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgApprovalEmailPlainText = (orgName, ownerName, organizationCode, honorCode, facultyLimit, frontendUrl) => {
  return `🎉 ${orgName} is now live on Classgrid

Hi ${ownerName || "Admin"},

Congratulations — your organization has been successfully reviewed and approved. You can now begin onboarding your faculty and students to your official Classgrid workspace.

🔐 Admin Account Activation

You will receive a separate email containing your secure Admin Account activation link.

This activation email will:
• Contain a unique, single-use activation link
• Be valid for 5 minutes
• Allow you to securely set your password
• Automatically log you into your Admin Dashboard after activation

For security reasons:
• The activation link can only be used once
• It will expire after the validity period
• It must not be shared with anyone

If your activation link expires, you can request a new one from the Admin Login page.

🏫 Your Organization Codes

Faculty Organization Code: ${organizationCode}
Share this only with faculty members.
This code is required when a faculty member joins your organization.
Do not share this with students.

Student Honor Code: ${honorCode}
Share this with students.
This allows students to connect directly to your organization without a classroom code.
This is not a classroom code.

🚀 Getting Started — Next Steps

1️⃣ For Faculty
Send faculty invitations from your Admin Dashboard.
Each faculty member will:
• Receive an invitation email
• Verify their account
• Set their password
• Enter the Faculty Organization Code
After completion → redirected to Faculty Dashboard.

2️⃣ For Students
Students can join your organization in two ways:
• Enter the Student Honor Code
  → Directly connect to your organization
• Enter a Classroom Code (created by faculty)
  → Join a specific classroom
  → Automatically linked to your organization

3️⃣ After Joining
• Faculty → Redirected to Faculty Dashboard
• Students → Redirected to Student Dashboard

📌 Quick Access Tip
Once your admin account is activated and you log in successfully, we recommend bookmarking your Admin Dashboard link in your browser for faster access.

Your Admin Dashboard allows you to manage:

Management
01 — Overview
02 — Faculty
03 — Students
04 — Classrooms
05 — Notes
06 — Announcements

Insights
07 — Analytics
08 — Attendance
09 — Billing

Settings
10 — Organization
11 — Security
12 — Role Sandbox

Bookmarking ensures you can return directly without navigating through the main portal.

If you need assistance during setup, our support team is always available at:
support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgAdminInvitePlainText = (adminName, orgName, activationLink) => {
  return `Activate Your Admin Account

Hi ${adminName},

Your organization "${orgName}" has been approved on Classgrid.

To activate your account and set your password, visit the link below:

Activation Link: ${activationLink}

IMPORTANT:
- This link is single-use and expires in 5 minutes.
- Do not share this link with anyone.
- After activation, you can sign in anytime at: ${getFrontendUrl()}/admin/login

If you did not apply for a Classgrid organization, please contact us at support@classgrid.in.

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getAdminOrgApplicationNotificationPlainText = (data) => {
  return `New Application: ${data.institute_name}

Owner: ${data.owner_name}
Email: ${data.owner_email}
Phone: ${data.phone}

Review Application: ${getFrontendUrl()}/superadmin/login

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getAdminOrgApprovalNotificationPlainText = (orgName, ownerEmail, organizationCode, honorCode, dashboardUrl) => {
  return `Organization Approved: ${orgName}

Faculty Code: ${organizationCode}
Student Code: ${honorCode}

View in Admin Panel: ${dashboardUrl}

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgApplicationConfirmationPlainText = (ownerName, instituteName, plan = "FREE") => {
  const proBlock = plan === "PRO" ? `\nPro Plan — Payment via Razorpay:\n  - Complete your payment securely via Razorpay (UPI, cards, net banking, or wallets).\n  - Once payment is confirmed, your Pro plan will be activated automatically.\n  - You will receive a confirmation email with your Pro plan details and dashboard access instructions.\n` : '';

  return `Application Received — ${instituteName}

Hello ${ownerName},

Thank you for registering ${instituteName} on Classgrid${plan === "PRO" ? ' with the Pro Plan' : ''}.

We have successfully received your application. ${plan === "PRO" ? 'Complete your payment to instantly activate your organization.' : 'It is now under review by our platform administration team.'}
${proBlock}
${plan === "FREE" ? `What happens next?
  - Our team will verify your institution details.
  - We perform a security and compliance check.
  - Review typically takes 24-48 hours.
` : ''}
You will receive another email once your organization is:
  [OK] Approved and activated

After Approval, you will receive:
  - Your Faculty Organization Code
  - Your Student Honor Code
  - A link to access your Admin Dashboard

We appreciate your interest in building a structured digital environment with Classgrid.

Warm regards,
The Classgrid Team

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgRejectionEmailPlainText = (ownerName, instituteName, reason = null) => {
  return `Application Update

Hi ${ownerName},
We have reviewed your application for ${instituteName}. Unfortunately, we are unable to approve it at this time.
${reason ? `\nReason: ${reason}\n` : ''}
For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgAdminActivatedPlainText = (userName, dashboardLink, adminLoginLink) => {
  return `Your Admin Account is Activated

Hi ${userName},
Your Organization Admin account on Classgrid is now active.

What you can do now:
- Create Classrooms — Set up classrooms and generate classroom codes.
- Invite Faculty — Send invitations to faculty members.
- Monitor Students — Track enrollment and activity across classrooms.
- Manage Settings — Configure your organization details and codes.

Go to Admin Dashboard: ${dashboardLink}

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getSuperAdminCredentialsPlainText = (name, email, password, loginLink) => {
  return `You have been assigned Super Admin access

Hi ${name},
You have been granted elevated, platform-wide privileges on Classgrid.

Your login credentials:
Email: ${email}
Temporary Password: ${password}

⚠ IMPORTANT: Change your password immediately after logging in. Do not share it.

Your platform-level controls include:
- Review and approve or reject organization applications.
- Manage all registered organizations and their admin accounts.
- Monitor platform-wide activity and system health.

Login to Super Admin Dashboard: ${loginLink}

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getOrgDeleteVerificationEmailPlainText = (orgName, ownerName, verifyLink) => {
  return `
URGENT: Organization Deletion Request

Hi ${ownerName},

You have requested to delete the organization "${orgName}". This action is irreversible.

To confirm deletion, click the link below within the next 15 minutes:
${verifyLink}

If you did not request this, please ignore this email.

— The Classgrid Team
support@classgrid.in
  `.trim();
};

// ───────────── CLASSROOM ACTIVITY NOTIFICATION ─────────────
export const getClassroomActivityEmailHtml = ({ orgName, classroomName, facultyName, contentType, title, preview, classroomUrl }) => {
  const typeLabels = { announcements: "Announcement", materials: "Notes", quizzes: "Quiz" };
  const typeEmojis = { announcements: "📢", materials: "📄", quizzes: "📝" };
  const label = typeLabels[contentType] || "Update";
  const emoji = typeEmojis[contentType] || "🔔";

  const content = `
  <h1>${emoji} New ${label} in ${classroomName}</h1>
    <p>Hi there,</p>
    <p>New content has been posted in your classroom.</p>

    <div class="box">
      <div class="meta">Organization</div>
      <p style="margin-bottom: 12px;">${orgName}</p>
      <div class="meta">Classroom</div>
      <p style="margin-bottom: 12px;">${classroomName}</p>
      <div class="meta">Posted by</div>
      <p style="margin-bottom: 12px;">${facultyName}</p>
      <div class="meta">${label}</div>
      ${(title && title !== (preview || '').substring(0, 80) && title !== 'New Announcement') ? `<p style="margin-bottom: 0; font-weight: 600;">${title}</p>` : ''}
      ${preview ? `<p style="margin-top: 8px; margin-bottom: 0; color: #525252; font-size: 14px;">${preview}</p>` : ''}
    </div>

    <a href="${classroomUrl}" class="btn">Open in Classroom</a>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">To manage email notifications, visit <a href="${getFrontendUrl()}/settings" style="color: #ffffff; font-weight: 600; text-decoration: underline;">Settings</a>.</p>
`;
  return baseTemplate({
    content,
    title: `New ${label} — ${classroomName} `
  });
};

export const getClassroomActivityEmailPlainText = ({ orgName, classroomName, facultyName, contentType, title, preview, classroomUrl }) => {
  const typeLabels = { announcements: "Announcement", materials: "Notes", quizzes: "Quiz" };
  const label = typeLabels[contentType] || "Update";
  return `New ${label} in ${classroomName}

Organization: ${orgName}
Classroom: ${classroomName}
Posted by: ${facultyName}
${label}: ${title}
${preview ? `\nPreview: ${preview}\n` : ''}
Open in Classroom: ${classroomUrl}

To manage email notifications, visit: ${getFrontendUrl()}/settings

For contact, mail us at: support @classgrid.in

© ${new Date().getFullYear()} Classgrid.All rights reserved.`;
};

// ───────────── JOIN REQUEST NOTIFICATION (to Faculty) ─────────────
export const getJoinRequestEmailHtml = ({ studentName, classroomName, reviewUrl }) => {
  const content = `
  <h1>New Join Request</h1>
    <p>Hi,</p>
    <p><strong>${studentName}</strong> has requested to join <strong>${classroomName}</strong>.</p>
    <p>You can approve or reject this request from your dashboard.</p>
    <a href="${reviewUrl}" class="btn">Review Request</a>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">To manage email notifications, visit <a href="${getFrontendUrl()}/settings" style="color: #ffffff; font-weight: 600; text-decoration: underline;">Settings</a>.</p>
`;
  return baseTemplate({
    content,
    title: `Join Request — ${classroomName} `
  });
};

export const getJoinRequestEmailPlainText = ({ studentName, classroomName, reviewUrl }) => {
  return `New Join Request

${studentName} has requested to join ${classroomName}.
Approve or reject from your dashboard.

Review Request: ${reviewUrl}

To manage email notifications, visit: ${getFrontendUrl()}/settings

For contact, mail us at: support @classgrid.in

© ${new Date().getFullYear()} Classgrid.All rights reserved.`;
};

// ───────────── JOIN APPROVED NOTIFICATION (to Student) ─────────────
export const getJoinApprovedEmailHtml = ({ classroomName, classroomUrl }) => {
  const content = `
  <h1>You're In! 🎉</h1>
    <p>Your request to join <strong>${classroomName}</strong> has been approved.</p>
    <p>You can now access all classroom materials, announcements, and quizzes.</p>
    <a href="${classroomUrl}" class="btn">Open Classroom</a>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">To manage email notifications, visit <a href="${getFrontendUrl()}/settings" style="color: #ffffff; font-weight: 600; text-decoration: underline;">Settings</a>.</p>
`;
  return baseTemplate({
    content,
    title: `Joined — ${classroomName} `
  });
};

export const getJoinApprovedEmailPlainText = ({ classroomName, classroomUrl }) => {
  return `You're In!

Your request to join ${classroomName} has been approved.
You can now access all classroom materials, announcements, and quizzes.

Open Classroom: ${classroomUrl}

To manage email notifications, visit: ${getFrontendUrl()}/settings

For contact, mail us at: support @classgrid.in

© ${new Date().getFullYear()} Classgrid.All rights reserved.`;
};

// ───────────── ATTENDANCE STARTED NOTIFICATION (to Students) ─────────────
export const getAttendanceStartedEmailHtml = ({ classroomName, facultyName, classroomUrl }) => {
  const content = `
    <h1>📋 Attendance is Open!</h1>
    <p>Hi there,</p>
    <p>Your instructor has started an attendance session. You have <strong>4 minutes</strong> to mark your attendance.</p>

    <div class="box">
      <div class="meta">Classroom</div>
      <p style="margin-bottom: 12px;">${classroomName}</p>
      <div class="meta">Started by</div>
      <p style="margin-bottom: 0;">${facultyName}</p>
    </div>

    <a href="${classroomUrl}" class="btn" style="background: #00c896;">Mark Attendance Now</a>
    <p style="font-size: 13px; color: #737373; margin-top: 24px;">This session expires in 4 minutes. Act quickly!</p>
`;
  return baseTemplate({
    content,
    title: `Attendance Active — ${classroomName}`
  });
};

export const getAttendanceStartedEmailPlainText = ({ classroomName, facultyName, classroomUrl }) => {
  return `Attendance is Open — ${classroomName}

Your instructor ${facultyName} has started an attendance session.
You have 4 MINUTES to mark your attendance.

Mark Attendance Now: ${classroomUrl}

This session expires in 4 minutes. Act quickly!

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ───────────── ABSENCE NOTIFICATION (to Students) ─────────────
export const getAbsenceNotificationEmailHtml = ({ classroomName, sessionDate, classroomUrl }) => {
  const content = `
    <h1>📌 You Were Marked Absent</h1>
    <p>Hi there,</p>
    <p>You were absent from the attendance session in <strong>${classroomName}</strong>.</p>

    <div class="box">
      <div class="meta">Classroom</div>
      <p style="margin-bottom: 12px;">${classroomName}</p>
      <div class="meta">Session Date</div>
      <p style="margin-bottom: 0;">${sessionDate}</p>
    </div>

    <p style="font-size: 13px; color: #737373; margin-top: 16px;">If you believe this is an error, contact your instructor. Keep your attendance above 75% to avoid being flagged as a defaulter.</p>
    <a href="${classroomUrl}" class="btn">View Classroom</a>
`;
  return baseTemplate({
    content,
    title: `Absent — ${classroomName}`
  });
};

export const getAbsenceNotificationEmailPlainText = ({ classroomName, sessionDate, classroomUrl }) => {
  return `You Were Marked Absent — ${classroomName}

You were absent from the attendance session on ${sessionDate}.

Classroom: ${classroomName}

If you believe this is an error, contact your instructor.

View Classroom: ${classroomUrl}

For contact, mail us at: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ─────────────────────────────────────────────────
// DIGEST EMAIL TEMPLATES
// ─────────────────────────────────────────────────

const typeLabels = {
  new_content: "📄 New Content",
  content_update: "📝 Content Update",
  request_approved: "✅ Request Approved",
  request_rejected: "❌ Request Rejected",
  system: "🔔 System",
};

export const getDailyDigestEmailHtml = ({ userName, notifications, grouped, totalCount, settingsUrl, frontendUrl, isWeekly = false }) => {
  const period = isWeekly ? "Weekly" : "Daily";

  let notifRows = "";
  for (const [type, items] of Object.entries(grouped)) {
    const label = typeLabels[type] || "🔔 Notification";
    notifRows += `
  <tr><td colspan="2" style="padding:12px 0 4px; font-weight:600; color:#1e293b; font-size:14px;">${label} (${items.length})</td></tr>`;
    for (const n of items.slice(0, 10)) {
      const time = new Date(n.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
      const link = n.link ? `${frontendUrl}${n.link} ` : "#";
      notifRows += `
  <tr>
      <td style="padding:6px 0; color:#475569; font-size:13px; border-bottom:1px solid #f1f5f9;">
        <a href="${link}" style="color:#2563eb; text-decoration:none; font-weight:500;">${n.title}</a>
        <div style="color:#94a3b8; font-size:12px; margin-top:2px;">${n.message?.substring(0, 100) || ""}</div>
      </td>
      <td style="padding:6px 0; color:#94a3b8; font-size:11px; text-align:right; white-space:nowrap; border-bottom:1px solid #f1f5f9; vertical-align:top;">${time}</td>
    </tr>`;
    }
    if (items.length > 10) {
      notifRows += `<tr><td colspan="2" style="padding:4px 0; color:#94a3b8; font-size:12px;">...and ${items.length - 10} more</td></tr>`;
    }
  }

  return baseTemplate({
    title: `${period} Summary`,
    content: `
  <p style="margin:0 0 6px; font-size:15px; color:#1e293b;">Hi <strong>${userName}</strong>,</p>
    <p style="margin:0 0 20px; color:#64748b; font-size:14px; line-height:1.5;">
      Here's your ${period.toLowerCase()} summary — <strong>${totalCount}</strong> notification${totalCount > 1 ? "s" : ""} since your last digest.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${notifRows}
    </table>
    <div style="text-align:center; margin:24px 0;">
      <a href="${frontendUrl}/classroom" style="display:inline-block; padding:12px 28px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px;">Open Dashboard</a>
    </div>
    <p style="margin:16px 0 0; color:#94a3b8; font-size:12px; text-align:center;">
      <a href="${settingsUrl}" style="color:#64748b; text-decoration:underline;">Change delivery preferences</a>
    </p>`,
    ignoreText: "You received this because your delivery mode is set to " + period.toLowerCase() + ".",
  });
};

export const getDailyDigestEmailPlainText = ({ userName, notifications, totalCount, settingsUrl, isWeekly = false }) => {
  const period = isWeekly ? "Weekly" : "Daily";
  let lines = [`Hi ${userName}, \n`, `Your ${period.toLowerCase()} summary — ${totalCount} notification${totalCount > 1 ? "s" : ""}: \n`];

  for (const n of notifications.slice(0, 20)) {
    const time = new Date(n.createdAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
    lines.push(`• ${n.title}: ${n.message?.substring(0, 80) || ""} (${time})`);
  }
  if (totalCount > 20) lines.push(`\n...and ${totalCount - 20} more`);

  lines.push(`\nOpen Dashboard: ${getFrontendUrl()}/classroom`);
  lines.push(`Change preferences: ${settingsUrl}`);
  lines.push(`\n© ${new Date().getFullYear()} Classgrid. All rights reserved.`);

  return lines.join("\n");
};

// ───────────── PLAN EXPIRY REMINDER ─────────────
export const getPlanExpiryReminderHtml = (orgName, ownerName, planName, expiryDate, daysRemaining) => {
  const urgencyColor = daysRemaining <= 0 ? '#ef4444' : daysRemaining <= 1 ? '#f59e0b' : '#f59e0b';
  const statusText = daysRemaining <= 0 ? 'has expired' : `expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  const dashboardUrl = `${getFrontendUrl()}/admin/login`;

  const content = `
    <h1 style="color:${urgencyColor};">⚠️ Plan ${daysRemaining <= 0 ? 'Expired' : 'Expiring Soon'}</h1>
    <p>Dear ${ownerName},</p>
    <p>Your <strong>${planName}</strong> plan for <strong>${orgName}</strong> ${statusText}.</p>
    
    <div class="box" style="border-left: 3px solid ${urgencyColor}; margin-bottom: 24px;">
      <div class="meta">Plan</div>
      <p style="font-weight: 600; margin-bottom: 8px;">${planName}</p>
      <div class="meta">Expiry Date</div>
      <p style="font-weight: 600; margin-bottom: 0;">${formatDate(expiryDate)}</p>
    </div>

    ${daysRemaining <= 0
      ? `<div class="box" style="border-left: 3px solid #ef4444; margin-bottom: 24px;">
          <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">🚫 Features Now Restricted</p>
          <p style="margin-bottom: 4px;">Your organization has been downgraded to the <strong>FREE</strong> plan (60 students max).</p>
          <p style="margin-bottom: 4px;">The following PRO features are no longer available:</p>
          <ul style="margin-top: 8px;">
            <li>150 student capacity → reduced to 60</li>
            <li>Advanced analytics</li>
            <li>Smart attendance</li>
            <li>10 faculty slots → reduced to 5</li>
            <li>5 classrooms → reduced to 3</li>
          </ul>
        </div>`
      : `<p>To avoid any service interruption, please renew your plan before it expires.</p>
         <div class="box" style="margin-bottom: 24px;">
          <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">🔒 Features at Risk</p>
          <p style="margin-bottom: 4px;">If not renewed, you will lose access to:</p>
          <ul style="margin-top: 8px;">
            <li>150 student capacity</li>
            <li>Advanced analytics & smart attendance</li>
            <li>10 faculty slots & 5 classrooms</li>
          </ul>
        </div>`
    }

    <a href="${dashboardUrl}" class="btn">🔄 Renew Now — Log in to Dashboard</a>

    <p style="margin-top: 24px; font-size: 13px; color: #9ca3af;">Log in to your Admin Dashboard and click <strong>"Upgrade to Pro"</strong> to renew via Razorpay Checkout. Renewal is instant.</p>
    <p style="font-size: 13px; color: #9ca3af;">Need help? Contact us at <a href="mailto:support@classgrid.in" style="color:#ffffff; font-weight:500;">support@classgrid.in</a>.</p>
  `;
  return baseTemplate({
    content,
    title: `Plan ${daysRemaining <= 0 ? 'Expired' : 'Expiry Reminder'}`
  });
};

export const getPlanExpiryReminderPlainText = (orgName, ownerName, planName, expiryDate, daysRemaining) => {
  const statusText = daysRemaining <= 0 ? 'has expired' : `expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
  const dashboardUrl = `${getFrontendUrl()}/admin/login`;
  return `Plan ${daysRemaining <= 0 ? 'Expired' : 'Expiry Reminder'}

Dear ${ownerName},

Your ${planName} plan for ${orgName} ${statusText}.

Plan: ${planName}
Expiry Date: ${formatDate(expiryDate)}

${daysRemaining <= 0
      ? 'Your organization has been downgraded to FREE plan (60 students max). PRO features are no longer available.'
      : 'To avoid any service interruption, please renew your plan before it expires.'
    }

Renew now: ${dashboardUrl}
Log in and click "Upgrade to Pro" to renew via Razorpay Checkout.

Need help? Contact us at support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ───────────── CONSOLIDATED APPROVAL + ACTIVATION + PLAN EMAIL ─────────────
// Merges: getOrgApprovalEmailHtml + getOrgAdminInviteHtml + getPlanActivationHtml
// Sent as ONE email when a super admin approves an organization.
// PRO: includes subscription details table. FREE: shows capacity only.
// Original wording from all three templates is preserved verbatim.
export const getConsolidatedApprovalEmailHtml = ({
  adminName,
  orgName,
  organizationCode,
  honorCode,
  plan = "FREE",
  studentLimit,
  activationLink,
  activationDate,
  expiryDate,
  planDuration = 31,
}) => {
  const isPro = plan === "PRO";

  // PRO: full subscription details table (from getPlanActivationHtml, verbatim)
  const proSubscriptionBlock = isPro ? `
    <h3 style="color:#ffffff; margin-top:32px;">Subscription Details</h3>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#111111;border:1px solid #2a2a2a;border-radius:10px;margin-bottom:20px;">
      <tr>
        <td style="padding:20px;">
          <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#cccccc;">
            <tr>
              <td><strong style="color:#9ca3af;">Plan Name</strong></td>
              <td align="right">${plan}</td>
            </tr>
            <tr>
              <td><strong style="color:#9ca3af;">Activation Date</strong></td>
              <td align="right">${formatDate(activationDate)}</td>
            </tr>
            <tr>
              <td><strong style="color:#9ca3af;">Expiry Date</strong></td>
              <td align="right">${formatDate(expiryDate)}</td>
            </tr>
            <tr>
              <td><strong style="color:#9ca3af;">Plan Duration</strong></td>
              <td align="right">${planDuration} Days</td>
            </tr>
            <tr>
              <td><strong style="color:#9ca3af;">Student Capacity</strong></td>
              <td align="right">Up to ${studentLimit} Students</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="font-size:13px;color:#9ca3af;margin-bottom:24px;">
      Your PRO plan remains active for ${planDuration} days from the activation date.
      Please renew before expiry to maintain uninterrupted access.
    </p>
  ` : '';

  // FREE: simple capacity note
  const freeCapacityBlock = !isPro ? `
    <div class="box" style="margin-bottom:24px;">
      <p style="margin-bottom:8px; font-weight:600; color:#ffffff;">📊 Plan</p>
      <p style="margin-bottom:4px;">Plan: <strong>FREE</strong></p>
      <p style="margin-bottom:0;">Student Capacity: <strong>Up to ${studentLimit} Students</strong></p>
    </div>
  ` : '';

  const content = `
    <h1>🎉 ${orgName} is now live on Classgrid</h1>

    <p>Hi ${adminName || "Admin"},</p>

    <p>Congratulations — your organization has been successfully reviewed and approved. You can now begin onboarding your faculty and students to your official Classgrid workspace.</p>

    ${isPro ? `<p>We're pleased to inform you that your payment has been successfully received and your <strong>Classgrid ${plan} Plan</strong> has been activated. You now have access to enhanced classroom capacity, smart attendance tools, and advanced analytics.</p>` : ''}

    ${proSubscriptionBlock}
    ${freeCapacityBlock}

    <h3 style="color:#ffffff; margin-top:32px;">🏫 Your Organization Codes</h3>

    <div class="box" style="margin-bottom: 16px;">
      <div class="meta">Faculty Organization Code</div>
      <div class="code" style="color: #60a5fa;">${organizationCode}</div>
      <p style="margin: 12px 0 4px; font-weight: 500; font-size: 14px; color: #ffffff;">Share this only with faculty members.</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #9ca3af;">This code is required when a faculty member joins your organization.</p>
      <p style="margin: 0; font-size: 14px; color: #ef4444;">Do not share this with students.</p>
    </div>

    <div class="box" style="margin-bottom: 24px;">
      <div class="meta">Student Honor Code</div>
      <div class="code" style="color: #34d399;">${honorCode}</div>
      <p style="margin: 12px 0 4px; font-weight: 500; font-size: 14px; color: #ffffff;">Share this with students.</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #9ca3af;">This allows students to connect directly to your organization without a classroom code.</p>
      <p style="margin: 0; font-size: 14px; color: #9ca3af;">This is not a classroom code.</p>
    </div>

    <h3 style="color:#ffffff; margin-top:32px;">🚀 Getting Started — Next Steps</h3>

    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">1️⃣ For Faculty</p>
    <p style="margin-bottom: 12px;">Send faculty invitations from your Admin Dashboard.</p>
    <p style="margin-bottom: 8px;">Each faculty member will:</p>
    <ul style="margin-bottom: 8px;">
      <li>Receive an invitation email</li>
      <li>Verify their account</li>
      <li>Set their password</li>
      <li>Enter the Faculty Organization Code</li>
    </ul>
    <p style="margin-bottom: 24px; font-size: 13px; color: #9ca3af;">After completion → redirected to Faculty Dashboard.</p>

    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">2️⃣ For Students</p>
    <p style="margin-bottom: 8px;">Students can join your organization in two ways:</p>
    <ul style="margin-bottom: 24px;">
      <li style="margin-bottom: 12px;"><strong>Enter the Student Honor Code</strong><br><span style="color: #9ca3af;">→ Directly connect to your organization</span></li>
      <li><strong>Enter a Classroom Code (created by faculty)</strong><br><span style="color: #9ca3af;">→ Join a specific classroom<br>→ Automatically linked to your organization</span></li>
    </ul>

    <p style="font-weight: 600; color: #ffffff; margin-bottom: 8px;">3️⃣ After Joining</p>
    <ul style="margin-bottom: 32px;">
      <li><strong>Faculty</strong> → Redirected to Faculty Dashboard</li>
      <li><strong>Students</strong> → Redirected to Student Dashboard</li>
    </ul>

    <div class="box" style="margin-bottom: 32px; border-left: 3px solid #3b82f6;">
      <p style="margin-bottom: 12px; font-weight: 600; color: #ffffff;">📌 Quick Access Tip</p>
      <p style="margin-bottom: 16px;">Once your admin account is activated and you log in successfully, we recommend bookmarking your Admin Dashboard link in your browser for faster access.</p>
      <p style="margin-bottom: 12px;">Your Admin Dashboard allows you to manage:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #9ca3af; margin-bottom: 16px;">
        <tr>
          <td valign="top" width="40%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Management</strong>
            01 — Overview<br>02 — Faculty<br>03 — Students<br>04 — Classrooms<br>05 — Notes<br>06 — Announcements
          </td>
          <td valign="top" width="30%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Insights</strong>
            07 — Analytics<br>08 — Attendance<br>09 — Billing
          </td>
          <td valign="top" width="30%">
            <strong style="color: #ffffff; display: block; margin-bottom: 6px;">Settings</strong>
            10 — Organization<br>11 — Security<br>12 — Role Sandbox
          </td>
        </tr>
      </table>

      <p style="margin-bottom: 0; font-size: 13px; color: #9ca3af; font-style: italic;">Bookmarking ensures you can return directly without navigating through the main portal.</p>
    </div>

    <h3 style="color:#ffffff; margin-top:32px;">&#x1F511; Set Up Your Account</h3>

    <div class="box" style="margin-bottom: 24px;">
      <p style="margin-bottom: 8px;">Click the button below to securely activate your admin account and set your password.</p>
      <p style="margin-bottom: 0; font-size: 13px; color: #9ca3af;">&#x26A0;&#xFE0F; This link is <strong>single-use</strong> and expires in <strong>5 minutes</strong>. Do not share it.</p>
    </div>

    <a href="${activationLink}" class="btn">Activate Admin Account</a>

    <div style="text-align:center;margin: 32px 0;">
      <p style="margin-bottom:12px;font-size:14px;color:#9ca3af;">After activating your account, go directly to your dashboard:</p>
      <a href="${getFrontendUrl()}/admin/login"
         style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#000000;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(0,212,255,0.3);"
      >🎛️ Open Org Admin Dashboard</a>
      <p style="margin-top:10px;font-size:12px;color:#6b7280;">Bookmark this page for quick access in the future.</p>
    </div>

    <p style="margin-top: 28px; font-size: 13px; color: #9ca3af;">After activation, you can sign in anytime at <a href="${getFrontendUrl()}/admin/login" style="color:#ffffff;">/admin/login</a>.</p>
    <p style="font-size: 13px; color: #9ca3af;">If you did not apply for a Classgrid organization, please contact us at <a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a>.</p>

    <p style="font-size: 14px; color: #9ca3af; margin-bottom: 0;">If you need assistance during setup, our support team is always available at:<br><a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a></p>
  `;

  return baseTemplate({
    content,
    title: isPro
      ? "Activate Your Classgrid Admin Account – PRO Plan Active"
      : "Activate Your Classgrid Admin Account – FREE Plan",
    ignoreText: "This link expires in 5 minutes and can only be used once.",
  });
};

export const getConsolidatedApprovalEmailPlainText = ({
  adminName,
  orgName,
  organizationCode,
  honorCode,
  plan = "FREE",
  studentLimit,
  activationLink,
  activationDate,
  expiryDate,
  planDuration = 31,
}) => {
  const isPro = plan === "PRO";

  const proSection = isPro ? `
--- SUBSCRIPTION DETAILS ---
Plan Name: ${plan}
Activation Date: ${formatDate(activationDate)}
Expiry Date: ${formatDate(expiryDate)}
Plan Duration: ${planDuration} Days
Student Capacity: Up to ${studentLimit} Students

Your PRO plan remains active for ${planDuration} days from the activation date. Please renew before expiry to maintain uninterrupted access.
` : `
--- PLAN ---
Plan: FREE
Student Capacity: Up to ${studentLimit} Students
`;

  return `${isPro ? "Activate Your Classgrid Admin Account – PRO Plan Active" : "Activate Your Classgrid Admin Account – FREE Plan"}

🎉 ${orgName} is now live on Classgrid

Hi ${adminName || "Admin"},

Congratulations — your organization has been successfully reviewed and approved. You can now begin onboarding your faculty and students to your official Classgrid workspace.
${isPro ? `\nWe're pleased to inform you that your payment has been successfully received and your Classgrid ${plan} Plan has been activated. You now have access to enhanced classroom capacity, smart attendance tools, and advanced analytics.` : ''}
${proSection}
--- YOUR ORGANIZATION CODES ---

Faculty Organization Code: ${organizationCode}
Share this only with faculty members.
This code is required when a faculty member joins your organization.
Do not share this with students.

Student Honor Code: ${honorCode}
Share this with students.
This allows students to connect directly to your organization without a classroom code.
This is not a classroom code.

--- GETTING STARTED — NEXT STEPS ---

1️⃣ For Faculty
Send faculty invitations from your Admin Dashboard.
Each faculty member will:
• Receive an invitation email
• Verify their account
• Set their password
• Enter the Faculty Organization Code
After completion → redirected to Faculty Dashboard.

2️⃣ For Students
Students can join your organization in two ways:
• Enter the Student Honor Code
  → Directly connect to your organization
• Enter a Classroom Code (created by faculty)
  → Join a specific classroom
  → Automatically linked to your organization

3️⃣ After Joining
• Faculty → Redirected to Faculty Dashboard
• Students → Redirected to Student Dashboard

If you need assistance during setup, our support team is always available at:
support@classgrid.in

--- SET UP YOUR ACCOUNT ---

⚠️ This link is single-use and expires in 5 minutes. Do not share it.

Activate Admin Account: ${activationLink}

>>> YOUR ORG ADMIN DASHBOARD <<<
${getFrontendUrl()}/admin/login
(Bookmark this link for quick access after activation)

After activation, you can sign in anytime at /admin/login.

If you did not apply for a Classgrid organization, please contact us at support@classgrid.in.

Need help? Contact support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ───────────── ACCOUNT SUSPENSION NOTIFICATION ─────────────
export const getAccountSuspensionEmailHtml = (userName, reason) => {
  const content = `
    <h1 style="color:#f59e0b;">⚠️ Account Suspended</h1>
    <p>Hi ${userName || 'User'},</p>
    <p>Your Classgrid account has been suspended by an administrator.</p>

    <div class="box" style="border-left: 3px solid #f59e0b; margin-bottom: 24px;">
      <div class="meta">Reason</div>
      <p style="font-weight: 500; margin-bottom: 0;">${reason || 'No reason provided.'}</p>
    </div>

    <p>While your account is suspended, you will not be able to log in or access any Classgrid services.</p>

    <p style="margin-top: 24px;">If you believe this is a mistake or would like to appeal, please contact our support team:</p>
    <a href="mailto:support@classgrid.in" class="btn" style="background: #f59e0b; color: #000;">Contact Support</a>

    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
      Email: <a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a>
    </p>
  `;
  return baseTemplate({ content, title: 'Account Suspended' });
};

export const getAccountSuspensionEmailPlainText = (userName, reason) => {
  return `Account Suspended

Hi ${userName || 'User'},

Your Classgrid account has been suspended by an administrator.

Reason: ${reason || 'No reason provided.'}

While your account is suspended, you will not be able to log in or access any Classgrid services.

If you believe this is a mistake or would like to appeal, please contact our support team at:
support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ───────────── ACCOUNT DELETION NOTIFICATION ─────────────
export const getAccountDeletionEmailHtml = (userName, reason) => {
  const content = `
    <h1 style="color:#ef4444;">🗑️ Account Deleted</h1>
    <p>Hi ${userName || 'User'},</p>
    <p>Your Classgrid account has been permanently deleted by an administrator.</p>

    <div class="box" style="border-left: 3px solid #ef4444; margin-bottom: 24px;">
      <div class="meta">Reason</div>
      <p style="font-weight: 500; margin-bottom: 0;">${reason || 'No reason provided.'}</p>
    </div>

    <p>All your data, including classroom memberships, sessions, and tokens, has been removed from our platform.</p>

    <p style="margin-top: 24px;">If you believe this was done in error, please contact our support team immediately:</p>
    <a href="mailto:support@classgrid.in" class="btn" style="background: #ef4444;">Contact Support</a>

    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
      Email: <a href="mailto:support@classgrid.in" style="color:#ffffff;">support@classgrid.in</a>
    </p>
  `;
  return baseTemplate({ content, title: 'Account Deleted' });
};

export const getAccountDeletionEmailPlainText = (userName, reason) => {
  return `Account Deleted

Hi ${userName || 'User'},

Your Classgrid account has been permanently deleted by an administrator.

Reason: ${reason || 'No reason provided.'}

All your data, including classroom memberships, sessions, and tokens, has been removed from our platform.

If you believe this was done in error, please contact our support team immediately at:
support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

// ───────────── NEW DEVICE OTP ─────────────
export const getNewDeviceOtpHtml = (userName, otp) => {
  const content = `
    <h1>New Device Login Detected</h1>
    <p>Hi <strong>${userName}</strong>,</p>
    <p>We noticed a login attempt to your Classgrid account from a new device or browser. To protect your account, please verify this device using the code below.</p>

    <div class="box" style="text-align:center; margin: 24px 0;">
      <div class="meta">Your Verification Code</div>
      <span class="code" style="font-size:32px; letter-spacing:8px; color:#ffffff;">${otp}</span>
      <p style="margin-top:12px; font-size:13px; color:#9ca3af;">This code expires in <strong style="color:#ffffff;">30 seconds</strong>.</p>
    </div>

    <p>Enter this code on the login page to verify your device. If you did not attempt to log in, please secure your account immediately.</p>
  `;
  return baseTemplate({
    content,
    title: 'Verify New Device',
    ignoreText: 'If you did not attempt to log in, please ignore this email and consider changing your password.'
  });
};

export const getNewDeviceOtpPlainText = (userName, otp) => {
  return `New Device Login Detected

Hi ${userName},

We noticed a login attempt from a new device or browser.

Your Verification Code: ${otp}

This code expires in 30 seconds. Enter it on the login page to verify your device.

If you did not attempt to log in, please reset your password immediately.

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};
