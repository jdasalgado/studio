"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  QrCode,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Pencil,
  Trash2,
  RefreshCw,
  MapPin,
  X,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Boxes,
  Tag,
  Activity,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Button,
  Input,
  Badge,
  Checkbox,
  Card,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@studio/ui';
import { cn } from '@/lib/utils';
import { useInventory, type InventoryItem } from '@/hooks/use-inventory';
import { useUserRole } from '@/hooks/use-user-role';
import { useAuthStore } from '@studio/store';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/export-excel';
import { ExportConfirmDialog } from '@/components/common/export-confirm-dialog';
import { QRModal } from './qr-modal';
import { ItemModal } from './item-modal';
import { StockScanModal } from './stock-scan-modal';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

// Category badge color mapping for instant visual recognition matching category settings
const getCategoryStyleProps = (category?: { name?: string; color?: string | null }) => {
  const hex = category?.color;
  if (hex && hex.startsWith('#')) {
    return {
      style: {
        backgroundColor: `${hex}15`,
        color: hex,
        borderColor: `${hex}40`,
      },
      className: "border font-semibold shadow-2xs",
    };
  }

  // Fallback to name-based mapping matching the preset category colors
  const name = (category?.name || '').toLowerCase();
  let fallbackColor = '#64748b'; // Slate
  if (name.includes('video') || name.includes('projection') || name.includes('camera') || name.includes('screen')) {
    fallbackColor = '#10b981'; // Emerald
  } else if (name.includes('light') || name.includes('lamp')) {
    fallbackColor = '#f59e0b'; // Amber
  } else if (name.includes('audio') || name.includes('sound') || name.includes('mic')) {
    fallbackColor = '#8b5cf6'; // Purple
  } else if (name.includes('it') || name.includes('electron') || name.includes('laptop')) {
    fallbackColor = '#06b6d4'; // Cyan
  } else if (name.includes('music') || name.includes('instrument')) {
    fallbackColor = '#8b5cf6'; // Purple
  } else if (name.includes('furniture') || name.includes('chair') || name.includes('table')) {
    fallbackColor = '#64748b'; // Slate
  } else if (name.includes('consumable') || name.includes('suppl') || name.includes('batter')) {
    fallbackColor = '#ef4444'; // Rose
  }

  return {
    style: {
      backgroundColor: `${fallbackColor}15`,
      color: fallbackColor,
      borderColor: `${fallbackColor}40`,
    },
    className: "border font-semibold shadow-2xs",
  };
};


interface InventoryTableProps {
  onScanClick?: () => void;
  statusFilterOverride?: string;
  onClearStatusFilterOverride?: () => void;
  onActivityFeedClick?: () => void;
}

