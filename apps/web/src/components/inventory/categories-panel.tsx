"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  Folder,
  Box,
  Mic,
  Video,
  Lightbulb,
  Music,
  Laptop,
  Armchair,
  Loader2,
  Search,
  X,
  Boxes,
  Check,
  Tag,
  AlertTriangle,
  FolderTree,
  Camera,
  Headphones,
  Cable,
  Wrench,
  AlignLeft,
  MoreHorizontal,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@studio/ui';
import { useInventory, type InventoryCategory } from '@/hooks/use-inventory';
import { cn } from '@/lib/utils';

const AVAILABLE_ICONS = [
  { name: 'mic', icon: Mic, label: 'Audio & Mic' },
  { name: 'box', icon: Box, label: 'Supplies & Box' },
  { name: 'video', icon: Video, label: 'Video & Projection' },
  { name: 'lightbulb', icon: Lightbulb, label: 'Lighting' },
  { name: 'music', icon: Music, label: 'Instruments' },
  { name: 'laptop', icon: Laptop, label: 'IT & Electronics' },
  { name: 'armchair', icon: Armchair, label: 'Furniture' },
  { name: 'folder', icon: Folder, label: 'General' },
  { name: 'camera', icon: Camera, label: 'Cameras & Video' },
  { name: 'headphones', icon: Headphones, label: 'Sound & Mon.' },
  { name: 'cable', icon: Cable, label: 'Cables & Power' },
  { name: 'wrench', icon: Wrench, label: 'Tools & Hardware' },
];

const PRESET_COLORS = [
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#64748b', label: 'Slate' },
  { hex: '#ef4444', label: 'Rose' },
  { hex: '#14b8a6', label: 'Teal' },
];

