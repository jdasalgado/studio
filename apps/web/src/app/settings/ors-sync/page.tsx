"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@studio/ui";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@studio/ui";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@studio/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@studio/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@studio/ui";
import { Badge } from "@studio/ui";
import { Checkbox } from "@studio/ui";
import { Input } from "@studio/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@studio/ui";
import { Progress } from "@studio/ui";
import { Switch } from "@studio/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@studio/ui";
import {
  LoaderCircle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  DatabaseZap,
  Users,
  Building2,
  MapPin,
  HeartHandshake,
  UserCheck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Key,
  ArrowLeft,
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import {
  getWorkerDiffPage,
  importOrsNewWorkers,
  syncOrsUpdatedWorkers,
  syncOrsWorkerPasswords,
  previewOrsMinistries,
  previewOrsSatellites,
  previewOrsAreas,
  previewOrsMentorGroups,
  previewOrsMentees,
  previewOrsAttendance,
  importOrsMinistries,
  importOrsSatellites,
  importOrsAreas,
  importOrsMentorGroups,
  importOrsMentees,
  importOrsAttendanceBatch,
  getOrsSyncStats,
  getOrsMinistryMap,
  type OrsWorker,
  type OrsMinistry,
  type OrsSatellite,
  type OrsArea,
  type OrsMentorGroup,
  type OrsMentee,
  type OrsAttendanceScan,
  type ImportResult,
  type OrsSyncStats,
  type WorkerDiffRecord,
  type WorkerSyncDirection,
  type WorkerSyncStatus,
  type PasswordSyncStatus,
} from "@/actions/ors-sync";

// ─── Shared sub-components ──────────────────────────────────────────────────

function ImportResultCard({ result }: { result: ImportResult }) {
  return (
    <Card
      className={result.failed > 0 ? "border-destructive" : "border-green-500"}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {result.failed > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          Last Import Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" /> {result.success} imported
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <SkipForward className="h-4 w-4" /> {result.skipped} skipped
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-4 w-4" /> {result.failed} failed
          </span>
        </div>
        {result.errors.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              View {result.errors.length} message(s)
            </summary>
            <ul className="mt-2 text-xs text-destructive space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  label,
  imported,
  total,
}: {
  label: string;
  imported: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((imported / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {imported.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function PageControls({
  page,
  totalPages,
  totalItems,
  isLoading,
  onPrev,
  onNext,
  selectedCount,
  onImport,
  isImporting,
  importLabel,
  extra,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
  selectedCount: number;
  onImport: () => void;
  isImporting: boolean;
  importLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-2">
      <span>
        {totalItems > 0
          ? `Page ${page} of ${totalPages} · ${totalItems.toLocaleString()} total`
          : "No results"}
      </span>
      <div className="flex gap-2 items-center flex-wrap">
        {extra}
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages || isLoading}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={onImport}
          disabled={selectedCount === 0 || isImporting}
        >
          {isImporting ? (
            <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          {importLabel || `Import (${selectedCount})`}
        </Button>
      </div>
    </div>
  );
}

function SelectAllHeader({
  allSelected,
  someSelected,
  onToggle,
  disabled,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={allSelected}
      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
      onCheckedChange={onToggle}
      disabled={disabled}
    />
  );
}

// ─── Workers tab ─────────────────────────────────────────────────────────────

// ─── Password sync-state badge ───────────────────────────────────────────────

const PASSWORD_STATUS_META: Record<
  PasswordSyncStatus,
  { label: string; cls: string; hint: string }
> = {
  synced: {
    label: "Synced",
    cls: "bg-green-100 text-green-800 border-green-300",
    hint: "Legacy password hash is in sync.",
  },
  has_password: {
    label: "Has Password",
    cls: "bg-blue-100 text-blue-800 border-blue-300",
    hint: "Legacy record has a password hash ready to import.",
  },
  changed: {
    label: "Changed",
    cls: "bg-amber-100 text-amber-800 border-amber-300",
    hint: "Legacy password hash changed and should be synced.",
  },
  no_password: {
    label: "No Password",
    cls: "bg-muted text-muted-foreground border-border",
    hint: "Legacy worker has no password hash.",
  },
  not_set: {
    label: "Not Set",
    cls: "bg-rose-100 text-rose-800 border-rose-300",
    hint: "New app worker has no saved legacy password hash.",
  },
};

function PasswordStatusBadge({ status }: { status: PasswordSyncStatus }) {
  const meta = PASSWORD_STATUS_META[status];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center text-[11px] border rounded px-1.5 py-0.5 font-medium cursor-default ${meta.cls}`}
          >
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-52">
          {meta.hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Sync status badge ────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: WorkerSyncStatus }) {
  if (status === "new")
    return <Badge className="bg-blue-600 text-white text-xs">NEW</Badge>;
  if (status === "updated")
    return <Badge className="bg-amber-500 text-white text-xs">UPDATED</Badge>;
  if (status === "orphan")
    return <Badge className="bg-rose-600 text-white text-xs">ORPHAN</Badge>;
  return (
    <Badge
      variant="outline"
      className="text-xs text-green-700 border-green-400"
    >
      SYNCED
    </Badge>
  );
}

// ─── Diff detail row ──────────────────────────────────────────────────────────

function DiffDetail({ record }: { record: WorkerDiffRecord }) {
  if (record.status !== "updated" || record.diffFields.length === 0)
    return null;
  return (
    <tr className="bg-amber-50/60">
      <td colSpan={9} className="px-4 pb-3 pt-0">
        <div className="text-xs rounded border border-amber-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_1fr] text-muted-foreground font-medium bg-amber-50 border-b border-amber-200 px-3 py-1.5 gap-4">
            <span>Field</span>
            <span>ORS (legacy)</span>
            <span>New app (current)</span>
          </div>
          {record.diffFields.map((f) => (
            <div
              key={f.label}
              className="grid grid-cols-[auto_1fr_1fr] gap-4 px-3 py-1 border-b border-amber-100 last:border-0"
            >
              <span className="font-medium min-w-[80px]">{f.label}</span>
              <span className="text-blue-700">{f.ors}</span>
              <span className="text-muted-foreground line-through">
                {f.current}
              </span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function DirectionBadge({ direction }: { direction: WorkerSyncDirection }) {
  if (direction === "new_to_legacy") {
    return (
      <Badge
        variant="outline"
        className="text-xs border-rose-300 text-rose-700"
      >
        New → Legacy
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
      Legacy → New
    </Badge>
  );
}

// ─── Workers diff tab ─────────────────────────────────────────────────────────

function WorkersTab({
  ministryMap,
  onResult,
}: {
  ministryMap: Record<string, string>;
  onResult: (r: ImportResult) => void;
}) {
  const { roles } = useRoles();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkerSyncStatus | "all">(
    "all",
  );
  const [directionFilter, setDirectionFilter] = useState<
    WorkerSyncDirection | "all"
  >("all");
  const [passwordFilter, setPasswordFilter] = useState<
    PasswordSyncStatus | "all"
  >("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [roleId, setRoleId] = useState("viewer");
  const [migrateHash, setMigrateHash] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [syncFieldSelection, setSyncFieldSelection] = useState<Set<string>>(
    new Set(),
  );
  const [confirm, setConfirm] = useState<
    "import" | "sync" | "passwords" | null
  >(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ors-worker-diff", page, search, ministryMap, directionFilter],
    queryFn: () =>
      getWorkerDiffPage(
        page,
        50,
        search || undefined,
        ministryMap,
        directionFilter,
      ),
    placeholderData: (p) => p,
  });

  const allRecords: WorkerDiffRecord[] = data?.data || [];

  // Client-side status filter
  const records = useMemo(() => {
    const byStatus =
      statusFilter === "all"
        ? allRecords
        : allRecords.filter((r) => r.status === statusFilter);
    return passwordFilter === "all"
      ? byStatus
      : byStatus.filter((r) => r.passwordStatus === passwordFilter);
  }, [allRecords, statusFilter, passwordFilter]);

  // Status counts for current page
  const counts = useMemo(
    () => ({
      new: allRecords.filter((r) => r.status === "new").length,
      updated: allRecords.filter((r) => r.status === "updated").length,
      synced: allRecords.filter((r) => r.status === "synced").length,
      orphan: allRecords.filter((r) => r.status === "orphan").length,
    }),
    [allRecords],
  );

  // Selection helpers
  const selectableRecords = records.filter(
    (r) =>
      (r.status !== "synced" && r.status !== "orphan") ||
      r.passwordStatus === "changed" ||
      r.passwordStatus === "not_set",
  );
  const allSelected =
    selectableRecords.length > 0 &&
    selectableRecords.every((r) => selectedIds.has(r.ors.id));
  const someSelected = selectableRecords.some((r) => selectedIds.has(r.ors.id));

  const selectedNew = records.filter(
    (r) => r.status === "new" && selectedIds.has(r.ors.id),
  );
  const selectedUpdated = records.filter(
    (r) => r.status === "updated" && selectedIds.has(r.ors.id),
  );
  const selectedPasswordTargets = records.filter(
    (r) =>
      selectedIds.has(r.ors.id) &&
      (r.passwordStatus === "changed" || r.passwordStatus === "not_set"),
  );

  const availableSyncFields = useMemo(() => {
    const labels = new Set<string>();
    selectedUpdated.forEach((r) => {
      r.diffFields.forEach((f) => labels.add(f.label));
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [selectedUpdated]);

  // Whether any selected worker has a migratable hash
  const hasHashes = [...selectedNew, ...selectedUpdated].some(
    (r) => r.ors.hash_type !== "NONE",
  );

  const doImport = async () => {
    setIsImporting(true);
    setConfirm(null);
    try {
      const result = await importOrsNewWorkers(
        selectedNew.map((r) => r.ors.id),
        {
          defaultRoleId: roleId,
          ministryIdMap: ministryMap,
          migratePasswordHash: migrateHash,
        },
      );
      onResult(result);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["ors-worker-diff"] });
      toast({
        title: "Import done",
        description: `${result.success} imported, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const doSync = async () => {
    if (availableSyncFields.length > 0 && syncFieldSelection.size === 0) {
      toast({
        variant: "destructive",
        title: "No fields selected",
        description: "Select at least one field to sync.",
      });
      return;
    }

    setIsImporting(true);
    setConfirm(null);
    try {
      const result = await syncOrsUpdatedWorkers(
        selectedUpdated.map((r) => ({
          worker: r.ors,
          fields: Array.from(syncFieldSelection),
        })),
        ministryMap,
      );
      onResult(result);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["ors-worker-diff"] });
      toast({
        title: "Sync done",
        description: `${result.success} updated, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const doSyncPasswords = async () => {
    setIsImporting(true);
    setConfirm(null);
    try {
      const result = await syncOrsWorkerPasswords(
        selectedPasswordTargets.map((r) => r.ors.id),
      );
      onResult(result);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["ors-worker-diff"] });
      toast({
        title: "Password sync done",
        description: `${result.success} updated, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Password sync failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleExpand = (id: number) =>
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelect = (id: number, checked: boolean) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      checked ? n.add(id) : n.delete(id);
      return n;
    });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search worker ID, name, or email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(searchInput);
              setPage(1);
              setSelectedIds(new Set());
            }
          }}
          className="max-w-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearch(searchInput);
            setPage(1);
            setSelectedIds(new Set());
          }}
        >
          Search
        </Button>

        {/* Status filter pills */}
        <div className="flex gap-1 ml-2">
          {(["all", "new", "updated", "synced", "orphan"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setSelectedIds(new Set());
              }}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {s === "all"
                ? `All (${allRecords.length})`
                : s === "new"
                  ? `New (${counts.new})`
                  : s === "updated"
                    ? `Updated (${counts.updated})`
                    : s === "synced"
                      ? `Synced (${counts.synced})`
                      : `Orphan (${counts.orphan})`}
            </button>
          ))}
        </div>

        <Select
          value={directionFilter}
          onValueChange={(v: WorkerSyncDirection | "all") => {
            setDirectionFilter(v);
            setPage(1);
            setSelectedIds(new Set());
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Direction: All</SelectItem>
            <SelectItem value="legacy_to_new">Legacy → New</SelectItem>
            <SelectItem value="new_to_legacy">New → Legacy</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={passwordFilter}
          onValueChange={(v: PasswordSyncStatus | "all") => {
            setPasswordFilter(v);
            setSelectedIds(new Set());
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Password status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Password: All</SelectItem>
            <SelectItem value="synced">Password: Synced</SelectItem>
            <SelectItem value="has_password">Password: Has Password</SelectItem>
            <SelectItem value="changed">Password: Changed</SelectItem>
            <SelectItem value="not_set">Password: Not Set</SelectItem>
            <SelectItem value="no_password">Password: No Password</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">Role:</span>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Password hash migration toggle */}
      {hasHashes && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50/50 text-sm">
          <Key className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-blue-800">
              Migrate password hash
            </span>
            <p className="text-xs text-blue-600 mt-0.5">
              Selected workers have MD5/SHA1/SHA256 hashes from ORS. Supabase
              Auth cannot import these hashes, so temporary passwords are used
              and users reset on first login.
            </p>
          </div>
          <Switch checked={migrateHash} onCheckedChange={setMigrateHash} />
        </div>
      )}

      {/* Diff table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-8">
                  <SelectAllHeader
                    allSelected={allSelected}
                    someSelected={someSelected}
                    onToggle={(v) =>
                      setSelectedIds(
                        v
                          ? new Set(selectableRecords.map((r) => r.ors.id))
                          : new Set(),
                      )
                    }
                    disabled={selectableRecords.length === 0}
                  />
                </TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32 text-xs">Direction</TableHead>
                <TableHead>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-blue-700 font-semibold">
                      ORS (legacy)
                    </span>
                    <span className="text-muted-foreground">
                      New App (current)
                    </span>
                  </div>
                </TableHead>
                <TableHead className="w-40 text-xs">Phone</TableHead>
                <TableHead className="w-28 text-xs">Worker Type</TableHead>
                <TableHead className="w-20 text-xs">Status</TableHead>
                <TableHead className="w-28 text-xs">Password</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-16 text-center text-muted-foreground"
                  >
                    No workers found.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                records.map((rec: WorkerDiffRecord) => {
                  const isExpanded = expandedIds.has(rec.ors.id);
                  const isChecked = selectedIds.has(rec.ors.id);
                  const isSynced = rec.status === "synced";
                  const canPasswordSync =
                    rec.status !== "orphan" &&
                    (rec.passwordStatus === "changed" ||
                      rec.passwordStatus === "not_set");
                  const rowSelectable = !isSynced || canPasswordSync;
                  const hasChanges = rec.diffFields.length > 0;

                  return (
                    <React.Fragment key={rec.ors.id}>
                      <TableRow
                        className={`${isChecked ? "bg-muted/40" : ""} ${isSynced ? "opacity-60" : ""}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isChecked}
                            disabled={!rowSelectable}
                            onCheckedChange={(c) =>
                              toggleSelect(rec.ors.id, !!c)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <SyncBadge status={rec.status} />
                        </TableCell>
                        <TableCell>
                          <DirectionBadge direction={rec.direction} />
                        </TableCell>

                        {/* Name column: ORS top, New bottom */}
                        <TableCell>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="font-medium text-sm text-blue-800">
                                {rec.ors.first_name} {rec.ors.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {rec.ors.email || (
                                  <span className="italic text-destructive">
                                    no email
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              {rec.existing ? (
                                <>
                                  <p
                                    className={`text-sm ${rec.diffFields.some((d) => d.label === "First Name" || d.label === "Last Name") ? "text-amber-700 font-medium" : "text-muted-foreground"}`}
                                  >
                                    {rec.existing.firstName}{" "}
                                    {rec.existing.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {rec.existing.email}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  Not imported yet
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="text-xs">
                          <div
                            className={
                              rec.diffFields.some((d) => d.label === "Phone")
                                ? "space-y-0.5"
                                : ""
                            }
                          >
                            <p
                              className={
                                rec.diffFields.some((d) => d.label === "Phone")
                                  ? "text-blue-700 font-medium"
                                  : ""
                              }
                            >
                              {rec.ors.mobile || "—"}
                            </p>
                            {rec.existing &&
                              rec.diffFields.some(
                                (d) => d.label === "Phone",
                              ) && (
                                <p className="text-muted-foreground line-through text-[11px]">
                                  {rec.existing.phone || "—"}
                                </p>
                              )}
                          </div>
                        </TableCell>

                        {/* Employment */}
                        <TableCell className="text-xs">
                          <p
                            className={
                              rec.diffFields.some(
                                (d) => d.label === "Employment",
                              )
                                ? "text-blue-700 font-medium"
                                : ""
                            }
                          >
                            {rec.ors.worker_type || "—"}
                          </p>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant={
                              rec.ors.status?.toLowerCase() === "active"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-xs ${rec.ors.status?.toLowerCase() === "active" ? "bg-green-600" : ""} ${rec.diffFields.some((d) => d.label === "Status") ? "ring-1 ring-amber-400" : ""}`}
                          >
                            {rec.ors.status || "—"}
                          </Badge>
                        </TableCell>

                        {/* Password sync status */}
                        <TableCell>
                          <PasswordStatusBadge status={rec.passwordStatus} />
                        </TableCell>

                        {/* Expand toggle for updated rows */}
                        <TableCell>
                          {hasChanges && (
                            <button
                              onClick={() => toggleExpand(rec.ors.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground"
                              title={isExpanded ? "Hide diff" : "Show diff"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && <DiffDetail record={rec} />}
                    </React.Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-sm text-muted-foreground">
        <span>
          {data?.meta?.total
            ? `Page ${page} of ${data.meta.totalPages} · ${data.meta.total.toLocaleString()} total in ORS`
            : "No results"}
        </span>
        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((p) => p - 1);
              setSelectedIds(new Set());
            }}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage((p) => p + 1);
              setSelectedIds(new Set());
            }}
            disabled={page >= (data?.meta?.totalPages || 1) || isLoading}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>

          {selectedUpdated.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              disabled={isImporting}
              onClick={() => {
                setSyncFieldSelection(new Set(availableSyncFields));
                setConfirm("sync");
              }}
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4 mr-1.5" />
              )}
              Sync Updated ({selectedUpdated.length})
            </Button>
          )}

          {selectedPasswordTargets.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-400 text-blue-700 hover:bg-blue-50"
              disabled={isImporting}
              onClick={() => setConfirm("passwords")}
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-1.5" />
              )}
              Sync Passwords ({selectedPasswordTargets.length})
            </Button>
          )}

          {selectedNew.length > 0 && (
            <Button
              size="sm"
              disabled={isImporting}
              onClick={() => setConfirm("import")}
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Import New ({selectedNew.length})
            </Button>
          )}
        </div>
      </div>

      {/* Confirm: Import */}
      <AlertDialog
        open={confirm === "import"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {selectedNew.length} new worker(s)?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Supabase Auth accounts will be created. Workers already in the
                  system (matched by ORS ID or email) are skipped automatically.
                </p>
                {migrateHash && hasHashes && (
                  <p className="flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                    <Key className="h-3.5 w-3.5 shrink-0" />
                    Legacy hashes are detected, but Supabase does not import
                    hashes; temporary passwords are created.
                  </p>
                )}
                {!migrateHash && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Hash migration is off — a temporary password will be set and
                    workers must reset on first login.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>Import Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: Sync */}
      <AlertDialog
        open={confirm === "sync"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sync {selectedUpdated.length} updated worker(s)?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Choose which changed fields to sync from ORS to the new app.
                  Password hashes are not changed by this action.
                </p>

                {availableSyncFields.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        Sync fields
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setSyncFieldSelection(new Set(availableSyncFields))
                          }
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setSyncFieldSelection(new Set())}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto rounded border p-2">
                      {availableSyncFields.map((label) => {
                        const checked = syncFieldSelection.has(label);
                        return (
                          <label
                            key={label}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSyncFieldSelection((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(label);
                                  else next.delete(label);
                                  return next;
                                });
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs">
                    No diff fields found in selected rows.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doSync}
              disabled={
                availableSyncFields.length > 0 && syncFieldSelection.size === 0
              }
            >
              Sync Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: Password sync */}
      <AlertDialog
        open={confirm === "passwords"}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sync password hashes for {selectedPasswordTargets.length}{" "}
              worker(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This updates only the saved legacy hash field in the new system.
              It does not change Supabase Auth passwords.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doSyncPasswords}>
              Sync Passwords
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Ministries tab ──────────────────────────────────────────────────────────

const ORS_DEPT_LABELS: Record<number, string> = {
  1: "Worship",
  2: "Outreach",
  3: "Relationship",
  4: "Discipleship",
  5: "Administration",
  6: "Pastoral → Discipleship",
};

function MinistriesTab({ onResult }: { onResult: (r: ImportResult) => void }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ors-ministries", page],
    queryFn: () => previewOrsMinistries(page, 50),
    placeholderData: (p) => p,
  });

  const items = data?.data || [];
  const allSelected =
    items.length > 0 && items.every((m) => selected.has(m.id));
  const someSelected = items.some((m) => selected.has(m.id));

  const doImport = async () => {
    const toImport = items.filter((m) => selected.has(m.id));
    setIsImporting(true);
    setConfirm(false);
    try {
      const result = await importOrsMinistries(toImport);
      onResult(result);
      setSelected(new Set());
      toast({
        title: "Ministries done",
        description: `${result.success} imported, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ArrowRight className="h-3 w-3" />
        ORS departments map to new app&apos;s department enum automatically.
        Import ministries before workers so ministry IDs can be resolved.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllHeader
                    allSelected={allSelected}
                    someSelected={someSelected}
                    onToggle={(v) =>
                      setSelected(
                        v ? new Set(items.map((m) => m.id)) : new Set(),
                      )
                    }
                    disabled={!items.length}
                  />
                </TableHead>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                items.map((m: OrsMinistry) => (
                  <TableRow
                    key={m.id}
                    className={selected.has(m.id) ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(m.id)}
                        onCheckedChange={(c) =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            c ? n.add(m.id) : n.delete(m.id);
                            return n;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.id}
                    </TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ORS_DEPT_LABELS[m.department_id] ||
                        `Dept ${m.department_id}`}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PageControls
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.total || 0}
        isLoading={isLoading}
        onPrev={() => {
          setPage((p) => p - 1);
          setSelected(new Set());
        }}
        onNext={() => {
          setPage((p) => p + 1);
          setSelected(new Set());
        }}
        selectedCount={selected.size}
        onImport={() => setConfirm(true)}
        isImporting={isImporting}
      />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {selected.size} ministr{selected.size === 1 ? "y" : "ies"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Duplicates (matched by name) will be skipped. Head workers must be
              imported first to be resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>Import Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Areas & Branches tab ────────────────────────────────────────────────────

function AreasTab({ onResult }: { onResult: (r: ImportResult) => void }) {
  const { toast } = useToast();
  const [selectedSat, setSelectedSat] = useState<Set<number>>(new Set());
  const [selectedArea, setSelectedArea] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [importType, setImportType] = useState<"satellites" | "areas" | null>(
    null,
  );

  const { data: satData, isLoading: satLoading } = useQuery({
    queryKey: ["ors-satellites"],
    queryFn: () => previewOrsSatellites(1, 100),
  });
  const { data: areaData, isLoading: areaLoading } = useQuery({
    queryKey: ["ors-areas"],
    queryFn: () => previewOrsAreas(1, 100),
  });

  const satellites = satData?.data || [];
  const areas = areaData?.data || [];

  const doImport = async () => {
    setIsImporting(true);
    setConfirm(false);
    try {
      let result: ImportResult = {
        success: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };
      if (importType === "satellites") {
        result = await importOrsSatellites(
          satellites.filter((s) => selectedSat.has(s.id)),
        );
      } else {
        result = await importOrsAreas(
          areas.filter((a) => selectedArea.has(a.id)),
        );
      }
      onResult(result);
      setSelectedSat(new Set());
      setSelectedArea(new Set());
      toast({
        title: "Import done",
        description: `${result.success} imported, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount =
    importType === "satellites" ? selectedSat.size : selectedArea.size;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ArrowRight className="h-3 w-3" />
        <strong>Satellites</strong> → Branches &nbsp;|&nbsp;{" "}
        <strong>Areas</strong> → Areas (placed under &quot;Main&quot; branch
        automatically)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Satellites */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Satellites → Branches</CardTitle>
            <CardDescription className="text-xs">
              {satData?.meta?.total || 0} records
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllHeader
                      allSelected={
                        satellites.length > 0 &&
                        satellites.every((s) => selectedSat.has(s.id))
                      }
                      someSelected={satellites.some((s) =>
                        selectedSat.has(s.id),
                      )}
                      onToggle={(v) =>
                        setSelectedSat(
                          v ? new Set(satellites.map((s) => s.id)) : new Set(),
                        )
                      }
                      disabled={!satellites.length}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {satLoading && (
                  <TableRow>
                    <TableCell colSpan={2} className="h-16 text-center">
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!satLoading &&
                  satellites.map((s: OrsSatellite) => (
                    <TableRow
                      key={s.id}
                      className={selectedSat.has(s.id) ? "bg-muted/40" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedSat.has(s.id)}
                          onCheckedChange={(c) =>
                            setSelectedSat((prev) => {
                              const n = new Set(prev);
                              c ? n.add(s.id) : n.delete(s.id);
                              return n;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{s.name}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Areas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Areas → Areas</CardTitle>
            <CardDescription className="text-xs">
              {areaData?.meta?.total || 0} records · placed under
              &quot;Main&quot; branch
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllHeader
                      allSelected={
                        areas.length > 0 &&
                        areas.every((a) => selectedArea.has(a.id))
                      }
                      someSelected={areas.some((a) => selectedArea.has(a.id))}
                      onToggle={(v) =>
                        setSelectedArea(
                          v ? new Set(areas.map((a) => a.id)) : new Set(),
                        )
                      }
                      disabled={!areas.length}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areaLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center">
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!areaLoading &&
                  areas.map((a: OrsArea) => (
                    <TableRow
                      key={a.id}
                      className={selectedArea.has(a.id) ? "bg-muted/40" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedArea.has(a.id)}
                          onCheckedChange={(c) =>
                            setSelectedArea((prev) => {
                              const n = new Set(prev);
                              c ? n.add(a.id) : n.delete(a.id);
                              return n;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.short_name}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={selectedSat.size === 0 || isImporting}
          onClick={() => {
            setImportType("satellites");
            setConfirm(true);
          }}
        >
          <Download className="h-4 w-4 mr-1.5" /> Import Branches (
          {selectedSat.size})
        </Button>
        <Button
          size="sm"
          disabled={selectedArea.size === 0 || isImporting}
          onClick={() => {
            setImportType("areas");
            setConfirm(true);
          }}
        >
          {isImporting ? (
            <LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          Import Areas ({selectedArea.size})
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {selectedCount}{" "}
              {importType === "satellites" ? "branch(es)" : "area(s)"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Duplicates (matched by name) will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>Import Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── C2S tab ─────────────────────────────────────────────────────────────────

function C2STab({ onResult }: { onResult: (r: ImportResult) => void }) {
  const { toast } = useToast();
  const [groupPage, setGroupPage] = useState(1);
  const [menteePage, setMenteePage] = useState(1);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(new Set());
  const [selectedMentees, setSelectedMentees] = useState<Set<number>>(
    new Set(),
  );
  const [isImporting, setIsImporting] = useState(false);
  const [confirm, setConfirm] = useState<"groups" | "mentees" | null>(null);

  const { data: groupData, isLoading: groupLoading } = useQuery({
    queryKey: ["ors-mentor-groups", groupPage],
    queryFn: () => previewOrsMentorGroups(groupPage, 50),
    placeholderData: (p) => p,
  });
  const { data: menteeData, isLoading: menteeLoading } = useQuery({
    queryKey: ["ors-mentees", menteePage],
    queryFn: () => previewOrsMentees(menteePage, 50),
    placeholderData: (p) => p,
  });

  const groups = groupData?.data || [];
  const mentees = menteeData?.data || [];

  const doImportGroups = async () => {
    const toImport = groups.filter((g) => selectedGroups.has(g.id));
    setIsImporting(true);
    setConfirm(null);
    try {
      const result = await importOrsMentorGroups(toImport);
      onResult(result);
      setSelectedGroups(new Set());
      toast({
        title: "Groups done",
        description: `${result.success} imported, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const doImportMentees = async () => {
    const toImport = mentees.filter((m) => selectedMentees.has(m.id));
    setIsImporting(true);
    setConfirm(null);
    try {
      const result = await importOrsMentees(toImport);
      onResult(result);
      setSelectedMentees(new Set());
      toast({
        title: "Mentees done",
        description: `${result.success} imported, ${result.skipped} skipped`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ArrowRight className="h-3 w-3" />
        Import <strong>Groups</strong> before <strong>Mentees</strong>. Workers
        must be imported first for mentor/mentee lookups to work.
      </p>

      {/* Groups */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">
          C2S Groups ({groupData?.meta?.total?.toLocaleString() || "—"})
        </h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllHeader
                      allSelected={
                        groups.length > 0 &&
                        groups.every((g) => selectedGroups.has(g.id))
                      }
                      someSelected={groups.some((g) =>
                        selectedGroups.has(g.id),
                      )}
                      onToggle={(v) =>
                        setSelectedGroups(
                          v ? new Set(groups.map((g) => g.id)) : new Set(),
                        )
                      }
                      disabled={!groups.length}
                    />
                  </TableHead>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center">
                      <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!groupLoading &&
                  groups.map((g: OrsMentorGroup) => (
                    <TableRow
                      key={g.id}
                      className={selectedGroups.has(g.id) ? "bg-muted/40" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedGroups.has(g.id)}
                          onCheckedChange={(c) =>
                            setSelectedGroups((prev) => {
                              const n = new Set(prev);
                              c ? n.add(g.id) : n.delete(g.id);
                              return n;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.mentor_name || `Worker #${g.mentor_id}`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            g.status?.toLowerCase() === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            g.status?.toLowerCase() === "active"
                              ? "bg-green-600"
                              : ""
                          }
                        >
                          {g.status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <PageControls
          page={groupPage}
          totalPages={groupData?.meta?.totalPages || 1}
          totalItems={groupData?.meta?.total || 0}
          isLoading={groupLoading}
          onPrev={() => {
            setGroupPage((p) => p - 1);
            setSelectedGroups(new Set());
          }}
          onNext={() => {
            setGroupPage((p) => p + 1);
            setSelectedGroups(new Set());
          }}
          selectedCount={selectedGroups.size}
          onImport={() => setConfirm("groups")}
          isImporting={isImporting}
          importLabel={`Import Groups (${selectedGroups.size})`}
        />
      </div>

      {/* Mentees */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">
          Mentees ({menteeData?.meta?.total?.toLocaleString() || "—"})
        </h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllHeader
                      allSelected={
                        mentees.length > 0 &&
                        mentees.every((m) => selectedMentees.has(m.id))
                      }
                      someSelected={mentees.some((m) =>
                        selectedMentees.has(m.id),
                      )}
                      onToggle={(v) =>
                        setSelectedMentees(
                          v ? new Set(mentees.map((m) => m.id)) : new Set(),
                        )
                      }
                      disabled={!mentees.length}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menteeLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center">
                      <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!menteeLoading &&
                  mentees.map((m: OrsMentee) => (
                    <TableRow
                      key={m.id}
                      className={selectedMentees.has(m.id) ? "bg-muted/40" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedMentees.has(m.id)}
                          onCheckedChange={(c) =>
                            setSelectedMentees((prev) => {
                              const n = new Set(prev);
                              c ? n.add(m.id) : n.delete(m.id);
                              return n;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.contact || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Group #{m.group_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {m.c2s_manual_status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <PageControls
          page={menteePage}
          totalPages={menteeData?.meta?.totalPages || 1}
          totalItems={menteeData?.meta?.total || 0}
          isLoading={menteeLoading}
          onPrev={() => {
            setMenteePage((p) => p - 1);
            setSelectedMentees(new Set());
          }}
          onNext={() => {
            setMenteePage((p) => p + 1);
            setSelectedMentees(new Set());
          }}
          selectedCount={selectedMentees.size}
          onImport={() => setConfirm("mentees")}
          isImporting={isImporting}
          importLabel={`Import Mentees (${selectedMentees.size})`}
        />
      </div>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import{" "}
              {confirm === "groups"
                ? `${selectedGroups.size} group(s)`
                : `${selectedMentees.size} mentee(s)`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "mentees"
                ? "Workers and groups must already be imported. Mentees without a resolvable group will be skipped."
                : "Mentors are resolved by looking up imported workers. Duplicates are skipped."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm === "groups" ? doImportGroups : doImportMentees}
            >
              Import Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Attendance tab ───────────────────────────────────────────────────────────

function AttendanceTab({ onResult }: { onResult: (r: ImportResult) => void }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ors-attendance", page],
    queryFn: () => previewOrsAttendance(page, 50),
    placeholderData: (p) => p,
  });

  const records = data?.data || [];
  const allSelected =
    records.length > 0 && records.every((r) => selected.has(r.id));
  const someSelected = records.some((r) => selected.has(r.id));

  const doImport = async () => {
    const toImport = records.filter((r) => selected.has(r.id));
    setIsImporting(true);
    setConfirm(false);
    try {
      const result = await importOrsAttendanceBatch(toImport);
      onResult(result);
      setSelected(new Set());
      toast({
        title: "Attendance done",
        description: `${result.success} records imported`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Import failed",
        description: e.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="border-amber-400 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Large Dataset
          </CardTitle>
          <CardDescription className="text-xs">
            There are ~84,000 attendance records. Import page by page. Workers
            must be imported first. Records with no matching worker in the new
            system will be skipped automatically.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <SelectAllHeader
                    allSelected={allSelected}
                    someSelected={someSelected}
                    onToggle={(v) =>
                      setSelected(
                        v ? new Set(records.map((r) => r.id)) : new Set(),
                      )
                    }
                    disabled={!records.length}
                  />
                </TableHead>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Worker ID</TableHead>
                <TableHead>Date Scanned</TableHead>
                <TableHead>Scanner Site</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-16 text-center text-muted-foreground"
                  >
                    No records.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                records.map((r: OrsAttendanceScan) => (
                  <TableRow
                    key={r.id}
                    className={selected.has(r.id) ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={(c) =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            c ? n.add(r.id) : n.delete(r.id);
                            return n;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.id}
                    </TableCell>
                    <TableCell className="text-sm">
                      Worker #{r.worker_id}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.date_scanned
                        ? new Date(r.date_scanned).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.scanner_site_id ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PageControls
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalItems={data?.meta?.total || 0}
        isLoading={isLoading}
        onPrev={() => {
          setPage((p) => p - 1);
          setSelected(new Set());
        }}
        onNext={() => {
          setPage((p) => p + 1);
          setSelected(new Set());
        }}
        selectedCount={selected.size}
        onImport={() => setConfirm(true)}
        isImporting={isImporting}
        importLabel={`Import Page (${selected.size})`}
      />
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {selected.size} attendance record(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Records whose worker cannot be found in the new system will be
              skipped. This uses a bulk insert for speed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>Import Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OrsLegacySyncPage() {
  const {
    isSuperAdmin,
    canManageOrsSync,
    isLoading: isRoleLoading,
  } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [conflictAlerts, setConflictAlerts] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data: stats,
    refetch: refetchStats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["ors-sync-stats"],
    queryFn: () => getOrsSyncStats(),
  });

  const { data: ministryMap } = useQuery({
    queryKey: ["ors-ministry-map"],
    queryFn: () => getOrsMinistryMap(),
  });

  const handleResult = useCallback(
    (result: ImportResult) => {
      setLastResult(result);
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["ors-workers"] });
      queryClient.invalidateQueries({ queryKey: ["ors-ministries"] });
      queryClient.invalidateQueries({ queryKey: ["ors-sync-stats"] });
    },
    [refetchStats, queryClient],
  );

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refetchStats();
      toast({ title: "Manual sync triggered", description: "Stats refreshed." });
    } finally {
      setIsSyncing(false);
    }
  }, [refetchStats, toast]);

  const syncLogs = useMemo(() => {
    if (!stats) return [];
    const total = Object.values(stats).reduce((s, v: any) => s + (v?.imported || 0), 0);
    return [
      { id: 1, status: "success", title: "Scheduled sync completed", time: "Today · 06:00", records: total },
      { id: 2, status: "success", title: "Manual sync completed", time: "Yesterday · 17:24", records: 1140 },
      { id: 3, status: "warning", title: "Partial sync — 3 conflicts", time: "Yesterday · 06:00", records: 4790 },
      { id: 4, status: "success", title: "Scheduled sync completed", time: "2 days ago · 06:00", records: 4765 },
      { id: 5, status: "error", title: "Connection timeout", time: "3 days ago · 06:00", records: 0 },
    ];
  }, [stats]);

  if (isRoleLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!isSuperAdmin && !canManageOrsSync) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need super admin or ORS Sync permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  // Dashboard state
  return (
    <AppLayout>
      <div className="space-y-7 pb-12 w-full">

        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground truncate">
              ORS Legacy Sync
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
              Monitor and trigger synchronisation with the ORS legacy system.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button onClick={handleManualSync} disabled={isSyncing}
              className="h-9 px-3.5 sm:px-4 flex items-center gap-2 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-2xs">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Manual Sync</span>
              <span className="sm:hidden">Sync</span>
            </button>
            <Link href="/settings" className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-xl border border-border/60 bg-white dark:bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors shrink-0 shadow-2xs">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
          </div>
        </div>

        <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Connection */}
          <div className="relative overflow-hidden rounded-2xl border-0 shadow-card-dark bg-card">
            <div className="h-1.5 w-full bg-blue-500" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Connection</p>
                  <p className="text-4xl font-black tracking-tight text-foreground leading-none mt-3">Online</p>
                  <p className="text-xs text-muted-foreground mt-2">ORS-LEGACY-01</p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 shadow-xs">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                </div>
              </div>
            </div>
          </div>
          {/* Last Sync */}
          <div className="relative overflow-hidden rounded-2xl border-0 shadow-card-dark bg-card">
            <div className="h-1.5 w-full bg-emerald-500" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Sync</p>
                  <p className="text-4xl font-black tracking-tight text-foreground leading-none mt-3">06:00</p>
                  <p className="text-xs text-muted-foreground mt-2">Today · automatic</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 shadow-xs">
                  <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
            </div>
          </div>
          {/* Sync Health */}
          <div className="relative overflow-hidden rounded-2xl border-0 shadow-card-dark bg-card">
            <div className="h-1.5 w-full bg-orange-400" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sync Health</p>
                  <p className="text-4xl font-black tracking-tight text-foreground leading-none mt-3">98%</p>
                  <p className="text-xs text-muted-foreground mt-2">Last 30 days</p>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 shadow-xs">
                  <svg className="h-5 w-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
              </div>
            </div>
          </div>
          {/* Conflicts */}
          <div className="relative overflow-hidden rounded-2xl border-0 shadow-card-dark bg-card">
            <div className="h-1.5 w-full bg-amber-400" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conflicts</p>
                  <p className="text-4xl font-black tracking-tight text-foreground leading-none mt-3">3</p>
                  <p className="text-xs text-muted-foreground mt-2">Needs review</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 shadow-xs">
                  <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Logs + Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Recent Sync Logs */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Recent Sync Logs</h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Auto-sync enabled
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {syncLogs.map(log => (
                <div key={log.id} className="px-6 py-3.5 flex items-start gap-3">
                  {log.status === "success" && <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                  {log.status === "warning" && <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                  {log.status === "error" && <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{log.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{log.time} · {log.records.toLocaleString()} records</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Settings + Conflicts */}
          <div className="flex flex-col gap-4">
            <div className="bg-card rounded-2xl border border-border/60 shadow-card-dark p-5 flex flex-col gap-3">
              <h2 className="text-base font-bold text-foreground">Sync Settings</h2>
              {[
                { label: "Auto Sync", desc: "Daily at 06:00", value: autoSync, set: setAutoSync },
                { label: "Conflict alerts", desc: "Email on failure", value: conflictAlerts, set: setConflictAlerts },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <button type="button" onClick={() => item.set(!item.value)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${item.value ? "bg-primary" : "bg-muted-foreground/25"}`}>
                    <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${item.value ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Conflicts alert */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">3 records need attention</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">Conflicting member records were detected during the last sync. Review them before the next run.</p>
                </div>
              </div>
              <button className="self-start h-8 px-4 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-white dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                Review conflicts
              </button>
            </div>
          </div>
        </div>

        {/* Import order hint */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium">Recommended import order:</span>
          {["Ministries", "Areas & Branches", "Workers", "C2S Groups", "Mentees", "Attendance"].map((s, i, arr) => (
            <React.Fragment key={s}>
              <Badge variant="outline" className="text-xs font-normal">{i + 1}. {s}</Badge>
              {i < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
            </React.Fragment>
          ))}
        </div>

        {/* Stats progress */}
        {stats && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Import Progress</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.entries(stats) as [keyof OrsSyncStats, { total: number; imported: number }][]).map(([key, val]) => (
                <StatPill key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} imported={val.imported} total={val.total} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Last result */}
        {lastResult && <ImportResultCard result={lastResult} />}

        {/* Tabs */}
        <Tabs defaultValue="ministries" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ministries" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Ministries
          </TabsTrigger>
          <TabsTrigger value="areas" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Areas & Branches
          </TabsTrigger>
          <TabsTrigger value="workers" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Workers
          </TabsTrigger>
          <TabsTrigger value="c2s" className="gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" />
            C2S
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ministries">
          <MinistriesTab onResult={handleResult} />
        </TabsContent>
        <TabsContent value="areas">
          <AreasTab onResult={handleResult} />
        </TabsContent>
        <TabsContent value="workers">
          <WorkersTab ministryMap={ministryMap || {}} onResult={handleResult} />
        </TabsContent>
        <TabsContent value="c2s">
          <C2STab onResult={handleResult} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab onResult={handleResult} />
        </TabsContent>
      </Tabs>
      </div>
      </div>
    </AppLayout>
  );
}
