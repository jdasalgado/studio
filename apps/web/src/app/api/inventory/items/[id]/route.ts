import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        children: true,
        parent: true,
        borrowings: {
          take: 5,
          orderBy: { borrowedAt: 'desc' },
          include: { borrower: { select: { id: true, firstName: true, lastName: true } } },
        },
        logs: {
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: { worker: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...item,
      stock: item.quantity,
      minStock: item.minQuantity,
      isKit: item.group === 'Kit' || (item.children && item.children.length > 0),
    });
  } catch (error: any) {
    console.error('[GET /api/inventory/items/[id]] error:', error);
    return NextResponse.json({ error: 'Failed to fetch item', details: error?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      name,
      categoryId,
      type,
      stock,
      quantity,
      minStock,
      minQuantity,
      unit,
      status,
      statusDetails,
      location,
      locationId,
      aisle,
      shelf,
      bin,
      assignedTo,
      imageUrl,
      isApprovalRequired,
      isKit,
      nextMaintenanceDate,
      parentId,
      inventoryCode,
      actorId,
      actorName,
      actorEmail,
    } = body;

    const currentItem = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Item Name cannot be empty.' }, { status: 400 });
      }
      if (name.trim().length > 50) {
        return NextResponse.json({ error: 'Item Name must not exceed 50 characters.' }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (type !== undefined) {
      updateData.type = type.toUpperCase() === 'CONSUMABLE' ? 'CONSUMABLE' : 'EQUIPMENT';
    }
    if (quantity !== undefined || stock !== undefined) {
      const newQty = quantity !== undefined ? Number(quantity) : Number(stock);
      if (isNaN(newQty) || newQty < 0 || newQty > 999999) {
        return NextResponse.json({ error: 'Current stock quantity must be between 0 and 999,999.' }, { status: 400 });
      }
      updateData.quantity = newQty;
      if (status === undefined) {
        if (newQty === 0 && currentItem.status !== 'Borrowed') {
          updateData.status = 'Out of Stock';
        } else if (newQty > 0 && currentItem.status === 'Out of Stock') {
          updateData.status = 'Good Condition';
        }
      }
    }
    if (minQuantity !== undefined || minStock !== undefined) {
      const newMin = minQuantity !== undefined ? Number(minQuantity) : Number(minStock);
      if (isNaN(newMin) || newMin < 0 || newMin > 999999) {
        return NextResponse.json({ error: 'Minimum stock alert must be between 0 and 999,999.' }, { status: 400 });
      }
      updateData.minQuantity = newMin;
    }
    if (unit !== undefined) updateData.unit = unit;
    if (status !== undefined) updateData.status = status;
    if (statusDetails !== undefined) updateData.statusDetails = statusDetails;
    if (location !== undefined || locationId !== undefined) updateData.location = location || locationId;
    if (aisle !== undefined) updateData.aisle = aisle;
    if (shelf !== undefined) updateData.shelf = shelf;
    if (bin !== undefined) updateData.bin = bin;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (isApprovalRequired !== undefined) updateData.isApprovalRequired = Boolean(isApprovalRequired);
    if (isKit !== undefined) updateData.group = isKit ? 'Kit' : null;
    if (nextMaintenanceDate !== undefined) {
      updateData.nextMaintenanceDate = nextMaintenanceDate ? new Date(nextMaintenanceDate) : null;
    }
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (inventoryCode !== undefined) updateData.inventoryCode = inventoryCode;

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    // Check if stock changed to create a log
    if (updateData.quantity !== undefined && updateData.quantity !== currentItem.quantity) {
      const diff = updateData.quantity - currentItem.quantity;
      await prisma.inventoryLog.create({
        data: {
          itemId: id,
          type: diff > 0 ? 'Stock In' : 'Stock Out',
          quantity: Math.abs(diff),
          balance: updateData.quantity,
          notes: `Stock adjusted during item update (${diff > 0 ? '+' : ''}${diff})`,
        },
      });
    }

    // Record in overall Activity / TransactionLog
    try {
      const stockChanged = updateData.quantity !== undefined && updateData.quantity !== currentItem.quantity;
      const oldStock = currentItem.quantity;
      const newStock = updateData.quantity ?? oldStock;
      const diff = newStock - oldStock;

      let actionDesc = 'Update Item';
      let detailsDesc = `Updated item specifications for "${updated.name}".`;

      if (stockChanged) {
        actionDesc = diff > 0 ? 'Stock In (+)' : 'Stock Out (-)';
        detailsDesc = `Stock modified for "${updated.name}" (${updated.inventoryCode || 'No Barcode'}) from ${oldStock} to ${newStock} (${diff > 0 ? '+' : ''}${diff} ${updated.unit || 'pcs'}). Status: ${updated.status}.`;
      }

      await prisma.transactionLog.create({
        data: {
          userId: actorId || null,
          userName: actorName || 'Inventory Staff',
          userEmail: actorEmail || null,
          action: actionDesc,
          module: 'Inventory',
          details: detailsDesc,
          targetId: updated.id,
          targetName: updated.name,
        },
      });
    } catch (logErr) {
      console.warn('Failed to record transaction log for item update:', logErr);
    }

    return NextResponse.json({
      ...updated,
      stock: updated.quantity,
      minStock: updated.minQuantity,
      isKit: updated.group === 'Kit',
    });
  } catch (error: any) {
    console.error('[PUT /api/inventory/items/[id]] error:', error);
    let userMsg = 'Failed to update item.';
    if (error?.message?.includes('Int out of range') || error?.code === 'P2020') {
      userMsg = 'Stock quantity or number value is too large (maximum 999,999 allowed).';
    } else if (error?.code === 'P2002') {
      userMsg = 'An item with this barcode/code already exists. Please choose a different code.';
    } else if (error?.message) {
      userMsg = error.message;
    }
    return NextResponse.json({ error: userMsg, details: error?.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get('actorId');
    const actorName = searchParams.get('actorName');
    const actorEmail = searchParams.get('actorEmail');

    const itemToDelete = await prisma.inventoryItem.findUnique({ where: { id } });

    // Delete related logs and borrowings first if needed
    await prisma.$transaction([
      prisma.inventoryLog.deleteMany({ where: { itemId: id } }),
      prisma.inventoryBorrowing.deleteMany({ where: { itemId: id } }),
      prisma.inventoryItem.delete({ where: { id } }),
    ]);

    if (itemToDelete) {
      try {
        await prisma.transactionLog.create({
          data: {
            userId: actorId || null,
            userName: actorName || 'Inventory Staff',
            userEmail: actorEmail || null,
            action: 'Delete Item',
            module: 'Inventory',
            details: `Permanently deleted item "${itemToDelete.name}" (Code: ${itemToDelete.inventoryCode || 'N/A'}, Remaining Stock: ${itemToDelete.quantity} ${itemToDelete.unit || 'pcs'}).`,
            targetId: id,
            targetName: itemToDelete.name,
          },
        });
      } catch (logErr) {
        console.warn('Failed to record transaction log for item deletion:', logErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error: any) {
    console.error('[DELETE /api/inventory/items/[id]] error:', error);
    return NextResponse.json({ error: 'Failed to delete item', details: error?.message }, { status: 500 });
  }
}
