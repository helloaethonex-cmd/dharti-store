import { Injectable } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import slugify from 'slugify'
import { nanoid } from 'nanoid'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { signAccessToken, verifyAccessToken } from '../../lib/jwt'
import { generateOtp, storeOtp, verifyOtp } from '../../lib/otp'
import { enforceRateLimit } from '../../lib/rate-limit'
import { redis } from '../../lib/redis'
import { sendOtpEmail, sendVendorApplicationEmail, sendNewVendorApplicationAdminEmail } from '../../lib/email'
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  VendorApplyDto,
} from './auth.schema'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SEO_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN']

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex')
}

function formatUser(user: {
  id: bigint
  publicId: string
  email: string
  name: string | null
  phone: string | null
  image: string | null
  isActive: boolean
  emailVerified: boolean
  role?: { id: bigint; name: string } | null
}) {
  return {
    id: user.publicId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    image: user.image,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    role: user.role?.name ?? null,
  }
}

@Injectable()
export class AuthService {
  async register(dto: RegisterDto, ip: string) {
    await enforceRateLimit(`rl:register:${ip}`, 5, 3600, 'Registration limit reached. Try again in an hour.')

    const existing = await prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw AppError.conflict('An account with this email already exists')

    const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } })
    if (!customerRole) throw new AppError('INTERNAL_ERROR')

    const hashedPassword = await bcrypt.hash(dto.password, 12)

    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          roleId: customerRole.id,
          accounts: {
            create: {
              provider: 'credentials',
              providerAccountId: dto.email,
              password: hashedPassword,
            },
          },
        },
        include: { role: true },
      })
      return newUser
    })

    const otp = generateOtp()
    await storeOtp(`verify:email:${dto.email}`, otp)
    await sendOtpEmail(dto.email, otp, 'verify').catch(() => null)

    const refreshToken = generateRefreshToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    })

    const accessToken = signAccessToken({
      userId: user.id,
      roleId: user.roleId!,
      roleName: user.role!.name,
    })

    return { user: formatUser(user), accessToken, refreshToken }
  }

  async login(dto: LoginDto, ip: string, userAgent?: string) {
    await enforceRateLimit(`rl:login:${ip}`, 10, 900, 'Too many login attempts. Try again in 15 minutes.')

    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        role: true,
        accounts: { where: { provider: 'credentials' } },
      },
    })

    if (!user || !user.isActive) throw AppError.unauthorized('Invalid email or password')

    const account = user.accounts[0]
    if (!account?.password) throw AppError.unauthorized('Invalid email or password')

    const passwordValid = await bcrypt.compare(dto.password, account.password)
    if (!passwordValid) throw AppError.unauthorized('Invalid email or password')

    const refreshToken = generateRefreshToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        ipAddress: ip,
        userAgent,
        expiresAt,
        lastUsedAt: new Date(),
      },
    })

    const accessToken = signAccessToken({
      userId: user.id,
      roleId: user.roleId!,
      roleName: user.role!.name,
    })

    return { user: formatUser(user), accessToken, refreshToken }
  }

  async logout(refreshToken: string) {
    await prisma.session.deleteMany({ where: { token: refreshToken } })
    return { message: 'Logged out successfully' }
  }

  async refresh(dto: RefreshTokenDto) {
    const session = await prisma.session.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { include: { role: true } } },
    })

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } })
      throw AppError.unauthorized('Session expired. Please log in again.')
    }

    if (!session.user.isActive) throw AppError.unauthorized('Account is inactive.')

    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    const accessToken = signAccessToken({
      userId: session.user.id,
      roleId: session.user.roleId!,
      roleName: session.user.role!.name,
    })

    return { accessToken }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    await enforceRateLimit(`rl:forgot:${dto.email}`, 3, 3600, 'Too many reset attempts. Try again in an hour.')

    const user = await prisma.user.findUnique({ where: { email: dto.email } })
    // Always return same message to prevent email enumeration
    if (!user || !user.isActive) {
      return { message: 'If an account with that email exists, a reset OTP has been sent.' }
    }

    const otp = generateOtp()
    await storeOtp(`reset:password:${dto.email}`, otp)
    await sendOtpEmail(dto.email, otp, 'reset').catch(() => null)

    return { message: 'If an account with that email exists, a reset OTP has been sent.' }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const valid = await verifyOtp(`reset:password:${dto.email}`, dto.otp)
    if (!valid) throw new AppError('VALIDATION_ERROR', 422, [{ field: 'otp', message: 'Invalid or expired OTP' }])

    const user = await prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw AppError.notFound('User')

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12)

    await prisma.account.updateMany({
      where: { userId: user.id, provider: 'credentials' },
      data: { password: hashedPassword },
    })

    // Invalidate all sessions after password reset
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await redis.del(`user:${user.id}`)

    return { message: 'Password reset successfully. Please log in with your new password.' }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const valid = await verifyOtp(`verify:email:${dto.email}`, dto.otp)
    if (!valid) throw new AppError('VALIDATION_ERROR', 422, [{ field: 'otp', message: 'Invalid or expired OTP' }])

    const user = await prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw AppError.notFound('User')

    if (user.emailVerified) return { message: 'Email is already verified.' }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    })

    await redis.del(`user:${user.id}`)
    return { message: 'Email verified successfully.' }
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } })

    if (!user || user.emailVerified) {
      return { message: 'If a pending verification exists, a new OTP has been sent.' }
    }

    const otp = generateOtp()
    await storeOtp(`verify:email:${dto.email}`, otp)
    await sendOtpEmail(dto.email, otp, 'verify').catch(() => null)

    return { message: 'Verification OTP resent.' }
  }

  async getMe(userId: bigint) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })
    if (!user) throw AppError.notFound('User')

    const isAdmin = ADMIN_ROLES.includes(user.role?.name ?? '')

    return {
      ...formatUser(user),
      isAdmin,
    }
  }

  async vendorApply(dto: VendorApplyDto) {
    const [existingUser, existingVendor] = await Promise.all([
      prisma.user.findUnique({ where: { email: dto.email } }),
      prisma.vendor.findUnique({ where: { email: dto.email } }),
    ])
    if (existingUser || existingVendor) {
      throw AppError.conflict('An account with this email already exists')
    }

    const vendorRole = await prisma.role.findUnique({ where: { name: 'VENDOR' } })
    if (!vendorRole) throw AppError.notFound('VENDOR role')

    const hashedPassword = await bcrypt.hash(dto.password, 12)
    const slugBase = slugify(dto.businessName, { lower: true, strict: true })
    const slug = `${slugBase}-${nanoid(6)}`

    await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.businessName,
          phone: dto.phone,
          roleId: vendorRole.id,
          accounts: {
            create: {
              provider: 'credentials',
              providerAccountId: dto.email,
              password: hashedPassword,
            },
          },
        },
      })

      await tx.vendor.create({
        data: {
          userId: user.id,
          businessName: dto.businessName,
          email: dto.email,
          phone: dto.phone,
          gstin: dto.gstin,
          panNumber: dto.panNumber,
          slug,
          status: 'PENDING',
          isActive: false,
        },
      })
    })

    await Promise.allSettled([
      sendVendorApplicationEmail(dto.email, dto.businessName),
      sendNewVendorApplicationAdminEmail(dto.businessName, dto.email),
    ])

    return { message: 'Application submitted. Admin will review shortly.' }
  }
}
