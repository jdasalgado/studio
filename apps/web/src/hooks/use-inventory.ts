import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface InventoryItem {
  id: string;
  name: string;
  inventoryCode?: string;
  categoryId: string;
  type: 'EQUIPMENT' | 'CONSUMABLE';
  stock: number;
  quantity?: number;
  minStock: number;
  minQuantity?: number;
  unit: string;
  status: string;
  statusDetails?: string;
  location?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
  assignedTo?: string;
  imageUrl?: string;
  isApprovalRequired?: boolean;
  isKit?: boolean;
  group?: string;
  nextMaintenanceDate?: string;
  parentId?: string;
  category?: { id: string; name: string; color?: string; icon?: string };
  children?: any[];
  parent?: any;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  group?: string;
  isActive: boolean;
  itemCount?: number;
}

export interface InventoryLog {
  id: string;
  itemId: string;
  workerId?: string;
  workerName?: string;
  action: string;
  type: string;
  quantity: number;
  balance: number;
  notes?: string;
  timestamp: string;
  item?: { id: string; name: string; inventoryCode?: string; imageUrl?: string };
  worker?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
}

export interface InventoryBorrowing {
  id: string;
  itemId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowedAt: string;
  dueDate?: string;
  returnedAt?: string;
  status: string;
  checkoutNotes?: string;
  checkoutCondition?: string;
  checkoutChecklist?: any;
  returnNotes?: string;
  returnCondition?: string;
  returnChecklist?: any;
  returnPhotos?: string[];
  item: { id: string; name: string; inventoryCode?: string; status: string; imageUrl?: string; stock?: number };
  borrower?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; avatarUrl?: string };
}

const EMPTY_ARRAY: any[] = [];

