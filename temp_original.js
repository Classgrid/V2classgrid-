/**
 * QuantumChem - Centralized Email Template Service
 * 
 * All emails share a common branded template with the platform logo.
 * Provides templates for:
 *   1. Welcome email (first login) - per provider
 *   2. Login notification email (every login) - per provider
 *   3. Verification email
 *   4. Password reset email
 */

const getFrontendUrl = () => {
  if (process.env.VERCEL) {
    return process.env.FRONTEND_URL_PROD || "https://www.quantumchem.site";
  }
  return process.env.FRONTEND_URL || "http://localhost:3000";
};

const PLATFORM_LOGO_URL = `${getFrontendUrl()}/Quantumchem.png`;

// ───────────── Provider Display Helpers ─────────────

const providerConfig = {
  manual: {
    name: "Email & Password",
    color: "#4F46E5",
    headerGradient: "linear-gradient(135deg, #4F46E5 0%, #3730a3 100%)",
    icon: "🔑",
    badgeBg: "#ede9fe",
    badgeColor: "#5b21b6",
    securityNote: "Keep your password secure and never share it with anyone.",
    securityLink: null,
  },
  google: {
    name: "Google OAuth 2.0",
    color: "#EA4335",
    headerGradient: "linear-gradient(135deg, #EA4335 0%, #c5221f 100%)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`,
    badgeBg: "#fee2e2",
    badgeColor: "#991b1b",
    securityNote: "Your credentials are managed by Google. Enable 2FA on your Google account for maximum security.",
    securityLink: "https://myaccount.google.com/security",
  },
  github: {
    name: "GitHub OAuth",
    color: "#24292e",
    headerGradient: "linear-gradient(135deg, #24292e 0%, #0d1117 100%)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,
    badgeBg: "#f3f4f6",
    badgeColor: "#1f2937",
    securityNote: "Your credentials are managed by GitHub. Enable 2FA on your GitHub account for maximum security.",
    securityLink: "https://github.com/settings/security",
  },
  facebook: {
    name: "Facebook OAuth",
    color: "#1877F2",
    headerGradient: "linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    badgeBg: "#dbeafe",
    badgeColor: "#1e40af",
    securityNote: "Your credentials are managed by Facebook. Enable 2FA on your Facebook account for maximum security.",
    securityLink: "https://www.facebook.com/settings?tab=security",
  },
  linkedin: {
    name: "LinkedIn OAuth",
    color: "#0077b5",
    headerGradient: "linear-gradient(135deg, #0077b5 0%, #005582 100%)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    badgeBg: "#e0f2fe",
    badgeColor: "#0077b5",
    securityNote: "Your credentials are managed by LinkedIn. Enable 2FA on your LinkedIn account for maximum security.",
    securityLink: "https://www.linkedin.com/psettings/two-step-verification",
  },
};

// ───────────── Format Date ─────────────

const formatDate = () => {
  return new Date().toLocaleString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  });
};

// ───────────── Base Email Wrapper ─────────────

