import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { returnNotes, returnCondition, returnChecklist, returnPhotos, damaged, quantity = 1, actorId, actorName, actorEmail } = body;

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
          status: 'RETURNED',
          returnNotes: returnNotes || null,
          returnCondition: returnCondition || null,
          returnChecklist: returnChecklist ? (returnChecklist as any) : undefined,
          returnPhotos: processedPhotos,
        },
        include: {
          item: { select: { id: true, name: true, inventoryCode: true, imageUrl: true } },
          borrower: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const currentItem = await tx.inventoryItem.findUnique({ where: { id: borrowing.itemId } });
      const newStock = (currentItem?.quantity || 0) + returnedQty;

      await tx.inventoryItem.update({
        where: { id: borrowing.itemId },
        data: {
          quantity: newStock,
          status: isDamagedItem ? 'Damaged' : (newStock > 0 && currentItem?.status === 'Borrowed' ? 'Good Condition' : undefined),
          statusDetails: isDamagedItem
            ? `Damaged upon return: ${returnNotes || 'Flagged for maintenance inspection'}`
            : undefined,
        },
      });

      const borrowerName = borrowing.borrower ? `${borrowing.borrower.firstName} ${borrowing.borrower.lastName}` : 'Worker';

      await tx.inventoryLog.create({
        data: {
          itemId: borrowing.itemId,
          workerId: borrowing.borrowerId,
          type: 'Return',
          quantity: returnedQty,
          balance: newStock,
          notes: `Returned by ${borrowerName}. Condition: ${returnCondition || 'N/A'}${isDamagedItem ? ' — DAMAGED (Requires Maintenance Inspection)' : ''}`,
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
