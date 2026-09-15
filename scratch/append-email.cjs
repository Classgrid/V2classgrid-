const fs = require('fs');
const content = `

// -------------------------------------------------------------
// APP REQUIRED EMAIL (Sent when blocking mobile browser login)
// -------------------------------------------------------------
export const getMobileAppRequiredEmailHtml = (email) => {
  return \`
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #b71c1c;">Action Required: Download Classgrid App</h2>
      <p>Hi there,</p>
      <p>We noticed you tried to log into Classgrid from a mobile web browser. For security, GPS location tracking, and attendance verification, <strong>mobile web access is strictly disabled</strong>.</p>
      <p>You must download the official Classgrid Android App to mark your attendance and access your classroom.</p>
      <a href="https://cdn.classgrid.in/v2classgrid.apk" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Download Classgrid App</a>
      <p style="margin-top: 25px; font-size: 13px; color: #666;"><em>Note: If you are using a laptop or desktop computer, you may ignore this message and log in normally.</em></p>
    </div>
  \`;
};

export const getMobileAppRequiredEmailPlainText = (email) => {
  return \`Action Required: Download Classgrid App

Hi there,

We noticed you tried to log into Classgrid from a mobile web browser. For security, GPS location tracking, and attendance verification, mobile web access is strictly disabled.

You must download the official Classgrid Android App to mark your attendance and access your classroom.

Download Link: https://cdn.classgrid.in/v2classgrid.apk

Note: If you are using a laptop or desktop computer, you may ignore this message and log in normally.\`;
};
`;

fs.appendFileSync('src/services/email-templates.service.js', content);
console.log('Done');
