import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      workerId,
      workerName,
      issuedQuantity,
      returnedQuantity,
      returnDate,
      notes,
      actorId,
      actorName,
    } = body;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found.' }, { status: 404 });
    }

    // STRICT RESTRICTION: Consumable Items ONLY
    if (item.type !== 'CONSUMABLE') {
      return NextResponse.json(
        { error: 'Returned items tracking is strictly available for Consumable items only. Equipment items use the borrowing and check-in workflow.' },
        { status: 400 }
      );
    }

    const issuedQty = Number(issuedQuantity);
    const returnedQty = Number(returnedQuantity);

    if (isNaN(issuedQty) || issuedQty <= 0) {
      return NextResponse.json(
        { error: 'Quantity Originally Issued must be a positive number greater than 0.' },
        { status: 400 }
      );
    }

    if (isNaN(returnedQty) || returnedQty <= 0) {
      return NextResponse.json(
        { error: 'Quantity Returned must be a positive number greater than 0.' },
        { status: 400 }
      );
    }

    // Validate that returned quantity cannot exceed originally issued quantity
    if (returnedQty > issuedQty) {
      return NextResponse.json(
        { error: `Returned quantity (${returnedQty}) cannot exceed the originally issued quantity (${issuedQty}).` },
        { status: 400 }
      );
    }

    // Automatically calculate quantity consumed: Quantity Used = Quantity Issued - Quantity Returned
    const usedQty = issuedQty - returnedQty;
    const newStock = item.quantity + returnedQty;

    // Determine updated item status
    let newStatus = item.status;
    if (newStock > 0 && (item.status === 'Out of Stock' || item.status === 'Low Stock')) {
      newStatus = newStock <= item.minQuantity && item.minQuantity > 0 ? 'Low Stock' : 'Good Condition';
    }

    const returneeLabel = (workerName || '').trim() || (workerId ? `Worker ID: ${workerId}` : 'Personnel / Ministry');
    const returnDateStr = returnDate ? new Date(returnDate).toLocaleDateString() : new Date().toLocaleDateString();

    const auditLogText = `[Consumable Return] Returned ${returnedQty} ${item.unit || 'pcs'} unused (Issued: ${issuedQty}, Consumed: ${usedQty}) by ${returneeLabel} on ${returnDateStr}${notes ? ` — ${notes}` : ''}`;

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
          type: 'Consumable Return',
          quantity: returnedQty,
          balance: newStock,
          notes: auditLogText,
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
      summary: {
        issuedQuantity: issuedQty,
        returnedQuantity: returnedQty,
        usedQuantity: usedQty,
        newStock,
        returnee: returneeLabel,
        returnDate: returnDateStr,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/inventory/items/[id]/consumable-return] error:', error);
    return NextResponse.json(
      { error: 'Failed to record consumable return', details: error?.message },
      { status: 500 }
    );
  }
}

