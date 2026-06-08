import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from '../app.module'
import { AppExceptionFilter } from '../middleware/exception.filter'
import { env } from '../config/env'
import { logger } from '../lib/logger'

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    cors: {
      origin: env.APP_URL,
      credentials: true,
    },
  })

  app.setGlobalPrefix('api/v1')
  app.useGlobalFilters(new AppExceptionFilter())

  app.enableShutdownHooks()

  logger.info('Nest application created')

  return app
}
