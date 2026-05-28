# Dharti Store — Prisma Schema Build Plan for Claude Code

## Overview

This document is a precise, implementation-ready plan for Claude Code to generate
`schema.prisma` for the Dharti Store multi-vendor marketplace. It references the
existing e-commerce schema (attached) as a base and extends it with all
marketplace-specific systems.

---

## Ground Rules for Claude Code

1. Use `postgresql` as the datasource provider.
2. All table names in `@@map()` use `snake_case`.
3. All field names in `@map()` use `snake_case`.
4. All model-level IDs use `BigInt @id @default(autoincrement())`.
5. All money/financial fields use `Decimal @db.Decimal(10, 2)` unless noted.
6. All percentage fields use `Decimal @db.Decimal(5, 2)`.
7. Use `soft deletes` (`deletedAt DateTime?`) on all major entities.
8. Every model gets `createdAt` and `updatedAt`.
9. Add `@@index` on every foreign key and every field used in WHERE clauses.
10. Carry over the full existing schema unchanged, then extend/modify as noted below.

---

## System Map — What to Build

```
01. Auth & User System          → carry over + extend
02. RBAC System                 → carry over + extend for marketplace roles
03. Vendor System               → NEW (core of marketplace)
04. Brand System                → NEW (vendors can own brands)
05. Category System             → carry over (no changes needed)
06. Product & Variant System    → extend (add vendorId, financial config)
07. Inventory System            → extend (vendor-aware)
08. Cart & Checkout             → carry over (no changes needed)
09. Order & Sub-order System    → extend (VendorOrder per vendor per order)
10. Financial Config System     → NEW (commission, charges config)
11. Vendor Earnings System      → NEW (per-item earnings ledger)
12. Vendor Settlement System    → NEW (payout batches)
13. Invoice System              → extend (two invoice types: product + commission)
14. Coupon & Discount System    → NEW (basic structure for post-launch)
15. Notification System         → NEW (basic)
16. Analytics Snapshot System   → NEW (daily aggregates)
17. Review System               → carry over (no changes needed)
18. Influencer System           → carry over (no changes needed)
```

---

## Section-by-Section Instructions

---

### 01. Auth & User System

**Carry over unchanged:** `User`, `Session`, `Account`, `Verification`

**Extend `User` with:**
```
vendor     Vendor?          // one user can be a vendor account
adminProfile AdminProfile? // one user can be an admin with profile
```

No other changes to auth models.

---

### 02. RBAC System

**Carry over unchanged:** `Role`, `Permission`, `RolePermission`

**Add new model: `AdminProfile`**

Purpose: Extended profile for admin users. Stores which admin role category
they belong to beyond RBAC (for UI routing and audit).

```
model AdminProfile {
  id         BigInt   @id @default(autoincrement())
  userId     BigInt   @unique
  user       User

  displayName String?
  // e.g. "Super Admin", "SEO Admin", "Finance Admin", "Operations Admin"
  adminType   String   @db.VarChar(50)

  isActive    Boolean  @default(true)
  lastLoginAt DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("admin_profiles")
}
```

**Seed-ready permission names to document in comments:**
```
// vendor:read, vendor:write, vendor:onboard
// product:read, product:write, product:seo
// order:read, order:write, order:manage
// finance:read, finance:write, finance:settle
// analytics:read
// coupon:read, coupon:write
// system:admin
```

---

### 03. Vendor System

This is the heart of the marketplace. A Vendor is a seller onboarded by admin.

**Model: `Vendor`**
```
Fields:
- id, publicId (uuid, unique)
- userId BigInt @unique (links to User for dashboard login)
- user User

- businessName String
- brandName    String?          // display name on storefront
- slug         String? @unique  // /shop/slug

- email        String @unique
- phone        String?

- gstin        String? @unique  @db.VarChar(20)  // GST registration number
- panNumber    String? @db.VarChar(15)

- status       VendorStatus enum (PENDING | ACTIVE | SUSPENDED | REJECTED)

- description  String?          // storefront bio
- logoUrl      String?
- bannerUrl    String?

- defaultCommissionRate Decimal? // fallback commission if product has none
- settlementCycleDays  Int @default(7)

- isActive     Boolean @default(false) // flipped by admin on approval

- onboardedAt  DateTime?
- createdAt, updatedAt, deletedAt

Relations:
- products       Product[]
- orders         VendorOrder[]
- earnings       VendorEarning[]
- settlements    VendorSettlement[]
- documents      VendorDocument[]
- bankDetails    VendorBankDetails?
- address        VendorAddress?
- brands         Brand[]

@@map("vendors")
```

