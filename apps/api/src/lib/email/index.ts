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

export async function sendNewVendorApplicationAdminEmail(businessName: string, vendorEmail: string) {
  const adminEmail = env.FROM_EMAIL
  await sendEmail({
    to: adminEmail,
    subject: `New vendor application: ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>New Vendor Application</h2>
        <p>A new vendor has applied:</p>
        <ul>
          <li><strong>Business:</strong> ${businessName}</li>
          <li><strong>Email:</strong> ${vendorEmail}</li>
        </ul>
        <p>Log in to the admin dashboard to review and approve.</p>
      </div>
    `,
  })
}

export async function sendVendorApprovalEmail(to: string, businessName: string) {
  await sendEmail({
    to,
    subject: 'Your vendor account is approved — Dharti Store',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Congratulations!</h2>
        <p>Your vendor account for <strong>${businessName}</strong> has been approved.</p>
        <p>You can now log in to your vendor dashboard and start listing products.</p>
      </div>
    `,
  })
}

export async function sendVendorSuspensionEmail(to: string, businessName: string, reason: string) {
  await sendEmail({
    to,
    subject: 'Your vendor account has been suspended — Dharti Store',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Account Suspended</h2>
        <p>Your vendor account for <strong>${businessName}</strong> has been suspended.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please contact support if you believe this is in error.</p>
      </div>
    `,
  })
}

export async function sendVendorRejectionEmail(to: string, businessName: string, reason: string) {
  await sendEmail({
    to,
    subject: 'Vendor application update — Dharti Store',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Application Not Approved</h2>
        <p>We regret to inform you that the vendor application for <strong>${businessName}</strong> was not approved.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please contact support for further assistance.</p>
      </div>
    `,
  })
}
