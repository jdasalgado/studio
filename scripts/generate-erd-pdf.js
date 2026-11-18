const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const margin = 14;
const contentW = pageW - margin * 2;

// App brand color: Dark navy blue
const PRIMARY_COLOR = [28, 65, 132];
const SECONDARY_COLOR = [15, 23, 42];
const ACCENT_COLOR = [56, 189, 248];

function addHeader(title, subtitle) {
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageW, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CHURCH OF GOD — INVENTORY & INCIDENT MANAGEMENT SYSTEM', margin, 8);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), margin, 18);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Database ERD Specification', pageW - margin, 8, { align: 'right' });
  doc.text(`Version: November 2026`, pageW - margin, 14, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-PH')}`, pageW - margin, 20, { align: 'right' });
}

function addFooter(pageNum, totalPages) {
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, pageH - 8, pageW, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Inventory System — Entity-Relationship Diagram (ERD)', margin, pageH - 3);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 3, { align: 'right' });
}

function drawSectionHeader(text, currentY) {
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, currentY, contentW, 6.5, 'F');
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, margin, currentY + 6.5);

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(text.toUpperCase(), margin + 3, currentY + 4.5);
  return currentY + 9;
}

// ─── PAGE 1: ARCHITECTURE OVERVIEW & RELATIONSHIP MATRIX ──────────────────────
addHeader('Database Entity-Relationship Diagram (ERD)', 'Latest Schema');

let y = 32;

doc.setFontSize(10.5);
doc.setFont('helvetica', 'bold');
doc.setTextColor(...SECONDARY_COLOR);
doc.text('1. System Architecture & New Features Overview', margin, y);
y += 5;

doc.setFontSize(8);
doc.setFont('helvetica', 'normal');
doc.setTextColor(71, 85, 105);
const intro = [
  'Ang dokumentong ito ay nagpapakita ng pinakabagong database schema at entity relationships ng Inventory Management System.',
  'Kabilang dito ang mga bagong features: (1) Check-in Return Verification na may Accessory Checklist, (2) Damaged & Lost Tracking',
  'na may Pending status at Photo Evidence, (3) Resolution Workflow na may Target Deadline at Stock Restoration, at (4) Auto-generated',
  'PDF Incident Report engine na naka-sync sa dark navy blue branding (#1c4184).'
];
doc.text(intro, margin, y);
y += 18;

// Relationship Matrix Table
y = drawSectionHeader('Entity Relationship & Cardinality Matrix', y);

autoTable(doc, {
  startY: y,
  margin: { left: margin, right: margin },
  head: [['Parent Entity', 'Child Entity', 'Relationship', 'Foreign Key / Link', 'Business Rule / Behavior']],
  body: [
    ['Worker', 'InventoryBorrowing', '1 to Many (1:N)', 'borrowerId -> Worker.id', 'Tumatala kung sinong worker ang humiram ng gamit.'],
    ['InventoryItem', 'InventoryBorrowing', '1 to Many (1:N)', 'itemId -> InventoryItem.id', 'Tumatala sa kasaysayan ng bawat hiram ng gamit.'],
    ['InventoryCategory', 'InventoryItem', '1 to Many (1:N)', 'categoryId -> InventoryCategory.id', 'Nag-uuri sa mga item (Equipment vs Consumables).'],
    ['InventoryItem (Parent)', 'InventoryItem (Child)', '1 to Many (1:N)', 'parentId -> InventoryItem.id', 'Self-relation para sa Kit / Bundles (e.g., Drone + Controller).'],
    ['InventoryItem', 'InventoryLog', '1 to Many (1:N)', 'itemId -> InventoryItem.id', 'Stock audit trail (Checkout, Return, Adjustment).'],
    ['Worker', 'InventoryLog', '1 to Many (1:N)', 'workerId -> Worker.id', 'Staff o worker na nag-trigger ng stock transaction.'],
    ['Worker', 'TransactionLog', '1 to Many (1:N)', 'userId -> Worker.id', 'Audit trail ng lahat ng action sa sistema.'],
    ['InventoryBorrowing', 'IncidentReportPDF', '1 to 1 (1:1)', 'borrowingId -> Borrowing.id', 'Auto-generates downloadable PDF para sa Damaged/Lost records.']
  ],
  headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
  bodyStyles: { fontSize: 7, cellPadding: 2.2 },
  columnStyles: {
    0: { cellWidth: 26, fontStyle: 'bold' },
    1: { cellWidth: 28, fontStyle: 'bold' },
    2: { cellWidth: 22 },
    3: { cellWidth: 42 },
    4: { cellWidth: 'auto' }
  },
  alternateRowStyles: { fillColor: [248, 250, 252] }
});

