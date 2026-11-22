import { db, ensureSchema } from "./db";
import { getDashboardData, getDashboardDataForOrders } from "./sheet-data";
import type { DashboardData, SalesOrder } from "./types";

const DB_SOURCE = "Dashboard database (editable)";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface OrderInput {
  employee: string;
  department: string;
  date: string;
  source: string;
  profile: string;
  clientId: string;
  orderNo: string;
  service: string;
  status: string;
  amount: number;
  fresh: string;
}

/** Normalize + validate a payload coming from the UI. Throws on invalid input. */
export function cleanOrderInput(body: unknown): OrderInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const s = (k: string, max = 120): string => {
    const v = typeof b[k] === "string" ? (b[k] as string).trim() : "";
    return v.slice(0, max);
  };
  const employee = s("employee", 120);
  if (!employee) throw new Error("Employee name is required");
  const rawAmount = typeof b.amount === "number" ? b.amount : parseFloat(String(b.amount ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error("Amount must be greater than 0");
  const date = s("date", 10);
  if (!DATE_RE.test(date)) throw new Error("Date must be YYYY-MM-DD");
  const status = s("status", 40) || "WIP";
  const service = s("service", 80) || "Other";
  const fresh = /^(green|yellow)$/i.test(s("fresh", 10)) ? s("fresh", 10).toLowerCase() : "";
  return {
    employee,
    department: s("department", 80),
    date,
    source: s("source", 80),
    profile: s("profile", 120),
    clientId: s("clientId", 60),
    orderNo: s("orderNo", 60),
    service,
    status,
    amount: Math.round(rawAmount * 100) / 100,
    fresh,
  };
}

function toSalesOrder(r: {
  id: string;
  origin: string;
  employee: string;
  department: string;
  date: string;
  source: string;
  profile: string;
  clientId: string;
  orderNo: string;
  service: string;
  status: string;
  amount: number;
  fresh: string;
}): SalesOrder {
  return {
    id: r.id,
    origin: r.origin,
    employee: r.employee,
    department: r.department,
    date: r.date,
    source: r.source,
    profile: r.profile,
    clientId: r.clientId,
    orderNo: r.orderNo,
    service: r.service || "Other",
    status: r.status || "Unknown",
    amount: r.amount,
    fresh: r.fresh,
  };
}

export async function getDbOrders(): Promise<SalesOrder[]> {
  await ensureSchema();
  const rows = await db.order.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toSalesOrder);
}

/**
 * Content fingerprint of a set of orders (ignores ids/origin so a re-sync of
 * identical rows produces the same signature and we can skip the rewrite).
 */
function ordersSignature(rows: SalesOrder[]): string {
  return rows
    .map((o) =>
      [
        o.employee,
        o.department,
        o.date,
        o.source,
        o.profile,
        o.clientId,
        o.orderNo,
        o.service,
        o.status,
        o.amount,
        o.fresh,
      ]
        .join("\u0001")
    )
    .sort()
    .join("\u0002");
}

function sheetSeedRows(orders: SalesOrder[]): ReturnType<typeof buildSeedRow>[] {
  const stamp = Date.now();
  return orders.map((o, i) => buildSeedRow(o, `${stamp}-${i + 1}`));
}

function buildSeedRow(o: SalesOrder, id: string) {
  return {
    id,
    origin: "sheet",
    sheetId: o.id,
    employee: o.employee,
    department: o.department,
    date: o.date,
    source: o.source,
    profile: o.profile,
    clientId: o.clientId,
    orderNo: o.orderNo,
    service: o.service || "Other",
    status: o.status || "Unknown",
    amount: o.amount,
    fresh: o.fresh,
  };
}

/**
 * The dashboard database is the single source of truth for orders.
 * On the very first run (empty table) it is seeded from the Google Sheet so
 * the transition is seamless. Afterwards the UI edits live in the database
 * and sheet changes flow in automatically: whenever the live sheet differs
 * from the sheet-origin rows in the database they are refreshed in place,
 * while rows added from the dashboard UI (origin = "ui") are always kept.
 */
