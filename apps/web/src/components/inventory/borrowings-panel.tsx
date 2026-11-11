"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  QrCode,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  X,
  Eye,
  Info,
  ShieldCheck,
  MoreHorizontal,
  Camera,
  ChevronDown,
  Pencil,
  Save,
  LoaderCircle,
  Lock,
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
  Textarea,
  Badge,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DatePicker,
} from '@studio/ui';
import { useInventory, type InventoryBorrowing } from '@/hooks/use-inventory';
import { useWorkers } from '@/hooks/use-workers';
import { useUserRole } from '@/hooks/use-user-role';
import { useAuthStore } from '@studio/store';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/export-excel';
import { ExportConfirmDialog } from '@/components/common/export-confirm-dialog';
import { BorrowingQRModal } from './borrowing-qr-modal';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';

export function BorrowingsPanel() {
  const { borrowings, totalBorrowings, loading, fetchBorrowings, items, fetchItems } = useInventory();
  const { workers } = useWorkers({ limit: 99999 });
  const { toast } = useToast();
  const { workerProfile } = useUserRole();
  const { user } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const take = 10;

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutItemId, setCheckoutItemId] = useState('');
  const [checkoutWorkerId, setCheckoutWorkerId] = useState('');
  const [checkoutDueDate, setCheckoutDueDate] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutCondition, setCheckoutCondition] = useState('Good Condition');
  const [checkoutChecklist, setCheckoutChecklist] = useState<Record<string, boolean>>({});
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Return Modal State
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState<InventoryBorrowing | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good Condition');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnChecklist, setReturnChecklist] = useState<Record<string, boolean>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnDamagePhoto, setReturnDamagePhoto] = useState<string | null>(null);
  const [isUploadingReturnPhoto, setIsUploadingReturnPhoto] = useState(false);
  const returnPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const handleReturnPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please select a valid image file (PNG, JPG, WEBP).',
      });
      return;
    }

    setIsUploadingReturnPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setReturnDamagePhoto(compressed);
          } else {
            setReturnDamagePhoto(reader.result as string);
          }
          setIsUploadingReturnPhoto(false);
        };
        img.onerror = () => {
          setReturnDamagePhoto(reader.result as string);
          setIsUploadingReturnPhoto(false);
        };
        img.src = reader.result;
      }
    };
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'Read Failed',
        description: 'Failed to read image file.',
      });
      setIsUploadingReturnPhoto(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Details Modal State
  const [detailsBorrowing, setDetailsBorrowing] = useState<InventoryBorrowing | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editReturnCondition, setEditReturnCondition] = useState('Good Condition');
  const [editReturnNotes, setEditReturnNotes] = useState('');
  const [editStatus, setEditStatus] = useState('RETURNED');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  useEffect(() => {
    if (detailsBorrowing) {
      setEditReturnCondition(detailsBorrowing.returnCondition || 'Good Condition');
      setEditReturnNotes(detailsBorrowing.returnNotes || '');
      setEditStatus(detailsBorrowing.status || 'RETURNED');
      setIsEditingDetails(false);
    }
  }, [detailsBorrowing]);

  const handleSaveDetails = async () => {
    if (!detailsBorrowing) return;

    const isReturned = detailsBorrowing.status === 'RETURNED';
    const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
    const isDamaged = cond.includes('damag') || cond.includes('repair') || cond.includes('replac') || cond.includes('sira') || cond.includes('ayos');
    if (isReturned && !isDamaged) {
      toast({
        variant: 'destructive',
        title: 'Record Locked',
        description: 'Returned equipment records cannot be edited unless marked as damaged.',
      });
      return;
    }

    setIsSavingDetails(true);
    try {
      const res = await fetch(`/api/borrowings/${detailsBorrowing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnCondition: editReturnCondition,
          returnNotes: editReturnNotes,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update borrowing record');
      }
      const updated = await res.json();
      setDetailsBorrowing(updated);
      setIsEditingDetails(false);
      toast({
        title: 'Record Updated',
        description: 'Borrowing status, condition, and maintenance notes updated successfully.',
      });
      loadData();
      fetchItems({ take: 200 });
      window.dispatchEvent(new CustomEvent('inventory-refresh'));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update borrowing details.',
      });
    } finally {
      setIsSavingDetails(false);
    }
  };
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);

  // Borrowing Transaction QR Modal
  const [qrBorrowing, setQrBorrowing] = useState<any | null>(null);

  const loadData = useCallback(() => {
    fetchBorrowings({
      skip: String(skip),
      take: String(take),
      ...(statusFilter && { status: statusFilter }),
    });
  }, [skip, take, statusFilter, fetchBorrowings]);

  useEffect(() => {
    loadData();
    fetchItems({ take: 200 });

    const handleRefreshEvent = () => {
      loadData();
    };
    window.addEventListener('inventory-refresh', handleRefreshEvent);
    return () => window.removeEventListener('inventory-refresh', handleRefreshEvent);
  }, [loadData, fetchItems]);

  useEffect(() => {
    fetch('/api/checklist-templates')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChecklistTemplates(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleExportEvent = () => setShowExportConfirm(true);
    window.addEventListener('trigger-inventory-export', handleExportEvent);
    return () => window.removeEventListener('trigger-inventory-export', handleExportEvent);
  }, []);

  const filteredBorrowings = useMemo(() => {
    return borrowings.filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.borrowerName?.toLowerCase().includes(q) ||
        b.borrowerEmail?.toLowerCase().includes(q) ||
        b.item?.name?.toLowerCase().includes(q) ||
        (b.item?.inventoryCode || '').toLowerCase().includes(q)
      );
    });
  }, [borrowings, search]);

  const stats = useMemo(() => {
    const active = borrowings.filter((b) => b.status === 'BORROWED').length;
    const returned = borrowings.filter((b) => b.status === 'RETURNED').length;
    const overdue = borrowings.filter(
      (b) => b.status === 'BORROWED' && b.dueDate && new Date(b.dueDate) < new Date()
    ).length;
    const total = totalBorrowings || borrowings.length;
    return { active, returned, overdue, total };
  }, [borrowings, totalBorrowings]);

  const checkoutTemplate = checklistTemplates.find((t) => t.type === 'checkout');
  const returnTemplate = checklistTemplates.find((t) => t.type === 'return');
  const returnTemplateItems = (returnTemplate?.items && returnTemplate.items.length > 0)
    ? returnTemplate.items
    : [
        { id: '1', label: 'Item returned complete (no missing parts)' },
        { id: '2', label: 'No new physical damage or dents' },
        { id: '3', label: 'Cleaned before return' },
        { id: '4', label: 'Power level acceptable' },
      ];
  const isReturnChecklistComplete = returnTemplateItems.every((item: any) => Boolean(returnChecklist[item.id]));

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutItemId) {
      toast({
        variant: 'destructive',
        title: 'Missing Item',
        description: 'Please select an item to checkout.',
      });
      return;
    }
    if (!checkoutWorkerId) {
      toast({
        variant: 'destructive',
        title: 'Missing Borrower',
        description: 'Please select a worker / borrower.',
      });
      return;
    }
    if (checkoutNotes && checkoutNotes.length > 500) {
      toast({
        variant: 'destructive',
        title: 'Notes Too Long',
        description: 'Notes must not exceed 500 characters.',
      });
      return;
    }

    const worker = workers?.find((w) => w.id === checkoutWorkerId);
    const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'Worker';

    setSubmittingCheckout(true);
    try {
      const res = await fetch('/api/borrowings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: checkoutItemId,
          borrowerId: checkoutWorkerId,
          borrowerName: workerName,
          dueDate: checkoutDueDate || null,
          checkoutNotes,
          checkoutCondition: 'Good Condition',
          checkoutChecklist,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to checkout');
      }

      toast({
        title: 'Checkout Successful',
        description: `Equipment checked out to ${workerName}.`,
      });

      setIsCheckoutOpen(false);
      setCheckoutItemId('');
      setCheckoutWorkerId('');
      setCheckoutDueDate('');
      setCheckoutNotes('');
      setCheckoutCondition('Good Condition');
      setCheckoutChecklist({});
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Failed',
        description: err.message,
      });
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowing) return;
    if (returnNotes && returnNotes.length > 500) {
      toast({
        variant: 'destructive',
        title: 'Notes Too Long',
        description: 'Inspection notes must not exceed 500 characters.',
      });
      return;
    }

    const isDamagedItem = returnCondition === 'Damaged';
    if (isDamagedItem && !returnDamagePhoto) {
      toast({
        variant: 'destructive',
        title: 'Photo Evidence Required',
        description: 'Please upload or capture a damage evidence photo before submitting a damaged return.',
      });
      return;
    }

    if (!isDamagedItem && !isReturnChecklistComplete) {
      toast({
        variant: 'destructive',
        title: 'Checklist Required',
        description: 'Please complete all items in the Return Inspection Checklist before completing the return.',
      });
      return;
    }

    setSubmittingReturn(true);
    try {
      const res = await fetch(`/api/borrowings/${selectedBorrowing.id}/return`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnNotes,
          returnCondition,
          returnChecklist,
          damaged: isDamagedItem,
          returnPhotos: returnDamagePhoto ? [returnDamagePhoto] : [],
          actorId: workerProfile?.id || user?.id || null,
          actorName: workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}`.trim() : (user?.displayName || user?.email || 'Staff'),
          actorEmail: user?.email || workerProfile?.email || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process return');
      }

      toast({
        title: isDamagedItem ? '⚠️ Return Completed (Flagged Damaged)' : 'Return Completed',
        description: isDamagedItem
          ? `${selectedBorrowing.item?.name || 'Item'} returned with damage reported. Photo evidence recorded.`
          : `${selectedBorrowing.item?.name || 'Item'} returned successfully.`,
      });

      setIsReturnOpen(false);
      setSelectedBorrowing(null);
      setReturnNotes('');
      setReturnDamagePhoto(null);
      setReturnChecklist({});
      loadData();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Return Failed',
        description: err.message,
      });
    } finally {
      setSubmittingReturn(false);
    }
  };

  const openReturnModal = (b: InventoryBorrowing) => {
    setSelectedBorrowing(b);
    setReturnCondition('Good Condition');
    setReturnNotes('');
    setReturnDamagePhoto(null);
    setReturnChecklist({});
    setIsReturnOpen(true);
  };

  const [showExportConfirm, setShowExportConfirm] = useState(false);

  // Export Excel
  const handleExportExcel = () => {
    const exportHeaders = [
      'Item Name',
      'Item Code',
      'Borrower Name',
      'Borrower Email',
      'Borrowed Date',
      'Due Date',
      'Returned Date',
      'Status',
      'Condition',
      'Notes',
    ];

    const exportRows = borrowings.map((b) => [
      b.item?.name || '—',
      b.item?.inventoryCode || '—',
      b.borrowerName || '—',
      b.borrowerEmail || '—',
      b.borrowedAt ? new Date(b.borrowedAt).toLocaleDateString() : '—',
      b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'N/A',
      b.returnedAt ? new Date(b.returnedAt).toLocaleDateString() : 'N/A',
      b.status,
      b.status === 'RETURNED' ? b.returnCondition || 'Good' : b.checkoutCondition || 'Good',
      b.status === 'RETURNED' ? b.returnNotes || '' : b.checkoutNotes || '',
    ]);

    const statusCounts: Record<string, number> = {};
    borrowings.forEach((b) => {
      const s = b.status || 'Active';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const summaryRows = Object.entries(statusCounts).map(([status, count]) => [
      status,
      count,
      borrowings.length > 0 ? `${Math.round((count / borrowings.length) * 100)}%` : '0%',
    ]);

    exportToExcel(`borrowings_export_${new Date().toISOString().split('T')[0]}.xlsx`, [
      {
        name: 'Borrowings List',
        data: [exportHeaders, ...exportRows],
        colWidths: [24, 16, 22, 26, 16, 16, 16, 14, 16, 30],
      },
      {
        name: 'Status Summary',
        data: [
          ['Total Borrowings', borrowings.length],
          [],
          ['Status', 'Count', 'Percentage'],
          ...summaryRows,
        ],
        colWidths: [20, 14, 14],
      },
    ]);

    toast({
      title: 'Export generated',
      description: `Exported ${borrowings.length} borrowing records to Excel.`,
    });
  };

  const getRelativeDueInfo = (dueDate?: string, status?: string) => {
    if (status === 'RETURNED') return null;
    if (!dueDate) return { text: 'No due date', isOverdue: false, isUrgent: false };
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true, isUrgent: true };
    }
    if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false, isUrgent: true };
    }
    if (diffDays === 1) {
      return { text: 'Due tomorrow', isOverdue: false, isUrgent: true };
    }
    return { text: `Due in ${diffDays}d`, isOverdue: false, isUrgent: false };
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ── OVERDUE ALERT BANNER ── */}
        {stats.overdue > 0 && (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between flex-wrap gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-bold">
                  {stats.overdue} Overdue Borrowing Item{stats.overdue > 1 ? 's' : ''} Detected!
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Some borrowed equipment has exceeded its return schedule. Please verify returns or follow up with workers.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="text-xs rounded-xl h-8 px-3 shadow-xs cursor-pointer"
              onClick={() => {
                setStatusFilter('BORROWED');
                setSkip(0);
              }}
            >
              Filter Overdue Items
            </Button>
          </div>
        )}

        {/* ── UNIFIED TOOLBAR & TABLE CONTAINER (Connect2Souls Style) ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200/80 dark:border-border shadow-xs p-5 sm:p-6 overflow-hidden flex flex-col gap-4">
          {/* Unified Single-Row Toolbar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input with Clear Button */}
            <div className="relative flex-1 min-w-[200px] max-w-full lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search borrower, item name, inventory code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
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

            {/* Right Controls Group in One Row */}
            <div className="flex flex-wrap items-center gap-2.5 justify-start lg:justify-end shrink-0">
              {/* Status Filter Dropdown with Counts */}
              <Select
                value={statusFilter || 'ALL'}
                onValueChange={(val) => {
                  setStatusFilter(val === 'ALL' ? '' : val);
                  setSkip(0);
                }}
              >
                <SelectTrigger className="h-10 w-[170px] text-xs font-medium rounded-2xl bg-white dark:bg-muted/30 border-slate-200/90 dark:border-border hover:bg-muted/50 transition-colors px-3 gap-2 shadow-2xs cursor-pointer">
                  <SelectValue placeholder="All Records" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-xs font-medium cursor-pointer">
                    All Records ({totalBorrowings || stats.total})
                  </SelectItem>
                  <SelectItem value="BORROWED" className="text-xs font-medium cursor-pointer">
                    Active Borrowed ({stats.active})
                  </SelectItem>
                  <SelectItem value="RETURNED" className="text-xs font-medium cursor-pointer">
                    Returned ({stats.returned})
                  </SelectItem>
                </SelectContent>
              </Select>

              {(search || statusFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setSkip(0);
                  }}
                  className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
              )}



              <Button
                size="sm"
                className="h-10 px-4 text-xs font-bold rounded-2xl gap-1.5 bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer"
                onClick={() => setIsCheckoutOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Checkout Item</span>
              </Button>
            </div>
          </div>

          {/* ── MASTER TABLE CONTAINER (Rounded Card inside White Container) ── */}
          <div className="border border-border/60 rounded-2xl overflow-hidden flex flex-col bg-card shadow-card-dark">
            {/* ── MOBILE / CARD LIST VIEW (Enhanced to match reference design) ── */}
            <div className="md:hidden p-3.5 sm:p-4 space-y-4 bg-muted/[0.15]">
              {loading && borrowings.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium">Loading borrowings...</span>
                </div>
              ) : filteredBorrowings.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground p-6 text-center bg-card rounded-2xl border border-border/60">
                  <Package className="h-8 w-8 text-muted-foreground/40" />
                  <span className="text-xs font-bold text-foreground">No borrowing records found</span>
                  <p className="text-[11px]">Try adjusting your search query or status filter.</p>
                </div>
              ) : (
                filteredBorrowings.map((b) => {
                  const isOverdue = b.status === 'BORROWED' && b.dueDate && new Date(b.dueDate) < new Date();
                  const dueInfo = getRelativeDueInfo(b.dueDate, b.status);
                  const codeDisplay = b.item?.inventoryCode || `BORROW-${b.id.slice(0, 6).toUpperCase()}`;
                  const borrowerInitials = b.borrowerName.trim().split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'BW';

                  return (
                    <div key={b.id} className="rounded-2xl overflow-hidden border border-border/70 shadow-2xs hover:shadow-sm transition-all bg-card">
                      {/* ── TOP HEADER BANNER (Dark Blue style matching right reference) ── */}
                      <div className="bg-sidebar px-4 py-3 flex items-center justify-between text-white shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-4 h-4 rounded-md border border-white/40 flex items-center justify-center shrink-0">
                            <Package className="h-2.5 w-2.5 text-white/80" />
                          </div>
                          <span className="font-mono font-bold text-xs tracking-wider text-white truncate">
                            {codeDisplay}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs",
                              b.status === 'RETURNED'
                                ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                                : isOverdue
                                ? "bg-rose-500/25 text-rose-200 border-rose-400/40 animate-pulse"
                                : "bg-amber-400/20 text-amber-200 border-amber-300/40"
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                b.status === 'RETURNED'
                                  ? "bg-emerald-400"
                                  : isOverdue
                                  ? "bg-rose-400"
                                  : "bg-amber-400"
                              )}
                            />
                            <span>{b.status === 'RETURNED' ? 'Returned' : isOverdue ? 'Overdue' : 'Borrowed'}</span>
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                title="Actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border border-border bg-popover">
                              <DropdownMenuItem
                                onClick={() => setDetailsBorrowing(b)}
                                className="cursor-pointer text-xs font-medium"
                              >
                                <Eye className="h-3.5 w-3.5 mr-2" /> Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setQrBorrowing(b)}
                                className="cursor-pointer text-xs font-medium"
                              >
                                <QrCode className="h-3.5 w-3.5 mr-2 text-sky-600" /> Transaction QR
                              </DropdownMenuItem>
                              {b.status === 'BORROWED' && (
                                <DropdownMenuItem
                                  onClick={() => openReturnModal(b)}
                                  className="cursor-pointer text-xs font-bold text-emerald-600 focus:text-emerald-700"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Return Item
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* ── CARD BODY ── */}
                      <div className="p-4 sm:p-5 space-y-4 bg-white dark:bg-card">
                        {/* Title & Subtitle */}
                        <div className="space-y-0.5">
                          <h4 className="text-base sm:text-lg font-bold font-headline text-foreground leading-snug truncate">
                            {b.item?.name || 'Equipment'}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {(b.item as any)?.category?.name || b.item?.status || 'Active Asset'} &bull; {(b as any).quantity || 1} {(b.item as any)?.unit || 'pcs'}
                          </p>
                        </div>

                        {/* Borrower User Row */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-sidebar/10 text-sidebar dark:text-sky-400 flex items-center justify-center font-black text-xs shrink-0 border border-sidebar/20 shadow-2xs">
                            {borrowerInitials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">{b.borrowerName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {b.borrowerEmail || 'Church Worker / Volunteer'}
                            </p>
                          </div>
                        </div>

                        {/* 2x2 Grid Info Box (matching ROOM / DATE & TIME / HEADCOUNT / CREATED layout) */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-muted/20 border border-slate-200/80 dark:border-border/60 grid grid-cols-2 gap-3.5 text-xs shadow-2xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              BORROWED
                            </span>
                            <span className="font-bold text-foreground text-xs block truncate">
                              {b.borrowedAt ? new Date(b.borrowedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              DUE SCHEDULE
                            </span>
                            <span className={cn("font-bold text-xs block truncate", isOverdue ? "text-destructive" : "text-foreground")}>
                              {dueInfo?.text || 'Open Schedule'}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              CONDITION
                            </span>
                            <span className="font-bold text-foreground text-xs block truncate">
                              {b.status === 'RETURNED' ? b.returnCondition || 'Returned' : b.checkoutCondition || 'Good Condition'}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              QUANTITY
                            </span>
                            <span className="font-bold text-foreground text-xs block truncate">
                              {(b as any).quantity || 1} {(b.item as any)?.unit || 'pcs'}
                            </span>
                          </div>
                        </div>

                        {/* Condition Notes Banner */}
                        {(b.checkoutNotes || b.returnNotes) && (
                          <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50 leading-relaxed italic">
                            "{b.status === 'RETURNED' ? b.returnNotes || 'No return notes' : b.checkoutNotes || 'Standard checkout'}"
                          </div>
                        )}

                        {b.returnPhotos && b.returnPhotos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDetailsBorrowing(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer w-fit"
                          >
                            <Camera className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>{b.returnPhotos.length} Damage Photo Evidence in DB (View)</span>
                          </button>
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── DESKTOP REFINED TABLE VIEW (Matching other tabs) ── */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-sidebar hover:bg-sidebar border-b border-sidebar-border/40 whitespace-nowrap">
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider pl-4 bg-sidebar whitespace-nowrap min-w-[170px]">
                      Item Details
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap min-w-[130px]">
                      Borrower
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap min-w-[100px]">
                      Borrowed Date
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap min-w-[125px]">
                      Returned Date
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap min-w-[130px]">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider bg-sidebar whitespace-nowrap min-w-[140px]">
                      Condition
                    </TableHead>
                    <TableHead className="text-[11px] font-bold text-white uppercase tracking-wider text-right pr-8 bg-sidebar whitespace-nowrap w-24 sticky right-0 z-20 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.15)]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && borrowings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs font-semibold">Loading borrowing records...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredBorrowings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="h-8 w-8 text-muted-foreground/40" />
                          <span className="text-xs font-bold text-foreground">No borrowing records found</span>
                          <p className="text-[11px] max-w-sm text-muted-foreground">
                            {search || statusFilter
                              ? 'No records match your active search or status filters.'
                              : 'There are currently no equipment checkouts recorded.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBorrowings.map((b) => {
                      const isOverdue = b.status === 'BORROWED' && b.dueDate && new Date(b.dueDate) < new Date();
                      const dueInfo = getRelativeDueInfo(b.dueDate, b.status);

                      return (
                        <TableRow
                          key={b.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-muted/20 border-b border-slate-100 dark:border-border/40 transition-colors group"
                        >
                          {/* 1. Item Details */}
                          <TableCell className="pl-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/70 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs group-hover:border-primary/40 transition-colors">
                                {b.item?.imageUrl ? (
                                  <img src={b.item.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground/60" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs md:text-sm leading-tight text-foreground truncate max-w-[220px]">
                                  {b.item?.name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono font-bold text-xs text-foreground">
                                    {b.item?.inventoryCode || b.itemId.slice(0, 8)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* 2. Borrower */}
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                                {b.borrowerName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">{b.borrowerName}</div>
                                {b.borrowerEmail ? (
                                  <div className="text-[11px] text-muted-foreground truncate">{b.borrowerEmail}</div>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">Church Worker</div>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* 3. Borrowed Date */}
                          <TableCell className="py-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                              <span>{b.borrowedAt ? new Date(b.borrowedAt).toLocaleDateString() : '—'}</span>
                            </div>
                          </TableCell>

                          {/* 4. Returned Date */}
                          <TableCell className="py-3">
                            {b.returnedAt ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>{new Date(b.returnedAt).toLocaleDateString()}</span>
                              </div>
                            ) : b.status === 'RETURNED' ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Returned</span>
                              </div>
                            ) : b.dueDate ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs font-medium">
                                  <Clock className={`h-3.5 w-3.5 shrink-0 ${isOverdue ? 'text-destructive' : 'text-muted-foreground/70'}`} />
                                  <span className={isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                                    {new Date(b.dueDate).toLocaleDateString()}
                                  </span>
                                </div>
                                {b.status === 'BORROWED' && dueInfo && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 font-bold ${
                                      isOverdue
                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                        : dueInfo.isUrgent
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                        : 'bg-muted text-muted-foreground border-border/70'
                                    }`}
                                  >
                                    {dueInfo.text}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/70">—</span>
                            )}
                          </TableCell>

                          {/* 5. Status Badge */}
                          <TableCell className="py-3 whitespace-nowrap min-w-[130px]">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${
                                b.status === 'RETURNED'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : isOverdue
                                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse'
                                  : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  b.status === 'RETURNED'
                                    ? 'bg-emerald-500'
                                    : isOverdue
                                    ? 'bg-red-500'
                                    : 'bg-sky-500'
                                }`}
                              />
                              <span className="whitespace-nowrap">{b.status === 'RETURNED' ? 'Returned' : isOverdue ? 'Overdue' : 'Active Borrowed'}</span>
                            </span>
                          </TableCell>

                          {/* 6. Condition Only */}
                          <TableCell className="py-3 text-xs text-foreground min-w-[140px]">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                                (b.status === 'RETURNED' ? b.returnCondition : b.checkoutCondition)?.toLowerCase().includes('damage')
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                  : (b.status === 'RETURNED' ? b.returnCondition : b.checkoutCondition)?.toLowerCase().includes('wear')
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              )}
                            >
                              {b.status === 'RETURNED'
                                ? b.returnCondition || 'Good Condition'
                                : b.checkoutCondition || 'Good Condition'}
                            </Badge>
                          </TableCell>

                          {/* 7. Actions */}
                          <TableCell className="py-3 text-right pr-8 w-24 sticky right-0 z-10 bg-card group-hover:bg-slate-50 dark:group-hover:bg-muted/40 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.06)]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 mr-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center justify-center"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border-border/80">
                                <DropdownMenuItem
                                  onClick={() => setDetailsBorrowing(b)}
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  View Details
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => setQrBorrowing(b)}
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                >
                                  <QrCode className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                  Print Borrowing QR
                                </DropdownMenuItem>

                                {b.status === 'BORROWED' && (
                                  <DropdownMenuItem
                                    onClick={() => openReturnModal(b)}
                                    className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 text-emerald-600 dark:text-emerald-400"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    Return Item
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── PAGINATION FOOTER (Matching other tabs) ── */}
            <div className="p-4 border-t border-border/60 bg-muted/[0.15] flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              <div>
                Showing <strong className="text-foreground">{totalBorrowings === 0 ? 0 : skip + 1}</strong> –{' '}
                <strong className="text-foreground">{Math.min(skip + take, totalBorrowings)}</strong> of{' '}
                <strong className="text-foreground">{totalBorrowings}</strong> records
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 rounded-xl border-border/80 shadow-2xs"
                  disabled={skip === 0}
                  onClick={() => setSkip((s) => Math.max(0, s - take))}
                  title="Previous Page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {Math.floor(skip / take) + 1} of {Math.max(1, Math.ceil(totalBorrowings / take))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 rounded-xl border-border/80 shadow-2xs"
                  disabled={skip + take >= totalBorrowings}
                  onClick={() => setSkip((s) => s + take)}
                  title="Next Page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── CHECKOUT MODAL (ENHANCED PREMIUM DESIGN) ── */}
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
            {/* ── STICKY MODAL HEADER ── */}
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
              <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs">
                    <ArrowUpCircle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <DialogTitle className="text-base font-bold font-headline text-foreground">
                      Equipment Checkout Form
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Assign inventory equipment or kit bundles to a church worker or volunteer.
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </DialogHeader>

            <form onSubmit={handleCheckoutSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full min-w-0">
              {/* Equipment Item Selection */}
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Select Equipment / SKU *</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Available items with stock &gt; 0</span>
                </Label>
                <Select
                  value={checkoutItemId}
                  onValueChange={(val) => setCheckoutItemId(val)}
                  required
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-2xs font-medium cursor-pointer">
                    <SelectValue placeholder="Select Equipment..." />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2.5rem)] sm:max-w-md max-h-60 rounded-xl">
                    {items
                      .filter((i) => i.type === 'EQUIPMENT' && i.stock > 0)
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id} className="text-xs cursor-pointer truncate">
                          <span className="truncate">
                            {i.name} ({i.stock} avail) {i.inventoryCode ? `[${i.inventoryCode}]` : ''} {i.isKit ? '★ KIT' : ''}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Borrower Worker Selection */}
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-bold text-foreground">Borrower (Assigned Worker) *</Label>
                <Select
                  value={checkoutWorkerId}
                  onValueChange={(val) => setCheckoutWorkerId(val)}
                  required
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-2xs font-medium cursor-pointer">
                    <SelectValue placeholder="Select Worker..." />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2.5rem)] sm:max-w-md max-h-60 rounded-xl">
                    {workers
                      ?.filter((w) => w.status === 'Active')
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-xs cursor-pointer truncate">
                          <span className="truncate">
                            {w.firstName} {w.lastName} ({w.employmentType || 'Worker'})
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Expected Return Date with Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Expected Return Date</Label>
                  <span className="text-[10px] text-muted-foreground">Optional</span>
                </div>
                <DatePicker
                  value={checkoutDueDate}
                  onChange={(date) => setCheckoutDueDate(date)}
                  placeholder="dd/mm/yyyy"
                  className="w-full h-9 text-xs rounded-xl"
                  align="start"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      setCheckoutDueDate(d.toISOString().slice(0, 10));
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setCheckoutDueDate(d.toISOString().slice(0, 10));
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setCheckoutDueDate(d.toISOString().slice(0, 10));
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    +1 Week
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      setCheckoutDueDate(d.toISOString().slice(0, 10));
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                  >
                    +2 Weeks
                  </button>
                  {checkoutDueDate && (
                    <button
                      type="button"
                      onClick={() => setCheckoutDueDate('')}
                      className="text-[11px] px-2 py-0.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-medium transition-colors cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Condition at Checkout */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Condition at Checkout</Label>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Fixed
                  </span>
                </div>
                <div className="relative">
                  <Input
                    value="Good Condition"
                    readOnly
                    tabIndex={-1}
                    className="h-9 text-xs rounded-xl bg-muted/40 border border-border/70 text-foreground font-medium cursor-not-allowed select-none focus-visible:ring-0 focus-visible:border-border/70 pr-8"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 pointer-events-none">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Checklist items */}
              {checkoutTemplate?.items && checkoutTemplate.items.length > 0 && (
                <div className="space-y-2 p-3 bg-muted/30 border border-border/70 rounded-xl">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Checkout Verification Checklist
                  </Label>
                  <div className="space-y-1.5 pt-1">
                    {checkoutTemplate.items.map((item: any) => (
                      <label key={item.id} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground">
                        <Checkbox
                          checked={checkoutChecklist[item.id] || false}
                          onCheckedChange={(c) =>
                            setCheckoutChecklist({ ...checkoutChecklist, [item.id]: Boolean(c) })
                          }
                        />
                        <span className="font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Purpose / Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Notes / Purpose</Label>
                <Input
                  value={checkoutNotes}
                  maxLength={500}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="e.g. Sunday 2nd Service Audio setup / Youth Camp"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              </div>

              {/* ── STICKY MODAL FOOTER ── */}
              <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-2.5 w-full min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCheckout}
                  className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer flex-1 sm:flex-initial"
                >
                  {submittingCheckout ? 'Processing Checkout...' : 'Confirm Checkout'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── RETURN MODAL (ENHANCED PREMIUM DESIGN) ── */}
        <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
            {/* ── STICKY MODAL HEADER ── */}
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
              <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-2xs">
                    <ArrowDownCircle className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <DialogTitle className="text-base font-bold font-headline text-foreground">
                      Equipment Check-in &amp; Return
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Verify item condition and restore item back into available stock.
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReturnOpen(false)}
                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </DialogHeader>

            {selectedBorrowing && (
              <form onSubmit={handleReturnSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full min-w-0">
                {/* Item & Borrower Card Banner */}
                <div className="p-3.5 bg-muted/30 border border-border/70 rounded-xl space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border/70 overflow-hidden flex items-center justify-center shrink-0">
                      {selectedBorrowing.item?.imageUrl ? (
                        <img src={selectedBorrowing.item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-foreground truncate">{selectedBorrowing.item?.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {selectedBorrowing.item?.inventoryCode || 'No barcode'}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Borrower: <strong className="text-foreground">{selectedBorrowing.borrowerName}</strong>
                    </span>
                    <span>
                      Borrowed: {selectedBorrowing.borrowedAt ? new Date(selectedBorrowing.borrowedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>

                {/* Return Condition */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Return Condition</Label>
                  <div className="relative">
                    <select
                      className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background pl-3.5 pr-10 py-2 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring font-medium text-foreground cursor-pointer transition-colors"
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value)}
                    >
                      <option value="Good Condition">Good Condition (No issues)</option>
                      <option value="Minor Wear">Minor Wear (Functional)</option>
                      <option value="Damaged">Damaged / Needs Maintenance</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Photo Upload Section: Damaged (Required), Minor Wear (Optional), Good Condition (Hidden) */}
                {(returnCondition === 'Damaged' || returnCondition === 'Minor Wear') && (
                  <div
                    className={cn(
                      "space-y-2 p-3 rounded-2xl border-2 border-dashed animate-in fade-in zoom-in-95 duration-200",
                      returnCondition === 'Damaged'
                        ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40"
                        : "bg-muted/40 dark:bg-muted/20 border-border/80"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Camera
                          className={cn(
                            "h-4 w-4",
                            returnCondition === 'Damaged'
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          )}
                        />
                        <label
                          className={cn(
                            "text-xs font-bold",
                            returnCondition === 'Damaged'
                              ? "text-amber-900 dark:text-amber-200"
                              : "text-foreground"
                          )}
                        >
                          {returnCondition === 'Damaged'
                            ? 'Damage Evidence Photo'
                            : 'Condition Photo (Minor Wear)'}
                        </label>
                      </div>
                      {returnCondition === 'Damaged' ? (
                        <Badge className="bg-destructive hover:bg-destructive text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 text-destructive-foreground">
                          Required *
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 text-muted-foreground border-border/70"
                        >
                          Optional
                        </Badge>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-[11px] leading-snug",
                        returnCondition === 'Damaged'
                          ? "text-amber-900/80 dark:text-amber-200/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {returnCondition === 'Damaged'
                        ? 'A clear photo of the damage is required for verification before processing the return.'
                        : 'You can upload a photo of minor wear or scratches (optional for inspection records).'}
                    </p>

                    <input
                      ref={returnPhotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleReturnPhotoSelect}
                      disabled={submittingReturn || isUploadingReturnPhoto}
                    />

                    {returnDamagePhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-border/80 bg-background/90 shadow-xs">
                        <div className="relative aspect-video w-full max-h-48 bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                          <img
                            src={returnDamagePhoto}
                            alt="Return condition evidence"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-2 bg-background/95 border-t border-border/60 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Photo Attached
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => returnPhotoInputRef.current?.click()}
                              disabled={submittingReturn}
                              className="h-7 px-2 text-[11px] rounded-lg cursor-pointer"
                            >
                              Change
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setReturnDamagePhoto(null)}
                              disabled={submittingReturn}
                              className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => !isUploadingReturnPhoto && returnPhotoInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-border/80 bg-background/60 hover:bg-muted/30 transition-colors text-center group"
                      >
                        <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <Camera className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-foreground">
                          {isUploadingReturnPhoto ? 'Processing photo...' : 'Take Photo or Upload Image'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Tap to open camera or browse files (JPG, PNG)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Return Checklist */}
                {returnTemplateItems.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/30 border border-border/70 rounded-xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Return Inspection Checklist
                      </Label>
                      {returnCondition !== 'Damaged' && (
                        <span className="text-[10px] text-destructive font-bold uppercase tracking-wider bg-destructive/10 px-2 py-0.5 rounded-md">
                          Required *
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {returnTemplateItems.map((item: any) => (
                        <label key={item.id} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground">
                          <Checkbox
                            checked={returnChecklist[item.id] || false}
                            onCheckedChange={(c) =>
                              setReturnChecklist({ ...returnChecklist, [item.id]: Boolean(c) })
                            }
                          />
                          <span className="font-medium">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Inspection Notes</Label>
                  <Input
                    value={returnNotes}
                    maxLength={500}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Returned clean, fully functional, battery at 90%"
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                </div>

                {/* ── STICKY MODAL FOOTER ── */}
                <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-2.5 w-full min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsReturnOpen(false)}
                    className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submittingReturn ||
                      (returnCondition === 'Damaged' ? !returnDamagePhoto : !isReturnChecklistComplete)
                    }
                    className={cn(
                      "min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer flex-1 sm:flex-initial",
                      returnCondition === 'Damaged'
                        ? (!returnDamagePhoto
                            ? "bg-amber-600/60 hover:bg-amber-600/60 text-white cursor-not-allowed opacity-80"
                            : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20")
                        : (!isReturnChecklistComplete
                            ? "bg-emerald-600/60 hover:bg-emerald-600/60 text-white cursor-not-allowed opacity-80"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white")
                    )}
                  >
                    {submittingReturn
                      ? 'Processing Return...'
                      : returnCondition === 'Damaged'
                      ? (!returnDamagePhoto
                          ? 'Photo Required'
                          : 'Flag as Damaged')
                      : (!isReturnChecklistComplete
                          ? 'Checklist Required'
                          : 'Complete Return')}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ── RECORD DETAILS MODAL ── */}
        <Dialog open={Boolean(detailsBorrowing)} onOpenChange={(open) => !open && setDetailsBorrowing(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-md max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
            {/* ── STICKY MODAL HEADER ── */}
            <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
              <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-2xs mt-0.5">
                    <Info className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <DialogTitle className="text-base font-bold font-headline text-foreground">
                      Borrowing Record Details
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Complete information for this equipment assignment.
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailsBorrowing(null)}
                  className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </DialogHeader>

            {detailsBorrowing && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full min-w-0 text-xs">
                {/* Item Banner */}
                <div className="p-3 bg-muted/30 border border-border/70 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted border overflow-hidden flex items-center justify-center shrink-0">
                    {detailsBorrowing.item?.imageUrl ? (
                      <img src={detailsBorrowing.item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/60" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{detailsBorrowing.item?.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Code: {detailsBorrowing.item?.inventoryCode || detailsBorrowing.itemId}
                    </p>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Borrower
                    </span>
                    <span className="font-bold text-foreground mt-0.5 block">{detailsBorrowing.borrowerName}</span>
                    {detailsBorrowing.borrowerEmail && (
                      <span className="text-[10px] text-muted-foreground truncate block">{detailsBorrowing.borrowerEmail}</span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Status
                    </span>
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          detailsBorrowing.status === 'RETURNED'
                            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                            : 'bg-sky-500/10 text-sky-700 border-sky-500/30'
                        }`}
                      >
                        {detailsBorrowing.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Borrowed Date
                    </span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {detailsBorrowing.borrowedAt ? new Date(detailsBorrowing.borrowedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Returned Date
                    </span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {detailsBorrowing.returnedAt
                        ? new Date(detailsBorrowing.returnedAt).toLocaleDateString()
                        : detailsBorrowing.status === 'RETURNED'
                        ? 'Returned'
                        : detailsBorrowing.dueDate
                        ? new Date(detailsBorrowing.dueDate).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Notes & Condition */}
                <div className="space-y-3 p-3.5 rounded-xl bg-muted/20 border border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Condition &amp; Notes
                    </span>
                    {!isEditingDetails && (
                      (() => {
                        const isReturned = detailsBorrowing.status === 'RETURNED';
                        const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
                        const isDamaged = cond.includes('damag') || cond.includes('repair') || cond.includes('replac') || cond.includes('sira') || cond.includes('ayos');
                        const canEdit = !isReturned || isDamaged;

                        return canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingDetails(true)}
                            className="h-7 px-2.5 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Edit Status / Notes
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80 bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                            <Lock className="h-3 w-3" /> Returned (Locked)
                          </span>
                        );
                      })()
                    )}
                  </div>

                  {isEditingDetails ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Equipment Condition</Label>
                          <Select value={editReturnCondition} onValueChange={setEditReturnCondition}>
                            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Good Condition" className="text-xs font-medium">Good Condition</SelectItem>
                              <SelectItem value="Damaged" className="text-xs text-destructive font-semibold">Damaged</SelectItem>
                              <SelectItem value="Repaired" className="text-xs text-emerald-600 font-semibold">Repaired</SelectItem>
                              <SelectItem value="Replaced" className="text-xs text-blue-600 font-semibold">Replaced</SelectItem>
                              <SelectItem value="Under Repair" className="text-xs text-amber-600 font-semibold">Under Repair / Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Borrowing Status</Label>
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RETURNED" className="text-xs font-medium">RETURNED</SelectItem>
                              <SelectItem value="BORROWED" className="text-xs font-medium">BORROWED</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Maintenance / Replacement Notes</Label>
                        <Textarea
                          value={editReturnNotes}
                          maxLength={1000}
                          onChange={(e) => setEditReturnNotes(e.target.value)}
                          placeholder="Describe any parts that were damaged, repaired, or replaced (e.g., Replaced camera lens, repaired charging port)..."
                          className="text-xs rounded-xl min-h-[75px] bg-background resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs space-y-2">
                      <p>
                        <strong>Checkout Condition:</strong> {detailsBorrowing.checkoutCondition || 'Good'}
                      </p>
                      {detailsBorrowing.checkoutNotes && (
                        <p className="text-muted-foreground">
                          <strong>Checkout Notes:</strong> {detailsBorrowing.checkoutNotes}
                        </p>
                      )}
                      {detailsBorrowing.status === 'RETURNED' && (
                        <>
                          <div className="flex items-center gap-2">
                            <strong>Return Condition:</strong>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold",
                                (detailsBorrowing.returnCondition || '').toLowerCase().includes('damage')
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  : ['repaired', 'replaced', 'naayos', 'napalitan'].some(k => (detailsBorrowing.returnCondition || '').toLowerCase().includes(k))
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              )}
                            >
                              {detailsBorrowing.returnCondition || 'Good'}
                            </Badge>
                          </div>
                          {detailsBorrowing.returnNotes && (
                            <div className="text-muted-foreground bg-background/80 p-2.5 rounded-xl border border-border/60">
                              <strong className="text-foreground">Maintenance / Damage Notes:</strong>
                              <p className="mt-0.5 whitespace-pre-wrap">{detailsBorrowing.returnNotes}</p>
                            </div>
                          )}
                          {detailsBorrowing.returnedAt && (
                            <p className="text-muted-foreground">
                              <strong>Returned Date:</strong> {new Date(detailsBorrowing.returnedAt).toLocaleDateString()}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {detailsBorrowing.returnPhotos && detailsBorrowing.returnPhotos.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-[11px] font-bold text-destructive flex items-center gap-1 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Damage Photo Evidence:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {detailsBorrowing.returnPhotos.map((photo: string, idx: number) => (
                          <a
                            key={idx}
                            href={photo}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-video rounded-lg overflow-hidden border border-border/70 bg-black/5 hover:opacity-90 transition-opacity block group"
                          >
                            <img
                              src={photo}
                              alt={`Damage evidence ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-semibold transition-opacity">
                              View Full
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                </div>

                {/* ── STICKY MODAL FOOTER ── */}
                <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2 w-full min-w-0">
                  {isEditingDetails ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
                        onClick={() => setIsEditingDetails(false)}
                        disabled={isSavingDetails}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold bg-sidebar hover:bg-sidebar/90 text-white cursor-pointer flex-1 sm:flex-initial shadow-xs"
                        onClick={handleSaveDetails}
                        disabled={isSavingDetails}
                      >
                        {isSavingDetails ? (
                          <><LoaderCircle className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</>
                        ) : (
                          <><Save className="h-4 w-4 mr-1.5" /> Save Updates</>
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold border-sidebar/30 text-sidebar hover:bg-sidebar/10 cursor-pointer flex-1 sm:flex-initial"
                        onClick={() => setIsEditingDetails(true)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Status &amp; Notes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-semibold border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
                        onClick={() => setDetailsBorrowing(null)}
                      >
                        Close
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── BORROWING TRANSACTION QR MODAL ── */}
        {qrBorrowing && (
          <BorrowingQRModal
            isOpen={Boolean(qrBorrowing)}
            onClose={() => setQrBorrowing(null)}
            borrowing={qrBorrowing}
          />
        )}

        {/* ── EXPORT CONFIRMATION MODAL (YES/NO) ── */}
        <ExportConfirmDialog
          open={showExportConfirm}
          onOpenChange={setShowExportConfirm}
          title="Export Borrowings Report?"
          description="Do you want to export borrowing records and status summary as an Excel file (.xlsx) with clean, organized formatting?"
          onConfirm={handleExportExcel}
        />
      </div>
    </TooltipProvider>
  );
}
