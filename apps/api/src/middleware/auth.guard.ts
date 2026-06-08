import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { verifyAccessToken } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { AppError } from '../lib/errors'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SEO_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN']
const USER_CACHE_TTL = 60 // seconds

interface CachedUser {
  id: string
  roleId: string
  roleName: string
  isActive: boolean
  permissions: string[]
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header')
    }

    const token = authHeader.slice(7)
    let payload: ReturnType<typeof verifyAccessToken>

    try {
      payload = verifyAccessToken(token)
    } catch {
      throw AppError.unauthorized('Invalid or expired token')
    }

    const userId = BigInt(payload.userId)
    const cacheKey = `user:${userId}`

    let cached = await redis.get(cacheKey)
    let userData: CachedUser

    if (cached) {
      userData = JSON.parse(cached) as CachedUser
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      })

      if (!user || !user.isActive) throw AppError.unauthorized('User not found or inactive')

      const permissions = user.role?.permissions.map(rp => rp.permission.name) ?? []

      userData = {
        id: user.id.toString(),
        roleId: user.roleId?.toString() ?? '',
        roleName: user.role?.name ?? '',
        isActive: user.isActive,
        permissions,
      }

      await redis.set(cacheKey, JSON.stringify(userData), 'EX', USER_CACHE_TTL)
    }

    if (!userData.isActive) throw AppError.unauthorized('Account is inactive')

    request.auth = {
      userId,
      userRole: userData.roleName,
      permissions: userData.permissions,
      isAdmin: ADMIN_ROLES.includes(userData.roleName),
    }

    return true
  }
}