**Enum: `VendorStatus`** → `PENDING | ACTIVE | SUSPENDED | REJECTED`

---

**Model: `VendorDocument`**

For KYC — GST certificate, PAN, MSME cert, etc.

```
Fields:
- id
- vendorId
- vendor     Vendor

- documentType  String   @db.VarChar(50)
  // "GST_CERTIFICATE" | "PAN_CARD" | "MSME_CERT" | "CANCELLED_CHEQUE"
- documentUrl   String
- isVerified    Boolean @default(false)
- verifiedAt    DateTime?
- verifiedBy    BigInt?  // admin userId

- createdAt, updatedAt

@@map("vendor_documents")
```

---

**Model: `VendorBankDetails`**

```
Fields:
- id (vendorId @id — one per vendor)
- vendorId    BigInt @unique
- vendor      Vendor

- accountHolderName String
- bankName          String
- accountNumber     String @db.VarChar(30)
- ifscCode          String @db.VarChar(20)
- branchName        String?

- upiId             String? @db.VarChar(100)

- isVerified        Boolean @default(false)

- createdAt, updatedAt

@@map("vendor_bank_details")
```

---

**Model: `VendorAddress`**

```
Fields:
- id (vendorId @id)
- vendorId   BigInt @unique
- line1, line2, city, state, postalCode, country
- createdAt, updatedAt

@@map("vendor_addresses")
```

---

### 04. Brand System

Brands are distinct from vendors. One vendor can own multiple brands. A product belongs to one brand.

**Model: `Brand`**
```
Fields:
- id
- name      String @unique
- slug      String? @unique
- logoUrl   String?
- vendorId  BigInt? // null = platform brand (admin-owned)
- vendor    Vendor?

- isActive  Boolean @default(true)
- createdAt, updatedAt, deletedAt

Relations:
- products Product[]

@@map("brands")
```

---

### 05. Category System

**Carry over unchanged.** `Category` model supports parent/child hierarchy already.

---

### 06. Product & Variant System

**Extend `Product`:**

Add these fields to existing `Product`:
```
- vendorId    BigInt?  // null = platform/admin product
- vendor      Vendor?

- brandId     BigInt?
- brand       Brand?

// SEO fields (SEO admin manages these)
- metaTitle       String?
- metaDescription String?
- metaKeywords    String?

// Admin controls
- isAdminApproved Boolean @default(false) @map("is_admin_approved")
- approvedAt      DateTime?
- approvedBy      BigInt?  // admin userId
```

**Extend `ProductVariant`:**

Add these fields:
```
- commissionRate     Decimal?  // overrides vendor default if set
- commissionType     String?   // "PERCENTAGE" | "FLAT"
  @db.VarChar(20)

- gstRate            Decimal @default(18)  // already exists, keep

- shippingChargeType String? @db.VarChar(20) // "FREE" | "FIXED" | "VARIABLE"
- shippingCharge     Decimal? // fixed charge if FIXED

- hsnCode            String? @db.VarChar(20) // for GST invoice
```

---

### 07. Inventory System

**Carry over `InventoryReservation` unchanged.**

**Add new model: `InventoryLog`**

For auditable stock change history per vendor:
```
Fields:
- id
- productVariantId
- productVariant     ProductVariant

- changeType  String @db.VarChar(30)
  // "MANUAL_ADD" | "MANUAL_REDUCE" | "ORDER_RESERVED" |
  // "ORDER_CONFIRMED" | "ORDER_CANCELLED" | "RETURN_RESTOCKED"

- quantityBefore Int
- quantityChange  Int  // positive = added, negative = reduced
- quantityAfter   Int

- orderId    BigInt?
- changedBy  BigInt?  // userId (vendor or admin)
- note       String?

- createdAt  DateTime @default(now())

@@index([productVariantId, createdAt])
@@map("inventory_logs")
```

---

### 08. Cart & Checkout

**Carry over unchanged:** `Cart`, `CartItem`

---

### 09. Order & Sub-Order System

