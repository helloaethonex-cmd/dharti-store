# Dharti Store — Backend Build Plan for Claude Code

> **Instructions for Claude Code:** Read this document fully before writing a single
> line of code. Follow the build phases in order. Each phase is self-contained —
> complete and test it before moving to the next. Every endpoint, service function,
> middleware, and business rule is specified here.

---

## Table of Contents

1. [Tech Stack & Tooling](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment & Configuration](#environment)
4. [Global Standards](#global-standards)
5. [Build Phase 0 — Project Bootstrap](#phase-0)
6. [Build Phase 1 — Auth System](#phase-1)
7. [Build Phase 2 — RBAC & Admin Profiles](#phase-2)
8. [Build Phase 3 — Vendor Onboarding System](#phase-3)
9. [Build Phase 4 — Brand & Category System](#phase-4)
10. [Build Phase 5 — Product & Inventory System](#phase-5)
11. [Build Phase 6 — Cart & Checkout System](#phase-6)
12. [Build Phase 7 — Order & Vendor Order System](#phase-7)
13. [Build Phase 8 — Financial System (Core)](#phase-8)
14. [Build Phase 9 — Invoice System](#phase-9)
15. [Build Phase 10 — Settlement System](#phase-10)
16. [Build Phase 11 — Coupon System](#phase-11)
17. [Build Phase 12 — Review System](#phase-12)
18. [Build Phase 13 — Notifications](#phase-13)
19. [Build Phase 14 — Analytics & Dashboards](#phase-14)
20. [Build Phase 15 — Influencer System](#phase-15)
21. [Background Jobs](#background-jobs)
22. [Error Handling & API Standards](#api-standards)
23. [Security Checklist](#security)
24. [Final Integration Checklist](#final-checklist)

---

## 1. Tech Stack & Tooling {#tech-stack}

```
Runtime        : Node.js 20 LTS
Language       : TypeScript (strict mode)
Framework      : NestJS (TypeScript-first Node.js framework)
ORM            : Prisma 5.x
Database       : PostgreSQL 15
Caching        : Redis (via ioredis)
Job Queue      : BullMQ (for async jobs: PDF, emails, analytics)
Validation     : Zod (all request bodies and env vars)
Auth           : Better Auth OR custom JWT (access + refresh tokens)
File Storage   : Cloudflare R2 / AWS S3 (via @aws-sdk/client-s3)
Email          : Resend (or Nodemailer as fallback)
PDF Generation : @react-pdf/renderer (server-side) or Puppeteer
Payment        : Razorpay
Logging        : Pino
Testing        : Vitest
Process Mgr    : PM2 (production)
```

**Why NestJS:** Modular architecture with DI, strong TypeScript support,
opinionated structure for large codebases, and robust ecosystem.

---

## 2. Project Structure {#project-structure}

```
dharti-store/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.base.json
├── turbo.json
├── apps/
│   └── api/
│       ├── package.json
│       ├── prisma.config.mjs
│       ├── prisma.config.ts
│       ├── tsconfig.json
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       │       ├── migration_lock.toml
│       │       └── 20260528071601_init/
│       │           └── migration.sql
│       ├── src/
│       │   ├── index.ts
│       │   ├── bootstrap/
│       │   │   ├── app.ts
│       │   │   └── server.ts
│       │   ├── config/
│       │   │   └── env.ts
│       │   ├── events/
│       │   ├── jobs/
│       │   ├── lib/
│       │   │   ├── auth/
│       │   │   ├── logger/
│       │   │   └── prisma/
│       │   ├── middleware/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── finance/
│       │   │   ├── inventory/
│       │   │   ├── notification/
│       │   │   ├── order/
│       │   │   ├── payment/
│       │   │   ├── product/
│       │   │   ├── user/
│       │   │   └── vendor/
│       │   ├── routes/
│       │   │   └── index.ts
│       │   └── types/
│       └── test/
├── packages/
│   ├── api-client/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   ├── config/
│   │   ├── package.json
│   │   ├── env/
│   │   │   └── index.ts
│   │   ├── eslint/
│   │   │   └── base.cjs
│   │   ├── prettier/
│   │   │   └── base.cjs
│   │   └── tsconfig/
│   │       ├── library.json
│   │       ├── next.json
│   │       └── node.json
│   ├── types/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── auth/
│   │       │   └── index.ts
│   │       ├── finance/
│   │       │   └── index.ts
│   │       ├── order/
│   │       │   └── index.ts
│   │       ├── product/
│   │       │   └── index.ts
│   │       ├── user/
│   │       │   └── index.ts
│   │       └── vendor/
│   │           └── index.ts
│   ├── ui/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── components/
│   │       │   └── index.ts
│   │       ├── layouts/
│   │       │   └── index.ts
│   │       └── theme/
│   │           └── index.ts
│   └── utils/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
├── plans/
│   ├── backend-plan.md
│   └── db-plan.md
└── tooling/
    ├── ci/
    │   └── README.md
    └── scripts/
        └── README.md
```

---

## 3. Environment & Configuration {#environment}

**`src/config/env.ts`** — Define with Zod and fail fast on missing vars:

```typescript
// All required env variables:
DATABASE_URL          // PostgreSQL connection string
REDIS_URL             // Redis connection string
JWT_ACCESS_SECRET     // Min 32 chars
JWT_REFRESH_SECRET    // Min 32 chars
JWT_ACCESS_EXPIRY     // "15m"
JWT_REFRESH_EXPIRY    // "7d"
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
S3_BUCKET
S3_REGION
S3_ACCESS_KEY
S3_SECRET_KEY
S3_ENDPOINT           // For R2: https://<account>.r2.cloudflarestorage.com
RESEND_API_KEY
FROM_EMAIL            // noreply@dhartistore.in
APP_URL               // Frontend URL (for CORS)
PLATFORM_GSTIN
PLATFORM_LEGAL_NAME
PLATFORM_ADDRESS
PLATFORM_STATE
NODE_ENV              // development | production
PORT                  // default 3000
```

---

## 4. Global Standards {#global-standards}

### API Response Format

Every response, success or error, uses this envelope:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 }  // only on paginated responses
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",         // machine-readable code
    "message": "Human readable message",
    "details": [ ... ]                  // optional field errors from Zod
  }
}
```

### Error Codes (define in `src/lib/errors.ts`)

```
UNAUTHORIZED          401 — No or invalid token
FORBIDDEN             403 — Valid token but no permission
NOT_FOUND             404 — Resource not found
VALIDATION_ERROR      422 — Zod validation failure
CONFLICT              409 — Duplicate resource
PAYMENT_FAILED        402 — Payment processing failure
INSUFFICIENT_STOCK    409 — Not enough inventory
VENDOR_INACTIVE       403 — Vendor not active
INTERNAL_ERROR        500 — Unexpected server error
```

### Pagination

All list endpoints support:
- `?page=1&limit=20` (offset pagination) for admin lists
- Responses include `meta: { page, limit, total, totalPages }`

### Route Prefix Convention

```
/api/v1/auth/...           → Auth
/api/v1/users/...          → User profile
/api/v1/admin/...          → Admin-only routes
/api/v1/vendor/...         → Vendor dashboard routes (vendor-authenticated)
/api/v1/public/...         → No auth required (browsing, product pages)
/api/v1/orders/...         → Customer order routes
/api/v1/payments/...       → Payment routes
/api/v1/webhooks/...       → Webhook receivers (Razorpay etc)
```

### Auth Context (NestJS Request)

```typescript
// Attach to request after JWT verification (Auth Guard)
export type AuthContext = {
  userId: bigint
  userRole: string           // role name
  permissions: string[]      // array of permission names
  vendorId?: bigint          // set if user is a vendor
  isAdmin: boolean
}

// Example request augmentation (Express)
declare module 'express' {
  interface Request {
    auth?: AuthContext
  }
}
```

---

## 5. Build Phase 0 — Project Bootstrap {#phase-0}

**Steps:**

1. `npm init` + install all dependencies
2. Configure `tsconfig.json` with `strict: true`, `moduleResolution: bundler`,
   `experimentalDecorators: true`, `emitDecoratorMetadata: true`
3. Set up Prisma: `npx prisma init`, apply schema from schema plan
4. Create `src/config/prisma.ts` — singleton Prisma client
5. Create `src/config/redis.ts` — ioredis singleton with reconnect logic
6. Create `src/config/env.ts` — Zod env validation, throw on startup if invalid
7. Create `src/lib/response.ts` — `ok()`, `created()`, `paginated()`, `fail()` helpers
8. Create `src/lib/errors.ts` — `AppError` class with `code`, `message`, `statusCode`
9. Create `apps/api/src/bootstrap/app.ts` — Nest application instance, register global providers:
  - CORS (allow APP_URL)
  - Request logger (Pino)
  - Global exception filter (AppError, Prisma errors, Zod errors)
10. Create `apps/api/src/bootstrap/server.ts` and `apps/api/src/index.ts` — start server, connect DB, log ready
11. Seed script: `prisma/seed.ts`
    - Create Super Admin user
    - Create default roles: `SUPER_ADMIN`, `SEO_ADMIN`, `FINANCE_ADMIN`, `OPERATIONS_ADMIN`, `VENDOR`, `CUSTOMER`
    - Create all permissions and assign to roles
    - Create default `PlatformFinancialConfig` row

**Dependency List:**
```json
{
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/platform-express": "^10",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7",
    "@prisma/client": "^5",
    "ioredis": "^5",
    "bullmq": "^5",
    "zod": "^3",
    "jsonwebtoken": "^9",
    "bcryptjs": "^2",
    "razorpay": "^2",
    "@aws-sdk/client-s3": "^3",
    "@aws-sdk/s3-request-presigner": "^3",
    "resend": "^3",
    "pino": "^9",
    "pino-http": "^10",
    "nanoid": "^5",
    "slugify": "^1",
    "date-fns": "^3",
    "decimal.js": "^10"
  },
  "devDependencies": {
    "prisma": "^5",
    "typescript": "^5",
    "vitest": "^1",
    "@types/node": "^20",
    "@types/jsonwebtoken": "^9",
    "@types/bcryptjs": "^2"
  }
}
```

---

## 6. Build Phase 1 — Auth System {#phase-1}

### Models used: `User`, `Session`, `Account`, `Verification`

### Endpoints

```
POST   /api/v1/auth/register             → Register customer
POST   /api/v1/auth/login                → Email + password login
POST   /api/v1/auth/logout               → Invalidate session
POST   /api/v1/auth/refresh              → Refresh access token
POST   /api/v1/auth/forgot-password      → Send reset OTP to email
POST   /api/v1/auth/reset-password       → Reset with OTP
POST   /api/v1/auth/verify-email         → Verify email with OTP
POST   /api/v1/auth/resend-verification  → Resend email OTP
GET    /api/v1/auth/me                   → Get current user (requires auth)
```

### Service Logic

**register:**
- Validate body: `email`, `password` (min 8 chars), `name`, `phone?`
- Check email uniqueness
- Hash password with bcrypt (rounds: 12)
- Create `User` + `Account` (provider: "credentials") in a transaction
- Send verification OTP email
- Return: `{ user, accessToken, refreshToken }`

**login:**
- Find user by email, check `isActive`
- Verify password via bcrypt
- Create `Session` record with `token`, `ipAddress`, `userAgent`, `expiresAt`
- Generate access JWT (payload: `userId`, `roleId`, `roleName`)
- Generate refresh token (store in Session)
- Return: `{ accessToken, refreshToken, user }`

**JWT Strategy:**
- Access token: short-lived (15m), signed with `JWT_ACCESS_SECRET`
- Refresh token: long-lived (7d), stored as `Session.token` in DB
- On refresh: verify session exists + not expired → issue new access token

**Auth Guard (`src/middleware/auth.ts`):**
- Extract Bearer token from `Authorization` header
- Verify JWT signature + expiry
- Load user from DB (or Redis cache with 60s TTL), attach to `request.auth`
- Load user permissions from DB, attach to `request.auth`
- Throw `UNAUTHORIZED` if any step fails

**Rate Limiting on Auth Routes:**
- `POST /register` → 5 req/hour per IP
- `POST /login` → 10 req/15min per IP
- `POST /forgot-password` → 3 req/hour per email

---

## 7. Build Phase 2 — RBAC & Admin Profiles {#phase-2}

### Models used: `Role`, `Permission`, `RolePermission`, `AdminProfile`

### Endpoints

```
// Admin management — requires SUPER_ADMIN
GET    /api/v1/admin/roles                   → List all roles
GET    /api/v1/admin/permissions             → List all permissions
POST   /api/v1/admin/admins                  → Create admin user
GET    /api/v1/admin/admins                  → List all admin users
GET    /api/v1/admin/admins/:id              → Get admin detail
PATCH  /api/v1/admin/admins/:id              → Update admin role/status
DELETE /api/v1/admin/admins/:id              → Deactivate admin
POST   /api/v1/admin/roles/:roleId/permissions → Assign permission to role
DELETE /api/v1/admin/roles/:roleId/permissions/:permId → Remove permission
```

### RBAC Guard (`src/middleware/rbac.ts`)

```typescript
// Usage in controllers:
// @UseGuards(AuthGuard, RbacGuard)
// @Permissions('product:write')

export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions)

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]) ?? []
    const request = context.switchToHttp().getRequest<Request>()
    const userPermissions = request.auth?.permissions ?? []
    const hasAll = required.every(p => userPermissions.includes(p))
    if (!hasAll) throw new AppError('FORBIDDEN', 403)
    return true
  }
}
```

### Permission Seeding (run in Phase 0 seed)

```
vendor:read, vendor:write, vendor:onboard, vendor:suspend
product:read, product:write, product:delete, product:seo, product:approve
category:read, category:write
brand:read, brand:write
order:read, order:write, order:manage, order:cancel
finance:read, finance:write, finance:settle, finance:config
coupon:read, coupon:write
analytics:read
system:admin
influencer:read, influencer:write
```

### Role → Permission Mapping (seed)

```
SUPER_ADMIN      → ALL permissions
SEO_ADMIN        → product:read, product:write, product:seo, category:read, category:write, brand:read
FINANCE_ADMIN    → finance:read, finance:write, finance:settle, analytics:read, order:read
OPERATIONS_ADMIN → order:read, order:write, order:manage, vendor:read, product:read, analytics:read
VENDOR           → (no admin permissions — vendor permissions enforced by vendor-auth guard)
CUSTOMER         → (no admin permissions)
```

---

## 8. Build Phase 3 — Vendor Onboarding System {#phase-3}

### Models used: `Vendor`, `VendorDocument`, `VendorBankDetails`, `VendorAddress`

---

### Admin-Facing Vendor Management

```
GET    /api/v1/admin/vendors                  → List vendors (filter by status)
GET    /api/v1/admin/vendors/:id              → Vendor detail with documents
POST   /api/v1/admin/vendors                  → Manually onboard a vendor
PATCH  /api/v1/admin/vendors/:id              → Update vendor details
PATCH  /api/v1/admin/vendors/:id/approve      → Approve vendor (PENDING → ACTIVE)
PATCH  /api/v1/admin/vendors/:id/suspend      → Suspend vendor
PATCH  /api/v1/admin/vendors/:id/reject       → Reject vendor application
DELETE /api/v1/admin/vendors/:id              → Soft delete vendor
```

All require `vendor:write` or `vendor:onboard` permission.

---

### Vendor Self-Registration (Application Flow)

```
POST   /api/v1/auth/vendor/apply              → Vendor applies (creates PENDING vendor)
GET    /api/v1/vendor/profile                 → Get own vendor profile
PATCH  /api/v1/vendor/profile                 → Update own profile
POST   /api/v1/vendor/documents               → Upload KYC documents
GET    /api/v1/vendor/documents               → List own documents
PATCH  /api/v1/vendor/bank-details            → Add/update bank details
GET    /api/v1/vendor/bank-details            → Get bank details
```

---

### Vendor Onboarding Service Logic

**`POST /auth/vendor/apply`:**
- Body: `businessName`, `email`, `phone`, `gstin?`, `panNumber?`, `password`
- Create `User` (role: VENDOR) + `Vendor` (status: PENDING) in transaction
- Send confirmation email to vendor
- Send new vendor application notification to Super Admin
- Return: `{ message: "Application submitted. Admin will review shortly." }`

**`PATCH /admin/vendors/:id/approve`:**
- Set `Vendor.status = ACTIVE`, `isActive = true`, `onboardedAt = now()`
- Send approval email to vendor
- Create notification for vendor

**`PATCH /admin/vendors/:id/suspend`:**
- Body: `{ reason: string }`
- Set `Vendor.status = SUSPENDED`, `isActive = false`
- All vendor's products: set `isActive = false`
- Send suspension email with reason

---

### Vendor Auth Guard (`src/middleware/vendor-auth.ts`)

```typescript
// Ensures the authenticated user IS an active vendor
// Attaches vendorId to request.auth
@Injectable()
export class VendorAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const userId = request.auth?.userId
    const vendor = await prisma.vendor.findFirst({
      where: { userId, status: 'ACTIVE', isActive: true, deletedAt: null }
    })
    if (!vendor) throw new AppError('VENDOR_INACTIVE', 403)
    request.auth = { ...(request.auth ?? {}), vendorId: vendor.id }
    return true
  }
}
```

---

## 9. Build Phase 4 — Brand & Category System {#phase-4}

### Models used: `Brand`, `Category`

### Brand Endpoints

```
// Public
GET    /api/v1/public/brands                  → List active brands (with product count)
GET    /api/v1/public/brands/:slug            → Brand detail + products

// Admin
GET    /api/v1/admin/brands                   → List all brands
POST   /api/v1/admin/brands                   → Create brand
PATCH  /api/v1/admin/brands/:id               → Update brand
DELETE /api/v1/admin/brands/:id               → Soft delete brand
PATCH  /api/v1/admin/brands/:id/assign-vendor → Assign brand to vendor
```

### Category Endpoints

```
// Public
GET    /api/v1/public/categories              → Full category tree (nested)
GET    /api/v1/public/categories/:slug        → Category detail + child categories

// Admin
GET    /api/v1/admin/categories               → Flat list with parent info
POST   /api/v1/admin/categories               → Create category
PATCH  /api/v1/admin/categories/:id           → Update category
DELETE /api/v1/admin/categories/:id           → Soft delete (reject if has products)
PATCH  /api/v1/admin/categories/:id/reorder   → Update display order
```

### Category Tree Builder

```typescript
// In categories.service.ts
// Build nested tree from flat list (single DB query, then nest in JS)
function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const map = new Map()
  const roots: CategoryNode[] = []
  categories.forEach(cat => map.set(cat.id, { ...cat, children: [] }))
  categories.forEach(cat => {
    if (cat.parentId) map.get(cat.parentId)?.children.push(map.get(cat.id))
    else roots.push(map.get(cat.id))
  })
  return roots
}
```

---

## 10. Build Phase 5 — Product & Inventory System {#phase-5}

### Models used: `Product`, `ProductVariant`, `ProductCategory`, `ProductImage`, `ProductContentSection`, `InventoryLog`

---

### Product Endpoints — Admin

```
GET    /api/v1/admin/products                 → List all products (paginated, filter by vendor/category/brand/status)
GET    /api/v1/admin/products/:id             → Full product detail
POST   /api/v1/admin/products                 → Create product (assign to vendor)
PATCH  /api/v1/admin/products/:id             → Update product
DELETE /api/v1/admin/products/:id             → Soft delete product
PATCH  /api/v1/admin/products/:id/approve     → Approve product listing
PATCH  /api/v1/admin/products/:id/seo         → Update SEO fields (SEO Admin)

// Variants
POST   /api/v1/admin/products/:id/variants    → Add variant
PATCH  /api/v1/admin/products/:id/variants/:variantId  → Update variant
DELETE /api/v1/admin/products/:id/variants/:variantId  → Delete variant

// Images
POST   /api/v1/admin/products/:id/images      → Upload product images (multipart)
DELETE /api/v1/admin/products/:id/images/:imageId → Delete image
PATCH  /api/v1/admin/products/:id/images/reorder  → Reorder images
```

### Product Endpoints — Vendor Dashboard

```
GET    /api/v1/vendor/products                → Vendor's own products
GET    /api/v1/vendor/products/:id            → Own product detail
// Vendors cannot CREATE/DELETE products — admin does that
// Vendors CAN update stock only:
PATCH  /api/v1/vendor/products/:id/variants/:variantId/stock → Update stock quantity
```

### Product Endpoints — Public

```
GET    /api/v1/public/products                → Browse products (with filters)
GET    /api/v1/public/products/:slug          → Product detail page
GET    /api/v1/public/products/search         → Full-text search
GET    /api/v1/public/vendors/:slug/products  → Vendor storefront products
```

---

### Product Creation Logic (Admin)

**`POST /admin/products` body:**
```
{
  name, slug?, description?, brandId?, vendorId?,
  categoryIds: bigint[],
  metaTitle?, metaDescription?, metaKeywords?,
  variants: [{
    variantName?, sku?, price, mrp?, costPrice?,
    gstRate, hsnCode?,
    stockQuantity,
    commissionRate?, commissionType?,
    shippingChargeType?, shippingCharge?,
    weight?
  }]
}
```

**Service Logic:**
- Auto-generate slug if not provided (slugify name + nanoid suffix for uniqueness)
- Validate all categoryIds exist
- Validate vendorId is ACTIVE vendor
- Create Product + Variants + ProductCategories in a single transaction
- Log initial stock to `InventoryLog` (changeType: "MANUAL_ADD")

---

### Public Product Browse — Filter Logic

Query params: `?category=slug&brand=slug&vendor=slug&minPrice=&maxPrice=&sortBy=price_asc|price_desc|newest|popular&page=&limit=`

Service builds Prisma `where` clause dynamically. Always filter:
- `isActive: true`
- `deletedAt: null`
- `isAdminApproved: true`
- Vendor `isActive: true`

---

### Inventory Update (Vendor)

**`PATCH /vendor/products/:id/variants/:variantId/stock`:**
- Body: `{ quantity: number, note?: string }`
- Verify the product belongs to the authenticated vendor
- Calculate `quantityBefore`, `quantityAfter`
- Update `ProductVariant.stockQuantity`
- Create `InventoryLog` record
- Return updated stock

---

## 11. Build Phase 6 — Cart & Checkout {#phase-6}

### Models used: `Cart`, `CartItem`, `InventoryReservation`, `Address`

### Cart Endpoints

```
GET    /api/v1/cart                           → Get active cart (auth or session)
POST   /api/v1/cart/items                     → Add item to cart
PATCH  /api/v1/cart/items/:itemId             → Update item quantity
DELETE /api/v1/cart/items/:itemId             → Remove item from cart
DELETE /api/v1/cart                           → Clear cart
POST   /api/v1/cart/merge                     → Merge guest cart into user cart (on login)
```

### Address Endpoints

```
GET    /api/v1/users/addresses                → List user's addresses
POST   /api/v1/users/addresses                → Add address
PATCH  /api/v1/users/addresses/:id            → Update address
DELETE /api/v1/users/addresses/:id            → Delete address
PATCH  /api/v1/users/addresses/:id/default    → Set as default
```

### Cart Logic

**Guest carts:** Use `sessionId` (random UUID stored in cookie) — no auth required.
**Auth cart:** `userId` field. On login, merge guest cart items into user cart.

**`POST /cart/items` Logic:**
- Check product variant is active + approved
- Check `stockQuantity - stockReserved >= requested quantity`
- If item already in cart → update quantity
- Create `InventoryReservation` (status: ACTIVE, expiresAt: now + 30 minutes)
- Update `ProductVariant.stockReserved += quantity`

**Cart Expiry Job (Background):**
- Every 5 minutes: find expired `InventoryReservation` records
- Release: `stockReserved -= quantity`, delete reservation
- If cart abandoned >2 hours: set `Cart.status = ABANDONED`

### Cart Pricing Calculation (in `cart.service.ts`)

For each cart item, compute:
```typescript
function calculateCartItem(variant: ProductVariant, quantity: number) {
  const price = variant.price          // selling price (GST-inclusive)
  const gstRate = variant.gstRate      // e.g. 18
  const lineTotal = price * quantity

  // Reverse-calculate base price (taxable value):
  // price = basePrice * (1 + gstRate/100)
  const basePrice = price / (1 + gstRate / 100)
  const gstAmount = price - basePrice

  return { price, quantity, lineTotal, basePrice, gstAmount, gstRate }
}
```

---

## 12. Build Phase 7 — Order & Vendor Order System {#phase-7}

### Models used: `Order`, `OrderItem`, `VendorOrder`, `VendorOrderStatusHistory`, `OrderStatusHistory`, `OrderNumberSequence`

---

### Customer Order Endpoints

```
POST   /api/v1/orders/checkout                → Place order (from cart)
GET    /api/v1/orders                         → List user's orders
GET    /api/v1/orders/:orderNumber            → Order detail with items
POST   /api/v1/orders/:orderNumber/cancel     → Cancel order (if PLACED)
POST   /api/v1/orders/:id/return              → Request return for delivered order
```

### Admin Order Endpoints

```
GET    /api/v1/admin/orders                   → List all orders (filter by status/date/vendor)
GET    /api/v1/admin/orders/:orderNumber      → Full order detail
PATCH  /api/v1/admin/orders/:id/status        → Manual status update
POST   /api/v1/admin/orders/manual            → Create manual order (offline order)
GET    /api/v1/admin/orders/export            → CSV export of orders
```

### Vendor Order Endpoints

```
GET    /api/v1/vendor/orders                  → Vendor's sub-orders
GET    /api/v1/vendor/orders/:id              → Vendor order detail
PATCH  /api/v1/vendor/orders/:id/status       → Update status (CONFIRMED → PROCESSING → SHIPPED)
PATCH  /api/v1/vendor/orders/:id/tracking     → Add tracking number + courier
```

---

### Order Placement — Core Business Logic

**`POST /orders/checkout` — THE MOST CRITICAL ENDPOINT**

This must run inside a **database transaction** with the following steps in order:

```
Step 1: Validate cart
  - Load active cart with items + variants + products
  - Check all items still active + approved
  - Check stock availability (stockQuantity - stockReserved >= quantity)
  - If any item fails: return 409 with specific item details

Step 2: Validate address
  - addressId must belong to the authenticated user
  - snapshot all address fields

Step 3: Apply coupon (if provided)
  - Validate coupon exists, active, not expired
  - Validate usage limits (total + per-user)
  - Calculate discount amount
  - Lock coupon usage optimistically (increment usageCount)

Step 4: Load platform financial config
  - Get defaultCommissionRate, defaultGstOnCommission, paymentGatewayFeeRate

Step 5: Calculate order financials
  FOR EACH cart item:
    a. Get commissionRate: variant.commissionRate ?? vendor.defaultCommissionRate ?? platform.defaultCommissionRate
    b. price = variant.price (GST-inclusive)
    c. basePrice = price / (1 + gstRate/100)           → taxable value
    d. gstAmount = price - basePrice                    → GST on product
    e. lineTotal = price * quantity
    f. commissionAmount = basePrice * commissionRate/100
    g. gstOnCommission = commissionAmount * gstOnCommissionRate/100
    h. vendorPayable = lineTotal - commissionAmount - gstOnCommission

  totalProductAmount = sum(lineTotal) - discountAmount
  totalTax = sum(gstAmount)
  totalShipping = sum(per-variant shipping charges)
  totalPaid = totalProductAmount + totalShipping

Step 6: Generate order number
  - Use OrderNumberSequence (atomic increment per year)
  - Format: "ORD-{YYYY}-{NNNNNN}" e.g. "ORD-2026-000001"

Step 7: Create Order record
  - Snapshot address fields
  - Snapshot all financial totals

Step 8: Group items by vendor → create VendorOrder per vendor
  - Generate VendorOrder number: "VO-{YYYY}-{NNNNNN}"
  - Snapshot address + calculate vendorPayable sum

Step 9: Create OrderItems
  - One per cart item, linked to both Order and VendorOrder
  - Snapshot: productName, variantName, sku, priceAtPurchase, commissionRate, commissionAmount, vendorPayable, gstRate, gstAmount, costPrice

Step 10: Confirm inventory reservations
  - Update existing InventoryReservation: status → CONFIRMED, orderId = new order id
  - Update ProductVariant.stockQuantity -= quantity (atomic)
  - Update ProductVariant.stockReserved -= quantity (atomic)
  - Log to InventoryLog (changeType: ORDER_CONFIRMED)

Step 11: Mark cart as CHECKED_OUT

Step 12: Commit transaction

Step 13 (outside TX): Initiate Razorpay payment order
  - Create Razorpay order for totalPaid
  - Return: { orderId, orderNumber, razorpayOrderId, razorpayKeyId, amount }
```

---

### Vendor Order Status Machine

```
Vendor can only move FORWARD:
PLACED → CONFIRMED → PROCESSING → SHIPPED → DELIVERED

Admin can set any status.

When ALL vendor orders for an order reach DELIVERED:
  → Parent Order.orderStatus = DELIVERED

When ANY vendor order is SHIPPED:
  → Parent Order.orderStatus = PARTIALLY_SHIPPED (if not all shipped)

When order is CANCELLED:
  → Release inventory reservations
  → Revert stockQuantity
  → Create InventoryLog (ORDER_CANCELLED)
  → Mark VendorEarnings as CANCELLED (if any were created)
```

---

## 13. Build Phase 8 — Financial System (Core) {#phase-8}

### Models used: `PlatformFinancialConfig`, `AdditionalCharge`, `VendorEarning`

---

### Financial Config Endpoints (Admin — Finance Admin role)

```
GET    /api/v1/admin/financial/config         → Get platform config
PATCH  /api/v1/admin/financial/config         → Update platform config
GET    /api/v1/admin/financial/charges        → List additional charge types
POST   /api/v1/admin/financial/charges        → Create charge type
PATCH  /api/v1/admin/financial/charges/:id    → Update charge type
DELETE /api/v1/admin/financial/charges/:id    → Delete charge type
```

---

### Vendor Earnings Endpoints

```
// Admin
GET    /api/v1/admin/earnings                 → All earnings (filter by vendor/status/date)
GET    /api/v1/admin/earnings/summary         → Aggregated summary per vendor
PATCH  /api/v1/admin/earnings/:id/hold        → Put earning on hold
PATCH  /api/v1/admin/earnings/:id/release     → Release hold

// Vendor
GET    /api/v1/vendor/earnings                → Own earnings (paginated, filter by date)
GET    /api/v1/vendor/earnings/summary        → Total pending, settled, on-hold
```

---

### Earnings Creation (triggered by payment success webhook)

**In `payments.webhook.ts` → after payment VERIFIED:**

```typescript
// Create VendorEarning for each OrderItem
for (const item of order.items) {
  await prisma.vendorEarning.create({
    data: {
      vendorId: item.vendorOrder.vendorId,
      vendorOrderId: item.vendorOrderId,
      orderItemId: item.id,
      orderId: order.id,
      salePrice: item.priceAtPurchase,
      quantity: item.quantity,
      discountAmount: item.discountAmount ?? 0,
      taxableValue: item.basePrice,
      gstRate: item.gstRate,
      gstAmount: item.taxAmount,
      commissionRate: item.commissionRate,
      commissionAmount: item.commissionAmount,
      gstOnCommission: item.commissionAmount * gstOnCommissionRate / 100,
      shippingCharge: shippingForThisItem,
      paymentGatewayFee: calculateGatewayFeeShare(item),
      vendorPayable: item.vendorEarning,
      status: 'PENDING'
    }
  })
}
```

**Important:** All financial values are SNAPSHOTS from OrderItem — never re-calculated.

---

### `src/lib/financial.ts` — Core Financial Engine

```typescript
// The single source of truth for all financial calculations.
// Used during checkout — never during display.

export interface FinancialLineItem {
  price: Decimal            // selling price (GST-inclusive)
  quantity: number
  gstRate: Decimal          // percentage e.g. 18
  commissionRate: Decimal   // percentage e.g. 10
  gstOnCommissionRate: Decimal
  shippingCharge: Decimal
  discountShare: Decimal    // this item's share of order-level discount
}

export interface LineItemResult {
  basePrice: Decimal        // price / (1 + gstRate/100)
  gstAmount: Decimal        // price - basePrice
  lineTotal: Decimal        // price * qty
  taxableValue: Decimal     // basePrice * qty
  totalGst: Decimal         // gstAmount * qty
  commissionAmount: Decimal // taxableValue * commissionRate/100
  gstOnCommission: Decimal
  vendorPayable: Decimal    // lineTotal - commissionAmount - gstOnCommission - shippingCharge
}

export function calculateLineItem(item: FinancialLineItem): LineItemResult {
  // All arithmetic with decimal.js — NEVER native JS floats
  // ...
}
```

### `src/lib/gst.ts` — GST Breakdown

```typescript
// Determines CGST+SGST (intra-state) vs IGST (inter-state)
// based on comparing platform state with customer shipping state

export function calculateGstBreakdown(
  totalTax: Decimal,
  platformState: string,
  customerState: string
): { cgst?: Decimal; sgst?: Decimal; igst?: Decimal } {
  const isInterState = platformState.toLowerCase() !== customerState.toLowerCase()
  if (isInterState) return { igst: totalTax }
  const half = totalTax.div(2)
  return { cgst: half, sgst: half }
}
```

---

## 14. Build Phase 9 — Invoice System {#phase-9}

### Models used: `Invoice`, `InvoiceItem`, `InvoiceNumberSequence`

### Invoice Endpoints

```
// Customer
GET    /api/v1/orders/:orderNumber/invoice    → Download product invoice PDF
GET    /api/v1/orders/:orderNumber/invoice/data → Invoice JSON (for web view)

// Admin
GET    /api/v1/admin/invoices                 → List all invoices
GET    /api/v1/admin/invoices/:id             → Invoice detail
GET    /api/v1/admin/invoices/:id/pdf         → Download invoice PDF
PATCH  /api/v1/admin/invoices/:id/cancel      → Cancel invoice (ACTIVE → CANCELLED)

// Vendor
GET    /api/v1/vendor/invoices                → Own product invoices
GET    /api/v1/vendor/commission-invoices     → Commission invoices (platform charged them)
GET    /api/v1/vendor/invoices/:id/pdf        → Download invoice PDF
```

---

### Invoice Creation (triggered inside payment success TX)

**Two invoices created atomically per order:**

**Invoice 1 — Product Invoice (type: PRODUCT)**
- `vendorId`: vendor who sold the products
- `sellerName`: vendor's businessName (from Vendor record, snapshotted)
- `sellerGstin`: vendor's GSTIN
- Items: all OrderItems for this vendor
- Financial: productTotal, shippingAmount, taxAmount, discountAmount, totalAmount
- GST breakdown: CGST+SGST or IGST based on state comparison

**Invoice 2 — Commission Invoice (type: COMMISSION)**
- `vendorId`: same vendor
- `sellerName`: Platform legal name (from PlatformFinancialConfig)
- `sellerGstin`: Platform GSTIN
- Items: commission charged per product line
- Financial: total commission, GST on commission
- This is what the platform charges the vendor

**Invoice Number Format:**
- Product: `INV-2026-000001`
- Commission: `COMINV-2026-000001`
- Use atomic DB sequence per type per year

---

### PDF Generation (async via BullMQ)

```
1. Invoice record created in DB (pdfStatus: 0 = PENDING)
2. Job queued: { invoiceId, invoiceType }
3. Worker picks job:
   a. Load full invoice data from DB
   b. Render HTML template (Handlebars or JSX)
   c. Generate PDF via Puppeteer (headless Chrome)
   d. Upload PDF to S3/R2
   e. Update Invoice: pdfUrl = s3Key, pdfStatus = 1 (GENERATED)
4. On GET /invoice/pdf: if pdfStatus=1, redirect to signed S3 URL
   If pdfStatus=0: return 202 Accepted with retry-after header
   If pdfStatus=2 (FAILED): regenerate on demand
```

**Invoice PDF must include (GST-compliant):**
- Invoice number, date
- Seller details (name, address, GSTIN, state)
- Buyer details (name, address, phone)
- HSN/SAC codes per line item
- Taxable value, GST rate, CGST/SGST or IGST per item
- Total taxable value, total tax, total amount
- "Tax Invoice" label

---

## 15. Build Phase 10 — Settlement System {#phase-10}

### Models used: `VendorSettlement`, `VendorEarning`

### Settlement Endpoints

```
// Admin (Finance Admin)
GET    /api/v1/admin/settlements              → List all settlements
GET    /api/v1/admin/settlements/:id          → Settlement detail with earnings
POST   /api/v1/admin/settlements              → Create settlement batch for vendor
PATCH  /api/v1/admin/settlements/:id/process  → Mark as PROCESSING (payment initiated)
PATCH  /api/v1/admin/settlements/:id/complete → Mark as COMPLETED (payment done)
PATCH  /api/v1/admin/settlements/:id/fail     → Mark as FAILED
GET    /api/v1/admin/settlements/:id/report   → Export settlement report PDF/CSV

// Vendor
GET    /api/v1/vendor/settlements             → Own settlements
GET    /api/v1/vendor/settlements/:id         → Settlement detail
```

---

### Settlement Creation Logic

**`POST /admin/settlements`:**
- Body: `{ vendorId, periodStart, periodEnd, note? }`
- Find all `VendorEarning` where:
  - `vendorId = vendorId`
  - `status = PENDING`
  - `createdAt >= periodStart AND <= periodEnd`
  - `settlementId = null`
- If none found: return error "No pending earnings in period"
- Calculate `totalEarnings = sum(vendorPayable)`
- Generate `settlementNumber`
- Create `VendorSettlement` (status: PENDING)
- Update all matched `VendorEarning` records: `settlementId = newSettlementId`
- Return settlement with earnings list

**`PATCH /admin/settlements/:id/complete`:**
- Body: `{ payoutMethod, paymentRef }`
- Set settlement `status = COMPLETED`, `settledAt = now()`, `settledBy = adminUserId`
- Update all linked `VendorEarning.status = SETTLED`
- Send settlement confirmation notification to vendor

---

## 16. Build Phase 11 — Coupon System {#phase-11}

### Models used: `Coupon`, `CouponUsage`

### Coupon Endpoints

```
// Admin
GET    /api/v1/admin/coupons                  → List coupons
POST   /api/v1/admin/coupons                  → Create coupon
PATCH  /api/v1/admin/coupons/:id              → Update coupon
DELETE /api/v1/admin/coupons/:id              → Soft delete coupon

// Customer (checkout flow)
POST   /api/v1/cart/apply-coupon              → Validate + preview coupon discount
DELETE /api/v1/cart/remove-coupon             → Remove applied coupon
```

### Coupon Validation Logic

**`POST /cart/apply-coupon`:**
- Body: `{ code, cartId? }`
- Find coupon by code
- Check: `isActive`, `expiresAt > now()`, `startsAt <= now()`
- Check `usageCount < usageLimit` (if usageLimit is set)
- Check user's prior usage: `CouponUsage` for this userId + couponId
- If `appliesTo = CATEGORY / PRODUCT / VENDOR`: validate cart has qualifying items
- Calculate discountAmount based on couponType:
  - PERCENTAGE: `cartSubtotal * value/100`, capped at `maxDiscountAmount`
  - FLAT_AMOUNT: `min(value, cartSubtotal)`
  - FREE_SHIPPING: `discountAmount = totalShippingCharge`
- Return: `{ valid: true, discountAmount, message }`

**Coupon is NOT consumed here** — it's consumed atomically in checkout transaction.

---

## 17. Build Phase 12 — Review System {#phase-12}

### Models used: `Review`, `ReviewImage`, `ReviewMetric`, `ProductReviewMetric`, `ReviewMetricResponse`, `ProductReviewSummary`

### Review Endpoints

```
// Customer
POST   /api/v1/orders/:orderId/reviews        → Submit review (verified purchase)
GET    /api/v1/public/products/:id/reviews    → Get product reviews (paginated)
GET    /api/v1/users/reviews                  → My reviews

// Admin
GET    /api/v1/admin/reviews                  → All reviews (filter by product/status)
PATCH  /api/v1/admin/reviews/:id/approve      → Approve review
PATCH  /api/v1/admin/reviews/:id/reject       → Reject (soft delete)
GET    /api/v1/admin/review-metrics           → List review metrics
POST   /api/v1/admin/review-metrics           → Create review metric
POST   /api/v1/admin/products/:id/metrics     → Assign metric to product
```

### Review Submission Logic

- Verify order exists, belongs to user, status = DELIVERED
- Verify user hasn't already reviewed this product
- Set `isVerifiedPurchase = true`
- Create Review + ReviewImages + ReviewMetricResponses in transaction
- Recalculate `ProductReviewSummary`:
  ```
  SELECT AVG(rating), COUNT(*) FROM reviews
  WHERE productId = X AND isApproved = true
  ```
- Update `ProductReviewSummary` atomically (use `upsert`)

---

## 18. Build Phase 13 — Notifications {#phase-13}

### Models used: `Notification`

### Notification Endpoints

```
GET    /api/v1/notifications                  → Get user's notifications (paginated)
PATCH  /api/v1/notifications/:id/read         → Mark as read
PATCH  /api/v1/notifications/read-all         → Mark all as read
DELETE /api/v1/notifications/:id              → Delete notification
GET    /api/v1/notifications/unread-count     → Get unread count (for badge)
```

### `notifications.service.ts` — `createNotification()` helper

```typescript
// Called internally throughout the system, never directly by client
export async function createNotification(params: {
  recipientType: 'USER' | 'VENDOR' | 'ADMIN'
  recipientId: bigint
  title: string
  message: string
  notificationType: string
  channel?: 'IN_APP' | 'EMAIL'
  referenceType?: string
  referenceId?: bigint
}) { ... }
```

**Trigger points for notifications:**

| Event | Recipients | Type |
|---|---|---|
| Order placed | Customer, Each Vendor | NEW_ORDER |
| Order status updated | Customer | ORDER_STATUS_UPDATE |
| Vendor approved | Vendor | VENDOR_APPROVED |
| Vendor suspended | Vendor | VENDOR_SUSPENDED |
| New vendor application | Super Admin | NEW_VENDOR_APPLICATION |
| Settlement completed | Vendor | SETTLEMENT_DONE |
| Low stock (qty < 5) | Vendor, Admin | LOW_STOCK |
| Payment success | Customer | PAYMENT_SUCCESS |
| Payment failed | Customer | PAYMENT_FAILED |

---

## 19. Build Phase 14 — Analytics & Dashboards {#phase-14}

### Models used: `DailyPlatformAnalytics`, `DailyVendorAnalytics`

### Analytics Endpoints

```
// Admin Dashboard
GET    /api/v1/admin/analytics/overview       → KPI cards (today, this week, this month)
GET    /api/v1/admin/analytics/revenue        → Revenue chart data (daily/weekly/monthly)
GET    /api/v1/admin/analytics/orders         → Order count chart
GET    /api/v1/admin/analytics/vendors        → Vendor performance table
GET    /api/v1/admin/analytics/products       → Top selling products
GET    /api/v1/admin/analytics/platform-earnings → Commission earnings breakdown

// Vendor Dashboard
GET    /api/v1/vendor/analytics/overview      → Vendor KPI cards
GET    /api/v1/vendor/analytics/revenue       → Vendor revenue chart
GET    /api/v1/vendor/analytics/orders        → Vendor order chart
GET    /api/v1/vendor/analytics/top-products  → Vendor's top products by sales
```

### Admin Overview Response Shape

```json
{
  "today": {
    "orders": 12,
    "revenue": 45000.00,
    "platformEarnings": 4500.00,
    "newCustomers": 3
  },
  "thisWeek": { ... },
  "thisMonth": { ... },
  "allTime": {
    "totalOrders": 540,
    "totalRevenue": 1250000.00,
    "activeVendors": 18,
    "totalProducts": 312
  }
}
```

### Analytics Strategy

**Real-time (for dashboard KPI cards):** Query live from `Order` and `VendorOrder`
tables for "today" range — acceptable for small-medium scale.

**Historical charts:** Query from `DailyPlatformAnalytics` / `DailyVendorAnalytics`
snapshots — fast, indexed by date.

**Snapshot Population (BullMQ daily job at midnight):**
```typescript
// daily-analytics.processor.ts
// Runs at 00:05 each day for yesterday's data
// Aggregates all orders, revenue, earnings for the day
// Upserts into DailyPlatformAnalytics and DailyVendorAnalytics
```

---

## 20. Build Phase 15 — Influencer System {#phase-15}

### Models used: `Influencer`, `InfluencerSale`, `InfluencerPayoutDetails`, `InfluencerPayout`

### Endpoints

```
// Admin
GET    /api/v1/admin/influencers              → List influencers
POST   /api/v1/admin/influencers              → Create influencer
PATCH  /api/v1/admin/influencers/:id          → Update
PATCH  /api/v1/admin/influencers/:id/status   → ACTIVE/PAUSED/BANNED
GET    /api/v1/admin/influencers/:id/sales    → Sales attributed
POST   /api/v1/admin/influencers/:id/payout   → Initiate payout

// Influencer Dashboard (if canViewDashboard = true)
GET    /api/v1/influencer/dashboard           → Own stats
GET    /api/v1/influencer/sales               → Own sales

// Public (no auth — referral code attribution)
GET    /api/v1/public/referral/:code/validate → Validate referral code before checkout
```

### Referral Attribution

- Customer provides `?ref=CODE` on product or checkout page
- Frontend sends `referralCode` in checkout body
- During checkout: look up `Influencer` by code, verify ACTIVE
- Snapshot `influencerId`, `referralCode`, `influencerCommissionRate` on `Order`
- After payment confirmed: create `InfluencerSale` with `@@unique(orderId)` guard

---

## 21. Background Jobs {#background-jobs}

**`src/jobs/queue.ts`** — Define queues:

```typescript
export const queues = {
  pdf: new Queue('invoice-pdf', { connection: redis }),
  email: new Queue('email', { connection: redis }),
  analytics: new Queue('analytics', { connection: redis }),
  notifications: new Queue('notifications', { connection: redis }),
  cartExpiry: new Queue('cart-expiry', { connection: redis }),
}
```

### Job Definitions

| Queue | Job Name | Trigger | Action |
|---|---|---|---|
| `invoice-pdf` | `generate-invoice` | After order payment | Generate + upload PDF |
| `email` | `send-order-confirmation` | After order placed | Send email to customer |
| `email` | `send-vendor-new-order` | After order placed | Send email per vendor |
| `email` | `send-settlement-done` | After settlement completed | Vendor email |
| `analytics` | `daily-snapshot` | Cron: 00:05 daily | Aggregate yesterday's data |
| `cart-expiry` | `release-reservations` | Cron: every 5 min | Release expired reservations |
| `notifications` | `push-notification` | Various | Create in-app + email notifications |

### Cron Setup

```typescript
// In src/jobs/queue.ts, after worker setup:
new CronJob('analytics-daily', queues.analytics, { pattern: '5 0 * * *' }, { jobId: 'daily' })
new CronJob('cart-expiry', queues.cartExpiry, { pattern: '*/5 * * * *' }, { jobId: 'expiry' })
```

---

## 22. Payments — Razorpay Integration {#payments}

### Payment Endpoints

```
POST   /api/v1/payments/initiate              → Create Razorpay order (after checkout)
POST   /api/v1/payments/verify                → Verify Razorpay payment signature (frontend calls after success)
POST   /api/v1/webhooks/razorpay              → Razorpay webhook (server-to-server)
POST   /api/v1/payments/refund                → Initiate refund (admin)
```

### Payment Flow

```
1. POST /orders/checkout → creates Order (status: PAYMENT_PENDING) → returns razorpayOrderId
2. Frontend: Razorpay Checkout UI → user pays
3. Frontend calls POST /payments/verify with:
   { razorpayOrderId, razorpayPaymentId, razorpaySignature, ourOrderId }
4. Backend verifies HMAC signature:
   expected = HMAC_SHA256(razorpayOrderId + "|" + razorpayPaymentId, RAZORPAY_KEY_SECRET)
   if mismatch → 400 Payment Tampered
5. If valid: optimistically mark Order as PAID
6. Razorpay also calls webhook (server-to-server) → authoritative confirmation

WEBHOOK HANDLER (authoritative):
- Verify webhook signature header
- Event: payment.captured → confirm Order payment, create VendorEarnings, generate invoices, queue notifications
- Event: payment.failed → mark Order PAYMENT_FAILED, release inventory
- Event: refund.created → update Payment record
- Use idempotency: check if orderId already processed before acting
```

---

## 23. Uploads System {#uploads}

### Upload Endpoints

```
POST   /api/v1/uploads/presign                → Get presigned S3 PUT URL
POST   /api/v1/uploads/confirm                → Confirm upload complete, get final URL
```

### Upload Strategy (Client-Direct to S3)

```
1. Frontend requests presigned URL for file (type, size, name)
2. Backend validates: only allow image/jpeg, image/png, image/webp; max 5MB
3. Backend generates presigned PUT URL (expires in 5 min)
4. Frontend uploads directly to S3/R2 via PUT
5. Frontend calls /confirm with the S3 key
6. Backend verifies object exists in S3
7. Backend returns final CDN URL
```

File key structure: `uploads/{category}/{yyyyMM}/{nanoid()}.{ext}`
Categories: `products`, `vendors`, `reviews`, `invoices`

---

## 24. Error Handling & API Standards {#api-standards}

### Global Exception Filter (registered in Nest bootstrap)

```typescript
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    // AppError: structured, known errors
    if (err instanceof AppError) {
      return response
        .status(err.statusCode)
        .json({ success: false, error: { code: err.code, message: err.message } })
    }

    // Prisma known errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return response
          .status(409)
          .json({ success: false, error: { code: 'CONFLICT', message: 'Resource already exists' } })
      }
      if (err.code === 'P2025') {
        return response
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } })
      }
    }

    // Zod validation error
    if (err instanceof ZodError) {
      return response.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        }
      })
    }

    // Unknown errors — never expose internals
    logger.error(err)
    return response
      .status(500)
      .json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
  }
}
```

### Validation Pattern (all routes use this)

```typescript
// src/middleware/validate.ts
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) throw new ZodError(result.error.issues)
    return result.data
  }
}
```

---

## 25. Security Checklist {#security}

Apply these throughout all phases:

```
[ ] All financial calculations use decimal.js — NEVER native JS floats
[ ] All order/payment operations run in DB transactions
[ ] Webhook signature verified BEFORE any processing
[ ] User can only access their own orders, cart, addresses
[ ] Vendor can only access their own products, orders, earnings
[ ] Admin routes all guarded by RBAC guard with specific permissions
[ ] All money amounts validated as positive Decimals in Zod schemas
[ ] Rate limiting on auth routes (register, login, forgot-password)
[ ] Presigned upload URLs validated for file type + size
[ ] CORS restricted to APP_URL
[ ] Prisma queries always scoped to authenticated user's context
[ ] Soft deletes used — no hard deletes on financial records, ever
[ ] Invoice records IMMUTABLE after creation — no UPDATE allowed
[ ] VendorEarning records IMMUTABLE after creation
[ ] Environment variables validated at startup (Zod)
[ ] No internal error details exposed in production responses
[ ] SQL injection: impossible via Prisma (parameterized by default)
[ ] Order number + invoice number generation uses DB-level atomic sequences
[ ] Settlement creation uses DB transaction to lock earnings
```

---

## 26. Final Integration Checklist {#final-checklist}

Run through this after all phases are complete:

```
[ ] Phase 0: Seed runs cleanly on fresh DB
[ ] Phase 1: Register → Login → Refresh flow works end-to-end
[ ] Phase 2: Admin can create another admin, RBAC gates enforced
[ ] Phase 3: Vendor can apply, admin can approve, vendor dashboard accessible
[ ] Phase 4: Categories with nested children, brands linked to vendors
[ ] Phase 5: Admin creates product+variants, vendor can update stock
[ ] Phase 5: Public browse filters work (category, brand, vendor, price range)
[ ] Phase 6: Cart add/update/remove, inventory reservation created/released
[ ] Phase 7: Full checkout flow creates Order + VendorOrders atomically
[ ] Phase 7: Inventory decremented correctly after checkout
[ ] Phase 8: Razorpay order created, payment verification works
[ ] Phase 8: Webhook receives payment.captured → VendorEarnings created
[ ] Phase 9: Both invoices (PRODUCT + COMMISSION) created after payment
[ ] Phase 9: PDF queued, generated, uploaded, accessible via signed URL
[ ] Phase 10: Settlement created for vendor, earnings marked SETTLED
[ ] Phase 11: Coupon validated, applied at checkout, CouponUsage created
[ ] Phase 12: Review submitted for delivered order, summary updated
[ ] Phase 13: Notifications created at all trigger points
[ ] Phase 14: Admin dashboard analytics populated
[ ] Phase 14: Daily snapshot job runs and populates analytics tables
[ ] Phase 15: Referral code attribution persists on order
[ ] All error cases return correct error codes and HTTP status
[ ] No floats used in any financial calculation
[ ] No raw SQL without parameterization
[ ] All vendor routes reject inactive/suspended vendors
```

---

## Build Order Summary for Claude Code

```
Phase 0  → Bootstrap, config, prisma, seed
Phase 1  → Auth (register/login/JWT)
Phase 2  → RBAC (roles, permissions, admin profiles)
Phase 3  → Vendor system (onboarding, documents, bank)
Phase 4  → Categories + Brands
Phase 5  → Products + Variants + Inventory
Phase 6  → Cart + Address
Phase 7  → Orders + Vendor Orders + Order placement TX
Phase 8  → Payments (Razorpay) + Webhook + Financial engine + VendorEarnings
Phase 9  → Invoice system (two invoice types + PDF queue)
Phase 10 → Settlements
Phase 11 → Coupons
Phase 12 → Reviews
Phase 13 → Notifications
Phase 14 → Analytics + Dashboard
Phase 15 → Influencer system
Final    → Integration pass, security audit, seed realistic test data
```

> **Critical rule for Claude Code:** Phases 7 and 8 contain the most complex
> transactional logic. Do NOT rush these. The checkout transaction and the
> payment webhook handler are the backbone of the entire financial system.
> Write these with explicit DB transactions, verify every step, and test with
> edge cases (concurrent orders, payment retries, partial failures) before
> proceeding to Phase 9.