y = doc.lastAutoTable.finalY + 7;

// Entity 1: InventoryBorrowing (The core of the new features)
y = drawSectionHeader('Core Entity: InventoryBorrowing (Check-in, Damage/Loss & Resolution)', y);

autoTable(doc, {
  startY: y,
  margin: { left: margin, right: margin },
  head: [['Field Name', 'Data Type', 'Key / Index', 'Null / Default', 'Description & New Feature Functionality']],
  body: [
    ['id', 'String (UUID)', 'PK', 'NOT NULL', 'Primary key ng borrowing transaction.'],
    ['itemId', 'String (UUID)', 'FK, Index', 'NOT NULL', 'Reference sa InventoryItem na hiniram.'],
    ['borrowerId', 'String (UUID)', 'FK, Index', 'NOT NULL', 'Reference sa Worker na humiram.'],
    ['borrowedAt', 'DateTime', 'Index', 'now()', 'Petsa at oras ng pag-checkout.'],
    ['dueDate', 'DateTime', 'Index', 'Nullable', 'Return deadline / Target Resolution Deadline kapag damaged.'],
    ['returnedAt', 'DateTime', 'Index', 'Nullable', 'Aktwal na petsa at oras ng pag-return.'],
    ['status', 'String', 'Index', "'BORROWED'", "BORROWED | RETURNED | PENDING (Damaged / Lost / Needs Action)"],
    ['checkoutCondition', 'String', '—', 'Nullable', 'Kondisyon bago ilabas (e.g. Good Condition, Minor Wear).'],
    ['checkoutNotes', 'String', '—', 'Nullable', 'Mga paalala o purpose ng paghiram.'],
    ['checkoutChecklist', 'Json', '—', 'Nullable', 'Array ng issued accessories (e.g. Lens, Battery, SD Card, Tripod).'],
    ['returnCondition', 'String', '—', 'Nullable', 'Good Condition | Damaged | Lost | Missing Gear | Resolved'],
    ['returnNotes', 'String', '—', 'Nullable', 'Inspection notes, detalye ng sira, o circumstances ng pagkawala.'],
    ['returnChecklist', 'Json', '—', 'Nullable', 'Resulta ng returned gear, missing list, at resolutionDeadline.'],
    ['returnPhotos', 'String[]', '—', '[]', 'Array ng camera photos / base64 proof ng sira o damage evidence.']
  ],
  headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
  bodyStyles: { fontSize: 7, cellPadding: 2 },
  columnStyles: {
    0: { cellWidth: 30, fontStyle: 'bold' },
    1: { cellWidth: 24 },
    2: { cellWidth: 18 },
    3: { cellWidth: 22 },
    4: { cellWidth: 'auto' }
  },
  alternateRowStyles: { fillColor: [248, 250, 252] }
});

// ─── PAGE 2: INVENTORY ITEM, LOGS & INCIDENT REPORT DATA ──────────────────────
doc.addPage();
addHeader('Database Entity-Relationship Diagram (ERD)', 'Entities: Items & Logs');

y = 32;

// Entity 2: InventoryItem
y = drawSectionHeader('Core Entity: InventoryItem (Equipment, Kits & Stock Management)', y);

autoTable(doc, {
  startY: y,
  margin: { left: margin, right: margin },
  head: [['Field Name', 'Data Type', 'Key / Index', 'Null / Default', 'Description & Business Rules']],
  body: [
    ['id', 'String (UUID)', 'PK', 'NOT NULL', 'Primary key ng imbentaryo.'],
    ['inventoryCode', 'String', 'Unique, Index', 'Nullable', 'Barcode / QR code tag (e.g. EQP-4673-CT9R).'],
    ['name', 'String', 'Index', 'NOT NULL', 'Pangalan ng kagamitan o consumable item.'],
    ['categoryId', 'String (UUID)', 'FK, Index', 'NOT NULL', 'Reference sa InventoryCategory.'],
    ['type', 'Enum', 'Index', 'EQUIPMENT', 'EQUIPMENT (nagbabalik) o CONSUMABLE (nauubos).'],
    ['quantity', 'Int', '—', '0', 'Kasalukuyang available stock. Hindi nirerestore kapag Damaged/Lost.'],
    ['minQuantity', 'Int', '—', '0', 'Threshold para sa low stock warnings.'],
    ['unit', 'String', '—', "'pcs'", 'Unit of measurement (pcs, sets, boxes, meters).'],
    ['status', 'String', 'Index', "'Good Condition'", 'Good Condition | Damaged | Borrowed | Under Maintenance.'],
    ['group', 'String', '—', 'Nullable', "Single item o 'Kit' (nagpapahiwatig ng bundle package)."],
    ['parentId', 'String (UUID)', 'FK (Self)', 'Nullable', 'Reference sa parent item kung ito ay parte ng Kit / Bundle.'],
    ['location', 'String', '—', 'Nullable', 'Room / Storage facility name.'],
    ['aisle / shelf / bin', 'String', '—', 'Nullable', 'Exact coordinates sa loob ng storage room.'],
    ['imageUrl', 'String', '—', 'Nullable', 'Larawan ng kagamitan para sa mabilis na pagkilala.'],
    ['nextMaintenanceDate', 'DateTime', '—', 'Nullable', 'Nakatakdang petsa ng periodic preventive maintenance.']
  ],
  headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
  bodyStyles: { fontSize: 7, cellPadding: 2 },
  columnStyles: {
    0: { cellWidth: 32, fontStyle: 'bold' },
    1: { cellWidth: 24 },
    2: { cellWidth: 20 },
    3: { cellWidth: 24 },
    4: { cellWidth: 'auto' }
  },
  alternateRowStyles: { fillColor: [248, 250, 252] }
});

