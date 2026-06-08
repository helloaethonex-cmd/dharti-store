import crypto from 'node:crypto'
import { prisma } from './prisma'

const OTP_TTL_MINUTES = 15

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function storeOtp(identifier: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
  await prisma.verification.upsert({
    where: { identifier },
    update: { value: otp, expiresAt },
    create: { identifier, value: otp, expiresAt },
  })
}

export async function verifyOtp(identifier: string, otp: string): Promise<boolean> {
  const record = await prisma.verification.findUnique({ where: { identifier } })
  if (!record) return false
  if (record.expiresAt < new Date()) {
    await prisma.verification.delete({ where: { identifier } })
    return false
  }
  if (record.value !== otp) return false
  await prisma.verification.delete({ where: { identifier } })
  return true
}
