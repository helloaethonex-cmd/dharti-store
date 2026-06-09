import { z } from 'zod'

export const UpdateVendorProfileSchema = z.object({
  businessName: z.string().min(1).optional(),
  brandName: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().max(20).optional(),
  panNumber: z.string().max(15).optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
})

export const UploadDocumentSchema = z.object({
  documentType: z.enum(['GST_CERTIFICATE', 'PAN_CARD', 'MSME_CERT', 'CANCELLED_CHEQUE']),
  documentUrl: z.string().url(),
})

export const UpsertBankDetailsSchema = z.object({
  accountHolderName: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(5).max(30),
  ifscCode: z.string().min(5).max(20),
  branchName: z.string().optional(),
  upiId: z.string().max(100).optional(),
})

export type UpdateVendorProfileDto = z.infer<typeof UpdateVendorProfileSchema>
export type UploadDocumentDto = z.infer<typeof UploadDocumentSchema>
export type UpsertBankDetailsDto = z.infer<typeof UpsertBankDetailsSchema>
