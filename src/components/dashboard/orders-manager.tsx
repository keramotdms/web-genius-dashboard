"use client";

import { useMemo, useState } from "react";
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
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusDot(s: string): string {
  const t = s.toLowerCase();
  if (t === "delivered") return "bg-emerald-500";
  if (t === "wip") return "bg-amber-500";
  if (t === "cancelled") return "bg-rose-500";
  return "bg-slate-400";
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
          <p className="text-sm text-slate-500">
            {data.orders.length} orders this month · add, edit or delete — everything saves to the dashboard database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisible(PAGE_SIZE);
              }}
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
          <Button
            size="sm"
            onClick={openAdd}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
          >
            <Plus className="mr-1 h-4 w-4" /> Add Order
          </Button>
        </div>
      </div>

      {/* mini stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Orders", value: String(filtered.length), cls: "text-violet-700" },
          { label: "Revenue", value: money(Math.round(revenue * 10) / 10), cls: "text-emerald-700" },
          { label: "Delivered", value: String(delivered), cls: "text-teal-700" },
          { label: "WIP", value: String(wip), cls: "text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border bg-white/85 shadow-sm backdrop-blur md:block">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
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
              {shown.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-violet-50/40">
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{shortDate(o.date)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{o.orderNo || "—"}</p>
                    <p className="text-xs text-slate-400">{o.clientId || o.profile || ""}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{o.employee}</td>
                  <td className="px-3 py-2.5 text-slate-600">{o.service}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{o.source || "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={`${statusClass(o.status)} text-[11px]`}>
                      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusDot(o.status)}`} />
                      {o.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-800">
                    {money(o.amount, 2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-500 hover:text-rose-600"
                      onClick={() => setDeleting(o)}
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
        {shown.map((o) => (
          <div key={o.id} className="rounded-2xl border bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{o.employee}</p>
                <p className="text-xs text-slate-400">
                  {shortDate(o.date)} · {o.orderNo || "no order no"}
                </p>
              </div>
              <p className="font-bold text-slate-800">{money(o.amount, 2)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={`${statusClass(o.status)} text-[11px]`}>
                {o.status}
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-[11px] text-slate-600">
                {o.service}
              </Badge>
              {o.source && (
                <Badge variant="outline" className="bg-slate-50 text-[11px] text-slate-600">
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-white/85 py-12 text-center shadow-sm">
          <ShoppingCart className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
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

  const field =
    "w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-violet-300";

  return (
    <Dialog open>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl sm:max-w-xl">
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
            <label className="text-xs font-medium text-slate-500">Date *</label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Amount ($) *</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="e.g. 120"
              className="rounded-xl"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-slate-500">Employee *</label>
            <Input
              list="og-employees"
              value={form.employee}
              onChange={(e) => set("employee", e.target.value)}
              placeholder="Team member name"
              className="rounded-xl"
            />
            <datalist id="og-employees">
              {props.employees.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Service</label>
            <Input
              list="og-services"
              value={form.service}
              onChange={(e) => set("service", e.target.value)}
              placeholder="Shopify, Wix…"
              className="rounded-xl"
            />
            <datalist id="og-services">
              {props.services.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Source</label>
            <Input
              list="og-sources"
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Where the sale came from"
              className="rounded-xl"
            />
            <datalist id="og-sources">
              {props.sources.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <Select value={form.status || "WIP"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="rounded-xl">
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
            <label className="text-xs font-medium text-slate-500">Fresh / Repeat</label>
            <Select value={form.fresh || "none"} onValueChange={(v) => set("fresh", v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
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
            <label className="text-xs font-medium text-slate-500">Order no</label>
            <Input value={form.orderNo} onChange={(e) => set("orderNo", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Client ID</label>
            <Input value={form.clientId} onChange={(e) => set("clientId", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Profile</label>
            <Input value={form.profile} onChange={(e) => set("profile", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Department</label>
            <Input
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="SAA_Team"
              className="rounded-xl"
            />
          </div>
        </div>

        {props.error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{props.error}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={props.onCancel} disabled={props.saving}>
            Cancel
          </Button>
          <Button
            onClick={() => props.onSave(form, props.onCancel)}
            disabled={props.saving}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90"
          >
            {props.saving ? "Saving…" : props.editingId ? "Save changes" : "Add order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