The key extension: one `Order` (customer-level) can contain items from multiple vendors.
A `VendorOrder` is created per vendor per order — this is what the vendor sees in their dashboard.

**Extend `Order`:**

Add:
```
- couponId       BigInt?   // nullable ref to Coupon
- couponCode     String?   // snapshot
- couponDiscount Decimal?  // snapshot amount
- notes          String?   // customer note at checkout
```

---

**New Model: `VendorOrder`**

The sub-order per vendor. Critical for vendor dashboard.

```
Fields:
- id
- publicId String @unique @default(uuid())

- orderId    BigInt
- order      Order

- vendorId   BigInt
- vendor     Vendor

- vendorOrderNumber String @unique  // e.g. "VO-2026-001"

- subTotal       Decimal  // sum of items for this vendor
- shippingAmount Decimal  @default(0)
- taxAmount      Decimal  @default(0)
- discountAmount Decimal  @default(0)
- vendorPayable  Decimal  // after commission deduction

- status     VendorOrderStatus enum

- shippingName, shippingPhone, shippingLine1, shippingLine2,
  shippingCity, shippingState, shippingPostalCode, shippingCountry
  (snapshot from parent Order — denormalized for vendor isolation)

- trackingNumber  String?
- courierName     String?
- shippedAt       DateTime?
- deliveredAt     DateTime?

- createdAt, updatedAt

Relations:
- items          OrderItem[]   (OrderItem now has vendorOrderId)
- statusHistory  VendorOrderStatusHistory[]
- earnings       VendorEarning[]

@@index([orderId])
@@index([vendorId, createdAt])
@@index([vendorId, status])
@@map("vendor_orders")
```

**Enum: `VendorOrderStatus`** → `PLACED | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | RETURN_REQUESTED | RETURNED`

---

**Extend `OrderItem`:**

Add:
```
- vendorOrderId  BigInt
- vendorOrder    VendorOrder

- commissionRate    Decimal  // snapshot at order time
- commissionAmount  Decimal  // snapshot at order time
- vendorEarning     Decimal  // price - commission - GST on commission

- returnStatus      String? @db.VarChar(30)
  // null | "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED"
- returnRequestedAt DateTime?
```

---

**New Model: `VendorOrderStatusHistory`**

```
Fields:
- id
- vendorOrderId  BigInt
- vendorOrder    VendorOrder
- oldStatus      VendorOrderStatus?
- newStatus      VendorOrderStatus
- changedBy      BigInt?  // userId
- note           String?
- createdAt      DateTime @default(now())

@@index([vendorOrderId])
@@map("vendor_order_status_history")
```

---

### 10. Financial Config System

Configurable charge types and global financial settings.

**New Model: `PlatformFinancialConfig`**

Singleton table (always one row, managed by admin).
```
Fields:
- id               BigInt @id @default(1)  // enforced singleton
- defaultCommissionRate  Decimal @default(10)
- defaultGstOnCommission Decimal @default(18)
- defaultGstRate         Decimal @default(18)
- platformGstin          String  @db.VarChar(20)
- platformLegalName      String
- platformAddress        String
- platformState          String
- paymentGatewayFeeRate  Decimal @default(2)
- updatedBy              BigInt?
- createdAt, updatedAt

@@map("platform_financial_config")
```

---

**New Model: `AdditionalCharge`**

Configurable charge types: shipping, handling, cold-storage, etc.
```
Fields:
- id
- name          String @unique  // "Standard Shipping" | "Express Shipping"
- chargeType    String @db.VarChar(20) // "FLAT" | "PERCENTAGE"
- amount        Decimal
- isGstApplicable Boolean @default(false)
- gstRate        Decimal @default(0)
- isActive       Boolean @default(true)
- appliesTo      String? @db.VarChar(30) // "ALL" | "VENDOR" | "CATEGORY"
- createdAt, updatedAt

@@map("additional_charges")
```

---

### 11. Vendor Earnings System

A granular ledger: one row per `OrderItem` once the order is paid.

**New Model: `VendorEarning`**

