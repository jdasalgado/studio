import { NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function GET() {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Auto-migrate legacy returned records that were marked as Damaged to PENDING
    try {
      await prisma.inventoryBorrowing.updateMany({
        where: {
          status: 'RETURNED',
          returnCondition: { contains: 'Damaged', mode: 'insensitive' },
        },
        data: {
          status: 'PENDING',
        },
      });
    } catch (e) {
      console.warn('Dashboard stats auto-migration skipped:', e);
    }

    const [
      totalItems,
      borrowedCount,
      overdueCount,
      returnedCount,
      pendingDamagedCount,
      outOfStock,
      allItems,
      totalLogs,
      stockInCount,
      stockOutCount,
      adjustmentsCount,
      totalCategories,
    ] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryBorrowing.count({ where: { status: 'BORROWED' } }),
      prisma.inventoryBorrowing.count({
        where: {
          status: 'BORROWED',
          dueDate: { lt: new Date() },
        },
      }),
      prisma.inventoryBorrowing.count({
        where: {
          status: 'RETURNED',
          NOT: { returnCondition: { contains: 'Damaged', mode: 'insensitive' } },
        },
      }),
      prisma.inventoryBorrowing.count({
        where: {
          OR: [
            { status: 'PENDING' },
            { returnCondition: { contains: 'Damaged', mode: 'insensitive' } },
          ],
        },
      }),
      prisma.inventoryItem.count({ where: { quantity: 0 } }),
      prisma.inventoryItem.findMany({
        select: { quantity: true, minQuantity: true, nextMaintenanceDate: true, type: true, categoryId: true },
      }),
      prisma.inventoryLog.count(),
      prisma.inventoryLog.count({ where: { type: { in: ['Stock In', 'STOCK_IN', 'RESTOCK'] } } }),
      prisma.inventoryLog.count({ where: { type: { in: ['Stock Out', 'STOCK_OUT', 'DISPOSE'] } } }),
      prisma.inventoryLog.count({ where: { type: { in: ['Adjustment', 'ADJUSTMENT', 'Audit'] } } }),
      prisma.inventoryCategory.count(),
    ]);

    const totalQuantity = allItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
    const lowStockAlerts = allItems.filter((i) => (i.quantity ?? 0) <= (i.minQuantity > 0 ? i.minQuantity : 5)).length;
    const pmsAlerts = allItems.filter((i) => i.nextMaintenanceDate && new Date(i.nextMaintenanceDate) <= thirtyDaysFromNow).length;
    const equipmentCount = allItems.filter((i) => i.type === 'EQUIPMENT').length;
    const consumableCount = allItems.filter((i) => i.type === 'CONSUMABLE').length;
    const categorizedItemsCount = allItems.filter((i) => !!i.categoryId).length;

    return NextResponse.json({
      totalItems,
      totalQuantity,
      borrowedCount,
      overdueCount,
      returnedCount,
      pendingDamagedCount,
      lowStockAlerts,
      outOfStock,
      pmsAlerts,
      totalLogs,
      stockInCount,
      stockOutCount,
      adjustmentsCount,
      totalCategories,
      equipmentCount,
      consumableCount,
      categorizedItemsCount,
      totalInventoryValue: `${totalItems} SKUs`,
    });
  } catch (error: any) {
    console.error('[GET /api/dashboard/stats] error:', error);
    return NextResponse.json({
      totalItems: 0,
      totalQuantity: 0,
      borrowedCount: 0,
      overdueCount: 0,
      returnedCount: 0,
      pendingDamagedCount: 0,
      lowStockAlerts: 0,
      outOfStock: 0,
      pmsAlerts: 0,
      totalLogs: 0,
      stockInCount: 0,
      stockOutCount: 0,
      adjustmentsCount: 0,
      totalCategories: 0,
      equipmentCount: 0,
      consumableCount: 0,
      categorizedItemsCount: 0,
      totalInventoryValue: '0 SKUs',
    });
  }
}
