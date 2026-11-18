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
  Wrench,
  Upload,
  Trash2,
  CheckCircle,
  Check,
  AlertOctagon,
  FileDown,
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
import { generateIncidentReportPDF, type IncidentReportData } from '@/lib/generate-incident-report';

const CAMERA_EQUIPMENT_PRESETS = [
  'Lens',
  'Battery',
  'SD Card',
  'Tripod',
  'Power Cord',
  'Charger',
  'Camera Bag',
  'Microphone',
];

const getBorrowingInclusions = (b: any): string[] => {
  if (!b) return [];
  const checklist = b.checkoutChecklist;
  if (checklist && typeof checklist === 'object' && Array.isArray((checklist as any).includedEquipment)) {
    return (checklist as any).includedEquipment;
  }
  const notes = b.checkoutNotes || '';
  if (notes.includes('Included Equipment:')) {
    const match = notes.match(/Included Equipment:\s*([^\n|]+)/);
    if (match && match[1]) {
      return match[1].split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

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

  // Equipment & Accessories Inclusions State
  const [checkoutIncludedEquipment, setCheckoutIncludedEquipment] = useState<string[]>([]);
  const [customAccessoryInput, setCustomAccessoryInput] = useState('');

  // Return Modal State
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState<InventoryBorrowing | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good Condition');
  const [returnInclusions, setReturnInclusions] = useState<string[]>([]);
  const [returnInclusionChecks, setReturnInclusionChecks] = useState<Record<string, boolean>>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [returnChecklist, setReturnChecklist] = useState<Record<string, boolean>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnDamagePhoto, setReturnDamagePhoto] = useState<string | null>(null);
  const [isUploadingReturnPhoto, setIsUploadingReturnPhoto] = useState(false);
  const [returnResolutionDeadline, setReturnResolutionDeadline] = useState('');
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
  const [resolveEvidencePhoto, setResolveEvidencePhoto] = useState<string | null>(null);
  const [isUploadingResolvePhoto, setIsUploadingResolvePhoto] = useState(false);
  const [restoreMainStock, setRestoreMainStock] = useState(true);
  const [resolveInclusionChecks, setResolveInclusionChecks] = useState<Record<string, boolean>>({});
  const [editDueDate, setEditDueDate] = useState('');
  const resolvePhotoInputRef = React.useRef<HTMLInputElement>(null);

  // Incident PDF Report
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleDownloadIncidentReport = useCallback(async (b: InventoryBorrowing) => {
    setIsGeneratingReport(true);
    try {
      const cond = (b.returnCondition || '').toLowerCase();
      const isLost = cond.includes('lost') || cond.includes('nawala');
      const isMissing = cond.includes('missing');
      const incidentType: IncidentReportData['incidentType'] = isLost ? 'LOST' : isMissing ? 'MISSING' : 'DAMAGED';

      const issuedAccessories = getBorrowingInclusions(b);
      const retIncs: Record<string, boolean> = (b as any)?.returnChecklist?.returnedInclusions || {};
      const missingItems: string[] = Array.isArray((b as any)?.returnChecklist?.missingItems)
        ? (b as any).returnChecklist.missingItems
        : [];
      const missingAccessories = issuedAccessories.filter(
        (acc) => retIncs[acc] === false || missingItems.includes(acc)
      );

      const reportData: IncidentReportData = {
        reportId: `RPT-${b.id?.slice(-8).toUpperCase()}`,
        reportDate: new Date().toISOString(),
        reportedBy: workerProfile
          ? `${workerProfile.firstName} ${workerProfile.lastName}`.trim()
          : (user?.displayName || user?.email || 'Staff'),
        itemName: b.item?.name || 'Unknown Item',
        itemCode: b.item?.inventoryCode || undefined,
        itemCategory: (b.item as any)?.category?.name || undefined,
        borrowerName: b.borrowerName || 'Unknown',
        borrowerEmail: b.borrowerEmail || undefined,
        borrowerWorkerId: (b.borrower as any)?.workerId || undefined,
        borrowedAt: b.borrowedAt ? String(b.borrowedAt) : undefined,
        dueDate: b.dueDate ? String(b.dueDate) : undefined,
        returnedAt: b.returnedAt ? String(b.returnedAt) : undefined,
        borrowingId: b.id,
        incidentType,
        returnCondition: b.returnCondition || '—',
        returnNotes: b.returnNotes || undefined,
        damagePhotoUrl: (b as any)?.returnPhotos?.[0] || undefined,
        issuedAccessories: issuedAccessories.length > 0 ? issuedAccessories : undefined,
        returnedAccessories: issuedAccessories.length > 0 ? retIncs : undefined,
        missingAccessories: missingAccessories.length > 0 ? missingAccessories : undefined,
        resolutionDeadline: b.dueDate ? String(b.dueDate) : undefined,
        resolutionStatus: b.status === 'RETURNED' ? 'Resolved' : 'Pending',
        resolutionNotes: (b as any)?.resolutionNotes || undefined,
        resolutionPhotoUrl: (b as any)?.resolutionPhoto || undefined,
      };

      await generateIncidentReportPDF(reportData);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Report Generation Failed',
        description: err?.message || 'Could not generate the incident report PDF.',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [workerProfile, user, toast]);

  const isDamagedPendingRecord = useCallback((b: any) => {
    if (!b) return false;
    if (b.status === 'PENDING') return true;
    const cond = (b.returnCondition || '').toLowerCase();
    const isProblemCond = cond.includes('damag') || cond.includes('sira') || cond.includes('lost') || cond.includes('nawala') || cond.includes('missing');
    return isProblemCond && !['resolved', 'repaired', 'replaced', 'naayos', 'napalitan'].some(k => cond.includes(k));
  }, []);

  const openDetailsModal = useCallback((b: InventoryBorrowing) => {
    setDetailsBorrowing(b);
    const cond = (b.returnCondition || '').toLowerCase();
    const isLost = cond.includes('lost') || cond.includes('nawala');
    setEditReturnCondition(
      isDamagedPendingRecord(b)
        ? (isLost ? 'Lost' : 'Damaged')
        : b.returnCondition || 'Good Condition'
    );
    setEditStatus(b.status || (isDamagedPendingRecord(b) ? 'PENDING' : 'RETURNED'));
    setEditReturnNotes(b.returnNotes || '');
    setResolveEvidencePhoto(null);
    setRestoreMainStock(true);
    setEditDueDate(b.dueDate ? new Date(b.dueDate).toISOString().slice(0, 10) : '');

    // Initialize missing accessories resolution checklist
    const incs = getBorrowingInclusions(b);
    const retIncs = (b as any)?.returnChecklist?.returnedInclusions || {};
    const missingList = Array.isArray((b as any)?.returnChecklist?.missingItems) ? (b as any).returnChecklist.missingItems : [];
    const initialResolved: Record<string, boolean> = {};
    incs.forEach((item) => {
      const isLostAcc = retIncs[item] === false || missingList.includes(item);
      if (isLostAcc) {
        initialResolved[item] = true;
      }
    });
    setResolveInclusionChecks(initialResolved);
    setIsEditingDetails(false);
  }, [isDamagedPendingRecord]);

  const openResolveModal = useCallback((b: InventoryBorrowing) => {
    setDetailsBorrowing(b);
    setEditReturnCondition('Resolved');
    setEditStatus('RETURNED');
    setEditReturnNotes(b.returnNotes ? `${b.returnNotes}\n[Resolved]: ` : '');
    setResolveEvidencePhoto(null);
    setRestoreMainStock(true);
    setEditDueDate(b.dueDate ? new Date(b.dueDate).toISOString().slice(0, 10) : '');

    const incs = getBorrowingInclusions(b);
    const retIncs = (b as any)?.returnChecklist?.returnedInclusions || {};
    const missingList = Array.isArray((b as any)?.returnChecklist?.missingItems) ? (b as any).returnChecklist.missingItems : [];
    const initialResolved: Record<string, boolean> = {};
    incs.forEach((item) => {
      const isLostAcc = retIncs[item] === false || missingList.includes(item);
      if (isLostAcc) {
        initialResolved[item] = true;
      }
    });
    setResolveInclusionChecks(initialResolved);
    setIsEditingDetails(true);
  }, []);

  const handleResolvePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingResolvePhoto(true);
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
            setResolveEvidencePhoto(compressed);
          } else {
            setResolveEvidencePhoto(reader.result as string);
          }
          setIsUploadingResolvePhoto(false);
        };
        img.onerror = () => {
          setResolveEvidencePhoto(reader.result as string);
          setIsUploadingResolvePhoto(false);
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
      setIsUploadingResolvePhoto(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveDetails = async () => {
    if (!detailsBorrowing) return;

    const isReturned = detailsBorrowing.status === 'RETURNED';
    const isPending = detailsBorrowing.status === 'PENDING';
    const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
    const isDamaged = isPending || cond.includes('damag') || cond.includes('repair') || cond.includes('replac') || cond.includes('sira') || cond.includes('ayos');
    if (isReturned && !isDamaged) {
      toast({
        variant: 'destructive',
        title: 'Record Locked',
        description: 'Returned equipment records cannot be edited unless marked as damaged.',
      });
      return;
    }

    const isResolving = ['resolved', 'repaired', 'replaced', 'good'].some(k => editReturnCondition.toLowerCase().includes(k));
    const wasDamaged = isDamagedPendingRecord(detailsBorrowing);

    // Require photo evidence when resolving a damaged item
    if (wasDamaged && isResolving) {
      if (!resolveEvidencePhoto) {
        toast({
          variant: 'destructive',
          title: 'Evidence Photo Required',
          description: 'Please upload or capture a photo proving that the item is repaired / replaced and in good condition before resolving.',
        });
        return;
      }
    }

    setIsSavingDetails(true);
    try {
      const res = await fetch(`/api/borrowings/${detailsBorrowing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnCondition: editReturnCondition,
          returnNotes: editReturnNotes,
          status: isResolving ? 'RETURNED' : editStatus,
          resolutionPhoto: resolveEvidencePhoto || undefined,
          restoreStock: restoreMainStock,
          resolvedInclusions: resolveInclusionChecks,
          dueDate: editDueDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update borrowing record');
      }
      const updated = await res.json();
      setDetailsBorrowing(updated);
      setResolveEvidencePhoto(null);
      setIsEditingDetails(false);
      toast({
        title: isResolving ? 'Equipment Resolved & Returned' : 'Record Updated',
        description: isResolving
          ? 'Equipment condition has been resolved with photo evidence, restored to available stock, and marked as RETURNED.'
          : 'Borrowing status, condition, and maintenance notes updated successfully.',
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
    fetchItems({ take: 200 });
  }, [skip, take, statusFilter, fetchBorrowings, fetchItems]);

  useEffect(() => {
    loadData();

    const handleRefreshEvent = () => {
      loadData();
    };
    window.addEventListener('inventory-refresh', handleRefreshEvent);
    return () => window.removeEventListener('inventory-refresh', handleRefreshEvent);
  }, [loadData]);

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
      if (statusFilter === 'BORROWED' && b.status !== 'BORROWED') return false;
      if (statusFilter === 'PENDING' && !isDamagedPendingRecord(b)) return false;
      if (statusFilter === 'RETURNED' && (b.status !== 'RETURNED' || isDamagedPendingRecord(b))) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.borrowerName?.toLowerCase().includes(q) ||
        b.borrowerEmail?.toLowerCase().includes(q) ||
        b.item?.name?.toLowerCase().includes(q) ||
        (b.item?.inventoryCode || '').toLowerCase().includes(q)
      );
    });
  }, [borrowings, search, statusFilter, isDamagedPendingRecord]);

  const stats = useMemo(() => {
    const active = borrowings.filter((b) => b.status === 'BORROWED').length;
    const pending = borrowings.filter((b) => isDamagedPendingRecord(b)).length;
    const returned = borrowings.filter((b) => b.status === 'RETURNED' && !isDamagedPendingRecord(b)).length;
    const overdue = borrowings.filter(
      (b) => b.status === 'BORROWED' && b.dueDate && new Date(b.dueDate) < new Date()
    ).length;
    const total = totalBorrowings || borrowings.length;
    return { active, returned, overdue, pending, total };
  }, [borrowings, totalBorrowings, isDamagedPendingRecord]);

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
      let finalCheckoutNotes = checkoutNotes.trim();
      if (checkoutIncludedEquipment.length > 0) {
        const inclStr = `Included Equipment: ${checkoutIncludedEquipment.join(', ')}`;
        finalCheckoutNotes = finalCheckoutNotes ? `${finalCheckoutNotes} | ${inclStr}` : inclStr;
      }

      const finalChecklist = {
        ...checkoutChecklist,
        includedEquipment: checkoutIncludedEquipment,
      };

      const res = await fetch('/api/borrowings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: checkoutItemId,
          borrowerId: checkoutWorkerId,
          borrowerName: workerName,
          dueDate: checkoutDueDate || null,
          checkoutNotes: finalCheckoutNotes,
          checkoutCondition: 'Good Condition',
          checkoutChecklist: finalChecklist,
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
      setCheckoutIncludedEquipment([]);
      setCustomAccessoryInput('');
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

    const isLostItem = returnCondition === 'Lost';
    const isDamagedItem = returnCondition === 'Damaged';
    if (isDamagedItem && !returnDamagePhoto) {
      toast({
        variant: 'destructive',
        title: 'Photo Evidence Required',
        description: 'Please upload or capture a damage evidence photo before submitting a damaged return.',
      });
      return;
    }

    if (!isDamagedItem && !isLostItem && !isReturnChecklistComplete) {
      toast({
        variant: 'destructive',
        title: 'Checklist Required',
        description: 'Please complete all items in the Return Inspection Checklist before completing the return.',
      });
      return;
    }

    setSubmittingReturn(true);
    try {
      const finalReturnChecklist = {
        ...returnChecklist,
        returnedInclusions: returnInclusionChecks,
        resolutionDeadline: returnResolutionDeadline || null,
      };

      const res = await fetch(`/api/borrowings/${selectedBorrowing.id}/return`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnNotes,
          returnCondition,
          returnChecklist: finalReturnChecklist,
          resolutionDeadline: returnResolutionDeadline || null,
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

      const missingCount = Object.values(returnInclusionChecks).filter((c) => !c).length;
      toast({
        title: isLostItem
          ? '⚠️ Equipment Reported Lost'
          : missingCount > 0
          ? '⚠️ Return Recorded with Lost Gear'
          : isDamagedItem
          ? '⚠️ Item Damaged — Pending'
          : 'Return Completed',
        description: isLostItem
          ? `${selectedBorrowing.item?.name || 'Item'} recorded as Lost. Stock will not be restored.`
          : missingCount > 0
          ? `${selectedBorrowing.item?.name || 'Item'} returned, but ${missingCount} accessory reported as lost/missing.`
          : isDamagedItem
          ? `${selectedBorrowing.item?.name || 'Item'} returned with damage reported. Marked as Pending until resolved.`
          : `${selectedBorrowing.item?.name || 'Item'} returned successfully.`,
      });

      setIsReturnOpen(false);
      setSelectedBorrowing(null);
      setReturnNotes('');
      setReturnDamagePhoto(null);
      setReturnChecklist({});
      setReturnInclusions([]);
      setReturnInclusionChecks({});
      setReturnResolutionDeadline('');
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

    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);
    setReturnResolutionDeadline(defaultDeadline.toISOString().slice(0, 10));

    const inclusions = getBorrowingInclusions(b);
    setReturnInclusions(inclusions);
    const initialChecks: Record<string, boolean> = {};
    inclusions.forEach((acc) => { initialChecks[acc] = true; });
    setReturnInclusionChecks(initialChecks);

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
                  <SelectItem value="PENDING" className="text-xs font-semibold cursor-pointer text-amber-600 dark:text-amber-400">
                    Pending / Damaged ({stats.pending})
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
                  const isDamagedPending = isDamagedPendingRecord(b);
                  const isPendingOverdue = isDamagedPending && Boolean(b.dueDate && new Date(b.dueDate) < new Date());
                  const isOverdue = (b.status === 'BORROWED' && Boolean(b.dueDate && new Date(b.dueDate) < new Date())) || isPendingOverdue;
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
                          {(() => {
                            const isDamagedPending = isDamagedPendingRecord(b);
                            const isReturned = b.status === 'RETURNED' && !isDamagedPending;
                            return (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs",
                                  isReturned
                                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                                    : isDamagedPending
                                    ? "bg-amber-500/25 text-amber-200 border-amber-400/50"
                                    : isOverdue
                                    ? "bg-rose-500/25 text-rose-200 border-rose-400/40 animate-pulse"
                                    : "bg-sky-400/20 text-sky-200 border-sky-300/40"
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    isReturned
                                      ? "bg-emerald-400"
                                      : isDamagedPending
                                      ? "bg-amber-400 animate-pulse"
                                      : isOverdue
                                      ? "bg-rose-400"
                                      : "bg-sky-400"
                                  )}
                                />
                                <span>
                                  {isReturned
                                    ? 'Returned'
                                    : isDamagedPending
                                    ? (b.returnCondition?.toLowerCase().includes('lost')
                                        ? 'Pending (Lost)'
                                        : b.returnCondition?.toLowerCase().includes('missing')
                                        ? 'Pending (Missing)'
                                        : 'Pending (Damaged)')
                                    : isOverdue
                                    ? 'Overdue'
                                    : 'Borrowed'}
                                </span>
                              </span>
                            );
                          })()}

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
                            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border border-border bg-popover">
                              <DropdownMenuItem
                                onClick={() => openDetailsModal(b)}
                                className="cursor-pointer text-xs font-medium"
                              >
                                <Eye className="h-3.5 w-3.5 mr-2" /> Details
                              </DropdownMenuItem>
                              {isDamagedPendingRecord(b) && (
                                <DropdownMenuItem
                                  onClick={() => openResolveModal(b)}
                                  className="cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400 focus:text-amber-700"
                                >
                                  <Wrench className="h-3.5 w-3.5 mr-2 text-amber-600 dark:text-amber-400" /> Resolve
                                </DropdownMenuItem>
                              )}
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
                          {(() => {
                            const inc = getBorrowingInclusions(b);
                            if (inc.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {inc.map((item, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                                  >
                                    +{item}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
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
                              {isDamagedPending ? 'RESOLUTION DUE' : 'DUE SCHEDULE'}
                            </span>
                            <span className={cn("font-bold text-xs block truncate", (isOverdue || isPendingOverdue) ? "text-destructive font-bold" : "text-foreground")}>
                              {isDamagedPending && b.dueDate
                                ? `${new Date(b.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}${isPendingOverdue ? ' (Overdue)' : ''}`
                                : (dueInfo?.text || 'Open Schedule')}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                              CONDITION
                            </span>
                            <span className={cn(
                              "font-bold text-xs block truncate",
                              isDamagedPendingRecord(b) ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-foreground"
                            )}>
                              {isDamagedPendingRecord(b)
                                ? (b.returnCondition && !b.returnCondition.toLowerCase().includes('good') ? b.returnCondition : 'Damaged')
                                : (b.returnCondition || b.checkoutCondition || 'Good Condition')}
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
                            "{(b.status === 'RETURNED' || isDamagedPendingRecord(b)) ? b.returnNotes || 'Damaged return recorded' : b.checkoutNotes || 'Standard checkout'}"
                          </div>
                        )}

                        {b.returnPhotos && b.returnPhotos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openDetailsModal(b)}
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
                      const isDamagedPending = isDamagedPendingRecord(b);
                      const isPendingOverdue = isDamagedPending && Boolean(b.dueDate && new Date(b.dueDate) < new Date());
                      const isOverdue = (b.status === 'BORROWED' && Boolean(b.dueDate && new Date(b.dueDate) < new Date())) || isPendingOverdue;
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
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-foreground">
                                    {b.item?.inventoryCode || b.itemId.slice(0, 8)}
                                  </span>
                                  {(() => {
                                    const inc = getBorrowingInclusions(b);
                                    if (inc.length === 0) return null;
                                    return (
                                      <span
                                        className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 truncate max-w-[150px]"
                                        title={`Included Equipment: ${inc.join(', ')}`}
                                      >
                                        +{inc.length} gear ({inc.slice(0, 2).join(', ')}{inc.length > 2 ? '…' : ''})
                                      </span>
                                    );
                                  })()}
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
                            {isDamagedPending ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  <Clock className={`h-3.5 w-3.5 shrink-0 ${isPendingOverdue ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
                                  <span className={isPendingOverdue ? 'text-destructive font-bold' : ''}>
                                    {b.dueDate ? new Date(b.dueDate).toLocaleDateString() : (b.returnedAt ? new Date(b.returnedAt).toLocaleDateString() : 'Pending')}
                                  </span>
                                </div>
                                <span className={cn(
                                  "text-[10px] font-bold block",
                                  isPendingOverdue ? "text-destructive" : "text-amber-700 dark:text-amber-300"
                                )}>
                                  {isPendingOverdue ? 'Resolution Overdue' : 'Target Resolution'}
                                </span>
                              </div>
                            ) : b.returnedAt ? (
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
                            {(() => {
                              const isDamagedPending = isDamagedPendingRecord(b);
                              const isReturned = b.status === 'RETURNED' && !isDamagedPending;

                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${
                                    isReturned
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : isDamagedPending
                                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                                      : isOverdue
                                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse'
                                      : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isReturned
                                        ? 'bg-emerald-500'
                                        : isDamagedPending
                                        ? 'bg-amber-500 animate-pulse'
                                        : isOverdue
                                        ? 'bg-red-500'
                                        : 'bg-sky-500'
                                    }`}
                                  />
                                  <span className="whitespace-nowrap">
                                    {isReturned
                                      ? 'Returned'
                                      : isDamagedPending
                                      ? (b.returnCondition?.toLowerCase().includes('lost')
                                          ? 'Pending (Lost)'
                                          : b.returnCondition?.toLowerCase().includes('missing')
                                          ? 'Pending (Missing)'
                                          : 'Pending (Damaged)')
                                      : isOverdue
                                      ? 'Overdue'
                                      : 'Active Borrowed'}
                                  </span>
                                </span>
                              );
                            })()}
                          </TableCell>

                          {/* 6. Condition Only */}
                          <TableCell className="py-3 text-xs text-foreground min-w-[140px]">
                            {(() => {
                              const isDamagedPending = isDamagedPendingRecord(b);
                              const cond = isDamagedPending
                                ? (b.returnCondition && !b.returnCondition.toLowerCase().includes('good') ? b.returnCondition : 'Damaged')
                                : (b.returnCondition || b.checkoutCondition || 'Good Condition');
                              const condLower = cond.toLowerCase();
                              const isLost = condLower.includes('lost') || condLower.includes('nawala');
                              const isMissing = condLower.includes('missing');
                              const isDamaged = condLower.includes('damag') || condLower.includes('sira');
                              const isResolved = ['resolved', 'repaired', 'replaced', 'naayos', 'napalitan'].some(k => condLower.includes(k));
                              const isWear = condLower.includes('wear');

                              return (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                                    isLost
                                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold"
                                      : isMissing
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold"
                                      : isDamaged
                                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                      : isResolved
                                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                      : isWear
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  )}
                                >
                                  {isResolved ? 'Resolved' : isLost ? 'Lost' : isMissing ? 'Missing Gear' : isDamaged ? 'Damaged' : cond}
                                </Badge>
                              );
                            })()}
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
                              <DropdownMenuContent align="end" className="w-52 p-1 rounded-xl shadow-lg border-border/80">
                                <DropdownMenuItem
                                  onClick={() => openDetailsModal(b)}
                                  className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                  View Details
                                </DropdownMenuItem>

                                {isDamagedPendingRecord(b) && (
                                  <DropdownMenuItem
                                    onClick={() => openResolveModal(b)}
                                    className="cursor-pointer gap-2 rounded-lg text-xs font-semibold py-2 text-amber-600 dark:text-amber-400"
                                  >
                                    <Wrench className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    Resolve
                                  </DropdownMenuItem>
                                )}

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

              {/* Included Equipment & Accessories (Lens, Battery, SD Card, Tripod, Cord, Charger, etc.) */}
              <div className="space-y-2.5 p-3.5 bg-muted/30 border border-border/70 rounded-2xl">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" />
                    <span>Included Equipment &amp; Accessories</span>
                  </Label>
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    {checkoutIncludedEquipment.length} item{checkoutIncludedEquipment.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Tag accessories or extra gear issued with this item (e.g. for camera package):
                </p>

                {/* Quick Add Presets */}
                <div className="space-y-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Quick Select:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {CAMERA_EQUIPMENT_PRESETS.map((preset) => {
                      const isSelected = checkoutIncludedEquipment.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setCheckoutIncludedEquipment(checkoutIncludedEquipment.filter((x) => x !== preset));
                            } else {
                              setCheckoutIncludedEquipment([...checkoutIncludedEquipment, preset]);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 select-none",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                              : "bg-background hover:bg-muted border border-border/70 text-foreground"
                          )}
                        >
                          <span className="text-[11px]">{isSelected ? '✓' : '+'}</span>
                          <span>{preset}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom equipment / accessory input */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={customAccessoryInput}
                    onChange={(e) => setCustomAccessoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = customAccessoryInput.trim();
                        if (val && !checkoutIncludedEquipment.includes(val)) {
                          setCheckoutIncludedEquipment([...checkoutIncludedEquipment, val]);
                          setCustomAccessoryInput('');
                        }
                      }
                    }}
                    placeholder="Add other gear (e.g. 50mm Lens, Ring Light, Case)..."
                    className="h-8 text-xs rounded-xl bg-background border-border/70 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const val = customAccessoryInput.trim();
                      if (val && !checkoutIncludedEquipment.includes(val)) {
                        setCheckoutIncludedEquipment([...checkoutIncludedEquipment, val]);
                        setCustomAccessoryInput('');
                      }
                    }}
                    disabled={!customAccessoryInput.trim()}
                    className="h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer shrink-0"
                  >
                    + Add
                  </Button>
                </div>

                {/* Selected Inclusions Badges */}
                {checkoutIncludedEquipment.length > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-1.5">
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">
                      Equipment to be Issued:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {checkoutIncludedEquipment.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/25 shadow-2xs"
                        >
                          <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setCheckoutIncludedEquipment(checkoutIncludedEquipment.filter((x) => x !== item))
                            }
                            className="hover:bg-primary/20 rounded p-0.5 ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnCondition(val);
                        if (val === 'Damaged' || val === 'Lost') {
                          setReturnChecklist({});
                        }
                      }}
                    >
                      <option value="Good Condition">Good Condition (No issues)</option>
                      <option value="Minor Wear">Minor Wear (Functional)</option>
                      <option value="Damaged">Damaged / Needs Maintenance</option>
                      <option value="Lost">Lost / Missing Equipment</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Lost Warning Banner */}
                {returnCondition === 'Lost' && (
                  <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-2 font-bold text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      <span>Equipment Declared Lost</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      This item will be recorded as <strong className="text-destructive">Lost (Pending Resolution)</strong>. Available inventory stock will <span className="text-destructive font-bold underline">NOT</span> be restored until the equipment is replaced or resolved.
                    </p>
                  </div>
                )}

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

                {/* Return Checklist: only applicable for normal returns; hidden when damaged or lost */}
                {returnCondition !== 'Damaged' && returnCondition !== 'Lost' && returnTemplateItems.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/30 border border-border/70 rounded-xl animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Return Inspection Checklist
                      </Label>
                      <span className="text-[10px] text-destructive font-bold uppercase tracking-wider bg-destructive/10 px-2 py-0.5 rounded-md">
                        Required *
                      </span>
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

                {/* Issued Inclusions Verification (Mark returned vs Lost) */}
                {returnInclusions.length > 0 && (
                  <div className="space-y-2.5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>Issued Equipment Return Verification</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allRet: Record<string, boolean> = {};
                            returnInclusions.forEach((acc) => { allRet[acc] = true; });
                            setReturnInclusionChecks(allRet);
                          }}
                          className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          All Returned
                        </button>
                        <span className="text-muted-foreground text-[10px]">&bull;</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allLost: Record<string, boolean> = {};
                            returnInclusions.forEach((acc) => { allLost[acc] = false; });
                            setReturnInclusionChecks(allLost);
                          }}
                          className="text-[10px] font-bold text-destructive hover:underline cursor-pointer"
                        >
                          All Lost
                        </button>
                      </div>
                    </div>
                    {returnCondition === 'Lost' && (
                      <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-[11px] font-medium flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Main unit is reported Lost. Verify which accessories were returned vs lost below:</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Check each item that is returned. Uncheck any accessory that is <strong>LOST or MISSING</strong>:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {returnInclusions.map((item) => {
                        const isChecked = returnInclusionChecks[item] ?? true;
                        return (
                          <div
                            key={item}
                            onClick={() =>
                              setReturnInclusionChecks({ ...returnInclusionChecks, [item]: !isChecked })
                            }
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all",
                              isChecked
                                ? "bg-background border-border/80 text-foreground hover:bg-muted/30"
                                : "bg-destructive/10 border-destructive/40 text-destructive font-semibold shadow-xs"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(c) =>
                                  setReturnInclusionChecks({ ...returnInclusionChecks, [item]: Boolean(c) })
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="font-semibold truncate">{item}</span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0",
                                isChecked
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : "bg-destructive/20 text-destructive font-extrabold"
                              )}
                            >
                              {isChecked ? '✓ Returned' : '✕ Lost'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {Object.values(returnInclusionChecks).some((c) => !c) && (
                      <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Unchecked accessories will be recorded as <strong>Lost</strong> on this borrowing record.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Target Replacement / Resolution Deadline Date (for Damaged / Lost / Missing Gear) */}
                {(returnCondition === 'Damaged' || returnCondition === 'Lost' || Object.values(returnInclusionChecks).some((c) => !c)) && (
                  <div className="space-y-2 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>
                          {returnCondition === 'Lost'
                            ? 'Target Replacement Deadline'
                            : returnCondition === 'Damaged'
                            ? 'Target Repair / Replacement Date'
                            : 'Missing Accessories Return Deadline'}
                        </span>
                      </Label>
                      {returnResolutionDeadline && (
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">
                          Due: {new Date(returnResolutionDeadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Kailan dapat maibalik, mapalitan, o maayos ang {returnCondition === 'Lost' ? 'nawalang gamit' : returnCondition === 'Damaged' ? 'nasirang kagamitan' : 'nawalang accessories'} ng borrower.
                    </p>
                    <DatePicker
                      value={returnResolutionDeadline}
                      onChange={(date) => setReturnResolutionDeadline(date)}
                      placeholder="dd/mm/yyyy"
                      className="w-full h-9 text-xs rounded-xl bg-background"
                      align="start"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          setReturnResolutionDeadline(d.toISOString().slice(0, 10));
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setReturnResolutionDeadline(d.toISOString().slice(0, 10));
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                      >
                        +1 Week
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 14);
                          setReturnResolutionDeadline(d.toISOString().slice(0, 10));
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                      >
                        +2 Weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setMonth(d.getMonth() + 1);
                          setReturnResolutionDeadline(d.toISOString().slice(0, 10));
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer"
                      >
                        +1 Month
                      </button>
                      {returnResolutionDeadline && (
                        <button
                          type="button"
                          onClick={() => setReturnResolutionDeadline('')}
                          className="text-[11px] px-2 py-0.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-medium transition-colors cursor-pointer ml-auto"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {returnCondition === 'Lost'
                      ? 'Loss Incident Notes / Circumstances'
                      : returnCondition === 'Damaged'
                      ? 'Damage & Maintenance Notes'
                      : 'Inspection Notes'}
                  </Label>
                  <Input
                    value={returnNotes}
                    maxLength={500}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder={
                      returnCondition === 'Lost'
                        ? 'Explain how the item was lost, last known location, incident report details...'
                        : returnCondition === 'Damaged'
                        ? 'Describe the damage, defect, or maintenance required...'
                        : 'e.g. Returned clean, fully functional, battery at 90%'
                    }
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
                  {(() => {
                    const isLost = returnCondition === 'Lost';
                    const isDamaged = returnCondition === 'Damaged';
                    const hasLostAccessories = Object.values(returnInclusionChecks).some((c) => !c);

                    return (
                      <Button
                        type="submit"
                        disabled={
                          submittingReturn ||
                          (isDamaged ? !returnDamagePhoto : isLost ? false : !isReturnChecklistComplete)
                        }
                        className={cn(
                          "min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer flex-1 sm:flex-initial transition-all",
                          isLost
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                            : isDamaged
                            ? (!returnDamagePhoto
                                ? "bg-amber-600/60 hover:bg-amber-600/60 text-white cursor-not-allowed opacity-80"
                                : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20")
                            : (!isReturnChecklistComplete
                                ? "bg-emerald-600/60 hover:bg-emerald-600/60 text-white cursor-not-allowed opacity-80"
                                : hasLostAccessories
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white")
                        )}
                      >
                        {submittingReturn
                          ? 'Processing...'
                          : isLost
                          ? 'Report as Lost Equipment'
                          : isDamaged
                          ? (!returnDamagePhoto
                              ? 'Photo Required'
                              : 'Flag as Damaged')
                          : (!isReturnChecklistComplete
                              ? 'Checklist Required'
                              : hasLostAccessories
                              ? 'Complete Return (with Lost Gear)'
                              : 'Complete Return')}
                      </Button>
                    );
                  })()}
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ── RECORD DETAILS MODAL ── */}
        <Dialog open={Boolean(detailsBorrowing)} onOpenChange={(open) => !open && setDetailsBorrowing(null)}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
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
                      {(() => {
                        const isPending = isDamagedPendingRecord(detailsBorrowing);
                        const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
                        const isLost = cond.includes('lost') || cond.includes('nawala');
                        const isMissing = cond.includes('missing') || (detailsBorrowing.returnChecklist?.missingItems && detailsBorrowing.returnChecklist.missingItems.length > 0);

                        if (isPending) {
                          if (isLost) {
                            return (
                              <Badge variant="outline" className="text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/40">
                                PENDING (LOST)
                              </Badge>
                            );
                          }
                          if (isMissing) {
                            return (
                              <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40">
                                PENDING (MISSING GEAR)
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30">
                              PENDING (DAMAGED)
                            </Badge>
                          );
                        }
                        if (detailsBorrowing.status === 'RETURNED') {
                          return (
                            <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                              RETURNED
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="outline" className="text-[10px] font-bold bg-sky-500/10 text-sky-700 border-sky-500/30">
                            {detailsBorrowing.status}
                          </Badge>
                        );
                      })()}
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
                      {isDamagedPendingRecord(detailsBorrowing) ? 'Target Resolution Due' : 'Returned Date'}
                    </span>
                    <span className={cn(
                      "font-bold text-foreground mt-0.5 block",
                      isDamagedPendingRecord(detailsBorrowing) && detailsBorrowing.dueDate && new Date(detailsBorrowing.dueDate) < new Date()
                        ? "text-destructive font-bold"
                        : ""
                    )}>
                      {isDamagedPendingRecord(detailsBorrowing) && detailsBorrowing.dueDate
                        ? new Date(detailsBorrowing.dueDate).toLocaleDateString()
                        : detailsBorrowing.returnedAt
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
                        const isDamaged = isDamagedPendingRecord(detailsBorrowing) || cond.includes('damag') || cond.includes('repair') || cond.includes('replac') || cond.includes('sira') || cond.includes('ayos');
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
                          <Select
                            value={editReturnCondition}
                            onValueChange={(val) => {
                              setEditReturnCondition(val);
                              if (val === 'Resolved' || val === 'Repaired' || val === 'Replaced' || val === 'Good Condition') {
                                setEditStatus('RETURNED');
                              } else if (val === 'Damaged' || val === 'Under Repair' || val === 'Lost') {
                                setEditStatus('PENDING');
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-xl bg-background">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Good Condition" className="text-xs font-medium">Good Condition</SelectItem>
                              <SelectItem value="Damaged" className="text-xs text-destructive font-semibold">Damaged</SelectItem>
<<<<<<< HEAD
                              <SelectItem value="Lost" className="text-xs text-rose-600 font-semibold">Lost / Missing</SelectItem>
                              <SelectItem value="Resolved" className="text-xs text-emerald-600 font-semibold">Resolved (Repaired / Replaced)</SelectItem>
=======
                              <SelectItem value="Repaired" className="text-xs text-emerald-600 font-semibold">Repaired</SelectItem>
                              <SelectItem value="Replaced" className="text-xs text-blue-600 font-semibold">Replaced</SelectItem>
>>>>>>> 3a2667343429984bb3cc872c980c50feff16d9ea
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
                              <SelectItem value="RETURNED" className="text-xs font-medium text-emerald-600 font-semibold">RETURNED (Resolved &amp; Restored)</SelectItem>
                              <SelectItem value="PENDING" className="text-xs font-medium text-amber-600 font-semibold">PENDING (Damaged / Lost / Needs Action)</SelectItem>
                              <SelectItem value="BORROWED" className="text-xs font-medium">BORROWED</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Target Resolution / Replacement Date (when pending resolution) */}
                      {(editStatus === 'PENDING' || isDamagedPendingRecord(detailsBorrowing) || editReturnCondition === 'Damaged' || editReturnCondition === 'Lost') && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/60">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-primary" /> Target Resolution / Replacement Deadline
                            </Label>
                            {editDueDate && (
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                {new Date(editDueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <DatePicker
                            value={editDueDate}
                            onChange={(date) => setEditDueDate(date)}
                            placeholder="dd/mm/yyyy"
                            className="w-full h-9 text-xs rounded-xl bg-background"
                            align="start"
                          />
                        </div>
                      )}

                      {/* Lost Main Equipment Settlement (when editing/resolving) */}
                      {((detailsBorrowing.returnCondition || '').toLowerCase().includes('lost') || editReturnCondition === 'Lost') && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                              <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                              Lost Equipment Settlement
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40 font-bold">
                              Declared Lost
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Main unit <strong>{detailsBorrowing.item?.name}</strong> was marked as Lost. Check the box below if the item is recovered or physically replaced:
                          </p>
                          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background border border-border/70 cursor-pointer hover:bg-muted/30 transition-colors">
                            <Checkbox
                              checked={restoreMainStock}
                              onCheckedChange={(c) => setRestoreMainStock(Boolean(c))}
                              className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-foreground block">
                                Restore 1 unit to available inventory stock
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                1 unit of this equipment will be restored to available stock and logged in the inventory audit history.
                              </span>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Lost / Missing Accessories Resolution Checklist */}
                      {(() => {
                        const incs = getBorrowingInclusions(detailsBorrowing);
                        const retIncs = detailsBorrowing.returnChecklist?.returnedInclusions || {};
                        const missingList: string[] = Array.isArray(detailsBorrowing.returnChecklist?.missingItems)
                          ? detailsBorrowing.returnChecklist.missingItems
                          : [];
                        const missingAccs = incs.filter((item) => retIncs[item] === false || missingList.includes(item));
                        if (missingAccs.length === 0) return null;

                        return (
                          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                Missing Accessories Resolution
                              </span>
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                                {Object.values(resolveInclusionChecks).filter(Boolean).length} / {missingAccs.length} Resolved
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              Check off each accessory that has been recovered, found, or replaced:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                              {missingAccs.map((item) => {
                                const isResolved = resolveInclusionChecks[item] ?? false;
                                return (
                                  <label
                                    key={item}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer select-none transition-all",
                                      isResolved
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-semibold"
                                        : "bg-background border-border/80 text-foreground hover:bg-muted/30"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <Checkbox
                                        checked={isResolved}
                                        onCheckedChange={(c) =>
                                          setResolveInclusionChecks({ ...resolveInclusionChecks, [item]: Boolean(c) })
                                        }
                                      />
                                      <span className="truncate">{item}</span>
                                    </div>
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0",
                                        isResolved
                                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                          : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                      )}
                                    >
                                      {isResolved ? '✓ Replaced' : '✕ Missing'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Maintenance / Replacement Notes</Label>
                        <Textarea
                          value={editReturnNotes}
                          maxLength={1000}
                          onChange={(e) => setEditReturnNotes(e.target.value)}
<<<<<<< HEAD
                          placeholder="Describe any maintenance or replacement details (e.g., Replaced camera lens, repaired charging port)..."
=======
                          placeholder="Describe any parts that were damaged, repaired, or replaced (e.g., Replaced camera lens, repaired charging port)..."
>>>>>>> 3a2667343429984bb3cc872c980c50feff16d9ea
                          className="text-xs rounded-xl min-h-[75px] bg-background resize-none leading-relaxed"
                        />
                      </div>

                      {/* Initial Damage Evidence (Reference) if available */}
                      {detailsBorrowing.returnPhotos && detailsBorrowing.returnPhotos.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1.5">
                          <span className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Initial Damage Photo Evidence (Reference):
                          </span>
                          <div className="flex gap-2 overflow-x-auto py-0.5">
                            {detailsBorrowing.returnPhotos.map((photo: string, idx: number) => (
                              <a
                                key={idx}
                                href={photo}
                                target="_blank"
                                rel="noreferrer"
                                className="w-20 h-14 rounded-lg overflow-hidden border border-border/70 shrink-0 block hover:opacity-90 transition-opacity"
                              >
                                <img src={photo} alt={`Damage photo ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Evidence Photo Upload (Mandatory for Resolution) */}
                      {(editReturnCondition === 'Resolved' || editReturnCondition === 'Repaired' || editReturnCondition === 'Replaced' || isDamagedPendingRecord(detailsBorrowing)) && (
                        <div className={cn(
                          "space-y-2 p-3 rounded-xl border transition-colors",
                          resolveEvidencePhoto
                            ? "bg-emerald-500/5 border-emerald-500/30"
                            : editReturnCondition === 'Resolved'
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-muted/30 border-border/60"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                              <Camera className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span>Evidence Photo (Restored / Okay Condition)</span>
                              {editReturnCondition === 'Resolved' && <span className="text-destructive font-bold">*</span>}
                            </div>
                            {resolveEvidencePhoto && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setResolveEvidencePhoto(null)}
                                className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Remove
                              </Button>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Upload or capture a photo proving that the item is repaired / replaced and in good working condition.
                          </p>

                          <input
                            ref={resolvePhotoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleResolvePhotoSelect}
                            className="hidden"
                          />

                          {resolveEvidencePhoto ? (
                            <div className="relative aspect-video max-h-48 rounded-xl overflow-hidden border border-emerald-500/40 bg-black/5">
                              <img
                                src={resolveEvidencePhoto}
                                alt="Resolution evidence preview"
                                className="w-full h-full object-contain bg-black/10"
                              />
                              <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Photo Attached
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => resolvePhotoInputRef.current?.click()}
                              className={cn(
                                "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group",
                                editReturnCondition === 'Resolved'
                                  ? "border-amber-500/50 hover:border-emerald-500 bg-amber-500/5 hover:bg-emerald-500/10"
                                  : "border-border hover:border-primary/50 bg-background hover:bg-muted/30"
                              )}
                            >
                              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                {isUploadingResolvePhoto ? (
                                  <LoaderCircle className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Upload className="h-5 w-5" />
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-foreground">
                                  {isUploadingResolvePhoto ? 'Compressing photo…' : 'Take or Upload Evidence Photo'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  PNG, JPG, or WEBP (captured camera photo or image file)
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                      {(() => {
                        const inc = getBorrowingInclusions(detailsBorrowing);
                        if (inc.length === 0) return null;
                        const isProcessed = detailsBorrowing.status === 'RETURNED' || isDamagedPendingRecord(detailsBorrowing);
                        const returnedIncs = detailsBorrowing.returnChecklist?.returnedInclusions;
                        const missingList: string[] = Array.isArray(detailsBorrowing.returnChecklist?.missingItems)
                          ? detailsBorrowing.returnChecklist.missingItems
                          : [];

                        const lostAccs: string[] = [];
                        const returnedAccs: string[] = [];

                        inc.forEach((item) => {
                          if (isProcessed) {
                            if (returnedIncs && typeof returnedIncs === 'object') {
                              if (returnedIncs[item] === false) {
                                lostAccs.push(item);
                              } else {
                                returnedAccs.push(item);
                              }
                            } else if (missingList.includes(item)) {
                              lostAccs.push(item);
                            } else {
                              returnedAccs.push(item);
                            }
                          }
                        });

                        return (
                          <div className="space-y-2 pt-1">
                            <strong className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                              Included Equipment &amp; Accessories:
                            </strong>
                            <div className="flex flex-wrap gap-1.5">
                              {inc.map((item, idx) => {
                                const isLost = isProcessed && (returnedIncs?.[item] === false || missingList.includes(item));
                                if (isLost) {
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/40 shadow-2xs"
                                    >
                                      <X className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                      <span>{item}</span>
                                      <span className="text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white px-1.5 py-0.2 rounded">LOST</span>
                                    </span>
                                  );
                                }
                                if (isProcessed) {
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 shadow-2xs"
                                    >
                                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span>{item}</span>
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Returned</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20"
                                  >
                                    <Package className="h-3 w-3" />
                                    {item}
                                  </span>
                                );
                              })}
                            </div>

                            {lostAccs.length > 0 && (
                              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800 dark:text-rose-300">
                                  <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                  <span>Recorded Lost Accessories ({lostAccs.length}):</span>
                                </div>
                                <p className="text-[11px] text-rose-900/90 dark:text-rose-200">
                                  Not returned by borrower: <strong className="font-bold underline">{lostAccs.join(', ')}</strong>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {(detailsBorrowing.status === 'RETURNED' || isDamagedPendingRecord(detailsBorrowing)) && (
                        <>
                          {isDamagedPendingRecord(detailsBorrowing) && (
                            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 my-1">
                              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>
                                  {(() => {
                                    const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
                                    if (cond.includes('lost') || cond.includes('nawala')) return 'Pending Resolution (Lost Equipment)';
                                    if (cond.includes('missing')) return 'Pending Resolution (Missing Accessories)';
                                    return 'Pending Resolution (Damaged Item)';
                                  })()}
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed opacity-95">
                                {(() => {
                                  const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
                                  if (cond.includes('lost') || cond.includes('nawala')) {
                                    return 'This equipment was declared lost. Replace the item or record replacement/settlement to complete the resolution.';
                                  }
                                  if (cond.includes('missing')) {
                                    return 'Some gear/accessories were reported missing. Return the missing items or replace them to complete resolution.';
                                  }
                                  return 'This item is damaged and pending resolution. Repair or replace the equipment to complete the return.';
                                })()}
                              </p>
                              {detailsBorrowing.dueDate && (
                                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-950 dark:text-amber-200 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30">
                                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>
                                    Target Resolution Deadline: {new Date(detailsBorrowing.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {new Date(detailsBorrowing.dueDate) < new Date() && (
                                      <span className="ml-1 text-destructive font-black uppercase tracking-wider text-[10px]">(OVERDUE)</span>
                                    )}
                                  </span>
                                </div>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setEditReturnCondition('Resolved');
                                  setEditStatus('RETURNED');
                                  setEditReturnNotes(detailsBorrowing.returnNotes ? `${detailsBorrowing.returnNotes}\n[Resolved]: ` : '');
                                  setResolveEvidencePhoto(null);
                                  setIsEditingDetails(true);
                                }}
                                className="mt-1 h-7 px-3 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Wrench className="h-3 w-3" />
                                Resolve
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <strong>Return Condition:</strong>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold",
                                (detailsBorrowing.returnCondition || '').toLowerCase().includes('lost')
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40'
                                  : (detailsBorrowing.returnCondition || '').toLowerCase().includes('missing')
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40'
                                  : (detailsBorrowing.returnCondition || '').toLowerCase().includes('damage') || isDamagedPendingRecord(detailsBorrowing)
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  : ['resolved', 'repaired', 'replaced', 'naayos', 'napalitan'].some(k => (detailsBorrowing.returnCondition || '').toLowerCase().includes(k))
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              )}
                            >
                              {(() => {
                                const cond = (detailsBorrowing.returnCondition || '').toLowerCase();
                                if (['resolved', 'repaired', 'replaced', 'naayos', 'napalitan'].some(k => cond.includes(k))) return 'Resolved';
                                if (cond.includes('lost') || cond.includes('nawala')) return 'Lost';
                                if (cond.includes('missing')) return detailsBorrowing.returnCondition || 'Missing Gear';
                                if (cond.includes('damag') || isDamagedPendingRecord(detailsBorrowing)) return 'Damaged';
                                return detailsBorrowing.returnCondition || 'Good Condition';
                              })()}
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

                  {Boolean(detailsBorrowing.returnPhotos && detailsBorrowing.returnPhotos.length > 0) && (() => {
                    const returnPhotosList = detailsBorrowing.returnPhotos || [];
                    const condLower = (detailsBorrowing.returnCondition || '').toLowerCase();
                    const isResolvedRecord = ['resolved', 'repaired', 'replaced', 'naayos', 'napalitan', 'good'].some(k => condLower.includes(k));

                    return (
                      <div className="pt-2 border-t border-border/50 space-y-2">
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" /> Photo Evidence:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {returnPhotosList.map((photo: string, idx: number) => {
                            const isResolutionPhoto = returnPhotosList.length > 1
                              ? idx > 0
                              : isResolvedRecord;

                          return (
                            <div key={idx} className="space-y-1">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1",
                                isResolutionPhoto
                                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30"
                              )}>
                                {isResolutionPhoto ? (
                                  <><CheckCircle className="h-2.5 w-2.5" /> Resolution Evidence (Okay)</>
                                ) : (
                                  <><AlertTriangle className="h-2.5 w-2.5" /> Damage Evidence (Before)</>
                                )}
                              </span>
                              <a
                                href={photo}
                                target="_blank"
                                rel="noreferrer"
                                className="relative aspect-video rounded-lg overflow-hidden border border-border/70 bg-black/5 hover:opacity-90 transition-opacity block group shadow-2xs"
                              >
                                <img
                                  src={photo}
                                  alt={isResolutionPhoto ? "Resolution evidence" : `Damage evidence ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-semibold transition-opacity">
                                  View Full Image
                                </span>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </div>

                </div>

                {/* ── STICKY MODAL FOOTER ── */}
                <DialogFooter className="p-2.5 sm:p-3 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 w-full min-w-0">
                  <div className="flex flex-row items-center justify-between gap-1.5 sm:gap-2 w-full min-w-0">
                    {/* LEFT — Download Report (only for damaged / lost / missing) */}
                    <div className="flex-shrink-0">
                      {detailsBorrowing && (
                        isDamagedPendingRecord(detailsBorrowing) ||
                        (detailsBorrowing.returnCondition || '').toLowerCase().includes('lost') ||
                        (detailsBorrowing.returnCondition || '').toLowerCase().includes('missing')
                      ) ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium border-sidebar/40 text-sidebar dark:text-sky-400 hover:bg-sidebar/10 cursor-pointer gap-1.5 shrink-0"
                          onClick={() => detailsBorrowing && handleDownloadIncidentReport(detailsBorrowing)}
                          disabled={isGeneratingReport || isSavingDetails}
                        >
                          {isGeneratingReport ? (
                            <><LoaderCircle className="h-3 w-3 animate-spin shrink-0" /> <span className="hidden xs:inline">Generating…</span><span className="xs:hidden">...</span></>
                          ) : (
                            <><FileDown className="h-3.5 w-3.5 shrink-0" /> <span>Download Report</span></>
                          )}
                        </Button>
                      ) : (
                        <span /> /* spacer to keep right side flush */
                      )}
                    </div>

                    {/* RIGHT — primary actions */}
                    <div className="flex flex-row items-center gap-1.5 sm:gap-2 shrink-0">
                      {isEditingDetails ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer shrink-0"
                            onClick={() => setIsEditingDetails(false)}
                            disabled={isSavingDetails}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className={cn(
                              "h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-xs transition-colors shrink-0",
                              editReturnCondition === 'Resolved' || editReturnCondition === 'Repaired' || editReturnCondition === 'Replaced'
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-sidebar hover:bg-sidebar/90"
                            )}
                            onClick={handleSaveDetails}
                            disabled={isSavingDetails || isUploadingResolvePhoto}
                          >
                            {isSavingDetails ? (
                              <><LoaderCircle className="h-3.5 w-3.5 mr-1 animate-spin shrink-0" /> Saving…</>
                            ) : editReturnCondition === 'Resolved' || editReturnCondition === 'Repaired' || editReturnCondition === 'Replaced' ? (
                              <><CheckCircle className="h-3.5 w-3.5 mr-1 shrink-0" /> Complete Return</>
                            ) : (
                              <><Save className="h-3.5 w-3.5 mr-1 shrink-0" /> Save Updates</>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium cursor-pointer shrink-0",
                              isDamagedPendingRecord(detailsBorrowing)
                                ? "border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                                : "border-sidebar/30 text-sidebar hover:bg-sidebar/10"
                            )}
                            onClick={() => {
                              if (isDamagedPendingRecord(detailsBorrowing)) {
                                setEditReturnCondition('Resolved');
                                setEditStatus('RETURNED');
                                setEditReturnNotes(detailsBorrowing.returnNotes ? `${detailsBorrowing.returnNotes}\n[Resolved]: ` : '');
                                setResolveEvidencePhoto(null);
                              }
                              setIsEditingDetails(true);
                            }}
                          >
                            {isDamagedPendingRecord(detailsBorrowing) ? (
                              <><Wrench className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400 shrink-0" /> Resolve</>
                            ) : (
                              <><Pencil className="h-3.5 w-3.5 mr-1 shrink-0" /> Edit Details</>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 sm:h-8.5 px-2.5 sm:px-3 rounded-lg text-xs font-medium border-border/80 hover:bg-muted/50 cursor-pointer shrink-0"
                            onClick={() => setDetailsBorrowing(null)}
                          >
                            Close
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
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
