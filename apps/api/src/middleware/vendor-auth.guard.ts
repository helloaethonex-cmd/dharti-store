import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'

@Injectable()
export class VendorAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const userId = request.auth?.userId

    if (!userId) throw AppError.unauthorized('Not authenticated')

    const vendor = await prisma.vendor.findFirst({
      where: { userId, status: 'ACTIVE', isActive: true, deletedAt: null },
      select: { id: true },
    })

    if (!vendor) throw AppError.from('VENDOR_INACTIVE', 403, 'Your vendor account is not active')

    request.auth = { ...(request.auth!), vendorId: vendor.id }

    return true
  }
}
