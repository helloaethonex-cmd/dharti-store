export type AuthContext = {
  userId: bigint
  userRole: string
  permissions: string[]
  vendorId?: bigint
  isAdmin: boolean
}

declare module 'express' {
  interface Request {
    auth?: AuthContext
  }
}