export async function loadDashboardData(force = false): Promise<DashboardData> {
  const sheetData = await getDashboardData(force);
  let orders = await getDbOrdersSafe();
  if (orders.length === 0) {
    // "no orders" is ambiguous: an empty table (first run → seed) or a failed
    // read (transient DB error → must NOT seed, the rows may still be there).
    const rowCount = await getDbCountSafe();
    if (rowCount === null) {
      console.warn("[orders-store] database unreadable — serving sheet view without seeding");
      return sheetData;
    }
    if (rowCount > 0) {
      console.warn("[orders-store] database read failed but rows exist — serving sheet view");
      return sheetData;
    }
    // First run: seed the database from the sheet. Only trust a live sheet
    // fetch — the offline snapshot could be stale and would lock old data in
    // as the database source of truth.
    if (sheetData.source !== "Google Sheets (live)") {
      console.warn("[orders-store] sheet fetch not live, skipping DB seed — serving sheet view");
      return sheetData;
    }
    if (sheetData.orders.length > 0) {
      try {
        await db.order.createMany({ data: sheetSeedRows(sheetData.orders) });
        console.log(`[orders-store] seeded ${sheetData.orders.length} orders from the sheet`);
        orders = await getDbOrders();
      } catch (e) {
        console.error("[orders-store] seeding failed, falling back to sheet orders:", e);
        return sheetData;
      }
    }
  }
  if (orders.length === 0) return sheetData; // nothing to serve — keep sheet view

  // AUTO-SYNC: if the live sheet differs from the sheet-origin rows stored in
  // the database, refresh them automatically so the dashboard never goes stale.
  if (sheetData.source === "Google Sheets (live)" && sheetData.orders.length > 0) {
    const dbSheetRows = orders.filter((o) => o.origin !== "ui");
    if (ordersSignature(dbSheetRows) !== ordersSignature(sheetData.orders)) {
      try {
        await db.order.deleteMany({ where: { origin: { not: "ui" } } });
        await db.order.createMany({ data: sheetSeedRows(sheetData.orders) });
        orders = await getDbOrders();
        console.log(
          `[orders-store] auto-synced ${sheetData.orders.length} orders from the sheet (ui rows kept: ${orders.length - sheetData.orders.length})`
        );
      } catch (e) {
        console.error("[orders-store] auto-sync failed, serving existing database rows:", e);
      }
    }
  }

  const data = await getDashboardDataForOrders(orders, false);
  return { ...data, source: DB_SOURCE };
}

async function getDbOrdersSafe(): Promise<SalesOrder[]> {
  try {
    return await getDbOrders();
  } catch (e) {
    console.error("[orders-store] database read failed, using sheet orders:", e);
    return [];
  }
}

/**
 * Direct row count (null = the database itself is unreadable).
 * Needed because "0 orders" from getDbOrdersSafe() is ambiguous — an empty
 * table AND a failed read both return [] — and seeding on a failed read
 * would append duplicate sheet rows onto the data that is still there.
 */
async function getDbCountSafe(): Promise<number | null> {
  try {
    return await db.order.count();
  } catch (e) {
    console.error("[orders-store] database count failed:", e);
    return null;
  }
}

/**
 * Refresh the database from the Google Sheet.
 * Sheet-origin rows are fully replaced (sheet row ids are NOT unique, so an
 * id-based upsert would silently collapse orders). UI-created rows are kept.
 */
export async function syncOrdersFromSheet(): Promise<{
  imported: number;
  total: number;
  kept: number;
}> {
  await ensureSchema();
  const sheetData = await getDashboardData(true);
  if (sheetData.source !== "Google Sheets (live)") {
    throw new Error(
      "Could not reach the live Google Sheet right now — nothing was changed. Please try again later."
    );
  }
  const kept = await db.order.count({ where: { origin: "ui" } });
  await db.order.deleteMany({ where: { origin: { not: "ui" } } });
  const rows = sheetSeedRows(sheetData.orders);
  if (rows.length > 0) await db.order.createMany({ data: rows });
  return { imported: rows.length, total: rows.length + kept, kept };
}
