import { redis } from './redis'
import { AppError } from './errors'

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  errorMessage = 'Too many requests. Please try again later.',
): Promise<void> {
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  if (count > limit) throw new AppError('VALIDATION_ERROR', 429, [{ message: errorMessage }])
}
