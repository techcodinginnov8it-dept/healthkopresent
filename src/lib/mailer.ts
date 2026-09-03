/**
 * Gmail SMTP mailer — server-only singleton.
 *
 * Uses Nodemailer with a Gmail "App Password" so you do NOT need to enable
 * "Less secure app access".  Generate an App Password at:
 *   myaccount.google.com → Security → 2-Step Verification → App passwords
 *
 * Required env vars (set in .env.local):
 *   GMAIL_USER          – the Gmail address sending the email
 *   GMAIL_APP_PASSWORD  – the 16-char app password (spaces stripped automatically)
 *   GMAIL_FROM_NAME     – (optional) display name, defaults to "HealthkO"
 */
import "server-only";

import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const fromName = process.env.GMAIL_FROM_NAME || "HealthkO Security";

  if (!user || !pass) {
    throw new Error(
      `Gmail SMTP is not configured. user: ${user ? "present" : "MISSING"}, pass: ${pass ? "present" : "MISSING"}`
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // SSL
    auth: {
      user,
      pass,
    },
  });

  return { transporter, from: `"${fromName}" <${user}>` };
}

export async function sendOtpEmail({
  to,
  otp,
  userName,
  purpose = "Password Change Request",
}: {
  to: string;
  otp: string;
  userName: string;
  purpose?: string;
}) {
  console.log(`[sendOtpEmail] Preparing to send OTP to recipient: "${to}" for user: "${userName}" (purpose: ${purpose})`);
  const { transporter, from } = getTransporter();

  const isContactUpdate = purpose.toLowerCase().includes("contact");
  const actionTitle = isContactUpdate ? "Contact Information Update" : purpose;
  const actionDesc = isContactUpdate
    ? "We received a request to update the contact details on your HealthkO account. Use the one-time code below to authorize this change."
    : "We received a request to change the password on your HealthkO account. Use the one-time code below to confirm this action.";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HealthkO — ${actionTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.75);text-transform:uppercase;">HealthkO</p>
              <h1 style="margin:8px 0 0;font-size:26px;font-weight:900;color:#ffffff;">${actionTitle}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;">
              <p style="margin:0 0 8px;font-size:15px;color:#334155;">Hello, <strong>${userName}</strong></p>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
                ${actionDesc}
              </p>

              <!-- OTP Box -->
              <div style="background:#f8fafc;border:2px dashed #0d9488;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.18em;color:#94a3b8;text-transform:uppercase;">Your Verification Code</p>
                <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:0.25em;color:#0d9488;font-family:'Courier New',monospace;">${otp}</p>
                <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Expires in <strong>10 minutes</strong></p>
              </div>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
                Enter this code in the HealthkO settings page to complete your ${purpose.toLowerCase()}.
              </p>
              <p style="margin:0 0 28px;font-size:13px;color:#64748b;line-height:1.6;">
                If you did <strong>not</strong> request this change, you can safely ignore this email.
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                This email was sent by HealthkO · Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const info = await transporter.sendMail({
    from,
    to,
    subject: `${otp} is your HealthkO verification code`,
    html,
    text: `Your HealthkO ${purpose} verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`,
  });

  console.log(`[sendOtpEmail] OTP email successfully sent to ${to}. MessageId: ${info.messageId}`);
  return info;
}
