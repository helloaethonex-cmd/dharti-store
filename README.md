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
