import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AccessTokenPayload {
  userId: string
  roleId: string
  roleName: string
}

export function signAccessToken(payload: AccessTokenInput): string {
  return jwt.sign(
    {
      userId: payload.userId.toString(),
      roleId: payload.roleId.toString(),
      roleName: payload.roleName,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'] },
  )
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
}

interface AccessTokenInput {
  userId: bigint
  roleId: bigint
  roleName: string
}
