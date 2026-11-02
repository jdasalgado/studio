"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ScanBarcode,
  ArrowLeftRight,
  AlertTriangle,
  Boxes,
  ShieldAlert,
  Loader2,
  Activity,
  CheckCircle2,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  FolderTree,
  Package,
  Tag,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  ClipboardCheck,
  Download,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Tabs,
  TabsContent,
  Button,
  Badge,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@studio/ui';
import { useInventory } from '@/hooks/use-inventory';
import { InventoryTable } from '@/components/inventory/inventory-table';
import { ActivityFeed } from '@/components/inventory/activity-feed';
import { BorrowingsPanel } from '@/components/inventory/borrowings-panel';
import { CategoriesPanel } from '@/components/inventory/categories-panel';
import { StockLogsPanel } from '@/components/inventory/stock-logs-panel';
import { cn } from '@/lib/utils';
import { ReportsPanel } from '@/components/inventory/reports-panel';
import { SettingsPanel } from '@/components/inventory/settings-panel';
import { StockScanModal } from '@/components/inventory/stock-scan-modal';
import { ScannerModal } from '@/components/inventory/scanner-modal';

// ── StatCard Component (Consistent with Connect2Souls & Dashboard) ───────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accentColor,
  iconClass,
  iconBgClass,
  badge,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accentColor: string;
  iconClass: string;
  iconBgClass: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-border shadow-xs bg-white dark:bg-card h-full",
        onClick && "cursor-pointer"
      )}
    >
      <div className={cn("h-1.5 w-full", accentColor)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight font-headline text-foreground leading-none">{value}</span>
              {badge}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-2 font-medium">{sub}</p>}
          </div>
          <div className={cn("p-2.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBgClass)}>
            <Icon className={cn("h-5 w-5", iconClass)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'items';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [quickStatusFilter, setQuickStatusFilter] = useState<string>("");
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [overdueAlerts, setOverdueAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checklistCounts, setChecklistCounts] = useState({ checkout: 5, return: 4, total: 9 });

  const { stats, fetchStats, fetchItems, fetchCategories, categories = [] } = useInventory();

  const fetchChecklists = async () => {
    try {
      const res = await fetch('/api/checklist-templates');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const chk = data.find((t: any) => t.type === 'checkout')?.items?.length ?? 5;
          const ret = data.find((t: any) => t.type === 'return')?.items?.length ?? 4;
          setChecklistCounts({ checkout: chk, return: ret, total: chk + ret });
        }
      }
    } catch { }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchItems(),
        fetchCategories(),
        fetchChecklists(),
        fetch('/api/inventory/borrowings?status=BORROWED')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const now = new Date();
              const over = data.filter((b) => b.expectedReturnDate && new Date(b.expectedReturnDate) < now);
              setOverdueAlerts(over);
            } else if (data.borrowings) {
              setOverdueAlerts(data.borrowings.filter((b: any) => b.isOverdue));
            } else {
              setOverdueAlerts(data);
            }
          })
          .catch(() => { }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCategories();
    fetchChecklists();
    fetch('/api/inventory/borrowings?status=BORROWED')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const now = new Date();
          const over = data.filter((b) => b.expectedReturnDate && new Date(b.expectedReturnDate) < now);
          setOverdueAlerts(over);
        } else if (data.borrowings) {
          setOverdueAlerts(data.borrowings.filter((b: any) => b.isOverdue));
        } else {
          setOverdueAlerts(data);
        }
      })
      .catch(() => { });
  }, [fetchStats, fetchCategories]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['items', 'borrowings', 'logs', 'categories', 'reports', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setQuickStatusFilter(statusParam);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setQuickStatusFilter('');
    router.push(`/inventory?tab=${val}`, { scroll: false });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── TOP HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-gray-900 dark:text-white leading-tight flex items-center gap-2.5 flex-wrap">
              {activeTab === "items"
                ? "Items & Catalog"
                : activeTab === "borrowings"
                ? "Borrowings"
                : activeTab === "logs"
                ? "Stock Logs"
                : activeTab === "categories"
                ? "Categories"
                : activeTab === "reports"
                ? "Reports & Analytics"
                : activeTab === "settings"
                ? "Checklist Management"
                : "Stock Monitoring & Assets"}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-0.5 rounded-full shadow-2xs font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {activeTab === "items"
                ? "Browse, manage, and catalog all organization inventory items and assets."
                : activeTab === "borrowings"
                ? "Monitor active borrowings, overdue equipment, and return verifications."
                : activeTab === "logs"
                ? "Audit historical stock adjustments, additions, and status changes."
                : activeTab === "categories"
                ? "Organize items by classification, storage location, and department."
                : activeTab === "reports"
                ? "Generate asset utilization insights, damaged item audits, and inventory summaries."
                : activeTab === "settings"
                ? "Configure checkout policies, checklists, and inventory alert parameters."
                : "Centralized equipment tracking, barcode checkout system, and preventive maintenance."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto sm:ml-auto">
            {['items', 'borrowings', 'logs', 'reports'].includes(activeTab) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-inventory-export'))}
                className="gap-1.5 sm:gap-2 rounded-xl border border-border/80 bg-white dark:bg-card hover:bg-muted/60 text-foreground shadow-2xs text-xs font-semibold cursor-pointer h-9 px-3 sm:px-3.5 shrink-0"
                title="Export Excel (.xlsx)"
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </Button>
            )}

            {['items', 'borrowings'].includes(activeTab) && (
              <Button
                size="sm"
                onClick={() => setIsCameraScannerOpen(true)}
                className="gap-1.5 sm:gap-2 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs text-xs font-semibold cursor-pointer h-9 px-3.5 sm:px-4 shrink-0"
              >
                <ScanBarcode className="h-4 w-4 text-white" />
                <span>Scanner</span>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* ── OVERDUE BANNER ALERT ── */}
          {overdueAlerts.length > 0 && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs font-bold">
                    {overdueAlerts.length} Overdue Borrowing Item(s) Detected!
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Some borrowed equipment has exceeded its return schedule. Please verify returns or send reminders to workers.
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs rounded-xl h-8 px-3 shadow-xs"
                onClick={() => handleTabChange('borrowings')}
              >
                View Overdue
              </Button>
            </div>
          )}

          {/* ── TOP KPI SUMMARY CARDS (DYNAMIC PER TAB) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* TAB: ITEMS & CATALOG */}
            {activeTab === 'items' && (
              <>
                <StatCard
                  label="TOTAL CATALOG"
                  value={stats?.totalItems ?? 0}
                  sub="All registered SKUs"
                  icon={Boxes}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar dark:text-blue-400"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                  onClick={() => setQuickStatusFilter('')}
                />
                <StatCard
                  label="ACTIVE BORROWED"
                  value={stats?.borrowedCount ?? 0}
                  sub="In worker possession"
                  icon={ArrowLeftRight}
                  accentColor="bg-sky-500"
                  iconClass="text-sky-600 dark:text-sky-400"
                  iconBgClass="bg-sky-50 dark:bg-sky-950/40"
                  badge={
                    stats?.overdueCount ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold rounded-full animate-pulse">
                        {stats.overdueCount} overdue
                      </Badge>
                    ) : null
                  }
                  onClick={() => handleTabChange('borrowings')}
                />
                <StatCard
                  label="LOW STOCK"
                  value={stats?.lowStockAlerts ?? 0}
                  sub="Below safety reorder point"
                  icon={AlertTriangle}
                  accentColor="bg-amber-500"
                  iconClass="text-amber-600 dark:text-amber-400"
                  iconBgClass="bg-amber-50 dark:bg-amber-950/40"
                  badge={
                    (stats?.lowStockAlerts ?? 0) > 0 ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-transparent text-[10px] px-1.5 py-0 font-bold rounded-full">
                        Needs restock
                      </Badge>
                    ) : null
                  }
                  onClick={() => setQuickStatusFilter('Low Stock')}
                />
                <StatCard
                  label="PMS ALERTS"
                  value={stats?.pmsAlerts ?? 0}
                  sub="Due maintenance within 30d"
                  icon={ShieldAlert}
                  accentColor="bg-indigo-500"
                  iconClass="text-indigo-600 dark:text-indigo-400"
                  iconBgClass="bg-indigo-50 dark:bg-indigo-950/40"
                  onClick={() => handleTabChange('settings')}
                />
              </>
            )}

            {/* TAB: BORROWINGS */}
            {activeTab === 'borrowings' && (
              <>
                <StatCard
                  label="ACTIVE BORROWED"
                  value={stats?.borrowedCount ?? 0}
                  sub="In worker possession"
                  icon={ArrowLeftRight}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar dark:text-blue-400"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                />
                <StatCard
                  label="OVERDUE RETURNS"
                  value={stats?.overdueCount ?? overdueAlerts.length ?? 0}
                  sub="Exceeded due schedule"
                  icon={AlertTriangle}
                  accentColor="bg-rose-500"
                  iconClass="text-rose-600 dark:text-rose-400"
                  iconBgClass="bg-rose-50 dark:bg-rose-950/40"
                  badge={
                    (stats?.overdueCount ?? overdueAlerts.length ?? 0) > 0 ? (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold rounded-full animate-pulse">
                        Urgent
                      </Badge>
                    ) : null
                  }
                />
                <StatCard
                  label="TOTAL RETURNED"
                  value={stats?.returnedCount ?? 0}
                  sub="Completed return intake"
                  icon={CheckCircle2}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600 dark:text-emerald-400"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="VERIFICATION REQUIRED"
                  value={stats?.borrowedCount ?? 0}
                  sub="Inspection on return"
                  icon={ClipboardCheck}
                  accentColor="bg-sky-500"
                  iconClass="text-sky-600 dark:text-sky-400"
                  iconBgClass="bg-sky-50 dark:bg-sky-950/40"
                />
              </>
            )}

            {/* TAB: STOCK LOGS */}
            {activeTab === 'logs' && (
              <>
                <StatCard
                  label="TOTAL AUDIT LOGS"
                  value={stats?.totalLogs ?? 0}
                  sub="Logged inventory transactions"
                  icon={History}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar dark:text-blue-400"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                />
                <StatCard
                  label="STOCK IN (RESTOCKED)"
                  value={stats?.stockInCount ?? 0}
                  sub="Inbound inventory additions"
                  icon={ArrowDownLeft}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600 dark:text-emerald-400"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="STOCK OUT (DISPATCHED)"
                  value={stats?.stockOutCount ?? 0}
                  sub="Dispatched & consumed items"
                  icon={ArrowUpRight}
                  accentColor="bg-amber-500"
                  iconClass="text-amber-600 dark:text-amber-400"
                  iconBgClass="bg-amber-50 dark:bg-amber-950/40"
                />
                <StatCard
                  label="MANUAL ADJUSTMENTS"
                  value={stats?.adjustmentsCount ?? 0}
                  sub="Audit corrections & syncs"
                  icon={SlidersHorizontal}
                  accentColor="bg-indigo-500"
                  iconClass="text-indigo-600 dark:text-indigo-400"
                  iconBgClass="bg-indigo-50 dark:bg-indigo-950/40"
                />
              </>
            )}

            {/* TAB: CATEGORIES */}
            {activeTab === 'categories' && (
              <>
                <StatCard
                  label="TOTAL CATEGORIES"
                  value={categories.length || stats?.totalCategories || 0}
                  sub="Active classification groups"
                  icon={FolderTree}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar dark:text-blue-400"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                />
                <StatCard
                  label="CATEGORIZED SKUS"
                  value={stats?.categorizedItemsCount ?? stats?.totalItems ?? 0}
                  sub="Assigned to classifications"
                  icon={Package}
                  accentColor="bg-sky-500"
                  iconClass="text-sky-600 dark:text-sky-400"
                  iconBgClass="bg-sky-50 dark:bg-sky-950/40"
                />
                <StatCard
                  label="EQUIPMENT CLASSES"
                  value={stats?.equipmentCount ?? 0}
                  sub="Gear & returnable assets"
                  icon={Boxes}
                  accentColor="bg-indigo-500"
                  iconClass="text-indigo-600 dark:text-indigo-400"
                  iconBgClass="bg-indigo-50 dark:bg-indigo-950/40"
                />
                <StatCard
                  label="CONSUMABLES CLASSES"
                  value={stats?.consumableCount ?? 0}
                  sub="Supplies & expendables"
                  icon={Tag}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600 dark:text-emerald-400"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
              </>
            )}

            {/* TAB: REPORTS & ANALYTICS */}
            {activeTab === 'reports' && (
              <>
                <StatCard
                  label="HEALTHY STOCKS"
                  value={Math.max(0, (stats?.totalItems ?? 0) - (stats?.lowStockAlerts ?? 0))}
                  sub="Above safety reorder level"
                  icon={CheckCircle2}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600 dark:text-emerald-400"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="ACTIVE DEPLOYMENTS"
                  value={stats?.borrowedCount ?? 0}
                  sub="Currently borrowed in field"
                  icon={TrendingUp}
                  accentColor="bg-sky-500"
                  iconClass="text-sky-600 dark:text-sky-400"
                  iconBgClass="bg-sky-50 dark:bg-sky-950/40"
                />
                <StatCard
                  label="CRITICAL REORDERS"
                  value={stats?.lowStockAlerts ?? 0}
                  sub="Below safety threshold"
                  icon={AlertTriangle}
                  accentColor="bg-amber-500"
                  iconClass="text-amber-600 dark:text-amber-400"
                  iconBgClass="bg-amber-50 dark:bg-amber-950/40"
                />
                <StatCard
                  label="MAINTAINED ASSETS"
                  value={Math.max(0, (stats?.totalItems ?? 0) - (stats?.pmsAlerts ?? 0))}
                  sub="PMS schedule up-to-date"
                  icon={ShieldAlert}
                  accentColor="bg-indigo-500"
                  iconClass="text-indigo-600 dark:text-indigo-400"
                  iconBgClass="bg-indigo-50 dark:bg-indigo-950/40"
                />
              </>
            )}

            {/* TAB: SETTINGS & CHECKLISTS */}
            {activeTab === 'settings' && (
              <>
                <StatCard
                  label="CHECKOUT RULES"
                  value={checklistCounts.checkout}
                  sub="Handover inspection steps"
                  icon={FileCheck}
                  accentColor="bg-sidebar"
                  iconClass="text-sidebar dark:text-blue-400"
                  iconBgClass="bg-blue-50 dark:bg-blue-950/40"
                />
                <StatCard
                  label="RETURN RULES"
                  value={checklistCounts.return}
                  sub="Intake damage criteria"
                  icon={ShieldCheck}
                  accentColor="bg-emerald-500"
                  iconClass="text-emerald-600 dark:text-emerald-400"
                  iconBgClass="bg-emerald-50 dark:bg-emerald-950/40"
                />
                <StatCard
                  label="TOTAL VERIFICATIONS"
                  value={checklistCounts.total}
                  sub="Active quality controls"
                  icon={CheckCircle2}
                  accentColor="bg-sky-500"
                  iconClass="text-sky-600 dark:text-sky-400"
                  iconBgClass="bg-sky-50 dark:bg-sky-950/40"
                />
                <StatCard
                  label="PMS CYCLE (DAYS)"
                  value={30}
                  sub="Maintenance advance window"
                  icon={ShieldAlert}
                  accentColor="bg-indigo-500"
                  iconClass="text-indigo-600 dark:text-indigo-400"
                  iconBgClass="bg-indigo-50 dark:bg-indigo-950/40"
                />
              </>
            )}
          </div>

          {/* ── TAB PANELS CONTENT ── */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
            <TabsContent value="items" className="space-y-6 mt-0">
              <div className="w-full">
                <InventoryTable
                  onScanClick={() => setIsScanModalOpen(true)}
                  statusFilterOverride={quickStatusFilter}
                  onClearStatusFilterOverride={() => setQuickStatusFilter('')}
                  onActivityFeedClick={() => setIsActivityFeedOpen(true)}
                />
              </div>
            </TabsContent>

            <TabsContent value="borrowings" className="space-y-6 mt-0">
              <BorrowingsPanel />
            </TabsContent>

            {/* Tab 3: Stock Logs */}
            <TabsContent value="logs" className="space-y-6 mt-0">
              <StockLogsPanel />
            </TabsContent>

            {/* Tab 4: Categories */}
            <TabsContent value="categories" className="space-y-6 mt-0">
              <CategoriesPanel />
            </TabsContent>

            {/* Tab 5: Reports & Analytics */}
            <TabsContent value="reports" className="space-y-6 mt-0">
              <ReportsPanel />
            </TabsContent>

            {/* Tab 6: Settings */}
            <TabsContent value="settings" className="space-y-6 mt-0">
              <SettingsPanel />
            </TabsContent>
          </Tabs>

          {/* ── ACTIVITY FEED SIDE SHEET (Unclutters the Table) ── */}
          <Sheet open={isActivityFeedOpen} onOpenChange={setIsActivityFeedOpen}>
            <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col bg-background border border-border/80 shadow-2xl overflow-hidden rounded-2xl">
              <SheetTitle className="sr-only">Live Activity Feed</SheetTitle>
              <SheetDescription className="sr-only">Real-time inventory audit trail and equipment history.</SheetDescription>
              <ActivityFeed onClose={() => setIsActivityFeedOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* ── SCAN MODALS ── */}
          {isScanModalOpen && (
            <StockScanModal
              isOpen={isScanModalOpen}
              initialCode={scannedCode}
              activeTab={activeTab}
              onSwitchTab={handleTabChange}
              onClose={() => {
                setIsScanModalOpen(false);
                setScannedCode('');
              }}
              onStockUpdated={() => {
                fetchStats();
                window.dispatchEvent(new CustomEvent('inventory-refresh'));
              }}
            />
          )}

          {isCameraScannerOpen && (
            <ScannerModal
              isOpen={isCameraScannerOpen}
              onClose={() => setIsCameraScannerOpen(false)}
              onScan={(code) => {
                setIsCameraScannerOpen(false);
                setScannedCode(code);
                setIsScanModalOpen(true);
              }}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Loading Inventory...</span>
          </div>
        </AppLayout>
      }
    >
      <InventoryPageContent />
    </Suspense>
  );
}

