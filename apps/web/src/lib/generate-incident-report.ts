/**
 * generate-incident-report.ts
 * Auto-generates a downloadable PDF Incident Report for lost or damaged equipment.
 * Uses jsPDF + jspdf-autotable for layout (dynamically imported — browser only).
 */

import { saveFileUniversal } from './save-file-native';

export interface IncidentReportData {
  // Report meta
  reportId?: string;
  reportDate?: string;
  reportedBy?: string;

  // Equipment info
  itemName: string;
  itemCode?: string;
  itemCategory?: string;

  // Borrower info
  borrowerName: string;
  borrowerEmail?: string;
  borrowerWorkerId?: string;

  // Borrowing transaction
  borrowedAt?: string;
  dueDate?: string;
  returnedAt?: string;
  borrowingId?: string;

  // Incident details
  incidentType: 'DAMAGED' | 'LOST' | 'MISSING' | 'OTHER';
  returnCondition: string;
  returnNotes?: string;
  damagePhotoUrl?: string; // base64 or URL

  // Accessories
  issuedAccessories?: string[];
  returnedAccessories?: Record<string, boolean>;
  missingAccessories?: string[];

  // Resolution
  resolutionDeadline?: string;
  resolutionStatus?: string;
  resolutionNotes?: string;
  resolutionPhotoUrl?: string;
}

function fmt(val?: string | null): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return val; }
}

function incidentLabel(type: string): string {
  switch (type?.toUpperCase()) {
    case 'DAMAGED': return 'Equipment Damage Report';
    case 'LOST':    return 'Lost Equipment Report';
    case 'MISSING': return 'Missing Accessories Report';
    default:        return 'Incident Report';
  }
}

// App primary color: HSL 222 67% 32% → RGB ≈ (28, 65, 132) — dark navy blue
const APP_BLUE: [number, number, number] = [28, 65, 132];

function accentRgb(_type: string): [number, number, number] {
  return APP_BLUE;
}

