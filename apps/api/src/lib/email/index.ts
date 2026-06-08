import { Resend } from 'resend'
import { env } from '../../config/env'

const resend = new Resend(env.RESEND_API_KEY)

async function sendEmail(params: { to: string; subject: string; html: string }) {
  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
}

export async function sendOtpEmail(to: string, otp: string, purpose: 'verify' | 'reset') {
  const subject =
    purpose === 'verify'
      ? 'Verify your email — Dharti Store'
      : 'Password reset OTP — Dharti Store'
  const action = purpose === 'verify' ? 'verify your email address' : 'reset your password'
  await sendEmail({
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Dharti Store</h2>
        <p>Your OTP to <strong>${action}</strong> is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
        <p>This OTP expires in <strong>15 minutes</strong>.</p>
        <p style="color:#888">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}

export async function sendVendorApplicationEmail(to: string, businessName: string) {
  await sendEmail({
    to,
    subject: 'Vendor application received — Dharti Store',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Application Received</h2>
        <p>Thank you, <strong>${businessName}</strong>! Your vendor application has been submitted.</p>
        <p>Our team will review it and get back to you shortly.</p>
      </div>
    `,
  })
}
