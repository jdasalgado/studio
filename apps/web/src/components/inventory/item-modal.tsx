"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  DatePicker,
} from '@studio/ui';
import {
  Boxes,
  Package,
  Barcode,
  Tag,
  Layers,
  MapPin,
  User,
  Calendar,
  ShieldCheck,
  ImageIcon,
  Loader2,
  AlertTriangle,
  FolderTree,
  Sparkles,
  CheckCircle2,
  X,
  UploadCloud,
  Trash2,
  Camera,
} from 'lucide-react';
import { useInventory, type InventoryItem } from '@/hooks/use-inventory';
import { useUserRole } from '@/hooks/use-user-role';
import { useAuthStore } from '@studio/store';
import { cn } from '@/lib/utils';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  onSaved?: () => void;
}

export function ItemModal({ isOpen, onClose, item, onSaved }: ItemModalProps) {
  const { categories, locations, fetchCategories, fetchLocations, createItem, updateItem } = useInventory();
  const { workerProfile } = useUserRole();
  const { user } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    type: 'EQUIPMENT',
    stock: 0,
    minStock: 0,
    unit: 'pcs',
    status: 'Good Condition',
    statusDetails: '',
    location: '',
    inventoryCode: '',
    imageUrl: '',
    isKit: false,
    isApprovalRequired: false,
    nextMaintenanceDate: '',
    aisle: '',
    shelf: '',
    bin: '',
    assignedTo: '',
    parentId: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('Image file exceeds 15MB limit.');
      e.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    setError('');

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
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            setFormData((prev) => ({ ...prev, imageUrl: compressed }));
          } else {
            setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
          }
          setIsUploadingImage(false);
        };
        img.onerror = () => {
          setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
          setIsUploadingImage(false);
        };
        img.src = reader.result;
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchLocations();
    }
  }, [isOpen, fetchCategories, fetchLocations]);

  const defaultCategoryId = categories[0]?.id || '';

  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setFormData({
        name: item.name || '',
        categoryId: item.categoryId || defaultCategoryId,
        type: item.type || 'EQUIPMENT',
        stock: item.stock ?? item.quantity ?? 0,
        minStock: item.minStock ?? item.minQuantity ?? 0,
        unit: item.unit || 'pcs',
        status: item.status || 'Good Condition',
        statusDetails: item.statusDetails || '',
        location: item.location || '',
        inventoryCode: item.inventoryCode || '',
        imageUrl: item.imageUrl || '',
        isKit: item.isKit || item.group === 'Kit' || false,
        isApprovalRequired: item.isApprovalRequired || false,
        nextMaintenanceDate: item.nextMaintenanceDate
          ? new Date(item.nextMaintenanceDate).toISOString().split('T')[0]
          : '',
        aisle: item.aisle || '',
        shelf: item.shelf || '',
        bin: item.bin || '',
        assignedTo: item.assignedTo || '',
        parentId: item.parentId || '',
      });
    } else {
      setFormData({
        name: '',
        categoryId: defaultCategoryId,
        type: 'EQUIPMENT',
        stock: 0,
        minStock: 0,
        unit: 'pcs',
        status: 'Good Condition',
        statusDetails: '',
        location: '',
        inventoryCode: '',
        imageUrl: '',
        isKit: false,
        isApprovalRequired: false,
        nextMaintenanceDate: '',
        aisle: '',
        shelf: '',
        bin: '',
        assignedTo: '',
        parentId: '',
      });
    }
    setError('');
  }, [item, isOpen, defaultCategoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Item Name is required. Please provide a name for this item.');
      return;
    }
    if (formData.name.trim().length > 50) {
      setError('Item Name is too long (maximum 50 characters).');
      return;
    }
    if (!formData.categoryId) {
      setError('Category is required. Please select a category from the dropdown.');
      return;
    }
    const stockVal = Number(formData.stock);
    if (isNaN(stockVal) || stockVal < 0) {
      setError('Current Stock cannot be negative. Please enter a valid number.');
      return;
    }
    if (stockVal > 999999) {
      setError('Current Stock exceeds the maximum limit (up to 999,999 units only).');
      return;
    }
    const minStockVal = Number(formData.minStock);
    if (isNaN(minStockVal) || minStockVal < 0) {
      setError('Minimum Stock Alert cannot be negative.');
      return;
    }
    if (minStockVal > 999999) {
      setError('Minimum Stock Alert exceeds the maximum limit (up to 999,999 units only).');
      return;
    }
    if (formData.unit && formData.unit.length > 20) {
      setError('Unit name must not exceed 20 characters (e.g. pcs, box, set).');
      return;
    }
    if (formData.location && formData.location.length > 100) {
      setError('Location Area / Room must not exceed 100 characters.');
      return;
    }
    if (formData.assignedTo && formData.assignedTo.length > 50) {
      setError('Assigned Custodian must not exceed 50 characters.');
      return;
    }
    if (formData.aisle && formData.aisle.length > 20) {
      setError('Aisle code must not exceed 20 characters.');
      return;
    }
    if (formData.shelf && formData.shelf.length > 20) {
      setError('Shelf code must not exceed 20 characters.');
      return;
    }
    if (formData.bin && formData.bin.length > 20) {
      setError('Bin code must not exceed 20 characters.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const actorData = {
        ...formData,
        actorId: workerProfile?.id || user?.id || null,
        actorName: workerProfile ? `${workerProfile.firstName} ${workerProfile.lastName}`.trim() : (user?.displayName || user?.email || 'Admin'),
        actorEmail: user?.email || workerProfile?.email || null,
      };

      if (item?.id) {
        await updateItem(item.id, actorData);
      } else {
        await createItem(actorData);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden"
        style={{
          width: "min(calc(100vw - 1rem), 46rem)",
          maxHeight: "min(calc(100dvh - 1.5rem), 92vh)",
        }}
      >
        {/* ── STICKY MODAL HEADER ── */}
        <DialogHeader className="p-4 sm:p-5 pb-3.5 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
          <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <DialogTitle className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground flex items-center gap-2 flex-wrap min-w-0">
                  <span>{item ? (item.name || item.inventoryCode) : 'Add New Item'}</span>
                  {item?.inventoryCode && (
                    <span className="font-mono text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/70 shrink-0">
                      {item.inventoryCode}
                    </span>
                  )}
                  {item?.status && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap shadow-2xs border shrink-0",
                        item.status === "Good Condition"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : item.status === "Low Stock"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          item.status === "Good Condition"
                            ? "bg-emerald-500"
                            : item.status === "Low Stock"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-rose-500"
                        )}
                      />
                      {item.status}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground break-words leading-snug">
                  {item
                    ? 'Update specifications, stock levels, location placement, and PMS status.'
                    : 'Register a new equipment or consumable record into the catalog.'}
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
              title="Close modal"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        {/* ── FORM CONTENT ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 w-full min-w-0">
            {error && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {/* 1. Item Specifications */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5 w-full min-w-0">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider font-headline">
                  Item Specifications
                </span>
              </div>

              {/* Row 1: Item Name & Item Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 w-full min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="item-name" className="text-xs font-semibold text-foreground/85 flex items-center gap-1">
                    <span>Item Name</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="item-name"
                    required
                    maxLength={50}
                    placeholder="e.g. Chauvet DJ SlimPAR Pro LED"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 50) })}
                    className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="item-code" className="text-xs font-semibold text-foreground/85 flex items-center gap-1">
                      <span>Item Code / Barcode</span>
                    </Label>
                    <span className="text-[10px] font-medium text-muted-foreground/75 bg-muted/60 px-1.5 py-0.5 rounded">Auto</span>
                  </div>
                  <div className="relative w-full min-w-0">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      id="item-code"
                      readOnly
                      tabIndex={-1}
                      placeholder="Auto-generated if empty"
                      value={formData.inventoryCode}
                      className="w-full min-w-0 pl-9 h-9 text-xs rounded-xl bg-muted/40 border border-border/70 font-mono text-muted-foreground placeholder:text-muted-foreground/70 cursor-not-allowed select-none focus-visible:ring-0 focus-visible:border-border/70 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Category & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 w-full min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold text-foreground/85 flex items-center gap-1">
                    <span>Category</span>
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.categoryId || ''}
                    onValueChange={(val) => setFormData({ ...formData, categoryId: val })}
                  >
                    <SelectTrigger className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium hover:bg-muted/50 transition-colors focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate text-left flex-1 min-w-0">
                          <SelectValue placeholder="Select Category..." />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl w-[var(--radix-popover-trigger-width)]">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold text-foreground/85 flex items-center gap-1">
                    <span>Type</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val) => setFormData({ ...formData, type: val as any })}
                  >
                    <SelectTrigger className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium hover:bg-muted/50 transition-colors focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar">
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate text-left flex-1 min-w-0">
                          <SelectValue placeholder="Select Type..." />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl w-[var(--radix-popover-trigger-width)]">
                      <SelectItem value="EQUIPMENT" className="text-xs font-medium">
                        Equipment (Tracked &amp; Borrowable)
                      </SelectItem>
                      <SelectItem value="CONSUMABLE" className="text-xs font-medium">
                        Consumable (Stock tracked only)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. Stock & Condition Section */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5 w-full min-w-0">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <Boxes className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider font-headline">
                  Stock &amp; Condition
                </span>
              </div>

              {/* Row 1: Stock, Min Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 w-full min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="current-stock" className="text-xs font-semibold text-foreground/85">
                    Current Stock
                  </Label>
                  <Input
                    id="current-stock"
                    type="number"
                    min="0"
                    max="999999"
                    value={formData.stock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
                      const num = raw === "" ? 0 : Math.min(parseInt(raw, 10) || 0, 999999);
                      setFormData({ ...formData, stock: num });
                    }}
                    className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 font-medium text-foreground focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="min-stock" className="text-xs font-semibold text-foreground/85">
                    Min Stock Alert
                  </Label>
                  <Input
                    id="min-stock"
                    type="number"
                    min="0"
                    max="999999"
                    value={formData.minStock}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
                      const num = raw === "" ? 0 : Math.min(parseInt(raw, 10) || 0, 999999);
                      setFormData({ ...formData, minStock: num });
                    }}
                    className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 font-medium text-foreground focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Condition / Status & Next Maintenance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 w-full min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold text-foreground/85">
                    Condition / Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium hover:bg-muted/50 transition-colors focus:ring-1 focus:ring-sidebar/40 focus:border-sidebar">
                      <span className="truncate text-left flex-1 min-w-0">
                        <SelectValue placeholder="Select Status..." />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl w-[var(--radix-popover-trigger-width)]">
                      <SelectItem value="Good Condition" className="text-xs font-medium">Good Condition</SelectItem>
                      <SelectItem value="Low Stock" className="text-xs font-medium">Low Stock</SelectItem>
                      <SelectItem value="Out of Stock" className="text-xs font-medium">Out of Stock</SelectItem>
                      <SelectItem value="Under Maintenance" className="text-xs font-medium">Under Maintenance</SelectItem>
                      <SelectItem value="Damaged" className="text-xs font-medium">Damaged</SelectItem>
                      <SelectItem value="Borrowed" className="text-xs font-medium">Borrowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="maintenance-date" className="text-xs font-semibold text-foreground/85">
                    Next Maintenance (PMS)
                  </Label>
                  <DatePicker
                    value={formData.nextMaintenanceDate}
                    onChange={(date) => setFormData({ ...formData, nextMaintenanceDate: date })}
                    placeholder="dd/mm/yyyy"
                    className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 3. Location & Placement Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5 w-full min-w-0">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider font-headline">
                  Location &amp; Placement
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 w-full min-w-0">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="loc-area" className="text-xs font-semibold text-foreground/85">Location Area / Room</Label>
                  <Input
                    id="loc-area"
                    maxLength={100}
                    placeholder="e.g. 4th Floor Studio"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value.slice(0, 100) })}
                    list="locations-list"
                    className="w-full min-w-0 h-9 px-3 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                  />
                  <datalist id="locations-list">
                    {locations.map((l) => (
                      <option key={l.id} value={l.name} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor="assigned-custodian" className="text-xs font-semibold text-foreground/85">Assigned Custodian / Person</Label>
                  <div className="relative w-full min-w-0">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="assigned-custodian"
                      maxLength={50}
                      placeholder="e.g. Tech Head"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value.slice(0, 50) })}
                      className="w-full min-w-0 pl-9 h-9 text-xs rounded-xl bg-background border border-border/70 text-foreground font-medium shadow-2xs focus-visible:ring-1 focus-visible:ring-sidebar/40 focus-visible:border-sidebar transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3.5 pt-1 w-full min-w-0">
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="loc-aisle" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center block truncate">Aisle</Label>
                  <Input
                    id="loc-aisle"
                    maxLength={20}
                    placeholder="A-1"
                    value={formData.aisle}
                    onChange={(e) => setFormData({ ...formData, aisle: e.target.value.slice(0, 20) })}
                    className="w-full min-w-0 h-9 px-1.5 text-xs rounded-xl bg-background border border-border/70 text-center font-medium text-foreground shadow-2xs"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <Label htmlFor="loc-shelf" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center block truncate">Shelf</Label>
                  <Input
                    id="loc-shelf"
                    maxLength={20}
                    placeholder="S-2"
                    value={formData.shelf}
                    onChange={(e) => setFormData({ ...formData, shelf: e.target.value.slice(0, 20) })}
                    className="w-full min-w-0 h-9 px-1.5 text-xs rounded-xl bg-background border border-border/70 text-center font-medium text-foreground shadow-2xs"
                  />
                </div>

                <div className="space-y-1 min-w-0">
                  <Label htmlFor="loc-bin" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center block truncate">Bin</Label>
                  <Input
                    id="loc-bin"
                    maxLength={20}
                    placeholder="B-04"
                    value={formData.bin}
                    onChange={(e) => setFormData({ ...formData, bin: e.target.value.slice(0, 20) })}
                    className="w-full min-w-0 h-9 px-1.5 text-xs rounded-xl bg-background border border-border/70 text-center font-medium text-foreground shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* 4. Photo Proof & Attachments */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card/60 shadow-2xs space-y-3.5 w-full min-w-0">
              <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
                <Camera className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider font-headline">
                  Item Photo
                </span>
              </div>

              <div className="space-y-2 w-full min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />

                {formData.imageUrl ? (
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-muted/40 border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={formData.imageUrl}
                        alt="Item Preview"
                        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-cover border border-border shrink-0 shadow-2xs"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <div className="text-xs min-w-0 flex-1">
                        <p className="font-semibold text-foreground break-words">Photo Attached</p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground break-words">Ready to save with item</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50"
                      >
                        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Change</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        disabled={isUploadingImage}
                        className="h-8 text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer px-2 sm:px-2.5"
                        title="Remove photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="w-full flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                      {isUploadingImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {isUploadingImage ? "Processing photo..." : "Click to upload item photo"}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                      PNG, JPG, WEBP, or GIF (max. 15MB)
                    </p>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── STICKY MODAL FOOTER ── */}
          <DialogFooter className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2.5 w-full min-w-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 text-xs font-bold rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : item ? (
                'Save Changes'
              ) : (
                'Add Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
