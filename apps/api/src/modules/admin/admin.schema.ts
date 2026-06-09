import { z } from 'zod'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SEO_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN'] as const

export const CreateAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleName: z.enum(ADMIN_ROLES),
  phone: z.string().optional(),
  displayName: z.string().optional(),
})

export const UpdateAdminSchema = z
  .object({
    roleName: z.enum(ADMIN_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(d => d.roleName !== undefined || d.isActive !== undefined, {
    message: 'At least one of roleName or isActive must be provided',
  })

export const AssignPermissionSchema = z.object({
  permissionId: z.string().min(1, 'Permission ID is required'),
})

export const ListAdminsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
})

export type CreateAdminDto = z.infer<typeof CreateAdminSchema>
export type UpdateAdminDto = z.infer<typeof UpdateAdminSchema>
export type AssignPermissionDto = z.infer<typeof AssignPermissionSchema>
export type ListAdminsQueryDto = z.infer<typeof ListAdminsQuerySchema>

// ─── Vendor Management Schemas ────────────────────────────────────────────────

export const ListVendorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']).optional(),
  search: z.string().optional(),
})

export const ManualOnboardVendorSchema = z.object({
  businessName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  gstin: z.string().max(20).optional(),
  panNumber: z.string().max(15).optional(),
  password: z.string().min(8),
  defaultCommissionRate: z.coerce.number().min(0).max(100).optional(),
})

export const UpdateVendorAdminSchema = z.object({
  businessName: z.string().min(1).optional(),
  brandName: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().max(20).optional(),
  panNumber: z.string().max(15).optional(),
  defaultCommissionRate: z.coerce.number().min(0).max(100).optional(),
  settlementCycleDays: z.coerce.number().int().min(1).max(90).optional(),
})

export const SuspendVendorSchema = z.object({
  reason: z.string().min(1, 'Suspension reason is required'),
})

export const RejectVendorSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
})

export type ListVendorsQueryDto = z.infer<typeof ListVendorsQuerySchema>
export type ManualOnboardVendorDto = z.infer<typeof ManualOnboardVendorSchema>
export type UpdateVendorAdminDto = z.infer<typeof UpdateVendorAdminSchema>
export type SuspendVendorDto = z.infer<typeof SuspendVendorSchema>
export type RejectVendorDto = z.infer<typeof RejectVendorSchema>
