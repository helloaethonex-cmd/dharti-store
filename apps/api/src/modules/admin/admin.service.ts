import { Injectable } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import slugify from 'slugify'
import { nanoid } from 'nanoid'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { AppError } from '../../lib/errors'
import {
  sendVendorApprovalEmail,
  sendVendorSuspensionEmail,
  sendVendorRejectionEmail,
} from '../../lib/email'
import type {
  CreateAdminDto,
  UpdateAdminDto,
  AssignPermissionDto,
  ListAdminsQueryDto,
  ListVendorsQueryDto,
  ManualOnboardVendorDto,
  UpdateVendorAdminDto,
  SuspendVendorDto,
  RejectVendorDto,
} from './admin.schema'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SEO_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN']

function serializeAdmin(user: {
  id: bigint
  publicId: string
  email: string
  name: string | null
  phone: string | null
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  role?: { id: bigint; name: string } | null
  adminProfile?: { displayName: string | null; adminType: string; isActive: boolean; lastLoginAt: Date | null } | null
}) {
  return {
    id: user.publicId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    role: user.role?.name ?? null,
    adminProfile: user.adminProfile
      ? {
          displayName: user.adminProfile.displayName,
          adminType: user.adminProfile.adminType,
          isActive: user.adminProfile.isActive,
          lastLoginAt: user.adminProfile.lastLoginAt,
        }
      : null,
  }
}

