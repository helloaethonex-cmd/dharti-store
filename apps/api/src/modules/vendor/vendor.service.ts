import { Injectable } from '@nestjs/common'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import type {
  UpdateVendorProfileDto,
  UploadDocumentDto,
  UpsertBankDetailsDto,
} from './vendor.schema'

function serializeVendor(vendor: {
  id: bigint
  publicId: string
  businessName: string
  brandName: string | null
  slug: string | null
  email: string
  phone: string | null
  gstin: string | null
  panNumber: string | null
  status: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  defaultCommissionRate: unknown
  settlementCycleDays: number
  isActive: boolean
  onboardedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: vendor.publicId,
    businessName: vendor.businessName,
    brandName: vendor.brandName,
    slug: vendor.slug,
    email: vendor.email,
    phone: vendor.phone,
    gstin: vendor.gstin,
    panNumber: vendor.panNumber,
    status: vendor.status,
    description: vendor.description,
    logoUrl: vendor.logoUrl,
    bannerUrl: vendor.bannerUrl,
    defaultCommissionRate: vendor.defaultCommissionRate?.toString() ?? null,
    settlementCycleDays: vendor.settlementCycleDays,
    isActive: vendor.isActive,
    onboardedAt: vendor.onboardedAt,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }
}

@Injectable()
export class VendorService {
  async getProfile(vendorId: bigint) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        address: true,
        bankDetails: {
          select: {
            id: true,
            accountHolderName: true,
            bankName: true,
            accountNumber: true,
            ifscCode: true,
            branchName: true,
            upiId: true,
            isVerified: true,
          },
        },
      },
    })

    if (!vendor) throw AppError.notFound('Vendor')

    return {
      ...serializeVendor(vendor),
      address: vendor.address,
      bankDetails: vendor.bankDetails
        ? {
            ...vendor.bankDetails,
            id: vendor.bankDetails.id.toString(),
          }
        : null,
    }
  }

  async updateProfile(vendorId: bigint, dto: UpdateVendorProfileDto) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor) throw AppError.notFound('Vendor')

    if (dto.gstin && dto.gstin !== vendor.gstin) {
      const existing = await prisma.vendor.findFirst({
        where: { gstin: dto.gstin, id: { not: vendorId } },
      })
      if (existing) throw AppError.conflict('A vendor with this GSTIN already exists')
    }

    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.brandName !== undefined && { brandName: dto.brandName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.gstin !== undefined && { gstin: dto.gstin }),
        ...(dto.panNumber !== undefined && { panNumber: dto.panNumber }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
      },
    })

    return serializeVendor(updated)
  }

  async uploadDocument(vendorId: bigint, dto: UploadDocumentDto) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor) throw AppError.notFound('Vendor')

    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
      },
    })

    return {
      id: doc.id.toString(),
      documentType: doc.documentType,
      documentUrl: doc.documentUrl,
      isVerified: doc.isVerified,
      createdAt: doc.createdAt,
    }
  }

  async getDocuments(vendorId: bigint) {
    const docs = await prisma.vendorDocument.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
    })

    return docs.map(d => ({
      id: d.id.toString(),
      documentType: d.documentType,
      documentUrl: d.documentUrl,
      isVerified: d.isVerified,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    }))
  }

  async upsertBankDetails(vendorId: bigint, dto: UpsertBankDetailsDto) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor) throw AppError.notFound('Vendor')

    const bankDetails = await prisma.vendorBankDetails.upsert({
      where: { vendorId },
      create: {
        vendorId,
        accountHolderName: dto.accountHolderName,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
        branchName: dto.branchName,
        upiId: dto.upiId,
      },
      update: {
        accountHolderName: dto.accountHolderName,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode,
        branchName: dto.branchName,
        upiId: dto.upiId,
        isVerified: false,
      },
    })

    return {
      id: bankDetails.id.toString(),
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      branchName: bankDetails.branchName,
      upiId: bankDetails.upiId,
      isVerified: bankDetails.isVerified,
      updatedAt: bankDetails.updatedAt,
    }
  }

  async getBankDetails(vendorId: bigint) {
    const bankDetails = await prisma.vendorBankDetails.findUnique({
      where: { vendorId },
    })

    if (!bankDetails) return null

    return {
      id: bankDetails.id.toString(),
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      branchName: bankDetails.branchName,
      upiId: bankDetails.upiId,
      isVerified: bankDetails.isVerified,
      updatedAt: bankDetails.updatedAt,
    }
  }
}