export function CategoriesPanel() {
  const { categories, fetchCategories, loading } = useInventory();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<InventoryCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('box');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setColor('#3b82f6');
    setIcon('box');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (cat: InventoryCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setColor(cat.color || '#3b82f6');
    setIcon(cat.icon || 'box');
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required. Please enter a category name.');
      return;
    }
    if (name.trim().length > 50) {
      setError('Category name must not exceed 50 characters.');
      return;
    }
    if (description && description.trim().length > 250) {
      setError('Category description must not exceed 250 characters.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingCategory) {
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, color, icon }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update category');
        }
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, color, icon }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create category');
        }
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete category');
      }
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const renderIcon = (iconName?: string) => {
    const found = AVAILABLE_ICONS.find((i) => i.name === iconName);
    const Comp = found ? found.icon : Folder;
    return <Comp className="h-5 w-5" />;
  };

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, search]);

  return (
    <div className="space-y-4">
      {/* ── UNIFIED TOOLBAR CONTAINER ── */}
      <Card className="rounded-2xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input on the left */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs rounded-xl bg-muted/30 border-border/70 focus:bg-background transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Add Category Button (Right side on both mobile and desktop) */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            <Button
              size="sm"
              className="gap-1.5 h-9 rounded-xl bg-sidebar hover:bg-sidebar/90 text-white font-bold text-xs shadow-xs cursor-pointer px-4"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* ── GRID OF CATEGORIES ── */}
      {loading && categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center animate-pulse">
            <Layers className="h-5 w-5 animate-spin" />
          </div>
          <span className="text-xs font-semibold">Loading categories...</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <Card className="rounded-2xl border border-border/70 p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto border border-border/70">
            <FolderTree className="h-6 w-6 opacity-60" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">No categories found</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              {search
                ? 'No categories match your search query. Try clearing the search bar.'
                : 'Click "+ Add Category" above to register your first equipment classification.'}
            </p>
          </div>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch('')}
              className="h-8 text-xs rounded-xl cursor-pointer"
            >
              Clear Search
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories.map((cat) => {
            const catColor = cat.color || '#3b82f6';
            return (
              <div
                key={cat.id}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-white dark:bg-card hover:border-sidebar/40 dark:hover:border-sidebar/60 transition-all shadow-card-dark hover:shadow-lg flex flex-col justify-between"
              >
                {/* Top Colored Accent Stripe */}
                <div
                  className="h-1.5 w-full shrink-0"
                  style={{ backgroundColor: catColor }}
                />

                <div className="p-4 space-y-3">
                  {/* Top Row: Category Icon & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: `${catColor}15`,
                        color: catColor,
                        borderColor: `${catColor}30`,
                      }}
                    >
                      {renderIcon(cat.icon)}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg border-border/80">
                        <DropdownMenuItem
                          onClick={() => openEdit(cat)}
                          className="cursor-pointer gap-2 rounded-lg text-xs font-medium py-2"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          Edit Category
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setCategoryToDelete(cat)}
                          className="text-destructive cursor-pointer gap-2 rounded-lg text-xs font-medium py-2 focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          Delete Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-sm font-bold text-foreground font-headline group-hover:text-sidebar transition-colors tracking-tight">
                      {cat.name}
                    </h4>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {cat.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Items Count */}
                <div className="p-3.5 border-t border-border/60 bg-muted/[0.12] flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-[11px]">Items Tracked</span>
                  <span className="font-mono font-bold text-xs text-foreground bg-muted/70 px-2 py-0.5 rounded-lg border border-border/50">
                    {cat.itemCount ?? 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT CATEGORY MODAL ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl md:rounded-3xl border-border/80 shadow-2xl gap-0 bg-background [&>button:last-child]:hidden">
          {/* ── STICKY MODAL HEADER ── */}
          <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-border/70 bg-card shrink-0 text-left space-y-0 w-full min-w-0">
            <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300 shadow-2xs"
                  style={{
                    backgroundColor: `${color}15`,
                    color: color,
                    borderColor: `${color}40`,
                    boxShadow: `0 0 20px -2px ${color}35`,
                  }}
                >
                  {renderIcon(icon)}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base font-bold font-headline tracking-tight text-foreground">
                      {editingCategory ? 'Edit Category' : 'Create Category'}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Define category name, description, icon and theme color.
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer shrink-0 -mt-1 -mr-1"
                title="Close modal"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden w-full">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 w-full min-w-0">
            {error && (
              <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Category Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <span>Category Name</span>
                  <span className="text-destructive font-bold">*</span>
                </Label>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  required
                  maxLength={50}
                  placeholder="e.g. Consumables & Supplies"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl bg-muted/30 border-border/70 focus:bg-background focus:ring-2 focus:ring-sidebar/20 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>Description</span>
                <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  maxLength={250}
                  placeholder="e.g. Cables, batteries, stationery, adapters"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 250))}
                  className="pl-9 h-9 text-xs rounded-xl bg-muted/30 border-border/70 focus:bg-background focus:ring-2 focus:ring-sidebar/20 transition-all"
                />
              </div>
            </div>

            {/* Icon Picker */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Select Icon
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {AVAILABLE_ICONS.find((i) => i.name === icon)?.label}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_ICONS.map((ic) => {
                  const IconComp = ic.icon;
                  const isSelected = icon === ic.name;
                  return (
                    <button
                      key={ic.name}
                      type="button"
                      onClick={() => setIcon(ic.name)}
                      className={cn(
                        "p-2 rounded-xl border text-xs flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer min-h-[66px] relative",
                        isSelected
                          ? "shadow-xs font-bold scale-[1.02]"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground hover:-translate-y-0.5"
                      )}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${color}15`,
                              borderColor: `${color}80`,
                              color: color,
                              boxShadow: `0 0 0 1px ${color}40`,
                            }
                          : undefined
                      }
                    >
                      <IconComp className="h-4.5 w-4.5 shrink-0" />
                      <span className="text-[10px] leading-tight text-center font-medium line-clamp-2 px-0.5 break-words">
                        {ic.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Theme Accent Color
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block border border-border/40"
                    style={{ backgroundColor: color }}
                  />
                  {PRESET_COLORS.find((c) => c.hex === color)?.label || color}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => {
                  const isSelected = color === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      title={c.label}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all duration-200 flex items-center justify-center cursor-pointer hover:scale-110 relative",
                        isSelected
                          ? "ring-2 ring-offset-2 ring-foreground/80 dark:ring-white scale-105 shadow-sm border-white/40"
                          : "border-transparent opacity-85 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white drop-shadow-md stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            </div>

            {/* ── STICKY MODAL FOOTER ── */}
            <DialogFooter className="p-3.5 sm:p-4 border-t border-border/70 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-2.5 w-full min-w-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl border-border/80 hover:bg-muted/50 cursor-pointer flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="min-h-[2.25rem] sm:min-h-[2.5rem] h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold rounded-xl bg-sidebar hover:bg-sidebar/90 text-white shadow-xs hover:shadow transition-all cursor-pointer flex-1 sm:flex-initial"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : editingCategory ? (
                  'Save Changes'
                ) : (
                  'Create Category'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CATEGORY CONFIRMATION MODAL ── */}
      <Dialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-6 text-center shadow-2xl border-border/80 gap-0">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 mx-auto flex items-center justify-center mb-3.5 shadow-xs">
            <Trash2 className="h-6 w-6" />
          </div>
          <DialogHeader className="space-y-1.5 p-0 text-center sm:text-center">
            <DialogTitle className="text-base font-bold text-center font-headline text-foreground">
              Delete Category
            </DialogTitle>
            <DialogDescription className="text-xs text-center text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete category <strong className="text-foreground font-semibold">"{categoryToDelete?.name}"</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2.5 sm:justify-center mt-5 p-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl text-xs h-9 font-semibold border-border/80 hover:bg-muted/60 cursor-pointer"
              onClick={() => setCategoryToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1 rounded-xl text-xs h-9 font-bold shadow-xs cursor-pointer"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