export async function generateIncidentReportPDF(data: IncidentReportData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  const autoTable = (autoTableMod as any).default ?? autoTableMod;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 15; // margin left/right
  const CW = W - ML * 2; // content width

  const [R, G, B] = accentRgb(data.incidentType);
  const title = incidentLabel(data.incidentType);
  const rptId = data.reportId || `RPT-${Date.now()}`;
  const now = new Date();

  // ── HEADER BANNER ────────────────────────────────────────────────────────────
  doc.setFillColor(R, G, B);
  doc.rect(0, 0, W, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('CHURCH OF GOD — INVENTORY MANAGEMENT SYSTEM', ML, 9);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), ML, 21);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(rptId, W - ML, 9, { align: 'right' });
  doc.text(
    `Generated: ${now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    W - ML, 14, { align: 'right' }
  );

  let y = 37;

  // ── STATUS BADGE ─────────────────────────────────────────────────────────────
  const badgeW = 60;
  const badgeX = (W - badgeW) / 2;
  doc.setFillColor(R, G, B);
  doc.roundedRect(badgeX, y - 5.5, badgeW, 8, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`⚠  ${data.incidentType}`, W / 2, y - 0.5, { align: 'center' });
  y += 8;

  // ── SECTION HELPERS ───────────────────────────────────────────────────────────
  function sectionHeader(label: string): void {
    doc.setFillColor(248, 250, 252);
    doc.rect(ML, y, CW, 7, 'F');
    doc.setDrawColor(R, G, B);
    doc.setLineWidth(0.9);
    doc.line(ML, y, ML, y + 7);
    doc.setLineWidth(0.2);
    doc.setTextColor(R, G, B);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), ML + 3.5, y + 5);
    y += 10;
  }

  function divider(): void {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(ML, y, ML + CW, y);
    y += 5;
  }

  function kv(label: string, value: string, x: number, colW: number): void {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(value || '—', colW - 2);
    doc.text(lines, x, y + 4);
    y += 4 + lines.length * 4 + 1;
  }

  // ── 1. EQUIPMENT DETAILS ──────────────────────────────────────────────────────
  sectionHeader('1. Equipment Details');

  const c1 = ML + 2;
  const c2 = ML + CW / 2 + 2;
  const hW = CW / 2 - 4;

  // Two-column layout via saved y snapshots
  const snap1 = y;
  kv('Item Name', data.itemName, c1, hW);
  kv('Inventory Code', data.itemCode || '—', c1, hW);
  kv('Category', data.itemCategory || '—', c1, hW);
  const end1 = y;

  y = snap1;
  kv('Borrowing ID', data.borrowingId || '—', c2, hW);
  kv('Date Borrowed', fmt(data.borrowedAt), c2, hW);
  kv('Due Date', fmt(data.dueDate), c2, hW);
  const end2 = y;

  y = Math.max(end1, end2) + 3;

  // ── 2. BORROWER INFORMATION ───────────────────────────────────────────────────
  divider();
  sectionHeader('2. Borrower Information');

  const s2a = y;
  kv('Borrower Name', data.borrowerName, c1, hW);
  kv('Worker ID', data.borrowerWorkerId || '—', c1, hW);
  const e2a = y;

  y = s2a;
  kv('Email Address', data.borrowerEmail || '—', c2, hW);
  kv('Return Date', fmt(data.returnedAt), c2, hW);
  const e2b = y;

  y = Math.max(e2a, e2b) + 3;

  // ── 3. INCIDENT / DAMAGE DETAILS ─────────────────────────────────────────────
  divider();
  sectionHeader('3. Incident / Damage Details');

  const s3a = y;
  kv('Incident Type', incidentLabel(data.incidentType), c1, hW);
  kv('Return Condition', data.returnCondition || '—', c1, hW);
  const e3a = y;

  y = s3a;
  kv('Reported By', data.reportedBy || '—', c2, hW);
  kv('Report Date', fmt(data.reportDate || now.toISOString()), c2, hW);
  const e3b = y;

  y = Math.max(e3a, e3b) + 2;

  if (data.returnNotes) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Inspection Notes', c1, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const noteLines = doc.splitTextToSize(data.returnNotes, CW - 4);
    doc.text(noteLines, c1, y + 4);
    y += 4 + noteLines.length * 4 + 3;
  }

  // ── 4. ACCESSORIES STATUS TABLE ───────────────────────────────────────────────
  if (data.issuedAccessories && data.issuedAccessories.length > 0) {
    divider();
    sectionHeader('4. Issued Accessories / Equipment Status');

    const rows = data.issuedAccessories.map((acc) => {
      const returned = data.returnedAccessories
        ? data.returnedAccessories[acc] !== false
        : true;
      const missing = data.missingAccessories?.includes(acc) || !returned;
      return [acc, missing ? '✗  LOST / MISSING' : '✓  RETURNED', missing ? 'Needs replacement' : '—'];
    });

    autoTable(doc, {
      startY: y,
      head: [['Accessory / Component', 'Status', 'Remarks']],
      body: rows,
      margin: { left: ML, right: ML },
      headStyles: { fillColor: [R, G, B], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 55 }, 2: { cellWidth: 'auto' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (d: any) => {
        if (d.section === 'body' && d.column.index === 1) {
          const v = String(d.cell.raw || '');
          d.cell.styles.textColor = v.includes('LOST') || v.includes('MISSING')
            ? [220, 38, 38]
            : [22, 163, 74];
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── 5. DAMAGE PHOTO ───────────────────────────────────────────────────────────
  if (data.damagePhotoUrl) {
    if (y > H - 90) { doc.addPage(); y = ML; }
    divider();
    sectionHeader('5. Damage / Loss Evidence Photo');

    try {
      const imgW = CW * 0.65;
      const imgH = 68;
      const imgX = ML + (CW - imgW) / 2;
      doc.addImage(data.damagePhotoUrl, 'JPEG', imgX, y, imgW, imgH, undefined, 'MEDIUM');
      doc.setDrawColor(R, G, B);
      doc.setLineWidth(0.5);
      doc.rect(imgX, y, imgW, imgH);
      doc.setLineWidth(0.2);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Photo evidence submitted at time of return', W / 2, y + imgH + 4, { align: 'center' });
      y += imgH + 10;
    } catch {
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text('[Photo could not be rendered]', ML + 2, y + 5);
      y += 10;
    }
  }

  // ── 6. RESOLUTION ─────────────────────────────────────────────────────────────
  if (data.resolutionDeadline || data.resolutionStatus || data.resolutionNotes) {
    if (y > H - 60) { doc.addPage(); y = ML; }
    divider();
    sectionHeader('6. Resolution / Follow-up');

    const s6a = y;
    kv('Resolution Deadline', fmt(data.resolutionDeadline), c1, hW);
    const e6a = y;

    y = s6a;
    kv('Resolution Status', data.resolutionStatus || 'Pending', c2, hW);
    const e6b = y;

    y = Math.max(e6a, e6b) + 2;

    if (data.resolutionNotes) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Resolution Notes', c1, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const rLines = doc.splitTextToSize(data.resolutionNotes, CW - 4);
      doc.text(rLines, c1, y + 4);
      y += 4 + rLines.length * 4 + 4;
    }
  }

  // ── SIGNATURE SECTION ─────────────────────────────────────────────────────────
  const sigH = 44;
  if (y > H - sigH - 18) { doc.addPage(); y = ML; }
  else { y = H - sigH - 15; }

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  y += 8;

  const sigBoxW = (CW - 10) / 3;
  ['Borrower / Responsible Party', 'Inventory Staff', 'Authorized By'].forEach((lbl, i) => {
    const sx = ML + i * (sigBoxW + 5);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(sx, y, sigBoxW, 20, 'S');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(lbl, sx + sigBoxW / 2, y + 24, { align: 'center' });
    doc.text('Signature over Printed Name / Date', sx + sigBoxW / 2, y + 28, { align: 'center' });
  });

  // ── FOOTER STRIP ──────────────────────────────────────────────────────────────
  doc.setFillColor(R, G, B);
  doc.rect(0, H - 10, W, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${rptId}  •  Auto-generated by Inventory Management System  •  ${now.toISOString()}`,
    W / 2, H - 4, { align: 'center' }
  );

  // ── SAVE ──────────────────────────────────────────────────────────────────────
  const blob = doc.output('blob');
  const safeName = (data.itemCode || data.itemName).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_]/g, '');
  const filename = `Incident-Report_${safeName}_${now.toISOString().slice(0, 10)}.pdf`;
  await saveFileUniversal(blob, filename, 'application/pdf');
}
