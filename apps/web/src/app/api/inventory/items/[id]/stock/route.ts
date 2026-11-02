import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, quantity = 1, notes, workerId, actorId, actorName, actorEmail } = body;

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const qty = Number(quantity) || 1;
    let newStock = item.quantity;

    if (action === 'Stock In') {
      newStock += qty;
    } else if (action === 'Stock Out') {
      if (item.quantity < qty) {
        return NextResponse.json({ error: `Not enough stock. Available: ${item.quantity}` }, { status: 400 });
      }
      newStock -= qty;
    } else if (action === 'Adjustment' || action === 'Adjust') {
      newStock = qty;
    } else {
      return NextResponse.json({ error: 'Invalid stock action' }, { status: 400 });
    }

    // Determine status
    let newStatus = item.status;
    if (newStock === 0 && item.status !== 'Borrowed') {
      newStatus = 'Out of Stock';
    } else if (newStock > 0 && (item.status === 'Out of Stock' || item.status === 'Low Stock')) {
      newStatus = newStock <= item.minQuantity && item.minQuantity > 0 ? 'Low Stock' : 'Good Condition';
    }

    const [updatedItem, log] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id },
        data: {
          quantity: newStock,
          status: newStatus,
        },
        include: { category: true },
      }),
      prisma.inventoryLog.create({
        data: {
          itemId: id,
          workerId: workerId || actorId || null,
          type: action === 'Adjust' ? 'Adjustment' : action,
          quantity: action === 'Adjust' || action === 'Adjustment' ? Math.abs(newStock - item.quantity) : qty,
          balance: newStock,
          notes: notes || `Quick ${action} (${action === 'Stock In' ? '+' : '-'}${qty})`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      updatedItem: {
        ...updatedItem,
        stock: updatedItem.quantity,
        minStock: updatedItem.minQuantity,
      },
      log,
    });
  } catch (error: any) {
    console.error('[POST /api/inventory/items/[id]/stock] error:', error);
    return NextResponse.json({ error: 'Failed to update stock', details: error?.message }, { status: 500 });
  }
}
