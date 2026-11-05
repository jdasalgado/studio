"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  PieChart,
  Activity,
  CheckCircle2,
  Layers,
  ShieldAlert,
  RotateCw,
  Printer,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@studio/ui';
import { cn } from '@/lib/utils';

export function ReportsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch('/api/inventory/analytics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportPDF = () => {
    window.print();
  };

  useEffect(() => {
    const handleExportEvent = () => handleExportPDF();
    window.addEventListener('trigger-inventory-export', handleExportEvent);
    return () => window.removeEventListener('trigger-inventory-export', handleExportEvent);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <div className="h-10 w-10 rounded-2xl bg-sidebar/10 border border-sidebar/20 text-sidebar dark:text-sky-400 flex items-center justify-center animate-pulse">
          <Activity className="h-5 w-5 animate-spin" />
        </div>
        <span className="text-xs font-semibold">Generating analytics and reports...</span>
      </div>
    );
  }

  const maxUsage =
    data.mostUsed?.length > 0
      ? Math.max(...data.mostUsed.map((m: any) => m.count), 1)
      : 1;

  const totalCategoryItems =
    data.stockByCategory?.reduce((acc: number, c: any) => acc + (c.count || 0), 0) || 1;

  return (
    <div className="space-y-4 print:space-y-4 print:p-0">
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: portrait;
            margin: 12mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header,
          nav,
          aside,
          [data-sidebar="sidebar"],
          .sidebar,
          .sidebar-container,
          .no-print,
          .print\\:hidden,
          button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .print-card {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .md\\:hidden {
            display: none !important;
          }
          .hidden.md\\:block {
            display: block !important;
          }
        }
      `}</style>



      {/* ── PRINT-ONLY OFFICIAL REPORT HEADER ── */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">COG APP</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-white font-semibold uppercase">Official Audit</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1 font-headline">
              Inventory &amp; Asset Management Report
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Church Operations &amp; Governance &bull; Equipment Utilization &amp; Safety Stock Audit
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-900">
              Official Inventory Report
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Confidential &bull; Internal Operations Only</p>
          </div>
        </div>
      </div>

      {/* ── MAIN CHARTS & LISTS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most Heavily Used Equipment */}
        <Card className="rounded-2xl border border-border/60 bg-white dark:bg-card shadow-card-dark flex flex-col overflow-hidden print-card">
          <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/[0.12]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold font-headline text-foreground">
                    Top High-Usage Equipment
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Most frequently borrowed equipment items
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-muted/60 border-border/70 px-2 py-0.5 rounded-lg">
                Top 5
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 flex-1 space-y-3.5">
            {data.mostUsed?.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <div className="h-10 w-10 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/60">
                  <TrendingUp className="h-5 w-5 opacity-60" />
                </div>
                <p>No borrowing usage recorded yet.</p>
              </div>
            ) : (
              data.mostUsed?.map((item: any, idx: number) => {
                const pct = Math.round((item.count / maxUsage) * 100);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border/60 bg-muted/[0.12] hover:bg-muted/[0.22] transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-5 w-5 rounded-md bg-sidebar text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs font-mono">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-foreground">{item.name}</span>
                          {item.code && (
                            <span className="ml-1.5 text-[10px] font-mono text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md border border-border/50">
                              {item.code}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[11px] text-sidebar dark:text-sky-400 bg-sidebar/10 px-2 py-0.5 rounded-lg border border-sidebar/20 shrink-0">
                        {item.count} {item.count === 1 ? 'checkout' : 'checkouts'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-sidebar rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="rounded-2xl border border-border/60 bg-white dark:bg-card shadow-card-dark flex flex-col overflow-hidden print-card">
          <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/[0.12]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-sidebar/10 text-sidebar dark:text-sky-400 border border-sidebar/20 flex items-center justify-center shrink-0">
                  <PieChart className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold font-headline text-foreground">
                    Stock by Category
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Item distribution across classifications
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-muted/60 border-border/70 px-2 py-0.5 rounded-lg">
                {data.stockByCategory?.length || 0} Categories
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 flex-1 space-y-3.5">
            {data.stockByCategory?.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                <div className="h-10 w-10 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/60">
                  <Layers className="h-5 w-5 opacity-60" />
                </div>
                <p>No categories available.</p>
              </div>
            ) : (
              data.stockByCategory?.map((cat: any, idx: number) => {
                const pct = Math.round((cat.count / totalCategoryItems) * 100);
                const catColor = cat.color || '#3b82f6';
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border/60 bg-muted/[0.12] hover:bg-muted/[0.22] transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: catColor }}
                        />
                        <span className="font-bold text-foreground truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {pct}%
                        </span>
                        <span className="font-mono font-bold text-[11px] text-foreground bg-muted/80 px-2 py-0.5 rounded-lg border border-border/60">
                          {cat.count} {cat.count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden border border-border/40">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: catColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── SAFETY STOCK & REORDER ALERT LIST TABLE ── */}
      <Card className="rounded-2xl border border-border/60 bg-white dark:bg-card shadow-card-dark overflow-hidden print-card">
        <CardHeader className="p-4 sm:p-5 border-b border-border/70 bg-muted/[0.12]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold font-headline text-foreground truncate">
                  Safety Stock &amp; Reorder Alert List
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground truncate">
                  Items currently at or below their minimum safety stock threshold
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-bold px-2.5 sm:px-3 py-1 rounded-xl border whitespace-nowrap shrink-0 flex items-center",
                (data.lowStockItems?.length || 0) > 0
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              )}
            >
              {(data.lowStockItems?.length || 0) > 0
                ? `${data.lowStockItems.length} ${data.lowStockItems.length === 1 ? 'Warning' : 'Warnings'}`
                : 'All Healthy'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {data.lowStockItems?.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="font-semibold text-foreground">All inventory items are currently well-stocked.</p>
              <p className="text-xs text-muted-foreground">No equipment or supplies require immediate reordering.</p>
            </div>
          ) : (
            <>
              {/* Mobile View: Clean Card List */}
              <div className="md:hidden divide-y divide-border/60">
                {data.lowStockItems.map((item: any) => (
                  <div key={item.id} className="p-4 space-y-2.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-foreground leading-snug">
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-md border border-border/50">
                            {item.inventoryCode || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded-md">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={item.stock === 0 ? 'destructive' : 'secondary'}
                        className={cn(
                          "text-xs font-bold rounded-lg px-2.5 py-0.5 shrink-0 whitespace-nowrap",
                          item.stock === 0
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        )}
                      >
                        {item.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs">Current Stock:</span>
                        <span className={cn(
                          "font-mono font-bold px-2 py-0.5 rounded-md text-xs",
                          item.stock === 0
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                        )}>
                          {item.stock}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <span>Min Threshold:</span>
                        <span className="font-mono font-semibold text-foreground bg-muted/70 px-2 py-0.5 rounded-md border border-border/50">
                          {item.minStock}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Full Table with Horizontal Scroll Safety */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40 whitespace-nowrap">
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Item Name</TableHead>
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Code</TableHead>
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Category</TableHead>
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-center bg-sidebar whitespace-nowrap">Current Stock</TableHead>
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-center bg-sidebar whitespace-nowrap">Min Threshold</TableHead>
                      <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-right pr-4 bg-sidebar whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lowStockItems.map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-xs sm:text-sm text-foreground">{item.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          <span className="bg-muted/70 px-2 py-0.5 rounded-md border border-border/50 font-semibold">
                            {item.inventoryCode || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-medium text-xs sm:text-sm">{item.category}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-xs sm:text-sm">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-md",
                            item.stock === 0
                              ? "bg-destructive/15 text-destructive border border-destructive/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          )}>
                            {item.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-foreground font-semibold text-xs sm:text-sm">
                          {item.minStock}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge
                            variant={item.stock === 0 ? 'destructive' : 'secondary'}
                            className={cn(
                              "text-xs font-bold rounded-lg px-2.5 py-0.5 whitespace-nowrap",
                              item.stock === 0
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            )}
                          >
                            {item.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