y = doc.lastAutoTable.finalY + 7;

// Entity 3 & 4: InventoryLog and IncidentReportPDF
y = drawSectionHeader('Audit Entities: InventoryLog & IncidentReportPDF Export Data Model', y);

autoTable(doc, {
  startY: y,
  margin: { left: margin, right: margin },
  head: [['Entity', 'Field Name', 'Data Type', 'Purpose & Value Handled']],
  body: [
    ['InventoryLog', 'id', 'String (PK)', 'Unique identifier ng log record.'],
    ['InventoryLog', 'itemId', 'String (FK)', 'Reference sa InventoryItem na nagalaw.'],
    ['InventoryLog', 'workerId', 'String (FK)', 'Staff o worker na nag-execute ng stock change.'],
    ['InventoryLog', 'type', 'String', 'Checkout | Return | Adjustment | Restored Stock | Damage Write-off.'],
    ['InventoryLog', 'quantity', 'Int', 'Bilang ng piraso na nadagdag o nabawas.'],
    ['InventoryLog', 'balance', 'Int', 'Natitirang stock balance pagkatapos ng transaksyon.'],
    ['InventoryLog', 'notes', 'String', 'Audit notes kasama ang borrower name at kit child details.'],
    ['IncidentReportPDF', 'reportId', 'String', 'Auto-generated code (e.g. RPT-B959E2BA).'],
    ['IncidentReportPDF', 'incidentType', 'Enum', 'DAMAGED | LOST | MISSING.'],
    ['IncidentReportPDF', 'accessoriesStatus', 'Json Array', 'Talaan ng bawat kasamang accessory na may markang [✓ RETURNED] o [✗ LOST].'],
    ['IncidentReportPDF', 'damagePhotoUrl', 'String (Base64)', 'Direktang naka-embed na larawan ng sira mula sa camera inspection.'],
    ['IncidentReportPDF', 'resolutionTerms', 'String / Date', 'Target deadline ng pag-ayos o pagpalit at agreed settlement notes.'],
    ['IncidentReportPDF', 'signatureBlocks', '3 Boxes', 'Borrower Signature, Inventory Staff Signature, Authorized Sign-off.']
  ],
  headStyles: { fillColor: PRIMARY_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
  bodyStyles: { fontSize: 7, cellPadding: 2 },
  columnStyles: {
    0: { cellWidth: 28, fontStyle: 'bold' },
    1: { cellWidth: 28, fontStyle: 'bold' },
    2: { cellWidth: 24 },
    3: { cellWidth: 'auto' }
  },
  alternateRowStyles: { fillColor: [248, 250, 252] }
});

// Add page numbers
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  addFooter(i, totalPages);
}

// Save outputs
const outPath1 = path.join('C:', 'studio', 'ERD_LATEST.pdf');
const outPath2 = path.join('C:', 'studio', 'apps', 'web', 'public', 'ERD_LATEST.pdf');
const outPath3 = path.join('C:', 'Users', 'hp', 'Downloads', 'ERD_LATEST.pdf');

const pdfBytes = doc.output();

fs.writeFileSync(outPath1, pdfBytes, 'binary');
console.log('Saved to ' + outPath1);

try {
  fs.writeFileSync(outPath2, pdfBytes, 'binary');
  console.log('Saved to ' + outPath2);
} catch (e) {
  console.warn('Could not write to web public folder:', e.message);
}

try {
  fs.writeFileSync(outPath3, pdfBytes, 'binary');
  console.log('Saved to ' + outPath3);
} catch (e) {
  console.warn('Could not write to Downloads directly:', e.message);
}