export function useInventory() {
  const queryClient = useQueryClient();
  const [itemParams, setItemParams] = useState<any>({ skip: '0', take: '12' });
  const [borrowingParams, setBorrowingParams] = useState<any>({ skip: '0', take: '10' });
  const [logsTake, setLogsTake] = useState<number>(30);
  const [mutationLoading, setMutationLoading] = useState(false);

  // 1. Dashboard Stats Query (Cached & Deduplicated across components, 2s live polling)
  const statsQuery = useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return await res.json();
    },
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });

  // 2. Categories Query (5 min cache)
  const categoriesQuery = useQuery<InventoryCategory[]>({
    queryKey: ['inventory', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60_000,
  });

  // 3. Locations Query (5 min cache)
  const locationsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ['inventory', 'locations'],
    queryFn: async () => {
      const res = await fetch('/api/locations');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60_000,
  });

  // 4. Activity Logs Query (Live 2s polling)
  const logsQuery = useQuery<InventoryLog[]>({
    queryKey: ['inventory', 'logs', logsTake],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/logs?take=${logsTake}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });

  // 5. Items Query (Live 2s polling with placeholderData for smooth paging)
  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', itemParams],
    queryFn: async () => {
      const query = new URLSearchParams(itemParams).toString();
      const res = await fetch(`/api/inventory/items?${query}`);
      if (!res.ok) throw new Error('Failed to fetch items');
      return await res.json();
    },
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    placeholderData: (prev) => prev,
  });

  // 6. Borrowings Query (Live 2s polling)
  const borrowingsQuery = useQuery({
    queryKey: ['inventory', 'borrowings', borrowingParams],
    queryFn: async () => {
      const query = new URLSearchParams(borrowingParams).toString();
      const res = await fetch(`/api/borrowings?${query}`);
      if (!res.ok) throw new Error('Failed to fetch borrowings');
      return await res.json();
    },
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    placeholderData: (prev) => prev,
  });

  // Cache Invalidation Helper
  const invalidateInventory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['transaction-logs'] });
  }, [queryClient]);

  // Backward-compatible trigger functions
  const fetchStats = useCallback(async () => {
    return await queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
  }, [queryClient]);

  const fetchLogs = useCallback(async (take: number = 30) => {
    setLogsTake(take);
  }, []);

  const fetchItems = useCallback(async (params: any = {}) => {
    setItemParams(params);
  }, []);

  const fetchCategories = useCallback(async () => {
    return await queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
  }, [queryClient]);

  const fetchLocations = useCallback(async () => {
    return await queryClient.invalidateQueries({ queryKey: ['inventory', 'locations'] });
  }, [queryClient]);

  const fetchBorrowings = useCallback(async (params: any = {}) => {
    setBorrowingParams(params);
  }, []);

  // Quick Action
  const updateStock = async (
    id: string,
    action: 'Stock In' | 'Stock Out' | 'Adjustment',
    quantity: number,
    notes?: string,
    actor?: { id?: string | null; name?: string | null; email?: string | null }
  ) => {
    try {
      const res = await fetch(`/api/inventory/items/${id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          quantity,
          notes,
          actorId: actor?.id,
          actorName: actor?.name,
          actorEmail: actor?.email,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update stock');
      }
      invalidateInventory();
      return await res.json();
    } catch (error) {
      console.error('Failed to update stock', error);
      throw error;
    }
  };

  const createItem = async (data: any) => {
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create item');
      }
      invalidateInventory();
      return await res.json();
    } catch (error) {
      console.error('Failed to create item', error);
      throw error;
    }
  };

  const updateItem = async (id: string, data: any) => {
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update item');
      }
      invalidateInventory();
      return await res.json();
    } catch (error) {
      console.error('Failed to update item', error);
      throw error;
    }
  };

  const deleteItem = async (id: string, actor?: { actorId?: string; actorName?: string; actorEmail?: string }) => {
    try {
      const q = new URLSearchParams();
      if (actor?.actorId) q.set('actorId', actor.actorId);
      if (actor?.actorName) q.set('actorName', actor.actorName);
      if (actor?.actorEmail) q.set('actorEmail', actor.actorEmail);
      const url = `/api/inventory/items/${id}${q.toString() ? '?' + q.toString() : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete item');
      }
      invalidateInventory();
    } catch (error) {
      console.error('Failed to delete item', error);
      throw error;
    }
  };

  const bulkUpdateItems = async (itemIds: string[], data: any) => {
    try {
      const res = await fetch('/api/inventory/items/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, data }),
      });
      if (!res.ok) throw new Error('Failed to bulk update');
      invalidateInventory();
    } catch (error) {
      console.error('Failed to bulk update items', error);
      throw error;
    }
  };

  const bulkDeleteItems = async (itemIds: string[]) => {
    try {
      const res = await fetch('/api/inventory/items/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) throw new Error('Failed to bulk delete');
      invalidateInventory();
    } catch (error) {
      console.error('Failed to bulk delete items', error);
      throw error;
    }
  };

  const bulkImportItems = async (itemsList: any[]) => {
    try {
      setMutationLoading(true);
      const res = await fetch('/api/inventory/items/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsList }),
      });
      if (!res.ok) throw new Error('Failed to import items');
      invalidateInventory();
      return await res.json();
    } catch (error) {
      console.error('Failed to bulk import', error);
      throw error;
    } finally {
      setMutationLoading(false);
    }
  };

  return {
    stats: statsQuery.data ?? null,
    logs: logsQuery.data ?? EMPTY_ARRAY,
    items: (itemsQuery.data?.items as InventoryItem[]) ?? EMPTY_ARRAY,
    totalItems: itemsQuery.data?.total ?? 0,
    loading: itemsQuery.isLoading || mutationLoading,
    categories: categoriesQuery.data ?? EMPTY_ARRAY,
    locations: locationsQuery.data ?? EMPTY_ARRAY,
    borrowings: (borrowingsQuery.data?.borrowings as InventoryBorrowing[]) ?? EMPTY_ARRAY,
    totalBorrowings: borrowingsQuery.data?.total ?? 0,
    fetchStats,
    fetchLogs,
    fetchItems,
    fetchCategories,
    fetchLocations,
    fetchBorrowings,
    updateStock,
    createItem,
    updateItem,
    deleteItem,
    bulkUpdateItems,
    bulkDeleteItems,
    bulkImportItems,
  };
}
