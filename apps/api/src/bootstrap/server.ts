import { createApp } from './app'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'

export async function startServer() {
  await prisma.$connect()
  logger.info('Database connected')

  const app = await createApp()
  await app.listen(env.PORT)

  logger.info({ port: env.PORT, env: env.NODE_ENV }, `API listening on port ${env.PORT}`)
}
