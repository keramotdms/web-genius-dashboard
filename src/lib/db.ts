import { PrismaClient } from '@prisma/client'
import {
  classifySite,
  WEBSITE_CATEGORIES,
  LEGACY_MAIN_TO_WEBSITE,
} from './site-taxonomy'

/**
 * Resolve the Postgres connection string.
 * Priority: process env DATABASE_URL (Vercel/CI) → .env file value (local dev).
 * The .env fallback matters because some sandbox shells export their own
 * DATABASE_URL (e.g. sqlite) that would otherwise override the project's.
 */
export function resolveDatabaseUrl(): string | undefined {
  const fromEnv = process.env.DATABASE_URL
  if (fromEnv && /^postgres(ql)?:\/\//.test(fromEnv)) return fromEnv
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    const m = raw.match(/^DATABASE_URL=(.+)$/m)
    if (m) {
      const v = m[1].trim().replace(/^"(.*)"$/, '$1')
      if (/^postgres(ql)?:\/\//.test(v)) return v
    }
  } catch {
    /* .env missing — fall back to whatever the env has */
  }
  return fromEnv
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaReady: Promise<void> | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasourceUrl: resolveDatabaseUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * One-time migration: rows saved before the current taxonomy carry either
 *   a) the old 8-sector main categories ("Ecommerce", "Home & Lifestyle Services"…)
 *      → mapped to the new 20 website categories; the business-name value in
 *      "subcategory" is kept as-is (business names did not change), or
 *   b) the pre-taxonomy labels ("Ecommerce Website", "Service-Based Business"…)
 *      → re-run the keyword classifier (the original sheet category text + URL
 *      are still stored, so nothing is lost).
 * Rows already classified with the current taxonomy are left untouched, so
 * manual/AI fixes survive and this is safe to call on every boot.
 */
async function migrateLegacySiteCategories(): Promise<void> {
  const rows = (await db.$queryRawUnsafe<Array<{
    id: string; platform: string; businessType: string; subcategory: string; category: string; url: string
  }>>(
    `SELECT "id", "platform", "businessType", "subcategory", "category", "url" FROM "CustomSite"`,
  )) as Array<{ id: string; platform: string; businessType: string; subcategory: string; category: string; url: string }>

  let migrated = 0
  for (const row of rows) {
    const mapped = LEGACY_MAIN_TO_WEBSITE[row.businessType]
    if (mapped) {
      const biz = row.subcategory?.trim() || 'General Business'
      if (mapped === row.businessType && biz === row.subcategory) continue
      await db.$executeRawUnsafe(
        `UPDATE "CustomSite" SET "businessType" = $1, "subcategory" = $2 WHERE "id" = $3`,
        mapped,
        biz,
        row.id,
      )
      migrated++
    } else if (!WEBSITE_CATEGORIES.includes(row.businessType)) {
      // pre-taxonomy label (or anything unexpected) → re-classify from scratch
      const cls = classifySite(row.platform, row.category || row.subcategory, row.url)
      await db.$executeRawUnsafe(
        `UPDATE "CustomSite" SET "businessType" = $1, "subcategory" = $2 WHERE "id" = $3`,
        cls.websiteCategory,
        cls.businessCategory,
        row.id,
      )
      migrated++
    }
  }

  // override rows: map the old sector names; unknown legacy values are cleared
  // ("" = no fix for this level) so the rule-based classification shines through
  const overrides = (await db.$queryRawUnsafe<Array<{ id: string; mainCategory: string }>>(
    `SELECT "id", "mainCategory" FROM "SiteOverride"`,
  )) as Array<{ id: string; mainCategory: string }>
  for (const ov of overrides) {
    if (WEBSITE_CATEGORIES.includes(ov.mainCategory)) continue
    const mapped = LEGACY_MAIN_TO_WEBSITE[ov.mainCategory] ?? ''
    await db.$executeRawUnsafe(`UPDATE "SiteOverride" SET "mainCategory" = $1 WHERE "id" = $2`, mapped, ov.id)
    migrated++
  }

  if (migrated) console.log(`migrated ${migrated} website rows to the current taxonomy`)
}

/**
 * Idempotently create the tables the app needs (CustomSite, Message).
 * Called by API routes before the first query so a freshly deployed
 * database (e.g. a new Neon project on Vercel) works with zero manual
 * migration steps. Safe to call on every request — it runs once per process.
 */
export function ensureSchema(): Promise<void> {
  if (!globalForPrisma.schemaReady) {
    globalForPrisma.schemaReady = (async () => {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CustomSite" (
        "id" TEXT PRIMARY KEY,
        "url" TEXT NOT NULL UNIQUE,
        "platform" TEXT NOT NULL,
        "businessType" TEXT NOT NULL,
        "subcategory" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT '',
        "labels" TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await db.$executeRawUnsafe(`ALTER TABLE "CustomSite" ADD COLUMN IF NOT EXISTS "labels" TEXT[] NOT NULL DEFAULT '{}'`)
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Message" (
        "id" TEXT PRIMARY KEY,
        "author" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Order" (
        "id" TEXT PRIMARY KEY,
        "origin" TEXT NOT NULL DEFAULT 'ui',
        "sheetId" TEXT NOT NULL DEFAULT '',
        "employee" TEXT NOT NULL,
        "department" TEXT NOT NULL DEFAULT '',
        "date" TEXT NOT NULL DEFAULT '',
        "source" TEXT NOT NULL DEFAULT '',
        "profile" TEXT NOT NULL DEFAULT '',
        "clientId" TEXT NOT NULL DEFAULT '',
        "orderNo" TEXT NOT NULL DEFAULT '',
        "service" TEXT NOT NULL DEFAULT 'Other',
        "status" TEXT NOT NULL DEFAULT 'WIP',
        "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "fresh" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await db.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'ui'`)
      await db.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sheetId" TEXT NOT NULL DEFAULT ''`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_date_idx" ON "Order" ("date")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_employee_idx" ON "Order" ("employee")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_origin_idx" ON "Order" ("origin")`)
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SiteOverride" (
        "id" TEXT PRIMARY KEY,
        "url" TEXT NOT NULL UNIQUE,
        "mainCategory" TEXT NOT NULL DEFAULT '',
        "subCategory" TEXT NOT NULL DEFAULT '',
        "labels" TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await db.$executeRawUnsafe(`ALTER TABLE "SiteOverride" ADD COLUMN IF NOT EXISTS "labels" TEXT[] NOT NULL DEFAULT '{}'`)
      await db.$executeRawUnsafe(`ALTER TABLE "SiteOverride" ALTER COLUMN "mainCategory" SET DEFAULT ''`)
      await db.$executeRawUnsafe(`ALTER TABLE "SiteOverride" ALTER COLUMN "subCategory" SET DEFAULT ''`)
      await migrateLegacySiteCategories()
    })().catch((e) => {
      // allow a retry on the next request if bootstrap failed
      globalForPrisma.schemaReady = undefined
      throw e
    })
  }
  return globalForPrisma.schemaReady
}
