import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { AppError } from '../lib/errors'

export const PERMISSIONS_KEY = 'permissions'

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? []

    if (required.length === 0) return true

    const request = context.switchToHttp().getRequest<Request>()
    const userPermissions = request.auth?.permissions ?? []
    const hasAll = required.every(p => userPermissions.includes(p))

    if (!hasAll) throw AppError.forbidden('Insufficient permissions')
    return true
  }
}
