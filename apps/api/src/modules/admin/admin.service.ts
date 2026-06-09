import { Injectable } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { AppError } from '../../lib/errors'
import type {
  CreateAdminDto,
  UpdateAdminDto,
  AssignPermissionDto,
  ListAdminsQueryDto,
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
}
