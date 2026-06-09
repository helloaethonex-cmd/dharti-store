import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AdminService } from './admin.service'
import { AuthGuard } from '../../middleware/auth.guard'
import { RbacGuard, Permissions } from '../../middleware/rbac'
import { ZodValidationPipe } from '../../middleware/validate'
import { ok, created, paginated } from '../../lib/response'
import {
  CreateAdminSchema,
  UpdateAdminSchema,
  AssignPermissionSchema,
  ListAdminsQuerySchema,
  type CreateAdminDto,
  type UpdateAdminDto,
  type AssignPermissionDto,
  type ListAdminsQueryDto,
} from './admin.schema'

@Controller('admin')
@UseGuards(AuthGuard, RbacGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('roles')
  @Permissions('system:admin')
  async getRoles(@Res() res: Response) {
    const data = await this.adminService.getRoles()
    return ok(res, data)
  }

  @Get('permissions')
  @Permissions('system:admin')
  async getPermissions(@Res() res: Response) {
    const data = await this.adminService.getPermissions()
    return ok(res, data)
  }

  @Post('admins')
  @Permissions('system:admin')
  async createAdmin(
    @Body(new ZodValidationPipe(CreateAdminSchema)) dto: CreateAdminDto,
    @Res() res: Response,
  ) {
    const data = await this.adminService.createAdmin(dto)
    return created(res, data)
  }

  @Get('admins')
  @Permissions('system:admin')
  async getAdmins(
    @Query(new ZodValidationPipe(ListAdminsQuerySchema)) query: ListAdminsQueryDto,
    @Res() res: Response,
  ) {
    const { admins, meta } = await this.adminService.getAdmins(query)
    return paginated(res, admins, meta)
  }

  @Get('admins/:id')
  @Permissions('system:admin')
  async getAdmin(@Param('id') id: string, @Res() res: Response) {
    const data = await this.adminService.getAdmin(id)
    return ok(res, data)
  }

  @Patch('admins/:id')
  @Permissions('system:admin')
  async updateAdmin(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAdminSchema)) dto: UpdateAdminDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.adminService.updateAdmin(id, dto, req.auth!.userId)
    return ok(res, data)
  }

  @Delete('admins/:id')
  @Permissions('system:admin')
  async deleteAdmin(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.adminService.deleteAdmin(id, req.auth!.userId)
    return ok(res, data)
  }

  @Post('roles/:roleId/permissions')
  @Permissions('system:admin')
  async assignPermission(
    @Param('roleId') roleId: string,
    @Body(new ZodValidationPipe(AssignPermissionSchema)) dto: AssignPermissionDto,
    @Res() res: Response,
  ) {
    const data = await this.adminService.assignPermission(roleId, dto)
    return created(res, data)
  }

  @Delete('roles/:roleId/permissions/:permId')
  @Permissions('system:admin')
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permId') permId: string,
    @Res() res: Response,
  ) {
    const data = await this.adminService.removePermission(roleId, permId)
    return ok(res, data)
  }
}