@Injectable()
export class AdminService {
  async getRoles() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    })

    return roles.map(role => ({
      id: role.id.toString(),
      name: role.name,
      userCount: role._count.users,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id.toString(),
        name: rp.permission.name,
      })),
    }))
  }

  async getPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' },
    })

    return permissions.map(p => ({
      id: p.id.toString(),
      name: p.name,
    }))
  }

  async createAdmin(dto: CreateAdminDto) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw AppError.conflict('An account with this email already exists')

    const role = await prisma.role.findUnique({ where: { name: dto.roleName } })
    if (!role) throw AppError.notFound('Role')

    const hashedPassword = await bcrypt.hash(dto.password, 12)

    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          roleId: role.id,
          emailVerified: true,
          accounts: {
            create: {
              provider: 'credentials',
              providerAccountId: dto.email,
              password: hashedPassword,
            },
          },
          adminProfile: {
            create: {
              adminType: dto.roleName,
              displayName: dto.displayName ?? dto.name,
            },
          },
        },
        include: {
          role: true,
          adminProfile: true,
        },
      })
      return newUser
    })

    return serializeAdmin(user)
  }

  async getAdmins(query: ListAdminsQueryDto) {
    const { page, limit, search } = query
    const skip = (page - 1) * limit

    const where = {
      role: { name: { in: ADMIN_ROLES } },
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true, adminProfile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return {
      admins: users.map(serializeAdmin),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getAdmin(publicId: string) {
    const user = await prisma.user.findUnique({
      where: { publicId },
      include: {
        role: true,
        adminProfile: true,
      },
    })

    if (!user || !user.role || !ADMIN_ROLES.includes(user.role.name)) {
      throw AppError.notFound('Admin')
    }

    return serializeAdmin(user)
  }

  async updateAdmin(publicId: string, dto: UpdateAdminDto, requestingUserId: bigint) {
    const user = await prisma.user.findUnique({
      where: { publicId },
      include: { role: true },
    })

    if (!user || !user.role || !ADMIN_ROLES.includes(user.role.name)) {
      throw AppError.notFound('Admin')
    }

    if (dto.isActive === false && user.id === requestingUserId) {
      throw AppError.forbidden('You cannot deactivate your own account')
    }

    // Prevent removing the last SUPER_ADMIN
    if (dto.roleName && dto.roleName !== 'SUPER_ADMIN' && user.role.name === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({
        where: { role: { name: 'SUPER_ADMIN' }, isActive: true },
      })
      if (superAdminCount <= 1) {
        throw AppError.forbidden('Cannot change role of the last active Super Admin')
      }
    }

    const updateData: Record<string, unknown> = {}

    if (dto.roleName) {
      const newRole = await prisma.role.findUnique({ where: { name: dto.roleName } })
      if (!newRole) throw AppError.notFound('Role')
      updateData.roleId = newRole.id
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive
    }

    const updated = await prisma.$transaction(async tx => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: updateData,
        include: { role: true, adminProfile: true },
      })

      if (dto.roleName) {
        await tx.adminProfile.update({
          where: { userId: user.id },
          data: { adminType: dto.roleName },
        })
      }

      if (dto.isActive !== undefined) {
        await tx.adminProfile.update({
          where: { userId: user.id },
          data: { isActive: dto.isActive },
        })
      }

      return updatedUser
    })

    // Invalidate cached auth context
    await redis.del(`user:${user.id}`)

    return serializeAdmin(updated)
  }

  async deleteAdmin(publicId: string, requestingUserId: bigint) {
    const user = await prisma.user.findUnique({
      where: { publicId },
      include: { role: true },
    })

    if (!user || !user.role || !ADMIN_ROLES.includes(user.role.name)) {
      throw AppError.notFound('Admin')
    }

    if (user.id === requestingUserId) {
      throw AppError.forbidden('You cannot deactivate your own account')
    }

    if (user.role.name === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({
        where: { role: { name: 'SUPER_ADMIN' }, isActive: true },
      })
      if (superAdminCount <= 1) {
        throw AppError.forbidden('Cannot deactivate the last active Super Admin')
      }
    }

    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: user.id },
        data: { isActive: false },
      })
      await tx.adminProfile.update({
        where: { userId: user.id },
        data: { isActive: false },
      })
    })

    await redis.del(`user:${user.id}`)

    return { message: 'Admin deactivated successfully' }
  }

  async assignPermission(roleId: string, dto: AssignPermissionDto) {
    const roleIdBig = BigInt(roleId)
    const permIdBig = BigInt(dto.permissionId)

    const [role, permission] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleIdBig } }),
      prisma.permission.findUnique({ where: { id: permIdBig } }),
    ])

    if (!role) throw AppError.notFound('Role')
    if (!permission) throw AppError.notFound('Permission')

    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: roleIdBig, permissionId: permIdBig } },
    })

    if (existing) throw AppError.conflict('Permission already assigned to this role')

    await prisma.rolePermission.create({
      data: { roleId: roleIdBig, permissionId: permIdBig },
    })

    // Invalidate all users in this role
    await this.invalidateRoleCache(roleIdBig)

    return {
      message: `Permission '${permission.name}' assigned to role '${role.name}'`,
      roleId: role.id.toString(),
      permissionId: permission.id.toString(),
    }
  }

  async removePermission(roleId: string, permId: string) {
    const roleIdBig = BigInt(roleId)
    const permIdBig = BigInt(permId)

    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: roleIdBig, permissionId: permIdBig } },
    })

    if (!existing) throw AppError.notFound('Permission assignment')

    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: roleIdBig, permissionId: permIdBig } },
    })

    await this.invalidateRoleCache(roleIdBig)

    return { message: 'Permission removed from role' }
  }

  private async invalidateRoleCache(roleId: bigint) {
    const users = await prisma.user.findMany({
      where: { roleId },
      select: { id: true },
    })
    if (users.length > 0) {
      const pipeline = redis.pipeline()
      users.forEach(u => pipeline.del(`user:${u.id}`))
      await pipeline.exec()
    }
  }

  // ─── Vendor Management ──────────────────────────────────────────────────────

  private serializeVendor(vendor: {
    id: bigint
    publicId: string
    businessName: string
    brandName: string | null
    slug: string | null
    email: string
    phone: string | null
    gstin: string | null
    panNumber: string | null
    status: string
    isActive: boolean
    onboardedAt: Date | null
    defaultCommissionRate: unknown
    settlementCycleDays: number
    createdAt: Date
    updatedAt: Date
    deletedAt: Date | null
    user?: { id: bigint; publicId: string; name: string | null; emailVerified: boolean } | null
    documents?: { id: bigint; documentType: string; isVerified: boolean }[]
    bankDetails?: { id: bigint; accountHolderName: string; bankName: string; isVerified: boolean } | null
  }) {
    return {
      id: vendor.publicId,
      businessName: vendor.businessName,
      brandName: vendor.brandName,
      slug: vendor.slug,
      email: vendor.email,
      phone: vendor.phone,
      gstin: vendor.gstin,
      panNumber: vendor.panNumber,
      status: vendor.status,
      isActive: vendor.isActive,
      onboardedAt: vendor.onboardedAt,
      defaultCommissionRate: vendor.defaultCommissionRate?.toString() ?? null,
      settlementCycleDays: vendor.settlementCycleDays,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      user: vendor.user
        ? { id: vendor.user.publicId, name: vendor.user.name, emailVerified: vendor.user.emailVerified }
        : undefined,
      documents: vendor.documents?.map(d => ({
        id: d.id.toString(),
        documentType: d.documentType,
        isVerified: d.isVerified,
      })),
      bankDetails: vendor.bankDetails
        ? {
            id: vendor.bankDetails.id.toString(),
            accountHolderName: vendor.bankDetails.accountHolderName,
            bankName: vendor.bankDetails.bankName,
            isVerified: vendor.bankDetails.isVerified,
          }
        : null,
    }
  }

  async listVendors(query: ListVendorsQueryDto) {
    const { page, limit, status, search } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          user: { select: { id: true, publicId: true, name: true, emailVerified: true } },
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ])

    return {
      vendors: vendors.map(v => ({
        ...this.serializeVendor(v),
        productCount: v._count.products,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async getVendor(publicId: string) {
    const vendor = await prisma.vendor.findUnique({
      where: { publicId },
      include: {
        user: { select: { id: true, publicId: true, name: true, emailVerified: true } },
        documents: true,
        bankDetails: true,
        address: true,
      },
    })

    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')

    return this.serializeVendor(vendor)
  }

  async manualOnboardVendor(dto: ManualOnboardVendorDto) {
    const [existingUser, existingVendor] = await Promise.all([
      prisma.user.findUnique({ where: { email: dto.email } }),
      prisma.vendor.findUnique({ where: { email: dto.email } }),
    ])
    if (existingUser || existingVendor) throw AppError.conflict('An account with this email already exists')

    const vendorRole = await prisma.role.findUnique({ where: { name: 'VENDOR' } })
    if (!vendorRole) throw AppError.notFound('VENDOR role')

    const hashedPassword = await bcrypt.hash(dto.password, 12)
    const slugBase = slugify(dto.businessName, { lower: true, strict: true })
    const slug = `${slugBase}-${nanoid(6)}`

    const vendor = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.businessName,
          phone: dto.phone,
          roleId: vendorRole.id,
          emailVerified: true,
          accounts: {
            create: {
              provider: 'credentials',
              providerAccountId: dto.email,
              password: hashedPassword,
            },
          },
        },
      })

      return tx.vendor.create({
        data: {
          userId: user.id,
          businessName: dto.businessName,
          email: dto.email,
          phone: dto.phone,
          gstin: dto.gstin,
          panNumber: dto.panNumber,
          slug,
          status: 'ACTIVE',
          isActive: true,
          onboardedAt: new Date(),
          ...(dto.defaultCommissionRate !== undefined && {
            defaultCommissionRate: dto.defaultCommissionRate,
          }),
        },
        include: {
          user: { select: { id: true, publicId: true, name: true, emailVerified: true } },
        },
      })
    })

    return this.serializeVendor(vendor)
  }

  async updateVendor(publicId: string, dto: UpdateVendorAdminDto) {
    const vendor = await prisma.vendor.findUnique({ where: { publicId } })
    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')

    if (dto.gstin && dto.gstin !== vendor.gstin) {
      const existing = await prisma.vendor.findFirst({
        where: { gstin: dto.gstin, id: { not: vendor.id } },
      })
      if (existing) throw AppError.conflict('A vendor with this GSTIN already exists')
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.brandName !== undefined && { brandName: dto.brandName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.gstin !== undefined && { gstin: dto.gstin }),
        ...(dto.panNumber !== undefined && { panNumber: dto.panNumber }),
        ...(dto.defaultCommissionRate !== undefined && { defaultCommissionRate: dto.defaultCommissionRate }),
        ...(dto.settlementCycleDays !== undefined && { settlementCycleDays: dto.settlementCycleDays }),
      },
      include: {
        user: { select: { id: true, publicId: true, name: true, emailVerified: true } },
      },
    })

    return this.serializeVendor(updated)
  }

  async approveVendor(publicId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { publicId } })
    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')
    if (vendor.status !== 'PENDING') {
      throw AppError.conflict(`Vendor is already ${vendor.status.toLowerCase()}`)
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { status: 'ACTIVE', isActive: true, onboardedAt: new Date() },
    })

    await sendVendorApprovalEmail(vendor.email, vendor.businessName)

    return this.serializeVendor(updated)
  }

  async suspendVendor(publicId: string, dto: SuspendVendorDto) {
    const vendor = await prisma.vendor.findUnique({ where: { publicId } })
    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')
    if (vendor.status === 'SUSPENDED') throw AppError.conflict('Vendor is already suspended')

    await prisma.$transaction(async tx => {
      await tx.vendor.update({
        where: { id: vendor.id },
        data: { status: 'SUSPENDED', isActive: false },
      })
      await tx.product.updateMany({
        where: { vendorId: vendor.id },
        data: { isActive: false },
      })
    })

    await sendVendorSuspensionEmail(vendor.email, vendor.businessName, dto.reason)

    return { message: 'Vendor suspended successfully' }
  }

  async rejectVendor(publicId: string, dto: RejectVendorDto) {
    const vendor = await prisma.vendor.findUnique({ where: { publicId } })
    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')
    if (vendor.status !== 'PENDING') {
      throw AppError.conflict(`Cannot reject a vendor with status ${vendor.status}`)
    }

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { status: 'REJECTED', isActive: false },
    })

    await sendVendorRejectionEmail(vendor.email, vendor.businessName, dto.reason)

    return { message: 'Vendor application rejected' }
  }

  async softDeleteVendor(publicId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { publicId } })
    if (!vendor || vendor.deletedAt) throw AppError.notFound('Vendor')

    await prisma.$transaction(async tx => {
      await tx.vendor.update({
        where: { id: vendor.id },
        data: { deletedAt: new Date(), isActive: false, status: 'SUSPENDED' },
      })
      await tx.product.updateMany({
        where: { vendorId: vendor.id },
        data: { isActive: false },
      })
    })

    return { message: 'Vendor removed successfully' }
  }
}
