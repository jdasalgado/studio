import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      returnNotes,
      returnCondition,
      returnChecklist,
      returnPhotos,
      damaged,
      quantity = 1,
      resolutionDeadline,
      dueDate,
      actorId,
      actorName,
      actorEmail,
    } = body;

    const borrowing = await prisma.inventoryBorrowing.findUnique({
      where: { id },
      include: {
        item: true,
        borrower: true,
      },
    });

    if (!borrowing) {
      return NextResponse.json({ error: 'Borrowing record not found' }, { status: 404 });
    }

    if (borrowing.status === 'RETURNED') {
      return NextResponse.json({ error: 'Item has already been marked as returned' }, { status: 400 });
    }

    const returnedQty = Number(quantity) || 1;
    const isDamagedItem = Boolean(damaged || returnCondition === 'Damaged');
    const isLostItem = Boolean(returnCondition === 'Lost' || returnCondition?.toLowerCase().includes('lost'));

    // Check if any issued equipment / accessories were marked as Lost / Missing
    const returnedInclusions = returnChecklist?.returnedInclusions;
    const missingInclusions: string[] = [];
    if (returnedInclusions && typeof returnedInclusions === 'object') {
      Object.entries(returnedInclusions).forEach(([acc, isReturned]) => {
        if (!isReturned) missingInclusions.push(acc);
      });
    }
    const hasMissingInclusions = missingInclusions.length > 0;
    const isPendingResolution = isDamagedItem || isLostItem || hasMissingInclusions;

    let finalReturnCondition = returnCondition || 'Good Condition';
    if (isLostItem) {
      finalReturnCondition = 'Lost';
    } else if (hasMissingInclusions) {
      finalReturnCondition = isDamagedItem
        ? `Damaged (Lost: ${missingInclusions.join(', ')})`
        : `Good Condition (Lost: ${missingInclusions.join(', ')})`;
    }

    // Process photo evidence: try Supabase storage first, fallback to direct base64 in PostgreSQL
    const rawPhotos = Array.isArray(returnPhotos)
      ? returnPhotos
      : (typeof returnPhotos === 'string' && returnPhotos ? [returnPhotos] : []);

    const processedPhotos: string[] = [];
    for (const photo of rawPhotos) {
      if (typeof photo === 'string' && photo.startsWith('data:image')) {
        try {
          const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
          const publicUrl = await uploadBase64ToSupabase(photo, 'Devotion-Photos', 'inventory-damage');
          processedPhotos.push(publicUrl);
        } catch (storageErr) {
          console.warn('[return] Supabase storage upload unavailable, storing photo directly in database:', storageErr);
          processedPhotos.push(photo);
        }
      } else if (typeof photo === 'string' && photo.trim()) {
        processedPhotos.push(photo);
      }
    }

    const updatedBorrowing = await prisma.$transaction(async (tx) => {
      const b = await tx.inventoryBorrowing.update({
        where: { id },
        data: {
          returnedAt: new Date(),
          status: isPendingResolution ? 'PENDING' : 'RETURNED',
          returnNotes: returnNotes || null,
          returnCondition: finalReturnCondition,
          returnChecklist: returnChecklist ? (returnChecklist as any) : undefined,
          returnPhotos: processedPhotos,
          dueDate: (isPendingResolution && resolutionDeadline)
            ? new Date(resolutionDeadline)
            : (dueDate ? new Date(dueDate) : borrowing.dueDate),
        },
        include: {
          item: { select: { id: true, name: true, inventoryCode: true, imageUrl: true } },
          borrower: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const currentItem = await tx.inventoryItem.findUnique({ where: { id: borrowing.itemId } });
      // If the main item itself is LOST, stock is NOT restored to available inventory
      const newStock = isLostItem
        ? (currentItem?.quantity || 0)
        : (currentItem?.quantity || 0) + returnedQty;

      await tx.inventoryItem.update({
        where: { id: borrowing.itemId },
        data: {
          quantity: newStock,
          status: isLostItem
            ? (newStock === 0 ? 'Out of Stock' : (currentItem?.status || 'Good Condition'))
            : isDamagedItem
            ? (newStock > 1 ? 'Good Condition' : 'Damaged')
            : (newStock > 0 && currentItem?.status === 'Borrowed' ? 'Good Condition' : undefined),
          statusDetails: isLostItem
            ? `Reported Lost by borrower: ${returnNotes || 'Item missing'}`
            : isDamagedItem
            ? `Damaged upon return: ${returnNotes || 'Flagged for maintenance inspection'}`
            : hasMissingInclusions
            ? `Missing accessories: ${missingInclusions.join(', ')}`
            : undefined,
        },
      });

      const borrowerName = borrowing.borrower ? `${borrowing.borrower.firstName} ${borrowing.borrower.lastName}` : 'Worker';

      const auditNotes = isLostItem
        ? `Reported LOST by ${borrowerName}${returnNotes ? ` — ${returnNotes}` : ''}${hasMissingInclusions ? ` | Lost gear: ${missingInclusions.join(', ')}` : ''}`
        : `Returned by ${borrowerName}. Condition: ${finalReturnCondition}${isDamagedItem ? ' — PENDING (Damaged)' : ''}${hasMissingInclusions ? ' — PENDING (Lost issued accessories: ' + missingInclusions.join(', ') + ')' : ''}`;

      await tx.inventoryLog.create({
        data: {
          itemId: borrowing.itemId,
          workerId: borrowing.borrowerId,
          type: isLostItem ? 'Lost' : 'Return',
          quantity: isLostItem ? 0 : returnedQty,
          balance: newStock,
          notes: auditNotes,
        },
      });

      return b;
    });

    const borrowerName = updatedBorrowing.borrower
      ? `${updatedBorrowing.borrower.firstName} ${updatedBorrowing.borrower.lastName}`
      : 'Worker';

    return NextResponse.json({
      ...updatedBorrowing,
      borrowerName,
    });
  } catch (error: any) {
    console.error('[PATCH /api/borrowings/[id]/return] error:', error);
    return NextResponse.json({ error: 'Failed to process return', details: error?.message }, { status: 500 });
  }
}
