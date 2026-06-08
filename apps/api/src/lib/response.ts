import type { Response } from 'express'
import type { ErrorCode } from './errors'

export interface ApiMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function ok(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data })
}

export function created(res: Response, data: unknown) {
  return ok(res, data, 201)
}

export function paginated(res: Response, data: unknown, meta: ApiMeta) {
  return res.status(200).json({ success: true, data, meta })
}

export function fail(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown[],
) {
  const body: Record<string, unknown> = { success: false, error: { code, message } }
  if (details?.length) body['error'] = { ...body['error'] as object, details }
  return res.status(statusCode).json(body)
}
