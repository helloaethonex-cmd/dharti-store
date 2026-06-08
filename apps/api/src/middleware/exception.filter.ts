import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import { Prisma } from '../generated/prisma/client'

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    if (err instanceof AppError) {
      const body: Record<string, unknown> = {
        success: false,
        error: { code: err.code, message: err.message },
      }
      if (err.details?.length) {
        (body['error'] as Record<string, unknown>)['details'] = err.details
      }
      return res.status(err.statusCode).json(body)
    }

    if (err instanceof HttpException) {
      return res.status(err.getStatus()).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: err.message },
      })
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: { code: 'CONFLICT', message: 'Resource already exists' },
        })
      }
      if (err.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
        })
      }
    }

    if (err instanceof ZodError) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      })
    }

    logger.error({ err, url: req.url, method: req.method }, 'Unhandled exception')

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    })
  }
}