```
Fields:
- id
- vendorId       BigInt
- vendor         Vendor

- vendorOrderId  BigInt
- vendorOrder    VendorOrder

- orderItemId    BigInt @unique
- orderItem      OrderItem

- orderId        BigInt  // denormalized for query convenience

// Frozen financial breakdown (immutable after creation)
- salePrice           Decimal   // item price paid by customer
- quantity            Int
- discountAmount      Decimal @default(0)
- taxableValue        Decimal   // base before GST
- gstRate             Decimal
- gstAmount           Decimal

- commissionRate      Decimal
- commissionAmount    Decimal   // platform takes this
- gstOnCommission     Decimal   // GST on commission

- shippingCharge      Decimal @default(0)
- paymentGatewayFee   Decimal @default(0)

- vendorPayable       Decimal
  // = salePrice - commissionAmount - gstOnCommission
  //   - shippingCharge - paymentGatewayFee

- status       VendorEarningStatus enum
- settlementId BigInt?   // set when included in a settlement batch
- settlement   VendorSettlement?

- createdAt, updatedAt

Indexes: vendorId, vendorOrderId, settlementId, status
@@map("vendor_earnings")
```

**Enum: `VendorEarningStatus`** → `PENDING | SETTLED | ON_HOLD | CANCELLED`

---

### 12. Vendor Settlement System

Batch settlement runs (manual initially, automated post-launch).

**New Model: `VendorSettlement`**

```
Fields:
- id
- vendorId       BigInt
- vendor         Vendor

- settlementNumber String @unique  // "SETL-2026-001"

- periodStart    DateTime
- periodEnd      DateTime

- totalEarnings  Decimal  // sum of vendorEarning.vendorPayable in batch
- deductions     Decimal @default(0)  // any manual deductions
- netPayable     Decimal

- status         VendorSettlementStatus enum
  // PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED

- payoutMethod   String? @db.VarChar(20) // "BANK" | "UPI"
- paymentRef     String? // bank transaction ref
- settledAt      DateTime?
- settledBy      BigInt?  // admin userId
- note           String?

- createdAt, updatedAt

Relations:
- earnings  VendorEarning[]

@@index([vendorId, status])
@@index([vendorId, createdAt])
@@map("vendor_settlements")
```

**Enum: `VendorSettlementStatus`** → `PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED`

---

### 13. Invoice System

Two types of invoices per order:
- **ProductInvoice** — issued by Vendor to Customer (product sale)
- **CommissionInvoice** — issued by Platform to Vendor (commission charged)

**Extend existing `Invoice` model** (rename to `ProductInvoice` or keep as `Invoice` with a `type` field).

Recommended: Keep `Invoice` as-is but add:
```
- invoiceType   InvoiceType enum  // PRODUCT | COMMISSION
- vendorId      BigInt?
- vendor        Vendor?
// For PRODUCT invoices: vendorId = issuing vendor
// For COMMISSION invoices: vendorId = vendor being charged
```

**Extend `InvoiceItem`:**
```
- commissionAmount   Decimal @default(0)  // for commission invoices
- gstOnCommission    Decimal @default(0)
- vendorPayable      Decimal @default(0)  // for product invoices
```

**Enum: `InvoiceType`** → `PRODUCT | COMMISSION`

**New Model: `InvoiceNumberSequence`** — already exists, keep, but ensure it supports
both invoice types by adding a `prefix` column:
```
- id        BigInt @id
- year      Int
- prefix    String  // "INV" | "COMINV"
- lastValue Int @default(0)
@@unique([year, prefix])
```

---

### 14. Coupon & Discount System

Basic structure now, fully implemented post-launch.

**Enum: `CouponType`** → `PERCENTAGE | FLAT_AMOUNT | FREE_SHIPPING`
**Enum: `CouponAppliesTo`** → `ALL | CATEGORY | PRODUCT | VENDOR | FIRST_ORDER`

**New Model: `Coupon`**
```
Fields:
- id
- code         String @unique @db.VarChar(50)
- description  String?
- couponType   CouponType
- appliesTo    CouponAppliesTo @default(ALL)
- targetId     BigInt?  // categoryId or productId or vendorId depending on appliesTo

- discountValue      Decimal   // percentage or flat amount
- maxDiscountAmount  Decimal?  // cap for percentage coupons
- minOrderValue      Decimal?  // minimum cart value to apply

- usageLimit         Int?      // total times can be used
- usageLimitPerUser  Int @default(1)
- usageCount         Int @default(0)

- isActive       Boolean @default(true)
- startsAt       DateTime?
- expiresAt      DateTime?

- createdBy      BigInt  // admin userId
- createdAt, updatedAt, deletedAt

Relations:
- usages CouponUsage[]

@@map("coupons")
```

