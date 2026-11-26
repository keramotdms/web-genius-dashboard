"use client";

import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { DashboardData, RefSite } from "@/lib/types";
import {
  classifySite,
  CORE_PLATFORMS,
  WEBSITE_CATEGORIES,
  BUSINESS_CATEGORIES,
  SITE_LABELS,
  isGenericBusiness,
  isValidWebsiteCategory,
  shortWebsiteCategory,
} from "@/lib/site-taxonomy";
import { hostOf, platformClass, siteLabelClass, websiteCategoryClass } from "@/components/dashboard/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpenCheck,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Layers,
  Library,
  Lightbulb,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

interface MatchResult {
  url: string;
  platform: string;
  category: string;
  websiteCategory?: string;
  businessCategory?: string;
  reason: string;
}

interface WebResult {
  url: string;
  name: string;
  snippet: string;
}

interface ImportResult {
  imported: number;
  alreadyInLibrary: number;
  duplicatesInFile: number;
  missingUrl: number;
  invalidCount: number;
  invalid: Array<{ row: number; value: string; reason: string }>;
  totalRows: number;
}

const PLATFORM_OPTIONS = CORE_PLATFORMS;
const DEFAULT_WEBSITE_CATEGORY = "Professional Service-Based Website";

function guessPlatform(url: string): string {
  const t = url.toLowerCase();
  if (t.includes("myshopify") || t.includes("shopify")) return "Shopify";
  if (/wordpress|wp-content|wp-admin/.test(t)) return "WordPress";
  if (/wixsite|\.wix\./.test(t)) return "Wix";
  if (/squarespace|sqsp\.cn/.test(t)) return "Squarespace";
  if (/webflow/.test(t)) return "Webflow";
  return "Other";
}

