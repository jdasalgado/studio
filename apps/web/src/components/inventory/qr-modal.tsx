"use client";

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Download, Printer, Loader2, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from '@studio/ui';
import { cn } from '@/lib/utils';

interface QRModalItem {
  id: string;
  name: string;
  inventoryCode?: string;
  category?: { name: string };
}

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: QRModalItem | null;
  items?: QRModalItem[];
}

interface QRRecord {
  itemId: string;
  itemName: string;
  inventoryCode?: string;
  pngDataUrl: string;
}

export function QRModal({ isOpen, onClose, item, items }: QRModalProps) {
  const [records, setRecords] = useState<QRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const allItems: QRModalItem[] = items && items.length > 0 ? items : item ? [item] : [];

  useEffect(() => {
    if (!isOpen || allItems.length === 0) {
      setRecords([]);
      return;
    }

    let active = true;
    setLoading(true);

    const generate = async () => {
      try {
        const generated: QRRecord[] = [];
        for (const it of allItems) {
          const rawCode = it.inventoryCode || it.id;
          const payload = rawCode.startsWith('ITEM-') ? rawCode : `ITEM-${rawCode}`;
          const url = await QRCode.toDataURL(payload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: { dark: '#111827', light: '#ffffff' },
          });
          if (active) {
            generated.push({
              itemId: it.id,
              itemName: it.name,
              inventoryCode: payload,
              pngDataUrl: url,
            });
          }
        }
        if (active) {
          setRecords(generated);
          setLoading(false);
        }
      } catch (err) {
        console.error('QR generation error:', err);
        if (active) setLoading(false);
      }
    };

    generate();

    return () => {
      active = false;
    };
  }, [isOpen, item, items]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print Inventory QR Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${isBatch ? `
    .label-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5mm;
      padding: 6mm;
    }
    .label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4mm 3mm;
      border: 1px solid #cbd5e1;
      border-radius: 3mm;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
      background: #ffffff;
    }
    .label img {
      width: 36mm;
      height: 36mm;
      object-fit: contain;
    }
    .label-name {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      margin-top: 2mm;
      max-width: 90%;
      word-break: break-word;
    }
    .label-code {
      font-size: 7pt;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      margin-top: 1mm;
      letter-spacing: 0.5px;
    }
    ` : `
    .label-grid {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      padding: 20mm 10mm;
    }
    .label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6mm;
      text-align: center;
      background: #ffffff;
      max-width: 90mm;
    }
    .label img {
      width: 55mm;
      height: 55mm;
      object-fit: contain;
    }
    .label-name {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-top: 4mm;
      word-break: break-word;
    }
    .label-code {
      font-size: 8.5pt;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
      margin-top: 1.5mm;
      letter-spacing: 0.5px;
    }
    `}
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="label-grid">
    ${records
      .map(
        (r) => `
      <div class="label">
        <img src="${r.pngDataUrl}" alt="QR" />
        <div class="label-name">${r.itemName}</div>
        <div class="label-code">${r.inventoryCode || r.itemId.slice(0, 8).toUpperCase()}</div>
      </div>
    `
      )
      .join('')}
  </div>
  <script>window.onload=()=>{ window.print(); window.close(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadAll = () => {
    records.forEach((r) => {
      const link = document.createElement('a');
      link.href = r.pngDataUrl;
      link.download = `QR_${r.inventoryCode || r.itemId.slice(0, 8)}.png`;
      link.click();
    });
  };

  const isBatch = allItems.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl bg-background [&>button:last-child]:hidden",
          isBatch ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        {/* ── STICKY MODAL HEADER ── */}
        <div className="p-5 pb-4 border-b border-border/70 bg-card/80 backdrop-blur-md shrink-0 sticky top-0 z-10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold font-headline tracking-tight text-foreground">
                {isBatch ? `QR Labels (${allItems.length} items)` : 'Item QR Code'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                {isBatch
                  ? 'Print-ready batch labels for selected items'
                  : 'Scan this code with a mobile camera or barcode scanner to lookup and adjust stock.'}
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
              <span className="text-xs font-semibold">Generating high-resolution QR codes...</span>
            </div>
          ) : (
            <div ref={printRef} className="w-full flex flex-col items-center justify-center">
              {isBatch ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {records.map((r) => (
                    <div
                      key={r.itemId}
                      className="p-3.5 rounded-2xl border border-border/70 bg-card/60 shadow-2xs flex flex-col items-center gap-2 text-center"
                    >
                      <img src={r.pngDataUrl} alt={r.itemName} className="w-28 h-28 object-contain rounded-xl" />
                      <div className="font-headline font-bold text-xs text-foreground line-clamp-1 w-full" title={r.itemName}>
                        {r.itemName}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-muted-foreground">
                        {r.inventoryCode || r.itemId.slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                records[0] && (
                  <div className="w-full flex flex-col items-center justify-center">
                    <div className="w-full max-w-[340px] p-6 bg-white dark:bg-card border border-border/80 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center">
                      <img
                        src={records[0].pngDataUrl}
                        alt={records[0].itemName}
                        className="w-56 h-56 object-contain"
                      />
                      <div className="mt-3.5 space-y-1 w-full">
                        <div className="font-headline font-bold text-sm tracking-wide text-foreground uppercase truncate" title={records[0].itemName}>
                          {records[0].itemName}
                        </div>
                        <div className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          {records[0].inventoryCode || records[0].itemId.slice(0, 8).toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* ── STICKY MODAL FOOTER ── */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={loading || records.length === 0}
            className="rounded-xl text-xs h-9 px-4 font-semibold border-border/80 hover:bg-muted/60 cursor-pointer shadow-2xs gap-1.5"
          >
            <Download className="h-4 w-4 text-muted-foreground" />
            <span>Download PNG{records.length > 1 ? 's' : ''}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            disabled={loading || records.length === 0}
            className="rounded-xl text-xs h-9 px-4 font-bold bg-sidebar hover:bg-sidebar/90 text-white shadow-xs cursor-pointer gap-1.5"
          >
            <Printer className="h-4 w-4" />
            <span>{isBatch ? `Print ${records.length} Labels` : 'Print Label'}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
