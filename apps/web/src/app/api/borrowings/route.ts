import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '20', 10);
    const status = searchParams.get('status') || '';
    const borrowerId = searchParams.get('borrowerId') || '';

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (borrowerId) {
      where.borrowerId = borrowerId;
    }

    const [borrowings, total] = await Promise.all([
      prisma.inventoryBorrowing.findMany({
        where,
        skip,
        take,
        orderBy: { borrowedAt: 'desc' },
        include: {
          item: {
            select: { id: true, name: true, inventoryCode: true, status: true, imageUrl: true, quantity: true },
          },
          borrower: {
            select: { id: true, firstName: true, lastName: true, email: true, workerId: true, avatarUrl: true },
          },
        },
      }),
      prisma.inventoryBorrowing.count({ where }),
    ]);

    const formatted = borrowings.map((b) => ({
      ...b,
      borrowerName: b.borrower ? `${b.borrower.firstName} ${b.borrower.lastName}` : 'Unknown Worker',
      borrowerEmail: b.borrower?.email || '',
      item: {
        ...b.item,
        stock: b.item.quantity,
      },
    }));

    return NextResponse.json({ borrowings: formatted, total });
  } catch (error: any) {
    console.error('[GET /api/borrowings] error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrowings', details: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      itemId,
      borrowerId,
      borrowerName,
      dueDate,
      checkoutNotes,
      checkoutCondition,
      checkoutChecklist,
      quantity = 1,
      actorId,
      actorName,
      actorEmail,
    } = body;

    if (!itemId || !borrowerId) {
      return NextResponse.json({ error: 'itemId and borrowerId are required' }, { status: 400 });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: { children: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const itemsToCheckout: any[] = [item];
    if (item.group === 'Kit' && item.children && item.children.length > 0) {
      itemsToCheckout.push(...item.children);
    }

    const numQty = Number(quantity) || 1;

    for (const it of itemsToCheckout) {
      if (it.status === 'Damaged') {
        return NextResponse.json({ error: `${it.name} is marked as Damaged and cannot be checked out.` }, { status: 400 });
      }
      if (it.quantity < numQty) {
        return NextResponse.json({ error: `Not enough stock for ${it.name} (Only ${it.quantity} available).` }, { status: 400 });
      }
    }

    const borrowing = await prisma.$transaction(async (tx) => {
      let mainBorrowing = null;

      for (const it of itemsToCheckout) {
        const b = await tx.inventoryBorrowing.create({
          data: {
            itemId: it.id,
            borrowerId,
            dueDate: dueDate ? new Date(dueDate) : null,
            status: 'BORROWED',
            checkoutNotes: checkoutNotes || null,
            checkoutCondition: checkoutCondition || null,
            checkoutChecklist: checkoutChecklist ? (checkoutChecklist as any) : undefined,
          },
          include: {
            item: { select: { id: true, name: true, inventoryCode: true, imageUrl: true } },
            borrower: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        if (it.id === item.id) {
          mainBorrowing = b;
        }

        const newStock = Math.max(0, it.quantity - numQty);
        await tx.inventoryItem.update({
          where: { id: it.id },
          data: {
            quantity: newStock,
            status: newStock === 0 && it.type === 'EQUIPMENT' ? 'Borrowed' : it.status,
          },
        });

        await tx.inventoryLog.create({
          data: {
            itemId: it.id,
            workerId: borrowerId,
            type: 'Checkout',
            quantity: numQty,
            balance: newStock,
            notes: `Checked out to ${borrowerName || 'Worker'} ${it.id !== item.id ? '(Kit Child)' : ''} ${checkoutNotes ? ' - ' + checkoutNotes : ''}`,
          },
        });
      }

      return mainBorrowing;
    });

    try {
      await prisma.transactionLog.create({
        data: {
          userId: actorId || borrowerId || null,
          userName: actorName || borrowerName || 'Inventory Staff',
          userEmail: actorEmail || null,
          action: 'Equipment Borrow / Checkout',
          module: 'Inventory',
          details: `Checked out item "${item.name}" (${numQty} ${item.unit || 'pcs'}) to ${borrowerName || 'Worker'}. Remaining stock: ${Math.max(0, item.quantity - numQty)}. Due: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'None'}. Notes: ${checkoutNotes || 'None'}.`,
          targetId: item.id,
          targetName: item.name,
        },
      });
    } catch (e) {
      console.warn('Failed to record transaction log for checkout:', e);
    }

    return NextResponse.json(borrowing);
  } catch (error: any) {
    console.error('[POST /api/borrowings] error:', error);
    return NextResponse.json({ error: 'Failed to create borrowing', details: error?.message }, { status: 500 });
  }
}