const baseTemplate = (content, headerGradient = "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)") => {
  const FRONTEND_URL = getFrontendUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>QuantumChem</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      line-height: 1.6; color: #1f2937; background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 20px; }
    .email-container {
      max-width: 600px; margin: 0 auto; background-color: #ffffff;
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: ${headerGradient};
      padding: 40px 40px 35px; text-align: center;
    }
    .platform-logo {
      width: 80px; height: 80px; border-radius: 16px;
      border: 3px solid rgba(255,255,255,0.3);
      object-fit: cover; box-shadow: 0 8px 20px rgba(0,0,0,0.25);
      margin-bottom: 16px;
    }
    .brand-name {
      font-size: 28px; font-weight: 700; color: #ffffff;
      margin: 12px 0 6px; letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;
    }
    .email-body { padding: 40px; }
    h1 { color: #111827; margin-bottom: 16px; font-weight: 700; font-size: 24px; line-height: 1.3; }
    h2 { color: #111827; margin-bottom: 14px; font-weight: 600; font-size: 20px; }
    p { color: #4b5563; margin-bottom: 14px; font-size: 15px; line-height: 1.7; }
    .success-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-left: 5px solid #10b981; padding: 22px; border-radius: 10px; margin: 24px 0;
    }
    .highlight-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-left: 5px solid #2563eb; padding: 22px; border-radius: 10px; margin: 24px 0;
    }
    .warning-box {
      background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
      border-left: 5px solid #f59e0b; padding: 22px; border-radius: 10px; margin: 24px 0;
    }
    .danger-box {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-left: 5px solid #ef4444; padding: 22px; border-radius: 10px; margin: 24px 0;
    }
    .info-table { width: 100%; margin: 20px 0; border-collapse: collapse; }
    .info-row { border-bottom: 1px solid #e5e7eb; }
    .info-label { padding: 12px 12px 12px 0; font-weight: 600; color: #6b7280; font-size: 14px; width: 40%; }
    .info-value { padding: 12px 0; color: #111827; font-size: 14px; }
    .badge {
      display: inline-block; padding: 5px 12px; border-radius: 6px;
      font-size: 12px; font-weight: 600;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff !important; text-decoration: none;
      padding: 16px 32px; border-radius: 10px;
      font-weight: 600; font-size: 16px; text-align: center; margin: 20px 0;
      box-shadow: 0 4px 10px rgba(37,99,235,0.3);
    }
    .button-full { display: block; width: 100%; }
    .feature-list { background: #f9fafb; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .feature-item { display: flex; align-items: flex-start; margin: 10px 0; color: #374151; font-size: 14px; }
    .feature-icon { color: #10b981; font-weight: bold; margin-right: 10px; font-size: 17px; flex-shrink: 0; }
    .divider { height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 30px 0; }
    .footer {
      background: #f9fafb; padding: 30px 40px; text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text { color: #6b7280; font-size: 13px; line-height: 1.8; margin: 8px 0; }
    .footer-link { color: #2563eb; text-decoration: none; margin: 0 10px; font-size: 13px; font-weight: 500; }
    .provider-badge-inline {
      display: inline-flex; align-items: center; gap: 8px;
      background: #fff; border: 2px solid #e5e7eb; padding: 10px 18px;
      border-radius: 10px; margin: 12px 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 0 !important; }
      .email-container { border-radius: 0 !important; box-shadow: none !important; }
      .email-header { padding: 28px 20px !important; }
      .email-body { padding: 24px 20px !important; }
      .footer { padding: 24px 20px !important; }
      .platform-logo { width: 65px !important; height: 65px !important; }
      .brand-name { font-size: 22px !important; }
      h1 { font-size: 20px !important; }
      h2 { font-size: 17px !important; }
      p { font-size: 14px !important; }
      .button { padding: 14px 24px !important; font-size: 15px !important; display: block !important; width: 100% !important; }
      .info-row { display: flex !important; flex-direction: column !important; padding: 12px 0 !important; }
      .info-label { display: block !important; width: 100% !important; padding: 0 0 4px 0 !important; font-size: 12px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
      .info-value { display: block !important; width: 100% !important; padding: 0 !important; font-size: 14px !important; font-weight: 500 !important; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr><td align="center">
        <div class="email-container">
          ${content}
          <div class="footer">
            <p class="footer-text" style="font-weight: 600; color: #111827; margin-bottom: 10px; font-size: 14px;">
              QuantumChem Research Platform
            </p>
            <p class="footer-text">© ${new Date().getFullYear()} QuantumChem. All rights reserved.</p>
            <div style="margin: 14px 0;">
              <a href="${FRONTEND_URL}" class="footer-link">Home</a>
              <span style="color: #d1d5db;">•</span>
              <a href="${FRONTEND_URL}/classroom" class="footer-link">Dashboard</a>
              <span style="color: #d1d5db;">•</span>
              <a href="mailto:quantumchem25@gmail.com,support@quantumchem.site" class="footer-link">Support</a>
            </div>
            <p class="footer-text" style="margin-top: 18px;">
              Need help? Contact us at
              <a href="mailto:quantumchem25@gmail.com,support@quantumchem.site" style="color: #2563eb; text-decoration: none; font-weight: 500;">quantumchem25@gmail.com or support@quantumchem.site</a>
            </p>
          </div>
        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
};

// ───────────── Email Header Block ─────────────

const emailHeader = (tagline, provider = "manual") => {
  const config = providerConfig[provider] || providerConfig.manual;
  return `
    <div class="email-header" style="background: ${config.headerGradient};">
      <img src="${PLATFORM_LOGO_URL}" alt="QuantumChem" class="platform-logo">
      <h1 class="brand-name">QuantumChem</h1>
      <p class="brand-tagline">${tagline}</p>
    </div>
  `;
};

// ───────────── WELCOME EMAIL (First Login) ─────────────

export const getWelcomeEmailHtml = (user, provider = "manual") => {
  const FRONTEND_URL = getFrontendUrl();
  const config = providerConfig[provider] || providerConfig.manual;
  const currentTime = formatDate();

  const authMethodDisplay = provider === "manual"
    ? "email and password"
    : `${config.name}`;

  const providerBadge = `<span class="badge" style="background: ${config.badgeBg}; color: ${config.badgeColor};">${config.name}</span>`;

  const securitySection = config.securityLink
    ? `<p style="margin: 12px 0 0 0; color: #1e40af; font-size: 14px; line-height: 1.8;">
        • <strong>No passwords stored</strong> - Your credentials remain with ${provider.charAt(0).toUpperCase() + provider.slice(1)}<br>
        • <strong>OAuth standard</strong> - Industry-leading authentication protocol<br>
        • <strong>Two-factor ready</strong> - Managed through your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account<br>
        • <strong>Privacy-focused</strong> - We only access essential profile information
      </p>`
    : `<p style="margin: 12px 0 0 0; color: #1e40af; font-size: 14px; line-height: 1.8;">
        • <strong>Encrypted password</strong> - Your password is hashed with bcrypt<br>
        • <strong>Secure sessions</strong> - JWT-based authentication with HTTP-only cookies<br>
        • <strong>Email verified</strong> - Your email was verified before account creation<br>
        • <strong>Password reset</strong> - You can reset your password anytime via email
      </p>`;

  const content = `
    ${emailHeader("✓ Welcome to the Platform", provider)}
    
    <div class="email-body">
      <div class="success-box">
        <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 20px; line-height: 1.3;">
          🎉 Welcome to QuantumChem!
        </p>
        <p style="margin: 10px 0 0 0; color: #065f46; font-size: 16px; line-height: 1.5;">
          Hello <strong>${user.name}</strong>, your account has been created successfully!
        </p>
      </div>

      <div style="margin-bottom: 28px;">
        <h2>Your Research Journey Starts Here</h2>
        <p>You've successfully signed in to QuantumChem using <strong>${authMethodDisplay}</strong>. We're thrilled to have you join our research community!</p>
      </div>

      <div class="divider"></div>

      <div style="margin-bottom: 28px;">
        <h2>📋 Your Account Information</h2>
        <table class="info-table" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr class="info-row">
            <td class="info-label">Full Name</td>
            <td class="info-value"><strong>${user.name}</strong></td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Email Address</td>
            <td class="info-value">${user.email}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Authentication</td>
            <td class="info-value">${providerBadge}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Account Created</td>
            <td class="info-value">${currentTime}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${FRONTEND_URL}/classroom" class="button button-full" style="text-decoration: none; color: #ffffff;">Access Your Dashboard →</a>
      </div>

      <div class="divider"></div>

      <div style="margin-bottom: 28px;">
        <h2>✨ Platform Features</h2>
        <div class="feature-list">
          <div class="feature-item"><span class="feature-icon">✓</span><span>Access comprehensive laboratory research database</span></div>
          <div class="feature-item"><span class="feature-icon">✓</span><span>Collaborate with researchers worldwide</span></div>
          <div class="feature-item"><span class="feature-icon">✓</span><span>Store and manage your research data securely</span></div>
          <div class="feature-item"><span class="feature-icon">✓</span><span>AI-powered chemistry assistant</span></div>
        </div>
      </div>

      <div class="highlight-box">
        <p style="margin: 0; font-weight: 600; color: #1e40af; font-size: 16px; line-height: 1.4;">
          🔐 Your Security & Privacy
        </p>
        ${securitySection}
      </div>

      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 15px; line-height: 1.4;">
          ⚠️ Security Notice
        </p>
        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px; line-height: 1.7;">
          If you didn't create this account, please contact our support team immediately at
          <a href="mailto:quantumchem25@gmail.com,support@quantumchem.site" style="color: #92400e; font-weight: 600; text-decoration: underline;">quantumchem25@gmail.com or support@quantumchem.site</a>
        </p>
      </div>

      <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 0;">
        Welcome aboard! We're excited to support your research journey.
      </p>
    </div>
  `;

  return baseTemplate(content, config.headerGradient);
};

// ───────────── LOGIN NOTIFICATION EMAIL (Every Login) ─────────────

export const getLoginNotificationHtml = (user, provider = "manual") => {
  const FRONTEND_URL = getFrontendUrl();
  const config = providerConfig[provider] || providerConfig.manual;
  const currentTime = formatDate();
  const authDisplay = provider === "manual" ? "email and password" : `${config.name}`;
  const providerBadge = `<span class="badge" style="background: ${config.badgeBg}; color: ${config.badgeColor};">${config.name}</span>`;

  const securityAction = config.securityLink
    ? `<strong>1.</strong> Secure your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account at 
       <a href="${config.securityLink}" style="color: #92400e; font-weight: 600; text-decoration: underline;">${provider.charAt(0).toUpperCase() + provider.slice(1)} Security</a><br>`
    : `<strong>1.</strong> Change your password immediately at 
       <a href="${FRONTEND_URL}/reset-password" style="color: #92400e; font-weight: 600; text-decoration: underline;">Reset Password</a><br>`;

  const content = `
    ${emailHeader("🔐 Account Security Alert", provider)}
    
    <div class="email-body">
      <div class="success-box">
        <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 18px; line-height: 1.3;">
          ✓ Successful Login
        </p>
        <p style="margin: 10px 0 0 0; color: #065f46; font-size: 15px; line-height: 1.5;">
          Hello <strong>${user.name}</strong>, you recently signed in to your QuantumChem account.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2>Account Access Notification</h2>
        <p>We detected a successful login to your QuantumChem account using <strong>${authDisplay}</strong>.</p>
      </div>

      <div class="highlight-box">
        <h3 style="margin: 0 0 16px 0; color: #1e40af; font-size: 16px; font-weight: 600;">📊 Login Information</h3>
        <table class="info-table" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0;">
          <tr class="info-row">
            <td class="info-label">Account Email</td>
            <td class="info-value">${user.email}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Access Time</td>
            <td class="info-value">${currentTime}</td>
          </tr>
          <tr class="info-row">
            <td class="info-label">Authentication</td>
            <td class="info-value">${providerBadge}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${FRONTEND_URL}/classroom" class="button button-full" style="text-decoration: none; color: #ffffff;">Go to Dashboard</a>
      </div>

      <div class="divider"></div>

      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 16px; line-height: 1.4;">
          🛡️ Didn't Sign In?
        </p>
        <p style="margin: 12px 0 0 0; color: #92400e; font-size: 14px; line-height: 1.7;">
          If you didn't perform this login, your account security may be compromised. Please take immediate action:
        </p>
        <div style="margin-top: 14px; color: #92400e; font-size: 14px; line-height: 1.9;">
          ${securityAction}
          <strong>2.</strong> Review your recent account activity<br>
          <strong>3.</strong> Contact our support team: 
          <a href="mailto:quantumchem25@gmail.com,support@quantumchem.site" style="color: #92400e; font-weight: 600; text-decoration: underline;">quantumchem25@gmail.com or support@quantumchem.site</a>
        </div>
      </div>

      <p style="text-align: center; color: #6b7280; font-size: 13px; line-height: 1.7; margin: 0;">
        You received this notification because you logged in to your account.<br>
        This is auto-generated by QuantumChem security system.
      </p>
    </div>
  `;

  return baseTemplate(content, config.headerGradient);
};

// ───────────── VERIFICATION EMAIL ─────────────

export const getVerificationEmailHtml = (name, verifyLink) => {
  const content = `
    ${emailHeader("📧 Email Verification", "manual")}
    
    <div class="email-body">
      <div class="highlight-box">
        <p style="margin: 0; font-weight: 700; color: #1e40af; font-size: 20px; line-height: 1.3;">
          📧 Complete your Registration
        </p>
        <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 15px; line-height: 1.5;">
          Hello <strong>${name}</strong>, please verify your email to continue.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <p>Click the button below to verify your email address and set your password:</p>
      </div>

      <div style="text-align: center;">
        <a href="${verifyLink}" class="button button-full" style="text-decoration: none; color: #ffffff; background: linear-gradient(135deg, #4F46E5 0%, #3730a3 100%); box-shadow: 0 4px 10px rgba(79,70,229,0.3);">
          Verify & Set Password →
        </a>
      </div>

      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 14px;">
          ⏰ This link expires in 24 hours.
        </p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    </div>
  `;

  return baseTemplate(content, providerConfig.manual.headerGradient);
};

// ───────────── PASSWORD RESET EMAIL ─────────────

export const getPasswordResetEmailHtml = (resetLink) => {
  const content = `
    ${emailHeader("🔑 Password Reset", "manual")}
    
    <div class="email-body">
      <div class="danger-box">
        <p style="margin: 0; font-weight: 700; color: #991b1b; font-size: 18px; line-height: 1.3;">
          🔑 Password Reset Requested
        </p>
        <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px; line-height: 1.5;">
          We received a request to reset your password.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
      </div>

      <div style="text-align: center;">
        <a href="${resetLink}" class="button button-full" style="text-decoration: none; color: #ffffff; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 4px 10px rgba(239,68,68,0.3);">
          Reset Password →
        </a>
      </div>

      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #92400e; font-size: 14px;">
          ⏰ This link expires in 1 hour.
        </p>
        <p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;">
          If you didn't request this, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    </div>
  `;

  return baseTemplate(content, "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)");
};

// ───────────── Plain Text Helpers ─────────────

export const getWelcomePlainText = (user, provider = "manual") => {
  const config = providerConfig[provider] || providerConfig.manual;
  return `Welcome to QuantumChem!

Hello ${user.name},

Your account has been created successfully! 🎉

ACCOUNT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full Name: ${user.name}
Email: ${user.email}
Authentication: ${config.name}
Account Created: ${formatDate()}

Access your dashboard: ${getFrontendUrl()}/classroom

PLATFORM FEATURES:
✓ Access comprehensive laboratory research database
✓ Collaborate with researchers worldwide
✓ Store and manage your research data securely
✓ AI-powered chemistry assistant

SECURITY NOTICE:
If you didn't create this account, contact us at quantumchem25@gmail.com or support@quantumchem.site

Welcome aboard!
QuantumChem Team`;
};

export const getLoginNotificationPlainText = (user, provider = "manual") => {
  const config = providerConfig[provider] || providerConfig.manual;
  return `QuantumChem - Account Login Notification

Hello ${user.name},

A successful login was detected on your QuantumChem account.

LOGIN INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account Email: ${user.email}
Access Time: ${formatDate()}
Authentication: ${config.name}

DIDN'T SIGN IN?
If you didn't perform this login, please take immediate action:
1. ${config.securityLink ? `Secure your account at ${config.securityLink}` : `Reset your password at ${getFrontendUrl()}/reset-password`}
2. Review your recent account activity
3. Contact support at quantumchem25@gmail.com or support@quantumchem.site

Access your dashboard: ${getFrontendUrl()}/classroom

QuantumChem Team`;
};
