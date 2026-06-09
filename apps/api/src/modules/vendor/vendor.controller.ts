import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { VendorService } from './vendor.service'
import { AuthGuard } from '../../middleware/auth.guard'
import { VendorAuthGuard } from '../../middleware/vendor-auth.guard'
import { ZodValidationPipe } from '../../middleware/validate'
import { ok } from '../../lib/response'
import {
  UpdateVendorProfileSchema,
  UploadDocumentSchema,
  UpsertBankDetailsSchema,
  type UpdateVendorProfileDto,
  type UploadDocumentDto,
  type UpsertBankDetailsDto,
} from './vendor.schema'

@Controller('vendor')
@UseGuards(AuthGuard, VendorAuthGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get('profile')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const data = await this.vendorService.getProfile(req.auth!.vendorId!)
    return ok(res, data)
  }

  @Patch('profile')
  async updateProfile(
    @Body(new ZodValidationPipe(UpdateVendorProfileSchema)) dto: UpdateVendorProfileDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.vendorService.updateProfile(req.auth!.vendorId!, dto)
    return ok(res, data)
  }

  @Post('documents')
  async uploadDocument(
    @Body(new ZodValidationPipe(UploadDocumentSchema)) dto: UploadDocumentDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.vendorService.uploadDocument(req.auth!.vendorId!, dto)
    return ok(res, data)
  }

  @Get('documents')
  async getDocuments(@Req() req: Request, @Res() res: Response) {
    const data = await this.vendorService.getDocuments(req.auth!.vendorId!)
    return ok(res, data)
  }

  @Patch('bank-details')
  async upsertBankDetails(
    @Body(new ZodValidationPipe(UpsertBankDetailsSchema)) dto: UpsertBankDetailsDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const data = await this.vendorService.upsertBankDetails(req.auth!.vendorId!, dto)
    return ok(res, data)
  }

  @Get('bank-details')
  async getBankDetails(@Req() req: Request, @Res() res: Response) {
    const data = await this.vendorService.getBankDetails(req.auth!.vendorId!)
    return ok(res, data)
  }
}
