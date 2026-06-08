/**
 * Classgrid - Centralized Email Template Service
 * 
 * Clean, minimal SaaS transactional emails.
 */

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === "production" ? "https://classgrid.in" : "http://localhost:3000");
};

const PLATFORM_LOGO_URL = "https://bumxgscngzjadyozdpce.supabase.co/storage/v1/object/public/notes-files/android-chrome-512x512.png";

const formatDate = () => {
  return new Date().toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
};

const baseTemplate = (content, headerTitle = "Notification", accentColor = "#111827") => {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle} - Classgrid</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper { width: 100%; padding: 40px 20px; background-color: #f9fafb; }
    .container {
      max-width: 600px; margin: 0 auto; background-color: #ffffff;
      border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden;
    }
    .header {
      padding: 32px 32px 24px; text-align: left; border-bottom: 1px solid #e5e7eb;
    }
    .logo { width: 32px; height: 32px; border-radius: 6px; vertical-align: middle; }
    .brand { font-size: 18px; font-weight: 600; color: #111827; margin-left: 10px; vertical-align: middle; display: inline-block; }
    .body-content { padding: 32px; text-align: left; }
    h1 { color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    h2 { color: #111827; font-size: 16px; font-weight: 600; margin: 24px 0 12px; }
    p { margin: 0 0 16px; font-size: 15px; }
    .box {
      background: #f3f4f6; border-left: 4px solid ${accentColor};
      padding: 16px; border-radius: 4px; margin: 24px 0;
    }
    .danger-box {
      background: #fef2f2; border-left: 4px solid #ef4444;
      padding: 16px; border-radius: 4px; margin: 24px 0;
    }
    .btn {
      display: inline-block; background-color: #111827; color: #ffffff !important;
      text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 15px;
      margin: 8px 0 24px;
    }
    .btn-danger { background-color: #ef4444; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .footer { padding: 0 32px 32px; text-align: left; }
    .footer p { color: #6b7280; font-size: 13px; margin: 0 0 8px; }
    .support-link { color: #111827; font-weight: 500; text-decoration: none; }
    hr { border: 0; border-top: 1px solid #e5e7eb; margin: 0 0 32px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center">
        <div class="container" style="text-align: left;">
          <div class="header">
            <img src="${PLATFORM_LOGO_URL}" alt="Classgrid Logo" class="logo">
            <span class="brand">Classgrid</span>
          </div>
          <div class="body-content">
            ${content}
          </div>
          <div class="footer">
            <hr>
            <p>If you did not request this, please ignore this email.</p>
            <p>Support Email: <a href="mailto:support@classgrid.in" class="support-link">support@classgrid.in</a></p>
            <p style="margin-top: 16px;">© ${year} Classgrid. All rights reserved.</p>
          </div>
        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
};

// ───────────── WELCOME EMAIL ─────────────
export const getWelcomeEmailHtml = (user, provider = "manual") => {
  const method = provider === "manual" ? "email and password" : provider.charAt(0).toUpperCase() + provider.slice(1);
  const content = `
    <h1>Welcome to Classgrid</h1>
    <p>Hello ${user.name},</p>
    <p>Your account has been successfully created using <strong>${method}</strong>. You are now ready to start your educational journey.</p>
    
    <a href="${getFrontendUrl()}/classroom" class="btn">Go to Dashboard</a>
  `;
  return baseTemplate(content, "Welcome");
};

// ───────────── LOGIN NOTIFICATION ─────────────
export const getLoginNotificationHtml = (user, provider = "manual") => {
  const method = provider === "manual" ? "email and password" : provider.charAt(0).toUpperCase() + provider.slice(1);
  const content = `
    <h1>New Login Detected</h1>
    <p>Hello ${user.name},</p>
    <p>We detected a successful login to your Classgrid account.</p>
    
    <div class="box">
      <div class="meta"><strong>Date & Time:</strong> ${formatDate()}</div>
      <div class="meta"><strong>Email:</strong> ${user.email}</div>
      <div class="meta"><strong>Method:</strong> ${method}</div>
    </div>
    
    <p>If this was you, no further action is required.</p>
    <p>If you do not recognize this activity, please secure your account immediately or contact support.</p>
  `;
  return baseTemplate(content, "Login Notification");
};

// ───────────── VERIFICATION EMAIL ─────────────
export const getVerificationEmailHtml = (name, verifyLink) => {
  const content = `
    <h1>Verify Your Email</h1>
    <p>Hello ${name},</p>
    <p>Please verify your email address to complete your registration.</p>
    
    <a href="${verifyLink}" class="btn">Verify Email</a>
    
    <div class="meta" style="margin-top: 16px;">This link will expire in 24 hours.</div>
  `;
  return baseTemplate(content, "Email Verification");
};

// ───────────── PASSWORD RESET ─────────────
export const getPasswordResetEmailHtml = (resetLink) => {
  const content = `
    <h1>Reset Your Password</h1>
    <p>We received a request to reset the password for your Classgrid account.</p>
    
    <a href="${resetLink}" class="btn">Reset Password</a>
    
    <div class="meta" style="margin-top: 16px;">This link will expire in 1 hour.</div>
  `;
  return baseTemplate(content, "Password Reset");
};

// ───────────── FACULTY INVITE ─────────────
export const getFacultyInviteEmailHtml = (facultyName, orgName, verifyLink, orgCode = null) => {
  const codeBox = orgCode ? `
    <div class="box">
      <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Organization Code (You will need this)</div>
      <div style="font-family: monospace; font-size: 18px; font-weight: 600; color: #111827; letter-spacing: 2px;">${orgCode}</div>
    </div>
  ` : '';

  const content = `
    <h1>You've Been Invited</h1>
    <p>Hello ${facultyName},</p>
    <p>You have been invited to join <strong>${orgName}</strong> as a Faculty member on Classgrid.</p>
    
    ${codeBox}
    
    <h2>Next Steps:</h2>
    <div class="meta">1. Click the button below to verify your email.</div>
    <div class="meta">2. Set your permanent password.</div>
    <div class="meta">3. Access your faculty dashboard.</div>
    
    <a href="${verifyLink}" class="btn" style="margin-top: 16px;">Verify & Set Password</a>
  `;
  return baseTemplate(content, "Faculty Invitation");
};

// ───────────── ORG APPROVAL ─────────────
export const getOrgApprovalEmailHtml = (orgName, ownerName, organizationCode, honorCode, facultyLimit, frontendUrl) => {
  const content = `
    <h1>Organization Approved</h1>
    <p>Hello ${ownerName},</p>
    <p>Your organization <strong>${orgName}</strong> has been approved and is now live on Classgrid.</p>
    
    <div class="box" style="border-color: #10b981;">
      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">Faculty Organization Code</div>
      <p style="font-size: 13px; margin-bottom: 8px;">Share this ONLY with faculty members who are joining.</p>
      <div style="font-family: monospace; font-size: 20px; font-weight: 600; color: #10b981; letter-spacing: 2px;">${organizationCode}</div>
    </div>
    
    <div class="box" style="border-color: #3b82f6;">
      <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">Student Honor Code</div>
      <p style="font-size: 13px; margin-bottom: 8px;">Share this ONLY with students to allow them to connect.</p>
      <div style="font-family: monospace; font-size: 20px; font-weight: 600; color: #3b82f6; letter-spacing: 2px;">${honorCode}</div>
    </div>
    
    <a href="${frontendUrl || getFrontendUrl()}/org-admin-dashboard" class="btn">Go to Admin Dashboard</a>
  `;
  return baseTemplate(content, "Organization Approved", "#10b981");
};

// ───────────── ORG DELETE VERIFICATION ─────────────
export const getOrgDeleteVerificationEmailHtml = (orgName, ownerName, verifyLink) => {
  const content = `
    <h1>Permanent Deletion Request</h1>
    <p>Hello ${ownerName},</p>
    <p>You have requested to permanently delete your organization <strong>${orgName}</strong>.</p>
    
    <div class="danger-box">
      <p style="font-weight: 600; color: #111827; margin-bottom: 12px;">The following data will be permanently removed:</p>
      <ul style="color: #ef4444; font-size: 14px; margin: 0 0 0 20px; padding: 0; line-height: 1.6;">
        <li>Organization records & settings</li>
        <li>All classrooms & related data</li>
        <li>All faculty & student connection records</li>
        <li>All messages, materials, and logs</li>
      </ul>
    </div>
    
    <a href="${verifyLink}" class="btn btn-danger">Confirm & Delete Organization</a>
    
    <div class="meta" style="margin-top: 16px;">This link will expire in 30 minutes.</div>
  `;
  return baseTemplate(content, "Deletion Request", "#ef4444");
};

// ───────────── PLAIN TEXT FALLBACKS ─────────────
export const getWelcomePlainText = (user, provider = "manual") => {
  const method = provider === "manual" ? "email and password" : provider.charAt(0).toUpperCase() + provider.slice(1);
  return `Welcome to Classgrid

Hello ${user.name},

Your account has been created successfully using ${method}.

Access your dashboard: ${getFrontendUrl()}/classroom

If you did not request this, please ignore this email.
Support Email: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};

export const getLoginNotificationPlainText = (user, provider = "manual") => {
  const method = provider === "manual" ? "email and password" : provider.charAt(0).toUpperCase() + provider.slice(1);
  return `New Login Detected

Hello ${user.name},

A successful login was detected on your Classgrid account.
Time: ${formatDate()}
Email: ${user.email}
Method: ${method}

If this was you, no action is required.
If you do not recognize this activity, please contact support.

Support Email: support@classgrid.in

© ${new Date().getFullYear()} Classgrid. All rights reserved.`;
};
