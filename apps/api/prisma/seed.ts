import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! })
const prisma = new PrismaClient({ adapter })

// ─── Permissions ──────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  'vendor:read', 'vendor:write', 'vendor:onboard', 'vendor:suspend',
  'product:read', 'product:write', 'product:delete', 'product:seo', 'product:approve',
  'category:read', 'category:write',
  'brand:read', 'brand:write',
  'order:read', 'order:write', 'order:manage', 'order:cancel',
  'finance:read', 'finance:write', 'finance:settle', 'finance:config',
  'coupon:read', 'coupon:write',
  'analytics:read',
  'system:admin',
  'influencer:read', 'influencer:write',
]

// ─── Role → Permission mapping ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  SEO_ADMIN: [
    'product:read', 'product:write', 'product:seo',
    'category:read', 'category:write',
    'brand:read',
  ],
  FINANCE_ADMIN: [
    'finance:read', 'finance:write', 'finance:settle',
    'analytics:read', 'order:read',
  ],
  OPERATIONS_ADMIN: [
    'order:read', 'order:write', 'order:manage',
    'vendor:read', 'product:read', 'analytics:read',
  ],
  VENDOR: [],
  CUSTOMER: [],
}

async function main() {
  console.log('🌱 Starting seed...')

  // ─── Roles ────────────────────────────────────────────────────────────────

  const roles: Record<string, bigint> = {}
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
    roles[roleName] = role.id
    console.log(`  ✓ Role: ${roleName}`)
  }

  // ─── Permissions ──────────────────────────────────────────────────────────

  const permissions: Record<string, bigint> = {}
  for (const permName of ALL_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    })
    permissions[permName] = perm.id
    console.log(`  ✓ Permission: ${permName}`)
  }

  // ─── Role → Permission assignments ────────────────────────────────────────

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roles[roleName]!
    for (const permName of perms) {
      const permId = permissions[permName]!
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      })
    }
    console.log(`  ✓ Assigned ${perms.length} permissions → ${roleName}`)
  }

  // ─── Super Admin user ─────────────────────────────────────────────────────

  const superAdminEmail = process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@dhartistore.in'
  const superAdminPassword = process.env['SUPER_ADMIN_PASSWORD'] ?? 'Admin@1234!'
  const superAdminRoleId = roles['SUPER_ADMIN']!

  const existingAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } })

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 12)

    const adminUser = await prisma.user.create({
      data: {
        email: superAdminEmail,
        name: 'Super Admin',
        isActive: true,
        emailVerified: true,
        roleId: superAdminRoleId,
        accounts: {
          create: {
            provider: 'credentials',
            providerAccountId: superAdminEmail,
            password: hashedPassword,
          },
        },
        adminProfile: {
          create: {
            displayName: 'Super Admin',
            adminType: 'SUPER_ADMIN',
            isActive: true,
          },
        },
      },
    })

    console.log(`  ✓ Super Admin created: ${adminUser.email}`)
  } else {
    console.log(`  ✓ Super Admin already exists: ${superAdminEmail}`)
  }

  // ─── Platform Financial Config ────────────────────────────────────────────

  await prisma.platformFinancialConfig.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      id: BigInt(1),
      defaultCommissionRate: 10,
      defaultGstOnCommission: 18,
      defaultGstRate: 18,
      paymentGatewayFeeRate: 2,
      platformGstin: process.env['PLATFORM_GSTIN'] ?? '22AAAAA0000A1Z5',
      platformLegalName: process.env['PLATFORM_LEGAL_NAME'] ?? 'Dharti Store Pvt Ltd',
      platformAddress: process.env['PLATFORM_ADDRESS'] ?? '123, Main Street, Bengaluru - 560001',
      platformState: process.env['PLATFORM_STATE'] ?? 'Karnataka',
    },
  })
  console.log('  ✓ PlatformFinancialConfig seeded')

  console.log('🌱 Seed complete!')
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
