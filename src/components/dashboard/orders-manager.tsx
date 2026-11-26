"use client";

import { useMemo, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DashboardData, SalesOrder } from "@/lib/types";
import { money, shortDate } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudDownload, Pencil, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";

interface FormState {
  date: string;
  employee: string;
  department: string;
  source: string;
  profile: string;
  clientId: string;
  orderNo: string;
  service: string;
  status: string;
  fresh: string;
  amount: string;
}

const STATUS_OPTIONS = ["Delivered", "WIP", "Pending", "Cancelled"];

const PAGE_SIZE = 50;

function emptyForm(today: string): FormState {
  return {
    date: today,
    employee: "",
    department: "",
    source: "",
    profile: "",
    clientId: "",
    orderNo: "",
    service: "",
    status: "WIP",
    fresh: "",
    amount: "",
  };
}

function orderToForm(o: SalesOrder): FormState {
  return {
    date: o.date,
    employee: o.employee,
    department: o.department,
    source: o.source,
    profile: o.profile,
    clientId: o.clientId,
    orderNo: o.orderNo,
    service: o.service === "Other" ? "" : o.service,
    status: STATUS_OPTIONS.includes(o.status) || !o.status ? o.status : o.status,
    fresh: o.fresh.toLowerCase() === "green" || o.fresh.toLowerCase() === "yellow" ? o.fresh.toLowerCase() : "",
    amount: String(o.amount),
  };
}

function statusClass(s: string): string {
  const t = s.toLowerCase();
  if (t === "delivered") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (t === "wip") return "bg-amber-100 text-amber-800 border-amber-200";
  if (t === "cancelled") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-foreground/80 border-slate-200";
}