export function InventoryTable({
  onScanClick,
  statusFilterOverride,
  onClearStatusFilterOverride,
  onActivityFeedClick,
}: InventoryTableProps) {
  const {
    items,
    totalItems,
    loading,
    categories,
    locations,
    stats,
    fetchStats,
    fetchItems,
    fetchCategories,
    fetchLocations,
    deleteItem,
    updateStock,
    bulkDeleteItems,
    bulkUpdateItems,
    bulkImportItems,
  } = useInventory();

  const { toast } = useToast();
  const { workerProfile } = useUserRole();
  const { user } = useAuthStore();
  const router = useRouter();

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 12;

  // Debounce search input to avoid hitting API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setSkip(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync external status filter override (e.g. clicking Low Stock KPI card)
  useEffect(() => {
    if (statusFilterOverride !== undefined) {
      setSelectedStatus(statusFilterOverride);
      setSkip(0);
    }
  }, [statusFilterOverride]);

  // Selected items for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<InventoryItem | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrItems, setQrItems] = useState<InventoryItem[]>([]);
  const [isFastScanOpen, setIsFastScanOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Custom Stock Adjustment Dialog State
  const [stockAdjustItem, setStockAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustAction, setAdjustAction] = useState<'Stock In' | 'Stock Out'>('Stock In');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  const loadData = useCallback(() => {
    const params: any = {
      skip: String(skip),
      take: String(take),
    };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (selectedCategory) params.categoryId = selectedCategory;
    if (selectedStatus) params.status = selectedStatus;
    if (selectedType) params.type = selectedType;
    if (selectedLocation) params.location = selectedLocation;

    fetchItems(params);
  }, [skip, take, debouncedSearch, selectedCategory, selectedStatus, selectedType, selectedLocation, fetchItems]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchCategories();
    fetchLocations();
    fetchStats();
  }, [fetchCategories, fetchLocations, fetchStats]);

  const localLowCount = items.filter((i) => (i.quantity ?? i.stock ?? 0) <= (i.minQuantity ?? i.minStock ?? 5)).length;
  const lowCount = (stats?.lowStockAlerts !== undefined && stats.lowStockAlerts > 0) ? stats.lowStockAlerts : localLowCount;
  const equipmentCount = stats?.equipmentCount ?? items.filter((i) => i.type === 'EQUIPMENT').length;
  const consumableCount = stats?.consumableCount ?? items.filter((i) => i.type === 'CONSUMABLE').length;
  const totalCount = totalItems || stats?.totalItems || items.length;

  const isLowFilterActive = selectedStatus === 'Low Stock';
  const displayedItems = useMemo(() => {
    if (isLowFilterActive) {
      return items.filter((i) => (i.quantity ?? i.stock ?? 0) <= (i.minQuantity ?? i.minStock ?? 5));
    }
    return items;
  }, [items, isLowFilterActive]);

  // Debounced search reset page
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSkip(0);
  };

  // Selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Actor metadata for transaction logs
  const currentActor = {
    id: workerProfile?.id || user?.id || null,
    name: workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}`.trim() : (user?.displayName || user?.email || 'User'),
    email: user?.email || workerProfile?.email || null,
  };

  // Quick Single Stock Actions (+1 / -1)
  const handleQuickStock = async (item: InventoryItem, action: 'Stock In' | 'Stock Out') => {
    try {
      await updateStock(item.id, action, 1, undefined, currentActor);
      const newStock = action === 'Stock In' ? item.stock + 1 : Math.max(0, item.stock - 1);
      const min = item.minStock || 5;
      const isNowLow = newStock <= min;

      toast({
        title: action === 'Stock In' ? 'Stock In (+1)' : 'Stock Out (-1)',
        description: action === 'Stock In'
          ? (isNowLow
              ? `${item.name} is now at ${newStock} ${item.unit || 'pcs'} (Safety threshold: ${min}).`
              : `${item.name} is now safely stocked at ${newStock} ${item.unit || 'pcs'}!`)
          : (isNowLow
              ? `⚠️ ${item.name} is now at ${newStock} ${item.unit || 'pcs'} (at or below minimum of ${min}).`
              : `${item.name} is now at ${newStock} ${item.unit || 'pcs'}.`),
      });
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.message || 'Failed to update stock quantity',
      });
    }
  };

  // Custom Stock Adjustment Submit
  const handleCustomStockAdjust = async () => {
    if (!stockAdjustItem) return;
    if (adjustQuantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid quantity',
        description: 'Please enter a quantity greater than zero.',
      });
      return;
    }

    setIsAdjusting(true);
    try {
      await updateStock(stockAdjustItem.id, adjustAction, adjustQuantity, adjustNote.trim() || undefined, currentActor);
      toast({
        title: 'Stock adjusted successfully',
        description: `${adjustAction} of ${adjustQuantity} ${stockAdjustItem.unit || 'pcs'} applied to ${stockAdjustItem.name}.`,
      });
      setStockAdjustItem(null);
      setAdjustQuantity(1);
      setAdjustNote('');
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Stock adjustment failed',
        description: err.message || 'Failed to adjust stock',
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // Single Delete
  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteItem(deleteConfirmId);
      toast({
        title: 'Item deleted',
        description: `"${deleteConfirmName}" has been removed from catalog.`,
      });
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err.message || 'Failed to delete item',
      });
    }
  };

  // Bulk Delete
  const confirmBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      await bulkDeleteItems(Array.from(selectedIds));
      toast({
        title: 'Items deleted',
        description: `Successfully deleted ${count} selected item(s).`,
      });
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk delete failed',
        description: err.message || 'Failed to delete items',
      });
    }
  };

  // Bulk Status Update
  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateItems(Array.from(selectedIds), { status });
      toast({
        title: 'Status updated',
        description: `Marked ${selectedIds.size} item(s) as "${status}".`,
      });
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk update failed',
        description: err.message || 'Failed to update status',
      });
    }
  };

  // QR batch print for selected
  const handleBatchQR = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;
    setQrItems(selectedItems);
    setIsQrModalOpen(true);
  };

  // Single QR
  const handleSingleQR = (item: InventoryItem) => {
    setQrItems([item]);
    setIsQrModalOpen(true);
  };

  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    const handleExportEvent = () => setShowExportConfirm(true);
    window.addEventListener('trigger-inventory-export', handleExportEvent);
    return () => window.removeEventListener('trigger-inventory-export', handleExportEvent);
  }, []);

  // Export Excel
  const handleExportExcel = () => {
    const itemHeaders = [
      'Item Name',
      'Inventory Code',
      'Category',
      'Type',
      'Stock',
      'Unit',
      'Min Stock',
      'Location',
      'Aisle',
      'Shelf',
      'Bin',
      'Status',
    ];

    const itemRows = items.map((i) => [
      i.name,
      i.inventoryCode || '—',
      i.category?.name || 'Uncategorized',
      i.type,
      i.stock,
      i.unit,
      i.minStock,
      i.location || '—',
      i.aisle || '—',
      i.shelf || '—',
      i.bin || '—',
      i.status || 'Good Condition',
    ]);

    // Low stock items
    const lowStockItems = items.filter((i) => i.stock <= (i.minStock || 5));
    const lowStockRows = lowStockItems.map((i) => [
      i.name,
      i.inventoryCode || '—',
      i.category?.name || 'Uncategorized',
      i.stock,
      i.minStock,
      i.stock === 0 ? 'Out of Stock' : 'Low Stock',
      i.location || '—',
    ]);

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    items.forEach((i) => {
      const cat = i.category?.name || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryRows = Object.entries(categoryCounts).map(([cat, count]) => [
      cat,
      count,
      items.length > 0 ? `${Math.round((count / items.length) * 100)}%` : '0%',
    ]);

    exportToExcel(`inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`, [
      {
        name: 'Inventory Items',
        data: [itemHeaders, ...itemRows],
        colWidths: [26, 16, 20, 14, 10, 10, 12, 16, 10, 10, 10, 16],
      },
      {
        name: 'Low Stock Alerts',
        data: [
          ['Item Name', 'Inventory Code', 'Category', 'Current Stock', 'Min Stock', 'Alert Status', 'Location'],
          ...lowStockRows,
        ],
        colWidths: [26, 16, 20, 14, 12, 16, 16],
      },
      {
        name: 'Category Summary',
        data: [
          ['Total Items', items.length],
          [],
          ['Category', 'Count', 'Share'],
          ...categoryRows,
        ],
        colWidths: [24, 14, 14],
      },
    ]);

    toast({
      title: 'Export generated',
      description: `Exported ${items.length} items with low stock and category tabs to Excel.`,
    });
  };

  const hasActiveFilters = Boolean(
    search || selectedCategory || selectedStatus || selectedType || selectedLocation
  );

  const resetAllFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setSelectedStatus('');
    setSelectedType('');
    setSelectedLocation('');
    setSkip(0);
    if (onClearStatusFilterOverride) {
      onClearStatusFilterOverride();
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ── UNIFIED TABLE TOOLBAR CONTAINER ── */}
        {/* ── UNIFIED TABLE TOOLBAR CONTAINER (Connect2Souls Style) ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
          {/* First Row: Search Bar & Smart Filter Selectors */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input with Clear Button */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search items by name, barcode, location..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-8 h-10 text-xs rounded-2xl bg-muted/30 border-slate-200/90 dark:border-border focus:bg-background transition-all shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns with Clean Responsive Grid/Flex Controls */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full md:w-auto flex-wrap xl:flex-nowrap">
              {/* Quick Filter Dropdown */}
              <div className="w-full sm:w-[155px] shrink-0">
                <Select
                  value={selectedStatus === 'Low Stock' ? 'low' : selectedType === 'EQUIPMENT' ? 'equipment' : selectedType === 'CONSUMABLE' ? 'consumables' : 'all'}
                  onValueChange={(val) => {
                    if (val === 'low') {
                      setSelectedStatus('Low Stock');
                      setSelectedType('');
                    } else if (val === 'equipment') {
                      setSelectedType('EQUIPMENT');
                      setSelectedStatus('');
                      onClearStatusFilterOverride?.();
                    } else if (val === 'consumables') {
                      setSelectedType('CONSUMABLE');
                      setSelectedStatus('');
                      onClearStatusFilterOverride?.();
                    } else {
                      setSelectedStatus('');
                      setSelectedType('');
                      onClearStatusFilterOverride?.();
                    }
                    setSkip(0);
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[155px] text-xs rounded-2xl border-slate-200/90 dark:border-border bg-white dark:bg-muted/30 font-medium shadow-2xs px-3.5 focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar transition-all cursor-pointer">
                    <SelectValue placeholder="All Items" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs font-medium cursor-pointer">
                      All Items ({totalCount})
                    </SelectItem>
                    <SelectItem value="low" className="text-xs font-medium cursor-pointer">
                      Low Stock ({lowCount})
                    </SelectItem>
                    <SelectItem value="equipment" className="text-xs font-medium cursor-pointer">
                      Equipment ({equipmentCount})
                    </SelectItem>
                    <SelectItem value="consumables" className="text-xs font-medium cursor-pointer">
                      Consumables ({consumableCount})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="w-full sm:w-[155px] shrink-0">
                <Select
                  value={selectedCategory || 'ALL'}
                  onValueChange={(val) => {
                    setSelectedCategory(val === 'ALL' ? '' : val);
                    setSkip(0);
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[155px] text-xs font-medium rounded-2xl bg-white dark:bg-muted/30 border-slate-200/90 dark:border-border hover:bg-muted/50 transition-colors px-3 gap-2 shadow-2xs">
                    <SelectValue placeholder="Category: All" className="truncate text-left" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" className="rounded-xl w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]">
                    <SelectItem value="ALL" className="text-xs">Category: All</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs truncate">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-[150px] shrink-0">
                <Select
                  value={selectedStatus || 'ALL'}
                  onValueChange={(val) => {
                    setSelectedStatus(val === 'ALL' ? '' : val);
                    setSkip(0);
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[150px] text-xs font-medium rounded-2xl bg-white dark:bg-muted/30 border-slate-200/90 dark:border-border hover:bg-muted/50 transition-colors px-3 gap-2 shadow-2xs">
                    <SelectValue placeholder="Status: All" className="truncate text-left" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" className="rounded-xl w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]">
                    <SelectItem value="ALL" className="text-xs">Status: All</SelectItem>
                    <SelectItem value="Good Condition" className="text-xs font-medium">Good Condition</SelectItem>
                    <SelectItem value="Low Stock" className="text-xs font-medium">Low Stock</SelectItem>
                    <SelectItem value="Out of Stock" className="text-xs font-medium">Out of Stock</SelectItem>
                    <SelectItem value="Under Maintenance" className="text-xs font-medium">Under Maintenance</SelectItem>
                    <SelectItem value="Damaged" className="text-xs font-medium">Damaged</SelectItem>
                    <SelectItem value="Borrowed" className="text-xs font-medium">Borrowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              {locations.length > 0 && (
                <div className="w-full sm:w-[150px] shrink-0">
                  <Select
                    value={selectedLocation || 'ALL'}
                    onValueChange={(val) => {
                      setSelectedLocation(val === 'ALL' ? '' : val);
                      setSkip(0);
                    }}
                  >
                    <SelectTrigger className="h-10 w-full sm:w-[150px] text-xs font-medium rounded-2xl bg-white dark:bg-muted/30 border-slate-200/90 dark:border-border hover:bg-muted/50 transition-colors px-3 gap-2 shadow-2xs">
                      <SelectValue placeholder="Location: All" className="truncate text-left" />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start" className="rounded-xl w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]">
                      <SelectItem value="ALL" className="text-xs">Location: All</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.name} className="text-xs truncate">
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1 cursor-pointer shrink-0 col-span-2 sm:col-auto"
                  onClick={resetAllFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>

          {/* Action Buttons Row: Swapped (+ Add Item & Activity Feed on Left, Low Stock on Right) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            {/* Left: Primary + Add Item Button & Activity Feed */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
              <Button
                size="sm"
                className="h-9 px-3.5 sm:px-4 text-xs font-bold rounded-xl gap-1.5 bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer flex-1 sm:flex-initial justify-center"
                onClick={() => {
                  setModalItem(null);
                  setIsItemModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Add Item</span>
              </Button>
            </div>

            {/* Right: Low Stock · X items */}
            <div className="flex items-center sm:justify-end gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (selectedStatus === 'Low Stock') {
                    setSelectedStatus('');
                    onClearStatusFilterOverride?.();
                  } else {
                    setSelectedStatus('Low Stock');
                  }
                  setSkip(0);
                }}
                className={cn(
                  "h-9 px-3.5 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs select-none w-full sm:w-auto",
                  selectedStatus === 'Low Stock'
                    ? "bg-red-600 text-white border-red-600 shadow-xs"
                    : "bg-red-50 text-red-700 border-red-200/90 hover:bg-red-100/90 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60"
                )}
                title={selectedStatus === 'Low Stock' ? 'Click to show all items' : 'Click to filter only low-stock items'}
              >
                <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", selectedStatus === 'Low Stock' ? "text-white" : "text-red-600 dark:text-red-400")} />
                <span>Low Stock &middot; {lowCount} {lowCount === 1 ? 'item' : 'items'}</span>
                {selectedStatus === 'Low Stock' && (
                  <span className="text-[10px] bg-red-700 text-white px-1.5 py-0.2 rounded-md font-bold">
                    Active
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ── MASTER TABLE CONTAINER (Rounded Card inside White Container) ── */}
          <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card shadow-card-dark">
            {/* ── BULK ACTIONS FLOATING STRIP ── */}
            {selectedIds.size > 0 && (
              <div className="p-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground text-[11px] px-2 py-0.5 rounded-full font-bold">
                    {selectedIds.size}
                  </span>
                  <span>item(s) selected</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 px-2.5 rounded-lg shrink-0" onClick={handleBatchQR}>
                    <QrCode className="h-3 w-3" />
                    Batch QR
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2.5 rounded-lg shrink-0">
                        Mark Status
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('Good Condition')}>
                        Mark Good Condition
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('Under Maintenance')}>
                        Mark Under Maintenance
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange('Damaged')}>
                        Mark Damaged
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 text-xs h-7 px-2.5 rounded-lg shrink-0 whitespace-nowrap"
                    onClick={() => setBulkDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            )}

            {/* ── MOBILE CARD LIST VIEW (FOR SMARTPHONES) ── */}
            <div className="block md:hidden divide-y divide-border/60">
              {loading && items.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium">Loading inventory items...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 px-4 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60 border border-border/60">
                    <Package className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-bold text-foreground">No inventory items found</span>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {hasActiveFilters
                      ? 'No items matched your search filters.'
                      : 'Get started by clicking "+ Add Item" above.'}
                  </p>
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const categoryStyle = getCategoryStyleProps(item.category);
                  const isLow = item.stock <= (item.minStock > 0 ? item.minStock : 5) && item.stock > 0;
                  const isOut = item.stock === 0;

                  return (
                    <div
                      key={`mob-${item.id}`}
                      className={cn(
                        "overflow-hidden rounded-none border-b border-border/60 transition-colors bg-card",
                        isSelected ? "bg-sidebar/5 dark:bg-sidebar/10" : "bg-card"
                      )}
                    >
                      {/* Top Header: Solid Blue Bar with Checkbox, Code, Status & Dropdown */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="h-[17px] w-[17px] rounded-[4px] border-[1.5px] border-white/90 bg-transparent data-[state=checked]:bg-white data-[state=checked]:border-white [&_svg]:text-sidebar focus-visible:ring-0 cursor-pointer shadow-xs transition-colors"
                          />
                          <span className="text-xs font-mono font-bold text-white tracking-wide">
                            {item.inventoryCode || item.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-400/20 text-rose-200 border border-rose-400/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {item.status || "Good Condition"}
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-border/80 bg-popover/95 backdrop-blur-sm p-1.5 space-y-0.5">
                              <DropdownMenuItem
                                className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                onClick={() => {
                                  setModalItem(item);
                                  setIsItemModalOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Edit Item</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                onClick={() => {
                                  setStockAdjustItem(item);
                                  setAdjustAction('Stock In');
                                  setAdjustQuantity(1);
                                  setAdjustNote('');
                                }}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Adjust Stock</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                onClick={() => handleSingleQR(item)}
                              >
                                <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>Print QR Label</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 bg-border/60" />
                              <DropdownMenuItem
                                className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/40 transition-colors"
                                onClick={() => {
                                  setDeleteConfirmId(item.id);
                                  setDeleteConfirmName(item.name);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                <span>Delete Item</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-xl bg-muted/40 border border-border/70 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs pointer-events-none select-none"
                          >
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground/60" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4
                                onClick={() => {
                                  setModalItem(item);
                                  setIsItemModalOpen(true);
                                }}
                                className="text-sm font-bold text-foreground hover:text-primary cursor-pointer line-clamp-1"
                              >
                                {item.name}
                              </h4>
                              {/* Quick In/Out buttons in row with item name */}
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 rounded-md cursor-pointer hover:bg-muted"
                                  disabled={item.stock <= 0}
                                  onClick={() => handleQuickStock(item, 'Stock Out')}
                                  title="Quick -1"
                                >
                                  <ArrowDown className="h-3 w-3 text-amber-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 rounded-md cursor-pointer hover:bg-muted"
                                  onClick={() => handleQuickStock(item, 'Stock In')}
                                  title="Quick +1"
                                >
                                  <ArrowUp className="h-3 w-3 text-emerald-600" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span
                                className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md", categoryStyle.className)}
                                style={categoryStyle.style}
                              >
                                {item.category?.name || 'Unassigned'}
                              </span>
                              {item.isKit && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                                  Kit / Bundle
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Details 2-Column Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-slate-50/70 dark:bg-muted/30 p-2.5 rounded-xl border border-border/40">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              Current Stock
                            </p>
                            <div className="mt-0.5">
                              <span className={cn(
                                "font-bold text-xs",
                                isOut || isLow ? "text-red-600 dark:text-red-400 font-mono" : "text-foreground font-mono"
                              )}>
                                {item.stock} {item.unit || 'pcs'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              Type / Class
                            </p>
                            <p className="font-semibold text-foreground truncate capitalize">
                              {item.type?.toLowerCase() || 'Equipment'}
                            </p>
                          </div>

                          <div className="col-span-2 pt-1 border-t border-border/30">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                              Location
                            </p>
                            <p className="font-semibold text-foreground truncate">
                              {item.location || '—'}
                            </p>
                            <p className="text-muted-foreground text-[11px] truncate">
                              {[item.aisle ? `Aisle ${item.aisle}` : '', item.shelf ? `Shelf ${item.shelf}` : '', item.bin ? `Bin ${item.bin}` : ''].filter(Boolean).join(' · ') || 'Storage Floor'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── THE MASTER TABLE (FOR DESKTOP & TABLETS) ── */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40 whitespace-nowrap">
                    <TableHead className="w-10 pl-4 bg-sidebar whitespace-nowrap">
                      <div className="flex items-center">
                        <Checkbox
                          checked={items.length > 0 && selectedIds.size === items.length}
                          onCheckedChange={handleSelectAll}
                          className="h-[17px] w-[17px] rounded-[4px] border-[1.5px] border-white/90 bg-transparent data-[state=checked]:bg-white data-[state=checked]:border-white [&_svg]:text-sidebar focus-visible:ring-0 cursor-pointer shadow-xs transition-colors"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-12 text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Item</TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider min-w-[200px] bg-sidebar whitespace-nowrap">
                      Name &amp; Code
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Category</TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Type</TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-center bg-sidebar whitespace-nowrap">
                      Stock
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap">Location</TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-left pl-3 bg-sidebar whitespace-nowrap min-w-[100px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-56 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2.5">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs font-medium">Loading inventory items...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-56 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground/60 border border-border/60">
                            <Package className="h-6 w-6" />
                          </div>
                          <span className="text-sm font-bold text-foreground">No inventory items found</span>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            {hasActiveFilters
                              ? 'No items matched your search filters. Try clearing filters to see all catalog items.'
                              : 'Get started by clicking "+ Add Item" to register your supplies and equipment.'}
                          </p>
                          {hasActiveFilters ? (
                            <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-2 text-xs rounded-xl">
                              Clear all filters
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setModalItem(null);
                                setIsItemModalOpen(true);
                              }}
                              className="mt-2 text-xs rounded-xl"
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add your first item
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const isLow = item.stock <= (item.minStock > 0 ? item.minStock : 5) && item.stock > 0;
                      const isOut = item.stock === 0;
                      const categoryStyle = getCategoryStyleProps(item.category);

                      return (
                        <TableRow
                          key={item.id}
                          className={`group transition-colors border-b border-slate-100 dark:border-border/40 ${isSelected ? 'bg-sidebar/5' : 'hover:bg-slate-50/60 dark:hover:bg-muted/20'
                            }`}
                        >
                          {/* 1. Checkbox */}
                          <TableCell className="pl-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(item.id)}
                              className="h-[17px] w-[17px] rounded-[4px] border-slate-300 dark:border-slate-600 data-[state=checked]:bg-sidebar data-[state=checked]:border-sidebar cursor-pointer transition-colors"
                            />
                          </TableCell>

                          {/* 2. Visual Thumbnail / Category Avatar */}
                          <TableCell className="py-3">
                            <div
                              className="w-10 h-10 rounded-xl bg-muted/40 border border-border/70 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs pointer-events-none select-none"
                            >
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </div>
                          </TableCell>

                          {/* 3. Name & Code */}
                          <TableCell className="py-3">
                            <div>
                              <div
                                className="font-bold text-xs md:text-sm text-foreground leading-tight hover:text-primary cursor-pointer transition-colors"
                                onClick={() => {
                                  setModalItem(item);
                                  setIsItemModalOpen(true);
                                }}
                              >
                                {item.name}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-foreground font-mono">
                                  {item.inventoryCode || item.id.slice(0, 8).toUpperCase()}
                                </span>
                                {item.isKit && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                  >
                                    Bundle
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* 4. Category */}
                          <TableCell className="py-3">
                            <span
                              className={cn("inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg", categoryStyle.className)}
                              style={categoryStyle.style}
                            >
                              {item.category?.name || 'General'}
                            </span>
                          </TableCell>

                          {/* 5. Type */}
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                              {item.type === 'CONSUMABLE' ? (
                                <>
                                  <Layers className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Consumable</span>
                                </>
                              ) : (
                                <>
                                  <Package className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                                  <span>Equipment</span>
                                </>
                              )}
                            </span>
                          </TableCell>

                          {/* 6. Stock Level & Health Indicator (Static Red Alert, Red Dot + Compact Badge) */}
                          <TableCell className="text-center py-3">
                            <div className="inline-flex flex-col items-center gap-1">
                              <div className="flex items-baseline gap-1">
                                <span
                                  className={`text-sm font-semibold ${
                                    isOut || isLow ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                                  }`}
                                >
                                  {item.stock}
                                </span>
                                <span
                                  className={`text-[10px] ${
                                    isOut || isLow ? 'text-red-600/80 dark:text-red-400/80 font-medium' : 'text-muted-foreground'
                                  }`}
                                >
                                  {item.unit || 'pcs'}
                                </span>
                              </div>

                              {/* Small Status Dot + Badge with helpful Tooltip */}
                              {isOut ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStockAdjustItem(item);
                                        setAdjustAction('Stock In');
                                      }}
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400 shrink-0" />
                                      <span>Out of Stock</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs p-2.5 max-w-xs">
                                    <p className="font-bold text-red-600">Out of Stock Alert</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      0 {item.unit || 'pcs'} remaining. Click badge to stock in.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : isLow ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStockAdjustItem(item);
                                        setAdjustAction('Stock In');
                                      }}
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400 shrink-0" />
                                      <span>Low Stock</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs p-2.5 max-w-xs">
                                    <p className="font-bold text-red-600">Low Stock Alert</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {item.stock} {item.unit || 'pcs'} remaining (Safety min: {item.minStock || 5}). Click to restock.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                          </TableCell>

                          {/* 7. Location */}
                          <TableCell className="py-3">
                            <div className="text-xs text-foreground font-medium flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[130px]">{item.location || '—'}</span>
                            </div>
                            {(item.aisle || item.shelf || item.bin) && (
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5 pl-4">
                                {[item.aisle && `A:${item.aisle}`, item.shelf && `S:${item.shelf}`, item.bin && `B:${item.bin}`]
                                  .filter(Boolean)
                                  .join(' ')}
                              </div>
                            )}
                          </TableCell>

                          {/* 8. Actions Column (Aligned with Actions header & Stock Out icon) */}
                          <TableCell className="text-left pl-3 py-3">
                            <div className="flex items-center justify-start gap-1">
                              {/* Stock Out (-1) */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                    disabled={item.stock <= 0}
                                    onClick={() => handleQuickStock(item, 'Stock Out')}
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Quick Stock Out (-1)</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Stock In (+1) */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                    onClick={() => handleQuickStock(item, 'Stock In')}
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Quick Stock In (+1)</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* More Options Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-border/80 bg-popover/95 backdrop-blur-sm p-1.5 space-y-0.5">
                                  <DropdownMenuItem
                                    className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                    onClick={() => {
                                      setModalItem(item);
                                      setIsItemModalOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Edit Item</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                    onClick={() => {
                                      setStockAdjustItem(item);
                                      setAdjustAction('Stock In');
                                      setAdjustQuantity(1);
                                      setAdjustNote('');
                                    }}
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Adjust Stock</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-foreground/90 hover:text-foreground hover:bg-muted/70 transition-colors"
                                    onClick={() => handleSingleQR(item)}
                                  >
                                    <QrCode className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Print QR Label</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator className="my-1 bg-border/60" />

                                  <DropdownMenuItem
                                    className="gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/40 transition-colors"
                                    onClick={() => {
                                      setDeleteConfirmId(item.id);
                                      setDeleteConfirmName(item.name);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                    <span>Delete Item</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── PAGINATION FOOTER ── */}
            <div className="p-4 border-t border-border/60 bg-muted/[0.15] flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              <div>
                Showing <strong className="text-foreground">{totalItems === 0 ? 0 : skip + 1}</strong> –{' '}
                <strong className="text-foreground">{Math.min(skip + take, totalItems)}</strong> of{' '}
                <strong className="text-foreground">{totalItems}</strong> items
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 rounded-xl border-border/80 shadow-2xs"
                  disabled={skip === 0}
                  onClick={() => setSkip((s) => Math.max(0, s - take))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {Math.floor(skip / take) + 1} of {Math.max(1, Math.ceil(totalItems / take))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 rounded-xl border-border/80 shadow-2xs"
                  disabled={skip + take >= totalItems}
                  onClick={() => setSkip((s) => s + take)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── CUSTOM STOCK ADJUSTMENT DIALOG ── */}
        {/* ── CUSTOM STOCK ADJUSTMENT DIALOG ── */}
        {stockAdjustItem && (
          <Dialog open={!!stockAdjustItem} onOpenChange={(open) => !open && setStockAdjustItem(null)}>
            <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl bg-background [&>button:last-child]:hidden">
              {/* ── MODAL HEADER ── */}
              <DialogHeader className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md shrink-0 text-left sticky top-0 z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <DialogTitle className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                        <span>Adjust Stock Quantity</span>
                        {stockAdjustItem.inventoryCode && (
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {stockAdjustItem.inventoryCode}
                          </span>
                        )}
                      </DialogTitle>
                      <DialogDescription asChild>
                        <div className="text-xs text-muted-foreground leading-relaxed space-y-0.5">
                          <p>
                            Update inventory levels for <strong className="text-foreground">{stockAdjustItem.name}</strong>.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Current level: <strong className="text-foreground font-semibold">{stockAdjustItem.stock} {stockAdjustItem.unit || 'pcs'}</strong>
                          </p>
                        </div>
                      </DialogDescription>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStockAdjustItem(null)}
                    className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
                    title="Close modal"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </div>
              </DialogHeader>

              {/* ── FORM BODY ── */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* 1. Action Type Selection */}
                <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Adjustment Type
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustAction('Stock In')}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer shadow-2xs",
                        adjustAction === 'Stock In'
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                          : "bg-background/80 border-border/60 text-foreground hover:bg-muted/60"
                      )}
                    >
                      <ArrowUp className="h-4 w-4 shrink-0" />
                      <span className="truncate">Stock In (Add)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustAction('Stock Out')}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border font-bold text-xs transition-all cursor-pointer shadow-2xs",
                        adjustAction === 'Stock Out'
                          ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs"
                          : "bg-background/80 border-border/60 text-foreground hover:bg-muted/60"
                      )}
                    >
                      <ArrowDown className="h-4 w-4 shrink-0" />
                      <span className="truncate">Stock Out (Deduct)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Quantity & Presets */}
                <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <Boxes className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Quantity &amp; Amount
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <span>Quantity to {adjustAction === 'Stock In' ? 'Add' : 'Deduct'}</span>
                      <span className="text-destructive font-bold">*</span>
                    </Label>
                    <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                      <Input
                        type="number"
                        min={1}
                        value={adjustQuantity}
                        onChange={(e) => setAdjustQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="h-10 text-xs font-bold rounded-xl border-border/70 bg-background focus:bg-background transition-all shadow-2xs flex-1 min-w-0"
                      />
                      <div className="flex gap-1.5 shrink-0">
                        {[1, 5, 10].map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => setAdjustQuantity(qty)}
                            className={cn(
                              "h-10 px-3 sm:px-3.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0",
                              adjustQuantity === qty
                                ? "bg-sidebar text-white border-sidebar"
                                : "bg-background/80 border-border/60 text-foreground hover:bg-muted/60"
                            )}
                          >
                            +{qty}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Live Impact Preview Box */}
                <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <Activity className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Stock Level Impact
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-center">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-background/80 border border-border/60 shadow-2xs min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold truncate">Current</p>
                      <p className="text-xs sm:text-sm font-black text-foreground mt-0.5 font-mono truncate">
                        {stockAdjustItem.stock} <span className="text-[10px] font-normal text-muted-foreground">{stockAdjustItem.unit || 'pcs'}</span>
                      </p>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl bg-background/80 border border-border/60 shadow-2xs min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold truncate">Adjustment</p>
                      <p className={cn("text-xs sm:text-sm font-black mt-0.5 font-mono truncate", adjustAction === 'Stock In' ? 'text-emerald-600' : 'text-amber-600')}>
                        {adjustAction === 'Stock In' ? '+' : '-'}{adjustQuantity} <span className="text-[10px] font-normal text-muted-foreground">{stockAdjustItem.unit || 'pcs'}</span>
                      </p>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-xl bg-background/80 border border-border/60 shadow-2xs min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold truncate">Projected</p>
                      <p className="text-xs sm:text-sm font-black text-foreground mt-0.5 font-mono truncate">
                        {Math.max(0, adjustAction === 'Stock In' ? stockAdjustItem.stock + adjustQuantity : stockAdjustItem.stock - adjustQuantity)}{' '}
                        <span className="text-[10px] font-normal text-muted-foreground">{stockAdjustItem.unit || 'pcs'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Audit Note */}
                <div className="p-4 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                    <Tag className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Reason / Audit Note
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      placeholder="e.g. Shipment arrival, Sunday service use, Damaged replacement..."
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="h-10 text-xs rounded-xl border-border/70 bg-background focus:bg-background transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* ── MODAL FOOTER ── */}
              <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex items-center justify-end gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStockAdjustItem(null)}
                  className="rounded-xl text-xs h-9 px-4 font-semibold border-border/80 cursor-pointer hover:bg-muted/60 shrink-0"
                  disabled={isAdjusting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCustomStockAdjust}
                  className="rounded-xl text-xs h-9 px-5 font-bold bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer gap-1.5 shrink-0"
                  disabled={isAdjusting}
                >
                  {isAdjusting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Confirm {adjustAction}</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* ── QR CODE MODAL ── */}
        <QRModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} items={qrItems} />

        {/* ── ITEM EDIT / CREATE MODAL ── */}
        <ItemModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          item={modalItem}
          onSaved={loadData}
        />

        {/* ── FAST SCAN MODAL ── */}
        {isFastScanOpen && (
          <StockScanModal
            isOpen={isFastScanOpen}
            activeTab="items"
            onSwitchTab={(tab) => router.push(`/inventory?tab=${tab}`)}
            onClose={() => setIsFastScanOpen(false)}
            onStockUpdated={loadData}
          />
        )}

        {/* ── SINGLE DELETE CONFIRMATION ── */}
        {deleteConfirmId && (
          <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-3xl p-6 text-center border-border/80 shadow-2xl bg-background [&>button:last-child]:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName('');
                }}
                className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 mx-auto flex items-center justify-center mb-3 shadow-xs">
                <Trash2 className="h-6 w-6" />
              </div>
              <DialogHeader className="p-0 text-center sm:text-center space-y-1.5">
                <DialogTitle className="text-base sm:text-lg font-bold text-center font-headline text-foreground">
                  Delete Catalog Item
                </DialogTitle>
                <DialogDescription className="text-xs text-center text-muted-foreground leading-relaxed px-2">
                  Are you sure you want to proceed with <strong className="text-foreground">{deleteConfirmName}</strong>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2.5 mt-5">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs h-10 font-semibold border-border/80 hover:bg-muted/60 cursor-pointer"
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setDeleteConfirmName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl text-xs h-10 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  onClick={confirmDelete}
                >
                  Delete Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* ── BULK DELETE CONFIRMATION ── */}
        {bulkDeleteConfirm && (
          <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-3xl p-6 text-center border-border/80 shadow-2xl bg-background [&>button:last-child]:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBulkDeleteConfirm(false)}
                className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 mx-auto flex items-center justify-center mb-3 shadow-xs">
                <Trash2 className="h-6 w-6" />
              </div>
              <DialogHeader className="p-0 text-center sm:text-center space-y-1.5">
                <DialogTitle className="text-base sm:text-lg font-bold text-center font-headline text-foreground">
                  Delete Selected Items
                </DialogTitle>
                <DialogDescription className="text-xs text-center text-muted-foreground leading-relaxed px-2">
                  Are you sure you want to permanently delete <strong className="text-foreground">{selectedIds.size}</strong> selected items? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2.5 mt-5">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl text-xs h-10 font-semibold border-border/80 hover:bg-muted/60 cursor-pointer"
                  onClick={() => setBulkDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-xl text-xs h-10 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
                  onClick={confirmBulkDelete}
                >
                  Delete All
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* ── EXPORT CONFIRMATION MODAL (YES/NO) ── */}
        <ExportConfirmDialog
          open={showExportConfirm}
          onOpenChange={setShowExportConfirm}
          title="Export Inventory Report?"
          description="Do you want to export the inventory items, low stock alerts, and category summary as an Excel file (.xlsx)?"
          onConfirm={handleExportExcel}
        />
      </div>
    </TooltipProvider>
  );
}
