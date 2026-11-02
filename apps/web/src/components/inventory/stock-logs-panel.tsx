"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Pencil,
  Clock,
  Activity,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Boxes,
  Tag,
  User,
  X,
  FileText,
  CheckCircle2,
  ArrowLeftRight,
  Layers,
  History,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@studio/ui';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import { exportToExcel } from '@/lib/export-excel';
import { ExportConfirmDialog } from '@/components/common/export-confirm-dialog';
import { useToast } from '@/hooks/use-toast';

type ActionCategory = 'ALL' | 'STOCK_IN' | 'STOCK_OUT' | 'BORROW' | 'ADJUSTMENT';

export function StockLogsPanel() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionCategory>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/audit?take=200');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    const handleExportEvent = () => setShowExportConfirm(true);
    window.addEventListener('trigger-inventory-export', handleExportEvent);
    return () => window.removeEventListener('trigger-inventory-export', handleExportEvent);
  }, []);

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedIds);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedIds(next);
  };

  // Compute category statistics
  const stats = useMemo(() => {
    let stockIn = 0;
    let stockOut = 0;
    let borrow = 0;
    let adjustment = 0;

    logs.forEach((entry) => {
      const act = (entry.data?.action || entry.action || '').toUpperCase();
      if (act.includes('IN') || act.includes('RESTOCK') || act.includes('RETURN')) {
        stockIn++;
      } else if (act.includes('OUT') || act.includes('DISPOSAL') || act.includes('DAMAGE')) {
        stockOut++;
      } else if (act.includes('BORROW') || act.includes('CHECKOUT')) {
        borrow++;
      } else {
        adjustment++;
      }
    });

    return {
      all: logs.length,
      stockIn,
      stockOut,
      borrow,
      adjustment,
    };
  }, [logs]);

  // Filter logs by action pill and search query
  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      const d = entry.data || {};
      const action = (d.action || entry.action || '').toUpperCase();
      const itemName = (d.item?.name || '').toLowerCase();
      const itemCode = (d.item?.inventoryCode || '').toLowerCase();
      const worker = (d.workerId || d.workerName || '').toLowerCase();
      const notes = (d.notes || '').toLowerCase();
      const q = search.toLowerCase().trim();

      // Action Filter
      if (selectedAction === 'STOCK_IN' && !action.includes('IN') && !action.includes('RESTOCK') && !action.includes('RETURN')) {
        return false;
      }
      if (selectedAction === 'STOCK_OUT' && !action.includes('OUT') && !action.includes('DISPOSAL') && !action.includes('DAMAGE')) {
        return false;
      }
      if (selectedAction === 'BORROW' && !action.includes('BORROW') && !action.includes('CHECKOUT')) {
        return false;
      }
      if (selectedAction === 'ADJUSTMENT' && !action.includes('ADJUST') && !action.includes('UPDATE') && !action.includes('EDIT') && !action.includes('AUDIT')) {
        return false;
      }

      // Search Query
      if (q) {
        return (
          itemName.includes(q) ||
          itemCode.includes(q) ||
          action.toLowerCase().includes(q) ||
          worker.includes(q) ||
          notes.includes(q)
        );
      }

      return true;
    });
  }, [logs, search, selectedAction]);

  const getActionTheme = (actionRaw: string) => {
    const act = (actionRaw || '').toLowerCase();
    if (act.includes('in') || act.includes('return') || act.includes('restock')) {
      return {
        icon: ArrowDownRight,
        iconWrapper: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        qtyBadge: 'text-emerald-600 dark:text-emerald-400 font-bold',
        typeLabel: 'Stock In',
      };
    }
    if (act.includes('out') || act.includes('checkout') || act.includes('disposal') || act.includes('damage')) {
      return {
        icon: ArrowUpRight,
        iconWrapper: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        qtyBadge: 'text-rose-600 dark:text-rose-400 font-bold',
        typeLabel: 'Stock Out',
      };
    }
    if (act.includes('borrow')) {
      return {
        icon: ArrowLeftRight,
        iconWrapper: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
        badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        qtyBadge: 'text-sky-600 dark:text-sky-400 font-bold',
        typeLabel: 'Borrowed',
      };
    }
    return {
      icon: Pencil,
      iconWrapper: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
      badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      qtyBadge: 'text-indigo-600 dark:text-indigo-400 font-bold',
      typeLabel: 'Adjustment',
    };
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return { full: '', relative: '' };
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    let relative = '';
    if (diffMin < 1) relative = 'Just now';
    else if (diffMin < 60) relative = `${diffMin}m ago`;
    else if (diffMin < 1440) relative = `${Math.floor(diffMin / 60)}h ago`;
    else relative = `${Math.floor(diffMin / 1440)}d ago`;

    const full = `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const short = isToday ? `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : full;

    return { full, short, relative };
  };

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast({ variant: 'destructive', title: 'No logs to export' });
      return;
    }

    const logHeaders = [
      'Timestamp',
      'Action',
      'Item Name',
      'Inventory Code',
      'Quantity Change',
      'Balance After',
      'Initiator',
      'Notes',
    ];

    const logRows = filteredLogs.map((entry) => {
      const d = entry.data || {};
      return [
        new Date(entry.timestamp).toLocaleString(),
        d.action || entry.action || '',
        d.item?.name || 'Item Record',
        d.item?.inventoryCode || '—',
        d.quantity ?? '—',
        d.balance ?? '—',
        d.workerId || d.workerName || 'System',
        d.notes || '—',
      ];
    });

    const actionCounts: Record<string, number> = {};
    filteredLogs.forEach((entry) => {
      const a = entry.data?.action || entry.action || 'OTHER';
      actionCounts[a] = (actionCounts[a] || 0) + 1;
    });

    const actionRows = Object.entries(actionCounts).map(([action, count]) => [
      action,
      count,
      `${Math.round((count / filteredLogs.length) * 100)}%`,
    ]);

    exportToExcel(`inventory_audit_logs_${new Date().toISOString().split('T')[0]}.xlsx`, [
      {
        name: 'Audit Logs',
        data: [logHeaders, ...logRows],
        colWidths: [22, 18, 24, 16, 16, 14, 20, 32],
      },
      {
        name: 'Action Summary',
        data: [
          ['Total Logs', filteredLogs.length],
          [],
          ['Action Type', 'Count', 'Share'],
          ...actionRows,
        ],
        colWidths: [20, 14, 14],
      },
    ]);

    toast({
      title: 'Audit Logs Exported',
      description: `Exported ${filteredLogs.length} audit log entries to Excel.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* ── UNIFIED TOOLBAR CONTAINER (Matching Items & Borrowings tabs) ── */}
      <Card className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden">
        {/* Single Row: Search Bar, Status Filter & Primary Actions */}
        <div className="p-3.5 sm:p-4 bg-background flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-border/60">
          {/* Left: Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by item name, barcode, worker or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-10 text-xs rounded-2xl bg-muted/30 border-slate-200/90 dark:border-border focus:bg-background transition-all shadow-2xs w-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right: Controls & Actions in One Row */}
          <div className="flex flex-wrap items-center gap-2.5 justify-start lg:justify-end shrink-0">
            {/* Action filter dropdown */}
            <Select value={selectedAction} onValueChange={(val: ActionCategory) => setSelectedAction(val)}>
              <SelectTrigger className="h-10 w-[170px] text-xs font-medium rounded-2xl bg-white dark:bg-muted/30 border-slate-200/90 dark:border-border hover:bg-muted/50 transition-colors px-3 gap-2 shadow-2xs cursor-pointer">
                <SelectValue placeholder="All Logs" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">
                  All Logs ({stats.all})
                </SelectItem>
                <SelectItem value="STOCK_IN" className="text-xs font-medium cursor-pointer">
                  Stock In ({stats.stockIn})
                </SelectItem>
                <SelectItem value="STOCK_OUT" className="text-xs font-medium cursor-pointer">
                  Stock Out ({stats.stockOut})
                </SelectItem>
                <SelectItem value="BORROW" className="text-xs font-medium cursor-pointer">
                  Borrowing ({stats.borrow})
                </SelectItem>
                <SelectItem value="ADJUSTMENT" className="text-xs font-medium cursor-pointer">
                  Adjustments ({stats.adjustment})
                </SelectItem>
              </SelectContent>
            </Select>

            {(search || selectedAction !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedAction('ALL');
                }}
                className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── TIMELINE LIST ── */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 sm:pt-1.5 bg-card">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center animate-pulse">
                <Activity className="h-5 w-5 animate-spin" />
              </div>
              <span className="text-xs font-semibold">Loading stock audit trail...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/70">
                <Boxes className="h-6 w-6 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">No stock logs found</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  {search || selectedAction !== 'ALL'
                    ? 'Try clearing your search term or selecting another filter category.'
                    : 'Stock movements, adjustments, and checkouts will be tracked here.'}
                </p>
              </div>
              {(search || selectedAction !== 'ALL') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSelectedAction('ALL');
                  }}
                  className="h-8 text-xs rounded-xl cursor-pointer"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((entry, idx) => {
                const { timestamp, data } = entry;
                const d = data || {};
                const isExpanded = expandedIds.has(idx);
                const theme = getActionTheme(d.action || entry.action);
                const Icon = theme.icon;
                const timeInfo = formatTimestamp(timestamp);
                const qty = d.quantity ?? 0;
                const sign = qty > 0 ? `+${qty}` : `${qty}`;
                const workerDisplay = d.workerId || d.workerName || 'System Admin';

                return (
                  <div
                    key={idx}
                    onClick={() => toggleExpand(idx)}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-border/70 bg-white dark:bg-card hover:border-sidebar/40 dark:hover:border-sidebar/60 transition-all cursor-pointer shadow-2xs hover:shadow-xs space-y-2 group"
                  >
                    {/* Header line: Action Badge, Item Name, SKU, Time, Expand */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs", theme.iconWrapper)}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Top Row: Badge, Title, Code */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2.5 py-0.5 font-bold rounded-full border uppercase tracking-wider shrink-0",
                                theme.badge
                              )}
                            >
                              {d.action || entry.action || 'Stock Movement'}
                            </Badge>

                            <h4 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-sidebar transition-colors truncate">
                              {d.item?.name || 'Item Record'}
                            </h4>

                            {d.item?.inventoryCode && (
                              <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/70 shrink-0">
                                {d.item.inventoryCode}
                              </span>
                            )}
                          </div>

                          {/* Detail line: Worker, Qty, Balance */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-foreground">
                              <User className="h-3 w-3 text-sidebar dark:text-sky-400 shrink-0" />
                              <span>{workerDisplay}</span>
                            </span>

                            {qty !== 0 && (
                              <>
                                <span className="opacity-40">&bull;</span>
                                <span className={theme.qtyBadge}>
                                  {sign} {qty === 1 || qty === -1 ? 'unit' : 'units'}
                                </span>
                              </>
                            )}

                            {d.balance !== undefined && (
                              <>
                                <span className="opacity-40">&bull;</span>
                                <span className="font-medium text-muted-foreground">
                                  Balance: <strong className="text-foreground font-bold">{d.balance}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 text-xs text-muted-foreground">
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 font-medium">
                          <Clock className="h-3 w-3 opacity-70" />
                          <span>{timeInfo.short}</span>
                        </span>
                        <div className="p-1.5 rounded-lg text-muted-foreground group-hover:text-foreground hover:bg-muted/60 transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Notes / Meta section */}
                    {isExpanded && (
                      <div className="pt-2.5 border-t border-border/50 text-xs space-y-2 animate-in fade-in duration-200">
                        {d.notes && (
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground italic flex items-start gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
                            <span>"{d.notes}"</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-0.5 px-0.5">
                          <span>Recorded on {timeInfo.full}</span>
                          <span className="font-mono text-[10px]">Log ID: #{idx + 1}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── EXPORT CONFIRMATION MODAL (YES/NO) ── */}
      <ExportConfirmDialog
        open={showExportConfirm}
        onOpenChange={setShowExportConfirm}
        title="Export Inventory Audit Logs?"
        description="Do you want to export the audit log entries and action summary as an Excel file (.xlsx) with clean, organized formatting?"
        onConfirm={handleExportExcel}
      />
    </div>
  );
}
