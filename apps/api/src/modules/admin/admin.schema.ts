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
