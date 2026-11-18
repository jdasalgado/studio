import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const borrowing = await prisma.inventoryBorrowing.findUnique({
      where: { id },
      include: {
        item: { select: { id: true, name: true, inventoryCode: true, status: true, imageUrl: true } },
        borrower: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!borrowing) {
      return NextResponse.json({ error: 'Borrowing not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...borrowing,
      borrowerName: borrowing.borrower ? `${borrowing.borrower.firstName} ${borrowing.borrower.lastName}` : 'Unknown Worker',
    });
  } catch (error: any) {
    console.error('[GET /api/borrowings/[id]] error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrowing', details: error?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      returnCondition,
      returnNotes,
      status,
      resolutionPhoto,
      returnPhotos,
      restoreStock,
      resolvedInclusions,
      dueDate,
    } = body;

    const existing = await prisma.inventoryBorrowing.findUnique({
      where: { id },
      include: { item: true, borrower: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Borrowing not found' }, { status: 404 });
    }

    // Process any new resolution / return photo evidence
    const photosToAppend: string[] = [];
    const incomingPhotos = [
      ...(resolutionPhoto ? [resolutionPhoto] : []),
      ...(Array.isArray(returnPhotos) ? returnPhotos : returnPhotos ? [returnPhotos] : []),
    ];

    for (const photo of incomingPhotos) {
      if (typeof photo === 'string' && photo.startsWith('data:image')) {
        try {
          const { uploadBase64ToSupabase } = await import('@/lib/upload-to-supabase');
          const publicUrl = await uploadBase64ToSupabase(photo, 'Devotion-Photos', 'inventory-resolution');
          photosToAppend.push(publicUrl);
        } catch (storageErr) {
          console.warn('[PATCH borrowing] Supabase storage upload unavailable, storing photo directly in database:', storageErr);
          photosToAppend.push(photo);
        }
      } else if (typeof photo === 'string' && photo.trim()) {
        photosToAppend.push(photo);
      }
    }

    const mergedPhotos = [
      ...(existing.returnPhotos || []),
      ...photosToAppend,
    ];

    // Process resolved accessories checklist if provided
    const existingChecklist = (existing.returnChecklist as any) || {};
    let updatedChecklist: any = existing.returnChecklist ? { ...existingChecklist } : null;

    if (resolvedInclusions && typeof resolvedInclusions === 'object') {
      const currentReturnedInclusions = { ...(existingChecklist.returnedInclusions || {}) };
      Object.entries(resolvedInclusions).forEach(([item, isOk]) => {
        if (isOk) {
          currentReturnedInclusions[item] = true;
        }
      });
      const remainingMissing = Object.keys(currentReturnedInclusions).filter(
        (item) => currentReturnedInclusions[item] === false
      );

      updatedChecklist = {
        ...existingChecklist,
        returnedInclusions: currentReturnedInclusions,
        missingItems: remainingMissing,
        resolvedAt: new Date().toISOString(),
      };
    }

    let finalStatus = status !== undefined ? status : existing.status;
    if (returnCondition) {
      const condLower = returnCondition.toLowerCase();
      const isRepairedOrGood = ['good', 'repaired', 'replaced', 'fixed', 'resolved', 'naayos', 'napalitan'].some((s) =>
        condLower.includes(s)
      );
      const isDamagedOrLost = condLower.includes('damag') || condLower.includes('sira') || condLower.includes('lost') || condLower.includes('nawala');

      if (isRepairedOrGood && (!status || status === 'PENDING')) {
        finalStatus = 'RETURNED';
      } else if (isDamagedOrLost && (!status || status === 'RETURNED')) {
        finalStatus = 'PENDING';
      }
    }

    const wasLostItem = (existing.returnCondition || '').toLowerCase().includes('lost');
    const isRepairedOrGood = returnCondition
      ? ['good', 'repaired', 'replaced', 'fixed', 'resolved', 'naayos', 'napalitan'].some((s) =>
          returnCondition.toLowerCase().includes(s)
        )
      : false;

    // Check if lost item stock should be restored to available inventory
    const shouldRestoreLostStock = Boolean(
      wasLostItem && (restoreStock === true || (restoreStock !== false && isRepairedOrGood))
    );

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.inventoryBorrowing.update({
        where: { id },
        data: {
          returnCondition: returnCondition !== undefined ? returnCondition : existing.returnCondition,
          returnNotes: returnNotes !== undefined ? returnNotes : existing.returnNotes,
          status: finalStatus,
          returnPhotos: mergedPhotos,
          returnChecklist: updatedChecklist ? (updatedChecklist as any) : undefined,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
          returnedAt: finalStatus === 'RETURNED' && !existing.returnedAt ? new Date() : existing.returnedAt,
        },
        include: {
          item: { select: { id: true, name: true, inventoryCode: true, status: true, imageUrl: true } },
          borrower: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      });

      // Synchronize item status and stock if condition is updated
      if (existing.itemId) {
        const condLower = (returnCondition || existing.returnCondition || '').toLowerCase();
        const isDamaged = condLower.includes('damage');

        if (shouldRestoreLostStock) {
          const qtyToRestore = (existing as any)?.quantity || 1;
          const currentItem = await tx.inventoryItem.findUnique({ where: { id: existing.itemId } });
          const newQty = (currentItem?.quantity || 0) + qtyToRestore;

          await tx.inventoryItem.update({
            where: { id: existing.itemId },
            data: {
              quantity: newQty,
              status: 'Good Condition',
              statusDetails: returnNotes ? `Resolved (Recovered/Replaced): ${returnNotes}` : 'Lost equipment recovered/replaced, stock restored',
            },
          });

          await tx.inventoryLog.create({
            data: {
              itemId: existing.itemId,
              workerId: existing.borrowerId,
              type: 'Adjustment',
              quantity: qtyToRestore,
              balance: newQty,
              notes: `Lost equipment resolved & restored to stock (+${qtyToRestore} unit): ${returnNotes || 'Resolved'}`,
            },
          });
        } else if (isRepairedOrGood) {
          await tx.inventoryItem.update({
            where: { id: existing.itemId },
            data: {
              status: 'Good Condition',
              statusDetails: returnNotes ? `Resolved: ${returnNotes}` : 'Restored to good condition',
            },
          });

          await tx.inventoryLog.create({
            data: {
              itemId: existing.itemId,
              workerId: existing.borrowerId,
              type: 'Adjustment',
              quantity: 0,
              balance: existing.item?.quantity || 0,
              notes: `Resolved & Completed Return: ${returnCondition}${returnNotes ? ` — ${returnNotes}` : ''}${photosToAppend.length > 0 ? ' (Restored photo evidence recorded)' : ''}`,
            },
          });
        } else if (isDamaged) {
          await tx.inventoryItem.update({
            where: { id: existing.itemId },
            data: {
              status: 'Damaged',
              statusDetails: returnNotes || 'Damaged upon return',
            },
          });
        }
      }

      return b;
    });

    return NextResponse.json({
      ...updated,
      borrowerName: updated.borrower
        ? `${updated.borrower.firstName} ${updated.borrower.lastName}`
        : 'Unknown Worker',
    });
  } catch (error: any) {
    console.error('[PATCH /api/borrowings/[id]] error:', error);
    return NextResponse.json({ error: 'Failed to update borrowing', details: error?.message }, { status: 500 });
  }
}