**New Model: `CouponUsage`**
```
Fields:
- id
- couponId   BigInt
- coupon     Coupon
- userId     BigInt
- orderId    BigInt @unique
- discountAmount  Decimal
- usedAt         DateTime @default(now())

@@unique([couponId, userId])  // if usageLimitPerUser = 1 enforced at app level
@@map("coupon_usages")
```

---

### 15. Notification System

Basic — one table covers all notification types for all roles.

**Enum: `NotificationChannel`** → `IN_APP | EMAIL | SMS | WHATSAPP`
**Enum: `NotificationRecipientType`** → `USER | VENDOR | ADMIN`

**New Model: `Notification`**
```
Fields:
- id
- recipientType  NotificationRecipientType
- recipientId    BigInt  // userId, vendorId or adminProfileId depending on type

- title          String @db.VarChar(255)
- message        String
- notificationType String @db.VarChar(50)
  // "NEW_ORDER" | "ORDER_STATUS_UPDATE" | "SETTLEMENT_DONE" |
  // "VENDOR_APPROVED" | "LOW_STOCK" | "NEW_VENDOR_APPLICATION" etc.

- channel        NotificationChannel @default(IN_APP)
- isRead         Boolean @default(false)
- readAt         DateTime?

- referenceType  String? @db.VarChar(50)  // "ORDER" | "VENDOR_ORDER" | "SETTLEMENT"
- referenceId    BigInt?

- createdAt      DateTime @default(now())
- updatedAt      DateTime @updatedAt

@@index([recipientType, recipientId, isRead])
@@index([createdAt])
@@map("notifications")
```

---

### 16. Analytics Snapshot System

Pre-aggregated daily snapshots for fast dashboard queries.
(Never query raw orders/items tables for analytics — populate these via cron.)

**New Model: `DailyPlatformAnalytics`**
```
Fields:
- id
- date              DateTime @unique @db.Date

- totalOrders       Int @default(0)
- totalRevenue      Decimal @default(0)
- platformEarnings  Decimal @default(0)  // total commissions
- totalGstCollected Decimal @default(0)
- totalItemsSold    Int @default(0)
- newCustomers      Int @default(0)
- newVendors        Int @default(0)

- createdAt, updatedAt

@@map("daily_platform_analytics")
```

**New Model: `DailyVendorAnalytics`**
```
Fields:
- id
- vendorId    BigInt
- vendor      Vendor
- date        DateTime @db.Date

- totalOrders     Int @default(0)
- totalRevenue    Decimal @default(0)
- totalEarnings   Decimal @default(0)  // after commission
- itemsSold       Int @default(0)
- avgOrderValue   Decimal @default(0)

- createdAt, updatedAt

@@unique([vendorId, date])
@@index([vendorId, date])
@@map("daily_vendor_analytics")
```

---

### 17. Review System

**Carry over unchanged.** No changes needed.

---

### 18. Influencer System

**Carry over unchanged.** Already well-structured.

---

## Enum Summary — All Enums to Define

```prisma
enum VendorStatus         { PENDING ACTIVE SUSPENDED REJECTED }
enum VendorOrderStatus    { PLACED CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED RETURN_REQUESTED RETURNED }
enum VendorEarningStatus  { PENDING SETTLED ON_HOLD CANCELLED }
enum VendorSettlementStatus { PENDING PROCESSING COMPLETED FAILED CANCELLED }
enum InvoiceType          { PRODUCT COMMISSION }
enum CouponType           { PERCENTAGE FLAT_AMOUNT FREE_SHIPPING }
enum CouponAppliesTo      { ALL CATEGORY PRODUCT VENDOR FIRST_ORDER }
enum NotificationChannel  { IN_APP EMAIL SMS WHATSAPP }
enum NotificationRecipientType { USER VENDOR ADMIN }

// Carry over from existing:
enum MetricUnit            { PERCENT RATING }
enum InfluencerStatus      { ACTIVE PAUSED BANNED }
enum InfluencerSaleStatus  { PENDING APPROVED PAID CANCELLED REFUNDED }
enum PayoutMethod          { UPI BANK }
enum InfluencerPayoutStatus { INITIATED COMPLETED FAILED }
enum InvoiceStatus         { ACTIVE CANCELLED }
```