export default function OrdersManager({
  data,
  reload,
}: {
  data: DashboardData;
  reload: () => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const distinct = useMemo(() => {
    const employees = [...new Set(data.orders.map((o) => o.employee))].sort();
    const members = data.members.map((m) => m.name);
    const sources = [...new Set(data.orders.map((o) => o.source).filter(Boolean))].sort();
    const services = [...new Set(data.orders.map((o) => o.service).filter((s) => s && s !== "Other"))].sort();
    return {
      employees: [...new Set([...employees, ...members])],
      sources,
      services,
    };
  }, [data.orders, data.members]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data.orders;
    return data.orders.filter((o) =>
      [
        o.employee,
        o.clientId,
        o.orderNo,
        o.service,
        o.source,
        o.status,
        o.profile,
        o.department,
        o.date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [data.orders, q]);

  const shown = filtered.slice(0, visible);
  const revenue = filtered.reduce((s, o) => s + o.amount, 0);
  const delivered = filtered.filter((o) => o.status.toLowerCase() === "delivered").length;
  const wip = filtered.filter((o) => o.status.toLowerCase() === "wip").length;

  const openAdd = () => {
    setEditingId(null);
    setError("");
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEdit = (o: SalesOrder) => {
    setEditingId(o.id);
    setError("");
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const saveForm = async (form: FormState, close: () => void) => {
    setError("");
    if (!form.employee.trim()) {
      setError("Employee name is required.");
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        service: form.service || "Other",
        amount: parseFloat(form.amount),
      };
      const res = await fetch(editingId ? `/api/orders/${editingId}` : "/api/orders", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed");
      toast({
        title: editingId ? "Order updated" : "Order added",
        description: `${form.employee} — ${money(payload.amount)}`,
      });
      close();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      const res = await fetch(`/api/orders/${target.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Delete failed");
      toast({ title: "Order deleted", description: `${target.employee} — ${money(target.amount)}` });
      await reload();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncFromSheet = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/orders/sync", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; imported?: number; kept?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Sync failed");
      toast({
        title: "Sheet sync complete",
        description: `${json.imported ?? 0} orders imported from the sheet · ${json.kept ?? 0} of your own orders kept`,
      });
      await reload();
    } catch (e) {
      toast({
        title: "Sheet sync failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sales Orders</h2>
          <p className="text-sm text-muted-foreground">
            {data.orders.length} orders this month · add, edit or delete — everything saves to the dashboard database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              aria-label="Search orders"
              autoComplete="off"
              placeholder="Search employee, client, order no…"
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncFromSheet}
            disabled={syncing}
            title="Pull the latest rows from the Google Sheet (your own orders are kept)"
          >
            <CloudDownload className={`mr-1 h-4 w-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing…" : "Sync from Sheet"}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" /> Add Order
          </Button>
        </div>
      </div>

      {/* mini stats — same card language as the overview KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Orders", value: String(filtered.length), cls: "text-foreground" },
          { label: "Revenue", value: money(Math.round(revenue * 10) / 10), cls: "text-emerald-700" },
          { label: "Delivered", value: String(delivered), cls: "text-teal-700" },
          { label: "WIP", value: String(wip), cls: "text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Order / Client</th>
                <th className="px-3 py-2.5 font-medium">Employee</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o, i) => (
                /* sheet rows can repeat an id — index suffix keeps React keys unique */
                <tr key={`${o.id}-${i}`} className="border-t border-border transition-colors hover:bg-accent/50">
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{shortDate(o.date)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{o.orderNo || "—"}</p>
                    <p className="text-xs text-muted-foreground">{o.clientId || o.profile || ""}</p>
                  </td>
                  <td className="px-3 py-2.5 text-foreground/80">{o.employee}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{o.service}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{o.source || "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={`${statusClass(o.status)} text-[11px]`}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                    {money(o.amount, 2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(o)}
                      aria-label={`Edit order ${o.orderNo || o.clientId || ""}`}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:text-rose-600"
                      onClick={() => setDeleting(o)}
                      aria-label={`Delete order ${o.orderNo || o.clientId || ""}`}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile cards */}
      <div className="space-y-3 md:hidden">
        {shown.map((o, i) => (
          <div key={`${o.id}-m-${i}`} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{o.employee}</p>
                <p className="text-xs text-muted-foreground">
                  {shortDate(o.date)} · {o.orderNo || "no order no"}
                </p>
              </div>
              <p className="font-bold tabular-nums text-foreground">{money(o.amount, 2)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`${statusClass(o.status)} text-[11px]`}>
                {o.status}
              </Badge>
              <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
                {o.service}
              </Badge>
              {o.source && (
                <Badge variant="outline" className="border-border bg-muted text-[11px] text-muted-foreground">
                  {o.source}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(o)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => setDeleting(o)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > shown.length && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more ({filtered.length - shown.length} remaining)
          </Button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card py-12 text-center">
          <ShoppingCart className="h-10 w-10 text-stone-300" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {data.orders.length ? "No order matches your search." : "No orders yet — add your first order or sync from the sheet."}
          </p>
        </div>
      )}

      {/* add / edit dialog — remounted per open so state always starts fresh */}
      {formOpen && (
        <OrderFormDialog
          key={formKey}
          editingId={editingId}
          initial={editingId ? orderToForm(data.orders.find((o) => o.id === editingId)!) : emptyForm(today)}
          employees={distinct.employees}
          sources={distinct.sources}
          services={distinct.services}
          saving={saving}
          error={error}
          onCancel={() => setFormOpen(false)}
          onSave={(form, close) => saveForm(form, close)}
        />
      )}

      {/* delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.employee} — {deleting ? money(deleting.amount, 2) : ""} ({deleting?.date}). This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OrderFormDialog(props: {
  editingId: string | null;
  initial: FormState;
  employees: string[];
  sources: string[];
  services: string[];
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: (form: FormState, close: () => void) => void;
}) {
  const [form, setForm] = useState<FormState>(props.initial);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // warn before closing/leaving with unsaved edits
  const dirty = JSON.stringify(form) !== JSON.stringify(props.initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const field =
    "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <Dialog open>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.editingId ? "Edit order" : "Add new order"}</DialogTitle>
          <DialogDescription>
            {props.editingId
              ? "Changes save to the dashboard database and update every chart instantly."
              : "Fill in the sale details — the order is saved to the dashboard database."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="og-date" className="text-xs font-medium text-muted-foreground">Date *</label>
            <Input
              id="og-date"
              name="date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="og-amount" className="text-xs font-medium text-muted-foreground">Amount ($) *</label>
            <Input
              id="og-amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              autoComplete="off"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="e.g. 120"
              className="rounded-lg"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label htmlFor="og-employee" className="text-xs font-medium text-muted-foreground">Employee *</label>
            <Input
              id="og-employee"
              name="employee"
              list="og-employees"
              autoComplete="off"
              value={form.employee}
              onChange={(e) => set("employee", e.target.value)}
              placeholder="Team member name…"
              className="rounded-lg"
            />
            <datalist id="og-employees">
              {props.employees.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="og-service" className="text-xs font-medium text-muted-foreground">Service</label>
            <Input
              id="og-service"
              name="service"
              list="og-services"
              autoComplete="off"
              value={form.service}
              onChange={(e) => set("service", e.target.value)}
              placeholder="Shopify, Wix…"
              className="rounded-lg"
            />
            <datalist id="og-services">
              {props.services.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="og-source" className="text-xs font-medium text-muted-foreground">Source</label>
            <Input
              id="og-source"
              name="source"
              list="og-sources"
              autoComplete="off"
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Where the sale came from…"
              className="rounded-lg"
            />
            <datalist id="og-sources">
              {props.sources.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="og-status" className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={form.status || "WIP"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger id="og-status" className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="og-fresh" className="text-xs font-medium text-muted-foreground">Fresh / Repeat</label>
            <Select value={form.fresh || "none"} onValueChange={(v) => set("fresh", v === "none" ? "" : v)}>
              <SelectTrigger id="og-fresh" className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="green">Green (fresh)</SelectItem>
                <SelectItem value="yellow">Yellow (repeat)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="og-order-no" className="text-xs font-medium text-muted-foreground">Order no</label>
            <Input
              id="og-order-no"
              name="orderNo"
              autoComplete="off"
              spellCheck={false}
              value={form.orderNo}
              onChange={(e) => set("orderNo", e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="og-client-id" className="text-xs font-medium text-muted-foreground">Client ID</label>
            <Input
              id="og-client-id"
              name="clientId"
              autoComplete="off"
              spellCheck={false}
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="og-profile" className="text-xs font-medium text-muted-foreground">Profile</label>
            <Input
              id="og-profile"
              name="profile"
              autoComplete="off"
              spellCheck={false}
              value={form.profile}
              onChange={(e) => set("profile", e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="og-department" className="text-xs font-medium text-muted-foreground">Department</label>
            <Input
              id="og-department"
              name="department"
              list="og-departments"
              autoComplete="off"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="SAA_Team / STA_Team…"
              className="rounded-lg"
            />
            <datalist id="og-departments">
              <option value="SAA_Team" />
              <option value="STA_Team" />
            </datalist>
          </div>
        </div>

        {props.error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{props.error}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancel
          </Button>
          <Button onClick={() => props.onSave(form, props.onCancel)} disabled={props.saving}>
            {props.saving ? "Saving…" : props.editingId ? "Save changes" : "Add order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
