import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@studio/database/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const location = searchParams.get('location') || '';
    const isKit = searchParams.get('isKit');
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '10', 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inventoryCode: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { assignedTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const isLowStockFilter = status === 'Low Stock' || status === 'low';

    if (status && !isLowStockFilter) {
      where.status = status;
    }

    if (type) {
      const upperType = type.toUpperCase();
      if (upperType === 'EQUIPMENT' || upperType === 'CONSUMABLE') {
        where.type = upperType;
      }
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (isKit === 'true') {
      where.group = 'Kit';
    }

    if (isLowStockFilter) {
      const allMatching = await prisma.inventoryItem.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
          children: {
            select: { id: true, name: true, inventoryCode: true, quantity: true, status: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      });

      const lowItems = allMatching.filter(
        (item) => (item.quantity ?? 0) <= (item.minQuantity > 0 ? item.minQuantity : 5)
      );

      const total = lowItems.length;
      const paginated = lowItems.slice(skip, skip + take);
      const formatted = paginated.map((item) => ({
        ...item,
        stock: item.quantity,
        minStock: item.minQuantity,
        isKit: item.group === 'Kit' || (item.children && item.children.length > 0),
      }));

      return NextResponse.json({
        items: formatted,
        total,
        skip,
        take,
      });
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take,
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
          children: {
            select: { id: true, name: true, inventoryCode: true, quantity: true, status: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    // Format items to map `quantity` to `stock` and `minQuantity` to `minStock` for backward compatibility
    const formatted = items.map((item) => ({
      ...item,
      stock: item.quantity,
      minStock: item.minQuantity,
      isKit: item.group === 'Kit' || (item.children && item.children.length > 0),
    }));

    return NextResponse.json({ items: formatted, total });
  } catch (error: any) {
    console.error('[GET /api/inventory/items] error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory items', details: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      categoryId,
      type = 'EQUIPMENT',
      stock = 0,
      quantity,
      minStock = 0,
      minQuantity,
      unit = 'pcs',
      status = 'Good Condition',
      statusDetails,
      location,
      locationId,
      aisle,
      shelf,
      bin,
      assignedTo,
      imageUrl,
      isApprovalRequired = false,
      isKit = false,
      nextMaintenanceDate,
      parentId,
      inventoryCode,
      actorId,
      actorName,
      actorEmail,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item Name is required. Please provide a name for this item.' }, { status: 400 });
    }

    if (name.trim().length > 50) {
      return NextResponse.json({ error: 'Item Name must not exceed 50 characters.' }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required. Please select a category.' }, { status: 400 });
    }

    const finalQuantity = quantity !== undefined ? Number(quantity) : Number(stock) || 0;
    const finalMinQuantity = minQuantity !== undefined ? Number(minQuantity) : Number(minStock) || 0;

    if (isNaN(finalQuantity) || finalQuantity < 0 || finalQuantity > 999999) {
      return NextResponse.json({ error: 'Current stock quantity must be between 0 and 999,999.' }, { status: 400 });
    }

    if (isNaN(finalMinQuantity) || finalMinQuantity < 0 || finalMinQuantity > 999999) {
      return NextResponse.json({ error: 'Minimum stock alert must be between 0 and 999,999.' }, { status: 400 });
    }
    const finalType = (type || 'EQUIPMENT').toUpperCase() === 'CONSUMABLE' ? 'CONSUMABLE' : 'EQUIPMENT';
    const finalLocation = location || locationId || null;

    // Generate inventoryCode if not provided
    let finalCode = inventoryCode?.trim();
    if (!finalCode) {
      const prefix = finalType === 'CONSUMABLE' ? 'CON' : 'EQP';
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      finalCode = `${prefix}-${Date.now().toString().slice(-4)}-${rand}`;
    }

    const newItem = await prisma.inventoryItem.create({
      data: {
        name,
        categoryId,
        type: finalType,
        quantity: finalQuantity,
        minQuantity: finalMinQuantity,
        unit,
        status: status || (finalQuantity === 0 ? 'Out of Stock' : 'Good Condition'),
        statusDetails: statusDetails || null,
        location: finalLocation,
        aisle: aisle || null,
        shelf: shelf || null,
        bin: bin || null,
        assignedTo: assignedTo || null,
        imageUrl: imageUrl || null,
        isApprovalRequired: Boolean(isApprovalRequired),
        group: isKit ? 'Kit' : null,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        parentId: parentId || null,
        inventoryCode: finalCode,
      },
      include: {
        category: true,
      },
    });

    // Create initial stock log
    if (finalQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          itemId: newItem.id,
          type: 'Stock In',
          quantity: finalQuantity,
          balance: finalQuantity,
          notes: 'Initial inventory stock creation',
        },
      });
    }

    // Record in overall Activity / TransactionLog
    try {
      await prisma.transactionLog.create({
        data: {
          userId: actorId || null,
          userName: actorName || 'Inventory Staff',
          userEmail: actorEmail || null,
          action: 'Create Item',
          module: 'Inventory',
          details: `Created new item "${newItem.name}" (Code: ${newItem.inventoryCode}) with initial stock of ${newItem.quantity} ${newItem.unit || 'pcs'}. Category: ${newItem.category?.name || 'N/A'}. Location: ${newItem.location || 'N/A'}.`,
          targetId: newItem.id,
          targetName: newItem.name,
        },
      });
    } catch (logErr) {
      console.warn('Failed to record transaction log for item creation:', logErr);
    }

    return NextResponse.json({
      ...newItem,
      stock: newItem.quantity,
      minStock: newItem.minQuantity,
      isKit: newItem.group === 'Kit',
    });
  } catch (error: any) {
    console.error('[POST /api/inventory/items] error:', error);
    let userMsg = 'Failed to create inventory item.';
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
