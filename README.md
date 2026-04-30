# Marketplace Monorepo Scaffold

Production-grade monorepo scaffold for a multi-vendor marketplace platform.

## Apps
- `apps/api`: Express API
- `apps/web`: Customer storefront (Next.js)
- `apps/admin`: Admin dashboard (Next.js)
- `apps/vendor`: Vendor dashboard (Next.js)

## Packages
- `packages/types`: Shared TypeScript contracts
- `packages/ui`: Shared UI component library
- `packages/utils`: Shared utility helpers
- `packages/config`: Shared tsconfig/eslint/prettier/env configs
- `packages/api-client`: Typed API client helpers

## Quick start
1. `pnpm install`
2. `pnpm dev`

## Notes
- This scaffold intentionally excludes DB schema and migrations for now.
- Add real dependencies and implementation per app before launch.

## Architecture Contract

### 1) Module Boundaries (API)
- All backend business logic must live in `apps/api/src/modules/*`.
- Use per-module files for separation of concerns:
  - `*.routes.ts`: HTTP route bindings
  - `*.controller.ts`: request/response handling only
  - `*.service.ts`: business logic
  - `*.repository.ts`: DB access only
  - `*.schema.ts`: request/response validation
- Cross-module imports should go through public exports (`index.ts`) and avoid deep internal file coupling.

### 2) Shared Types Rule
- `packages/types` is the source of truth for domain contracts shared across apps.
- Frontends (`apps/web`, `apps/admin`, `apps/vendor`) and API should import shared contracts from `@marketplace/types`.
- Do not duplicate DTOs/interfaces in app-local folders when they are cross-app contracts.
- App-local types remain in each app’s `src/types` only when truly local to that app.

### 3) RBAC Ownership and Naming
- RBAC policies are owned by API modules and enforced server-side in middleware/policy layers.
- Role naming convention:
  - `SUPER_ADMIN`
  - `SEO_ADMIN`
  - `FINANCE_ADMIN`
  - `VENDOR_ADMIN`
  - `VENDOR_STAFF`
- Permission naming convention: `resource:action` (example: `product:approve`, `vendor:payout`, `order:refund`).
- Frontend role checks are UX-only; they must never replace server authorization.
