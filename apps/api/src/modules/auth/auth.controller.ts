import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { ZodValidationPipe } from '../../middleware/validate'
import { AuthGuard } from '../../middleware/auth.guard'
import { ok, created } from '../../lib/response'
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  VendorApplySchema,
  type RegisterDto,
  type LoginDto,
  type RefreshTokenDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type VerifyEmailDto,
  type ResendVerificationDto,
  type VendorApplyDto,
} from './auth.schema'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res() res: Response) {
    const ip = req.ip ?? 'unknown'
    const data = await this.authService.register(dto, ip)
    return created(res, data)
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const ip = req.ip ?? 'unknown'
    const userAgent = req.headers['user-agent']
    const data = await this.authService.login(dto, ip, userAgent)
    return ok(res, data)
  }

  @Post('logout')
  async logout(@Body() body: { refreshToken?: string }, @Res() res: Response) {
    const token = body.refreshToken ?? ''
    const data = await this.authService.logout(token)
    return ok(res, data)
  }

  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshTokenSchema))
  async refresh(@Body() dto: RefreshTokenDto, @Res() res: Response) {
    const data = await this.authService.refresh(dto)
    return ok(res, data)
  }

  @Post('forgot-password')
  @UsePipes(new ZodValidationPipe(ForgotPasswordSchema))
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request, @Res() res: Response) {
    const data = await this.authService.forgotPassword(dto)
    return ok(res, data)
  }

  @Post('reset-password')
  @UsePipes(new ZodValidationPipe(ResetPasswordSchema))
  async resetPassword(@Body() dto: ResetPasswordDto, @Res() res: Response) {
    const data = await this.authService.resetPassword(dto)
    return ok(res, data)
  }

  @Post('verify-email')
  @UsePipes(new ZodValidationPipe(VerifyEmailSchema))
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res() res: Response) {
    const data = await this.authService.verifyEmail(dto)
    return ok(res, data)
  }

  @Post('resend-verification')
  @UsePipes(new ZodValidationPipe(ResendVerificationSchema))
  async resendVerification(@Body() dto: ResendVerificationDto, @Res() res: Response) {
    const data = await this.authService.resendVerification(dto)
    return ok(res, data)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request, @Res() res: Response) {
    const data = await this.authService.getMe(req.auth!.userId)
    return ok(res, data)
  }

  @Post('vendor/apply')
  @UsePipes(new ZodValidationPipe(VendorApplySchema))
  async vendorApply(@Body() dto: VendorApplyDto, @Res() res: Response) {
    const data = await this.authService.vendorApply(dto)
    return created(res, data)
  }
}
