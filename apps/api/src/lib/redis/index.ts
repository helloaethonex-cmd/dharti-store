import Redis from 'ioredis'

function createRedisClient() {
  const client = new Redis(process.env['REDIS_URL']!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  client.on('error', err => {
    console.error('[redis] connection error', err)
  })

  return client
}

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env['NODE_ENV'] !== 'production') {
  globalForRedis.redis = redis
}

export { Redis }
