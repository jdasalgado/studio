"use client";

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Loader2, QrCode, User, Calendar, Package, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from '@studio/ui';
import { cn } from '@/lib/utils';

export interface BorrowingQRData {
  id: string;
  itemId: string;
  borrowerName: string;
  borrowerEmail?: string;
  borrowedAt: string | Date;
  dueDate?: string | Date | null;
  status?: string;
  quantity?: number;
  item?: {
    name?: string;
    inventoryCode?: string;
    category?: { name?: string };
    unit?: string;
  };
}

interface BorrowingQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  borrowing: BorrowingQRData | null;
}

export function BorrowingQRModal({ isOpen, onClose, borrowing }: BorrowingQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const borrowYear = borrowing?.borrowedAt ? new Date(borrowing.borrowedAt).getFullYear() : 2026;
  const borrowingCode = borrowing ? `BORROW-${borrowYear}-${borrowing.id.slice(0, 8).toUpperCase()}` : '';
  const qrPayload = borrowing ? `BORROW-${borrowYear}-${borrowing.id}` : '';

  useEffect(() => {
    if (!isOpen || !borrowing) {
      setQrDataUrl('');
      return;
    }

    let active = true;
    setLoading(true);

    const generate = async () => {
      try {
        const url = await QRCode.toDataURL(qrPayload, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 360,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (active) {
          setQrDataUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Borrowing QR generation error:', err);
        if (active) setLoading(false);
      }
    };

    generate();

    return () => {
      active = false;
    };
  }, [isOpen, borrowing, qrPayload]);

  const handlePrint = () => {
    if (!borrowing) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedBorrowed = borrowing.borrowedAt
      ? new Date(borrowing.borrowedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';
    const formattedDue = borrowing.dueDate
      ? new Date(borrowing.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Open Schedule';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Borrowing Transaction Slip - ${borrowingCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      padding: 10mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slip {
      width: 82mm;
      max-width: 82mm;
      padding: 6mm 5mm;
      border: 1.5px solid #0f172a;
      border-radius: 4mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2mm;
      background: #ffffff;
    }
    .org-title {
      font-size: 7pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .header {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 0.5mm;
    }
    .code {
      font-size: 9pt;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      color: #0f172a;
      margin: 1.5mm 0;
      background: #f1f5f9;
      padding: 1mm 2.5mm;
      border-radius: 1.5mm;
    }
    .qr-img {
      width: 44mm;
      height: 44mm;
      object-fit: contain;
      margin: 1mm auto;
    }
    .divider {
      width: 100%;
      border-top: 1px solid #e2e8f0;
      margin: 2mm 0;
    }
    .details {
      width: 100%;
      font-size: 7.5pt;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 1.8mm;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2mm;
    }
    .label {
      color: #64748b;
      font-weight: 600;
      white-space: nowrap;
    }
    .val {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
      word-break: break-word;
    }
    .footer {
      font-size: 6.5pt;
      color: #94a3b8;
      margin-top: 2mm;
      text-align: center;
      line-height: 1.3;
    }
    @media print {
      body {
        padding: 0;
        min-height: auto;
      }
      .slip {
        margin: 10mm auto;
      }
      @page {
        size: portrait;
        margin: 10mm auto;
      }
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="org-title">COG APP &bull; Church Operations &amp; Governance</div>
    <div class="header">Equipment Borrowing Slip</div>
    <div class="code">${borrowingCode}</div>
    <img src="${qrDataUrl}" alt="Borrowing QR" class="qr-img" />
    <div class="divider"></div>
    <div class="details">
      <div class="row"><span class="label">Borrower:</span><span class="val">${borrowing.borrowerName}</span></div>
      <div class="row"><span class="label">Item:</span><span class="val">${borrowing.item?.name || 'Equipment'}</span></div>
      <div class="row"><span class="label">Item Code:</span><span class="val">${borrowing.item?.inventoryCode || borrowing.itemId.slice(0, 8)}</span></div>
      <div class="row"><span class="label">Quantity:</span><span class="val">${borrowing.quantity || 1} ${borrowing.item?.unit || 'pcs'}</span></div>
      <div class="row"><span class="label">Borrowed Date:</span><span class="val">${formattedBorrowed}</span></div>
      <div class="row"><span class="label">Expected Return:</span><span class="val">${formattedDue}</span></div>
      <div class="row"><span class="label">Status:</span><span class="val">${borrowing.status || 'BORROWED'}</span></div>
    </div>
    <div class="divider"></div>
    <div class="footer">Scan QR with handheld reader on item return check-in.<br/>Official Transaction Record &bull; Church Property</div>
  </div>
  <script>window.onload=()=>{ window.print(); window.close(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (!qrDataUrl || !borrowing) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `BORROWING_QR_${borrowingCode}.png`;
    link.click();
  };

  if (!borrowing) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-background [&>button:last-child]:hidden">
        {/* ── STICKY MODAL HEADER ── */}
        <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md shrink-0 sticky top-0 z-10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground">
                Borrowing Transaction QR
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Scan this code with a mobile camera or barcode scanner to lookup and adjust stock.
              </DialogDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer shrink-0 -mt-1 -mr-1"
            title="Close modal"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-semibold">Generating transaction QR code...</span>
            </div>
          ) : (
            <div ref={printRef} className="w-full flex flex-col items-center justify-center space-y-4">
              {/* QR Image Card matching Item QR style */}
              <div className="w-full max-w-[340px] p-6 bg-white dark:bg-card border border-border/80 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center">
                <img
                  src={qrDataUrl}
                  alt={borrowingCode}
                  className="w-56 h-56 object-contain"
                />
                <div className="mt-3.5 space-y-1 w-full">
                  <div className="font-headline font-bold text-sm tracking-wide text-foreground uppercase truncate" title={borrowing.item?.name || 'Equipment'}>
                    {borrowing.item?.name || 'Equipment'}
                  </div>
                  <div className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {borrowingCode}
                  </div>
                </div>
              </div>

              {/* Transaction Metadata Card */}
              <div className="w-full max-w-[340px] rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-2.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>Borrower:</span>
                  </div>
                  <span className="font-bold text-foreground truncate max-w-[170px]">{borrowing.borrowerName}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span>Borrowed Item:</span>
                  </div>
                  <span className="font-bold text-foreground truncate max-w-[170px]">
                    {borrowing.item?.name || 'Equipment'} ({borrowing.quantity || 1} {borrowing.item?.unit || 'pcs'})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>Date Borrowed:</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {borrowing.borrowedAt ? new Date(borrowing.borrowedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center italic px-2 max-w-[340px]">
                Note: This QR code is strictly for this borrowing transaction and does not replace the Item&apos;s permanent QR.
              </p>
            </div>
          )}
        </div>

        {/* ── STICKY MODAL FOOTER ── */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={loading || !qrDataUrl}
            className="rounded-xl text-xs h-9 px-4 font-semibold border-border/80 hover:bg-muted/60 cursor-pointer shadow-2xs gap-1.5"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Download PNG</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            disabled={loading || !qrDataUrl}
            className="rounded-xl text-xs h-9 px-4 font-bold bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>Print Slip</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