---

## Cross-Cutting Field Rules

| Pattern | Rule |
|---|---|
| Soft delete | `deletedAt DateTime? @map("deleted_at")` on Vendor, Product, Category, Brand, Coupon |
| Money fields | `Decimal @db.Decimal(10, 2)` — NEVER Float |
| Large money (platform totals) | `Decimal @db.Decimal(14, 2)` |
| Percentage fields | `Decimal @db.Decimal(5, 2)` |
| Varchar defaults | Constrain with `@db.VarChar(n)` wherever length is predictable |
| Snapshots | Financial values at transaction time must always be snapshotted — never recalculated from live config |
| Public IDs | Use `publicId String @unique @default(uuid()) @db.Uuid` on all externally exposed entities (Vendor, VendorOrder, Invoice) |
| Singleton tables | Use `@id @default(1)` and enforce single-row at application level |

---

## Relationship Integrity Rules

```
Product → Vendor        : onDelete: SetNull  (product survives vendor deletion)
Product → Brand         : onDelete: SetNull
VendorOrder → Order     : onDelete: Restrict (can't delete order with sub-orders)
VendorOrder → Vendor    : onDelete: Restrict
VendorEarning → OrderItem: onDelete: Restrict (financial record must be immutable)
VendorSettlement → Vendor: onDelete: Restrict
Invoice → Order         : onDelete: Restrict
InvoiceItem → Invoice   : onDelete: Cascade
CouponUsage → Coupon    : onDelete: Restrict
CouponUsage → Order     : onDelete: Restrict
VendorDocument → Vendor : onDelete: Cascade
VendorBankDetails → Vendor : onDelete: Cascade
```

---

## Index Strategy

Beyond FK indexes, add composite indexes for these high-frequency queries:

```
-- Vendor dashboard: orders for vendor in date range
@@index([vendorId, createdAt]) on VendorOrder

-- Admin: all pending vendor applications
@@index([status, createdAt]) on Vendor

-- Finance admin: unsettled earnings per vendor
@@index([vendorId, status]) on VendorEarning

-- Customer: active products for category + brand filter
@@index([vendorId, isActive, deletedAt]) on Product

-- Admin: platform revenue by date
@@index([date]) on DailyPlatformAnalytics

-- Vendor: daily revenue by vendor
@@index([vendorId, date]) on DailyVendorAnalytics

-- Coupon: validity check
@@index([code, isActive, expiresAt]) on Coupon
```

---

## File Checklist for Claude Code

1. [ ] Open existing `schema.prisma`
2. [ ] Add all new enums at the top (after generator/datasource blocks)
3. [ ] Extend `User` with `vendor` and `adminProfile` relations
4. [ ] Add `AdminProfile` model
5. [ ] Add `Vendor`, `VendorDocument`, `VendorBankDetails`, `VendorAddress`
6. [ ] Add `Brand`
7. [ ] Extend `Product` with vendorId, brandId, SEO fields, approval fields
8. [ ] Extend `ProductVariant` with commissionRate, commissionType, hsnCode, shipping config
9. [ ] Add `InventoryLog`
10. [ ] Extend `Order` with couponId, couponCode, couponDiscount, notes
11. [ ] Add `VendorOrder`, `VendorOrderStatusHistory`
12. [ ] Extend `OrderItem` with vendorOrderId, commission snapshot, returnStatus
13. [ ] Add `PlatformFinancialConfig`
14. [ ] Add `AdditionalCharge`
15. [ ] Add `VendorEarning`
16. [ ] Add `VendorSettlement`
17. [ ] Extend `Invoice` with invoiceType, vendorId
18. [ ] Extend `InvoiceItem` with commission fields
19. [ ] Update `InvoiceNumberSequence` with prefix support
20. [ ] Add `Coupon`, `CouponUsage`
21. [ ] Add `Notification`
22. [ ] Add `DailyPlatformAnalytics`, `DailyVendorAnalytics`
23. [ ] Verify all `@@map()` names are snake_case
24. [ ] Verify all financial Decimal precisions
25. [ ] Run `prisma format` to validate syntax
26. [ ] Run `prisma validate` to check schema integrity