function Pill({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
        active
          ? "border-teal-600 bg-teal-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700"
      }`}
    >
      {children}
    </button>
  );
}

/** Business-name picker: type your own OR pick from the grouped suggestion list. */
function BusinessPicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // adjust stored text when the parent resets the value (React's
  // "adjust state during render" pattern — no effect needed)
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return BUSINESS_CATEGORIES.slice(0, 8);
    return BUSINESS_CATEGORIES.filter((b) => b.toLowerCase().includes(t)).slice(0, 8);
  }, [text]);

  return (
    <div className="relative">
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Business name category"
        aria-expanded={open && matches.length > 0}
        role="combobox"
        aria-controls="business-suggestions"
        placeholder={placeholder ?? "e.g. cleaning service, bakery shop, X News Paper…"}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div id="business-suggestions" role="listbox" className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white shadow-lg">
          {matches.map((b) => (
            <button
              key={b}
              type="button"
              role="option"
              aria-selected={text === b}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-800 focus-visible:bg-teal-50 focus-visible:text-teal-800 focus-visible:outline-none"
              onMouseDown={(e) => {
                e.preventDefault();
                setText(b);
                onChange(b);
                setOpen(false);
              }}
              onClick={() => {
                // keyboard path — Enter/Space fires click, not mousedown
                setText(b);
                onChange(b);
                setOpen(false);
              }}
            >
              {b}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px] text-slate-400">
        Pick a suggestion or type your own business name — anything like “consultant”, “X News Paper” works.
      </p>
    </div>
  );
}

/** Multi-select chips for the big-client labels. */
function LabelChips({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SITE_LABELS.map((label) => {
        const active = selected.includes(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 ${
              active
                ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-amber-400 hover:text-amber-700"
            }`}
          >
            <Tag className="mr-1 inline h-3 w-3" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function References({ data, reload }: { data: DashboardData; reload?: () => void }) {
  // ── filters: CMS → Website Category → Business Name → Label ──
  const [platform, setPlatform] = useState("All");
  const [websiteCat, setWebsiteCat] = useState("All");
  const [businessCat, setBusinessCat] = useState("All");
  const [labelFilter, setLabelFilter] = useState("All");
  const [q, setQ] = useState("");
  const [requirement, setRequirement] = useState("");
  const [finding, setFinding] = useState(false);
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [web, setWeb] = useState<WebResult[]>([]);

  // ── add-website dialog state ──
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("Shopify");
  const [newWebsite, setNewWebsite] = useState("E-commerce Based (Product Selling) Website");
  const [newBusiness, setNewBusiness] = useState("");
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ── delete confirmation ──
  const [deletingSite, setDeletingSite] = useState<RefSite | null>(null);

  // ── show-more pagination (renders 60 cards at a time, keeps the DOM small) ──
  const REF_PAGE = 60;
  const [shownCount, setShownCount] = useState(REF_PAGE);

  // ── edit dialog state ──
  const [editSite, setEditSite] = useState<RefSite | null>(null);
  const [editWebsite, setEditWebsite] = useState(DEFAULT_WEBSITE_CATEGORY);
  const [editBusiness, setEditBusiness] = useState("");
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── CSV import dialog state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pasteCsv, setPasteCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── AI auto-categorize ──
  const [aiBusy, setAiBusy] = useState(false);
  const aiRemaining = useMemo(
    () =>
      data.references.filter(
        (r) => isGenericBusiness(r.businessCategory) || !isValidWebsiteCategory(r.websiteCategory)
      ).length,
    [data.references],
  );

  const toggleLabel = (list: string[], setList: (v: string[]) => void, label: string) => {
    setList(list.includes(label) ? list.filter((l) => l !== label) : [...list, label]);
  };

  // auto-detect CMS + suggested categories from the pasted URL
  const onUrlChange = (value: string) => {
    setNewUrl(value);
    const m = value.match(/https?:\/\/[^\s"'<>)]+/i);
    if (m) {
      const p = guessPlatform(m[0]);
      const cls = classifySite(p, "", m[0]);
      setNewPlatform(p);
      setNewWebsite(cls.websiteCategory);
      setNewBusiness(isGenericBusiness(cls.businessCategory) ? "" : cls.businessCategory);
    }
  };

  const openAddDialog = () => {
    setNewUrl("");
    setNewPlatform("Shopify");
    setNewWebsite("E-commerce Based (Product Selling) Website");
    setNewBusiness("");
    setNewLabels([]);
    setAddOpen(true);
  };

  const saveWebsite = async () => {
    if (!/^https?:\/\//i.test(newUrl.trim())) {
      toast({ title: "URL needed", description: "Paste the full website link (starting with https://…)", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          platform: newPlatform,
          websiteCategory: newWebsite,
          businessCategory: newBusiness,
          labels: newLabels,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not save");
      toast({
        title: json.exists ? "Already in your library" : "Website added",
        description: json.exists
          ? "This URL was already saved earlier."
          : `${json.site.platform} · ${shortWebsiteCategory(json.site.websiteCategory)} · ${json.site.businessCategory}`,
      });
      setAddOpen(false);
      reload?.();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (site: RefSite) => {
    setEditSite(site);
    setEditWebsite(isValidWebsiteCategory(site.websiteCategory) ? site.websiteCategory : DEFAULT_WEBSITE_CATEGORY);
    setEditBusiness(site.businessCategory || "");
    setEditLabels(site.labels ?? []);
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editSite) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/websites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: editSite.url,
          websiteCategory: editWebsite,
          businessCategory: editBusiness,
          labels: editLabels,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not update");
      toast({
        title: "Category updated",
        description: `${hostOf(editSite.url)} → ${shortWebsiteCategory(editWebsite)} · ${editBusiness || "auto"}${
          editLabels.length ? ` · ${editLabels.join(", ")}` : ""
        }`,
      });
      setEditSite(null);
      reload?.();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const openImportDialog = () => {
    setImportFile(null);
    setPasteCsv("");
    setImportResult(null);
    setImportOpen(true);
  };

  const runImport = async () => {
    if (!importFile && !pasteCsv.trim()) {
      toast({
        title: "Nothing to import",
        description: "Choose a CSV file or paste the CSV text first.",
        variant: "destructive",
      });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      let res: Response;
      if (importFile) {
        const form = new FormData();
        form.append("file", importFile);
        res = await fetch("/api/websites/import", { method: "POST", body: form });
      } else {
        res = await fetch("/api/websites/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: pasteCsv }),
        });
      }
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Import failed");
      const result: ImportResult = {
        imported: json.imported ?? 0,
        alreadyInLibrary: json.alreadyInLibrary ?? 0,
        duplicatesInFile: json.duplicatesInFile ?? 0,
        missingUrl: json.missingUrl ?? 0,
        invalidCount: json.invalidCount ?? 0,
        invalid: json.invalid ?? [],
        totalRows: json.totalRows ?? 0,
      };
      setImportResult(result);
      if (result.imported > 0) {
        toast({
          title: `${result.imported} website${result.imported === 1 ? "" : "s"} imported`,
          description: "CMS, website category and business name were auto-detected for every site.",
        });
        reload?.();
      } else {
        toast({
          title: "Nothing new to import",
          description:
            result.alreadyInLibrary > 0
              ? "All these websites are already in your library."
              : "No valid website links were found.",
        });
      }
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const deleteWebsite = async (site: RefSite) => {
    try {
      const row = { id: site.id };
      if (!row.id) throw new Error("Site not found");
      const del = await fetch(`/api/websites?id=${row.id}`, { method: "DELETE" });
      const dj = await del.json();
      if (!del.ok || !dj.ok) throw new Error(dj.error ?? "Could not delete");
      toast({ title: "Website removed", description: hostOf(site.url) });
      reload?.();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const runAiCategorize = async () => {
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/websites/categorize", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "AI categorization failed");
      if (json.refined === 0) {
        toast({
          title: json.warning ? "AI could not categorize right now" : "Nothing to refine",
          description:
            json.warning
              ? String(json.warning).slice(0, 140)
              : "Every website already has a specific category.",
          variant: json.warning ? "destructive" : "default",
        });
      } else {
        toast({
          title: `${json.refined} website${json.refined === 1 ? "" : "s"} categorized by AI`,
          description:
            json.remaining > 0
              ? `${json.remaining} generic ones left — click again to continue.`
              : "All generic buckets are cleared.",
        });
      }
      reload?.();
    } catch (e) {
      toast({
        title: "AI categorize failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiBusy(false);
    }
  };

  // Level 1 — CMS counts (independent of other filters). The 5 core platforms
  // ALWAYS show — even with 0 sites — in the order the team defined
  // (WordPress, Wix, Shopify, Squarespace, Webflow); "Other" appears only
  // when sheet data actually contains it.
  const platformOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.references) counts.set(r.platform, (counts.get(r.platform) ?? 0) + 1);
    const core = CORE_PLATFORMS.filter((p) => p !== "Other").map((p) => [p, counts.get(p) ?? 0] as [string, number]);
    const extra = [...counts.entries()].filter(([p]) => !CORE_PLATFORMS.includes(p));
    return [["All", data.references.length] as [string, number], ...core, ...extra];
  }, [data.references]);

  // Level 2 — website categories within the selected CMS
  const websiteOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.references) {
      if (platform !== "All" && r.platform !== platform) continue;
      counts.set(r.websiteCategory, (counts.get(r.websiteCategory) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((s, c) => s + c, 0);
    const ordered = WEBSITE_CATEGORIES.filter((w) => counts.has(w));
    const extra = [...counts.keys()].filter((w) => !WEBSITE_CATEGORIES.includes(w));
    const sorted = [...extra].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    return [["All", total] as [string, number], ...[...ordered, ...sorted].map((w) => [w, counts.get(w) ?? 0] as [string, number])];
  }, [data.references, platform]);

  // Level 3 — business names within the selected CMS + website category
  const businessOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.references) {
      if (platform !== "All" && r.platform !== platform) continue;
      if (websiteCat !== "All" && r.websiteCategory !== websiteCat) continue;
      counts.set(r.businessCategory, (counts.get(r.businessCategory) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((s, c) => s + c, 0);
    const suggestionOrder = BUSINESS_CATEGORIES;
    const known = suggestionOrder.filter((b) => counts.has(b));
    const extra = [...counts.keys()].filter((b) => !suggestionOrder.includes(b)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    return [["All", total] as [string, number], ...[...known, ...extra].map((b) => [b, counts.get(b) ?? 0] as [string, number])];
  }, [data.references, platform, websiteCat]);

  // Level 4 — label counts within everything selected so far
  const labelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.references) {
      if (platform !== "All" && r.platform !== platform) continue;
      if (websiteCat !== "All" && r.websiteCategory !== websiteCat) continue;
      if (businessCat !== "All" && r.businessCategory !== businessCat) continue;
      for (const l of r.labels ?? []) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return SITE_LABELS.map((l) => [l, counts.get(l) ?? 0] as [string, number]);
  }, [data.references, platform, websiteCat, businessCat]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.references.filter((r) => {
      if (platform !== "All" && r.platform !== platform) return false;
      if (websiteCat !== "All" && r.websiteCategory !== websiteCat) return false;
      if (businessCat !== "All" && r.businessCategory !== businessCat) return false;
      if (labelFilter !== "All" && !(r.labels ?? []).includes(labelFilter)) return false;
      if (!needle) return true;
      return (
        r.category.toLowerCase().includes(needle) ||
        r.businessCategory.toLowerCase().includes(needle) ||
        r.websiteCategory.toLowerCase().includes(needle) ||
        (r.labels ?? []).some((l) => l.toLowerCase().includes(needle)) ||
        r.url.toLowerCase().includes(needle)
      );
    });
  }, [data.references, platform, websiteCat, businessCat, labelFilter, q]);

  const pickPlatform = (p: string) => {
    setPlatform(p);
    setWebsiteCat("All");
    setBusinessCat("All");
    setLabelFilter("All");
    setShownCount(REF_PAGE);
  };
  const pickWebsite = (t: string) => {
    setWebsiteCat(t);
    setBusinessCat("All");
    setLabelFilter("All");
    setShownCount(REF_PAGE);
  };
  const pickBusiness = (b: string) => {
    setBusinessCat(b);
    setLabelFilter("All");
    setShownCount(REF_PAGE);
  };
  const clearAll = () => {
    setPlatform("All");
    setWebsiteCat("All");
    setBusinessCat("All");
    setLabelFilter("All");
    setQ("");
    setShownCount(REF_PAGE);
  };
  const hasFilters =
    platform !== "All" || websiteCat !== "All" || businessCat !== "All" || labelFilter !== "All" || q.trim() !== "";

  const findWebsites = async () => {
    if (requirement.trim().length < 3) {
      toast({ title: "Describe your requirement first", description: "e.g. 'client needs a Shopify jewelry store website'" });
      return;
    }
    setFinding(true);
    setMatches(null);
    setWeb([]);
    try {
      const res = await fetch("/api/ai/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "AI search failed");
      setMatches(json.matches ?? []);
      setWeb(json.web ?? []);
      toast({ title: "AI found references", description: `${(json.matches ?? []).length} library matches · ${(json.web ?? []).length} web suggestions` });
    } catch (e) {
      toast({
        title: "AI finder failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setFinding(false);
    }
  };

  const categorySelectItems = (value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label>Website Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {WEBSITE_CATEGORIES.map((w) => (
            <SelectItem key={w} value={w}>
              {w}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* AI finder */}
      <Card className="overflow-hidden border-teal-200">
        <div className="bg-gradient-to-r from-teal-600 via-emerald-500 to-lime-400 px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <div>
              <h2 className="font-semibold">AI Reference Finder</h2>
              <p className="text-xs text-white/85">
                Describe what your client needs — AI picks the best examples from your library and the web
              </p>
            </div>
          </div>
        </div>
        <CardContent className="space-y-3 pt-4">
          <Textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            aria-label="Describe the client requirement"
            placeholder="e.g. Client runs a jewelry business on Shopify and wants a clean, elegant store…"
            rows={3}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={findWebsites}
              disabled={finding}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:opacity-90"
            >
              <Sparkles className={`mr-1.5 h-4 w-4 ${finding ? "animate-pulse" : ""}`} />
              {finding ? "Searching…" : "Find reference websites"}
            </Button>
            {finding && <span className="text-xs text-slate-500">Matching your library + searching the web…</span>}
          </div>

          {finding && (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          )}

          {matches && !finding && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-teal-800">
                  <Library className="h-4 w-4" /> From your reference library
                </p>
                {matches.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {matches.map((m) => (
                      <a
                        key={m.url}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-xl border bg-white p-3 transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap gap-1">
                              <Badge variant="outline" className={platformClass(m.platform)}>
                                {m.platform}
                              </Badge>
                              {m.websiteCategory && (
                                <Badge variant="outline" className={websiteCategoryClass(m.websiteCategory)}>
                                  {shortWebsiteCategory(m.websiteCategory)}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-sm font-medium text-slate-800 group-hover:text-teal-700">
                              {m.businessCategory || m.category}
                            </p>
                            <p className="truncate text-xs text-slate-400">{hostOf(m.url)}</p>
                            {m.reason && <p className="mt-1.5 text-xs italic text-slate-600">{m.reason}</p>}
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-600" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No close match in your library — check the web suggestions below.</p>
                )}
              </div>

              {web.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                    <Globe className="h-4 w-4" /> Fresh picks from the web
                  </p>
                  <div className="space-y-2">
                    {web.map((w) => (
                      <a
                        key={w.url}
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-2 rounded-xl border bg-white p-3 transition-shadow hover:shadow-md"
                      >
                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-emerald-600" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800 group-hover:text-emerald-700">
                            {w.name || hostOf(w.url)}
                          </p>
                          {w.snippet && <p className="line-clamp-2 text-xs text-slate-500">{w.snippet}</p>}
                          <p className="truncate text-xs text-emerald-600">{hostOf(w.url)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Library browser with cascading filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5 text-teal-600" /> Reference Library
              </CardTitle>
              <CardDescription>
                {data.references.length} example websites — filter by CMS, website category, business name and
                big-client labels, or add your own
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {hasFilters && (
                <Button size="sm" variant="ghost" onClick={clearAll} className="text-slate-500 hover:text-teal-700">
                  <X className="mr-1 h-4 w-4" /> Clear filters
                </Button>
              )}
              <Button
                size="sm"
                onClick={runAiCategorize}
                disabled={aiBusy}
                variant="outline"
                className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800"
              >
                <Wand2 className={`mr-1 h-4 w-4 ${aiBusy ? "animate-pulse" : ""}`} />
                {aiBusy ? "AI working…" : "AI categorize"}
                {aiRemaining > 0 && !aiBusy && (
                  <span className="ml-1 rounded-full bg-purple-100 px-1.5 text-[10px] font-semibold text-purple-700">
                    {aiRemaining}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                onClick={openImportDialog}
                variant="outline"
                className="border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
              >
                <Upload className="mr-1 h-4 w-4" /> Import CSV
              </Button>
              <Button
                size="sm"
                onClick={openAddDialog}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:opacity-90"
              >
                <Plus className="mr-1 h-4 w-4" /> Add website
              </Button>
            </div>
          </div>

            {/* Level 1 — CMS Category */}
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-semibold text-slate-400">
              1. CMS category (platform)
            </p>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map(([p, count]) => (
                <Pill key={p} active={platform === p} onClick={() => pickPlatform(p)}>
                  {p} ({count})
                </Pill>
              ))}
            </div>
          </div>

          {/* Level 2 — Website Category */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-slate-400">
              2. Website category
            </p>
            <div className="flex flex-wrap gap-2">
              {websiteOptions.map(([w, count]) => (
                <Pill
                  key={w}
                  active={websiteCat === w}
                  onClick={() => pickWebsite(w)}
                  title={w}
                >
                  {shortWebsiteCategory(w)} ({count})
                </Pill>
              ))}
            </div>
          </div>

          {/* Level 3 — Business Name Category */}
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div className="min-w-[260px] space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-400">
                3. Business name category
              </p>
              <Select value={businessCat} onValueChange={pickBusiness}>
                <SelectTrigger className="h-9 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {businessOptions.map(([b, count]) => (
                    <SelectItem key={b} value={b}>
                      {b} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative max-w-xs flex-1 pt-[18px]">
              <Search className="absolute left-2.5 top-[30px] h-4 w-4 text-slate-400" aria-hidden="true" />
              <Input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShownCount(REF_PAGE);
                }}
                aria-label="Search the reference library"
                autoComplete="off"
                placeholder="Search business, category, label or URL…"
                className="pl-8"
              />
            </div>
          </div>

          {/* Level 4 — Big-client labels */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-slate-400">
              4. Labels (big-client hunting)
            </p>
            <div className="flex flex-wrap gap-2">
              {labelOptions.map(([l, count]) => (
                <Pill key={l} active={labelFilter === l} onClick={() => setLabelFilter(labelFilter === l ? "All" : l)}>
                  {l} ({count})
                </Pill>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-slate-500">
            Showing <span className="font-semibold tabular-nums text-teal-700">{Math.min(shownCount, filtered.length)}</span> of{" "}
            <span className="tabular-nums">{filtered.length}</span> websites
            {platform !== "All" ? ` in ${platform}` : ""}
            {websiteCat !== "All" ? ` · ${shortWebsiteCategory(websiteCat)}` : ""}
            {businessCat !== "All" ? ` · ${businessCat}` : ""}
            {labelFilter !== "All" ? ` · ${labelFilter}` : ""}
          </p>
          {filtered.length ? (
            <>
            <div className="max-h-[520px] overflow-auto rounded-md border">
              <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.slice(0, shownCount).map((r) => (
                  <div
                    key={r.url}
                    className="group relative flex items-start justify-between gap-2 rounded-lg border bg-white p-2.5 transition-colors hover:border-teal-400 hover:bg-teal-50/40"
                  >
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-sm font-medium text-slate-700">
                        {r.businessCategory}
                        {r.custom && (
                          <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 align-middle text-[9px] font-semibold text-rose-600">
                            added
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-400 group-hover:text-teal-700">{hostOf(r.url)}</p>
                      {(r.labels ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(r.labels ?? []).map((l) => (
                            <Badge key={l} variant="outline" className={`px-1.5 py-0 text-[9px] font-semibold ${siteLabelClass(l)}`}>
                              {l}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </a>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <Badge variant="outline" className={`text-[10px] ${platformClass(r.platform)}`}>
                          {r.platform}
                        </Badge>
                        <Badge
                          variant="outline"
                          title={r.websiteCategory}
                          className={`max-w-[110px] truncate text-[10px] ${websiteCategoryClass(r.websiteCategory)}`}
                        >
                          {shortWebsiteCategory(r.websiteCategory)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDialog(r)}
                          aria-label={`Change category and labels of ${hostOf(r.url)}`}
                          title="Change category & labels"
                          className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 transition-colors hover:border-teal-400 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                        </button>
                        {r.custom && (
                          <button
                            type="button"
                            onClick={() => setDeletingSite(r)}
                            aria-label={`Remove ${hostOf(r.url)} from the library`}
                            title="Remove this website"
                            className="rounded-full border border-rose-200 bg-white p-1.5 text-rose-400 transition-colors hover:border-rose-400 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                        <span aria-hidden="true">
                          <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-teal-600" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {filtered.length > shownCount && (
              <div className="mt-3 text-center">
                <Button variant="outline" size="sm" onClick={() => setShownCount((c) => c + REF_PAGE)}>
                  Show more ({filtered.length - shownCount} remaining)
                </Button>
              </div>
            )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No references match your filter.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Add website dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-teal-600" /> Add a reference website
            </DialogTitle>
            <DialogDescription>
              Paste the URL — CMS, website category and business name are auto-detected, and you can fine-tune
              them before saving. Labels flag the big-client potential.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="site-url">Website URL</Label>
              <Input
                id="site-url"
                name="url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={newUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://example.myshopify.com/…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CMS Category</Label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categorySelectItems(newWebsite, setNewWebsite)}
            <div className="space-y-1.5">
              <Label>Business Name Category</Label>
              <BusinessPicker value={newBusiness} onChange={setNewBusiness} />
            </div>
            <div className="space-y-1.5">
              <Label>Labels</Label>
              <LabelChips selected={newLabels} onToggle={(l) => toggleLabel(newLabels, setNewLabels, l)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={saveWebsite}
              disabled={saving || !newUrl.trim()}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:opacity-90"
            >
              {saving ? "Saving…" : "Save to library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit category & labels dialog ── */}
      <Dialog open={!!editSite} onOpenChange={(open) => !open && setEditSite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-teal-600" /> Edit category & labels
            </DialogTitle>
            <DialogDescription className="truncate">
              {editSite ? `${editSite.platform} · ${hostOf(editSite.url)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            {categorySelectItems(editWebsite, setEditWebsite)}
            <div className="space-y-1.5">
              <Label>Business Name Category</Label>
              <BusinessPicker value={editBusiness} onChange={setEditBusiness} />
            </div>
            <div className="space-y-1.5">
              <Label>Labels</Label>
              <LabelChips selected={editLabels} onToggle={(l) => toggleLabel(editLabels, setEditLabels, l)} />
            </div>
            <p className="text-[11px] text-slate-400">
              Your fix is saved permanently — even for sheet-synced websites it survives the next sync.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditSite(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:opacity-90"
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV import dialog ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-teal-600" /> Import websites from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file (or paste the text) — every website is auto-categorised with CMS, website
              category and business name, exactly like the rest of the library.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* file picker / drop zone */}
            <label
              htmlFor="csv-file"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setImportFile(f);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-5 text-center transition-colors hover:border-teal-400 hover:bg-teal-50"
            >
              <FileSpreadsheet className="h-6 w-6 text-teal-500" />
              {importFile ? (
                <>
                  <p className="text-sm font-medium text-teal-800">{importFile.name}</p>
                  <p className="text-xs text-slate-500">
                    {(importFile.size / 1024).toFixed(1)} KB — click to choose another file
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">Choose a CSV file or drop it here</p>
                  <p className="text-xs text-slate-400">.csv / .tsv / .txt — max 2 MB, up to 3000 rows</p>
                </>
              )}
              <input
                id="csv-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="relative">
              <div className="absolute inset-x-0 -top-2 text-center">
                <span className="bg-white px-2 text-[11px] text-slate-400">or paste CSV text</span>
              </div>
              <Textarea
                value={pasteCsv}
                onChange={(e) => {
                  setPasteCsv(e.target.value);
                  if (e.target.value) setImportFile(null);
                }}
                rows={4}
                placeholder={"url, platform, business name, labels\nhttps://example.myshopify.com, Shopify, Fashion store, Premium Website\nhttps://plumbing-pros.com, WordPress, Plumbing Services"}
                className="pt-6 font-mono text-xs"
              />
            </div>

            {/* how it works */}
            <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">How the auto-categorisation works</p>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>One column must contain the website links (headers like <code className="rounded bg-white px-1">URL</code>, <code className="rounded bg-white px-1">Website</code> or <code className="rounded bg-white px-1">Link</code> are detected automatically — even without a header it finds the link column).</li>
                <li>Optional columns: <code className="rounded bg-white px-1">platform</code>, <code className="rounded bg-white px-1">website category</code>, <code className="rounded bg-white px-1">business name</code> and <code className="rounded bg-white px-1">labels</code> (separate multiple labels with <code className="rounded bg-white px-1">|</code> or <code className="rounded bg-white px-1">,</code>).</li>
                <li>CMS is sniffed from the link (myshopify.com → Shopify, wp-content → WordPress…), and the categories come from your taxonomy rules.</li>
                <li>Duplicates (inside the file or already in the library) are skipped automatically.</li>
              </ul>
            </div>

            {/* result summary */}
            {importResult && (
              <div aria-live="polite" className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium text-emerald-700">{importResult.imported} imported</span>
                  {importResult.alreadyInLibrary > 0 && (
                    <span className="text-slate-500">{importResult.alreadyInLibrary} already in library</span>
                  )}
                  {importResult.duplicatesInFile > 0 && (
                    <span className="text-slate-500">{importResult.duplicatesInFile} duplicates in file</span>
                  )}
                  {importResult.invalidCount > 0 && (
                    <span className="text-rose-600">{importResult.invalidCount} invalid rows</span>
                  )}
                  {importResult.missingUrl > 0 && (
                    <span className="text-slate-400">{importResult.missingUrl} rows without a link</span>
                  )}
                </div>
                {importResult.invalid.length > 0 && (
                  <div className="max-h-28 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-500">
                    {importResult.invalid.map((r) => (
                      <p key={`${r.row}-${r.value}`} className="truncate">
                        row {r.row}: {r.value} — {r.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              {importResult ? "Done" : "Cancel"}
            </Button>
            <Button
              onClick={runImport}
              disabled={importing || (!importFile && !pasteCsv.trim())}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:opacity-90"
            >
              {importing ? "Importing…" : "Import websites"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation — destructive action is never immediate ── */}
      <AlertDialog open={!!deletingSite} onOpenChange={(open) => !open && setDeletingSite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this website?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSite ? `${deletingSite.platform} · ${hostOf(deletingSite.url)}` : ""} will be removed from your
              library. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deletingSite;
                setDeletingSite(null);
                if (target) void deleteWebsite(target);
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Platform sales guide */}
      {data.guide.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-5 w-5 text-amber-500" /> Platform Sales Guide
            </CardTitle>
            <CardDescription>Know the platform before the pitch — benefits, limits and the winning angle</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {data.guide.map((g) => (
                <AccordionItem key={g.platform} value={g.platform}>
                  <AccordionTrigger className="text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-400" /> {g.platform}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm text-slate-600">
                    <p className="line-clamp-4">
                      <span className="font-medium text-slate-800">What it is: </span>
                      {g.definition}
                    </p>
                    {g.benefits && (
                      <p>
                        <span className="font-medium text-emerald-700">Benefits: </span>
                        {g.benefits}
                      </p>
                    )}
                    {g.limitations && (
                      <p>
                        <span className="font-medium text-rose-700">Limitations: </span>
                        {g.limitations}
                      </p>
                    )}
                    {g.salesTip && (
                      <p className="rounded-lg bg-amber-50 p-2.5 text-amber-900">
                        <span className="font-semibold">Sales tip: </span>
                        {g.salesTip}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
