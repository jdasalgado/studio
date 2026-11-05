import { useEffect, useState, useRef } from 'react';
import { X, Printer, Download, Loader } from 'lucide-react';

interface QRItem {
  id: string;
  name: string;
  inventoryCode?: string;
}

interface QRRecord {
  itemId: string;
  itemName: string;
  inventoryCode?: string;
  pngDataUrl: string;
}

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: QRItem | null;      // single item (legacy)
  items?: QRItem[];          // batch items
}

export function QRModal({ isOpen, onClose, item, items }: QRModalProps) {
  const [records, setRecords] = useState<QRRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Merge single/batch modes
  const allItems: QRItem[] = items && items.length > 0 ? items : item ? [item] : [];

  useEffect(() => {
    if (!isOpen || allItems.length === 0) return;
    setLoading(true);
    setRecords([]);

    if (allItems.length === 1) {
      fetch(`/api/items/${allItems[0].id}/qr`)
        .then(r => r.json())
        .then(data => {
          if (data.pngDataUrl) {
            setRecords([{
              itemId: data.itemId,
              itemName: data.itemName,
              inventoryCode: data.inventoryCode,
              pngDataUrl: data.pngDataUrl
            }]);
          }
        })
        .catch(err => console.error('QR fetch error', err))
        .finally(() => setLoading(false));
    } else {
      const ids = allItems.map(i => i.id).join(',');
      fetch(`/api/items/qr/batch?ids=${ids}`)
        .then(r => r.json())
        .then(data => Array.isArray(data) ? setRecords(data) : setRecords([]))
        .catch(err => console.error('Batch QR error', err))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, JSON.stringify(allItems.map(i => i.id))]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Labels</title>
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
    ${records.map(r => `
      <div class="label">
        <img src="${r.pngDataUrl}" alt="QR" />
        <div class="label-name">${r.itemName}</div>
        ${r.inventoryCode ? `<div class="label-code">${r.inventoryCode}</div>` : `<div class="label-code">${r.itemId.slice(0, 8).toUpperCase()}</div>`}
      </div>
    `).join('')}
  </div>
  <script>window.onload=()=>{ window.print(); window.close(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownloadAll = () => {
    records.forEach(r => {
      const link = document.createElement('a');
      link.href = r.pngDataUrl;
      link.download = `qr_${r.inventoryCode || r.itemId.slice(0, 8)}.png`;
      link.click();
    });
  };

  const isBatch = allItems.length > 1;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: isBatch ? '720px' : '380px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: '#1a1a2e' }}>
              {isBatch ? `QR Labels (${allItems.length} items)` : 'QR Label'}
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
              {isBatch ? 'Print-ready batch labels for selected items' : 'Scan to identify this item'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '1.5rem'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', minHeight: '200px', color: '#9ca3af' }}>
              <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.875rem' }}>Generating QR codes…</span>
            </div>
          ) : (
            <div ref={printRef}>
              {isBatch ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem'
                }}>
                  {records.map(r => (
                    <div key={r.itemId} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textAlign: 'center',
                      backgroundColor: '#fafafa'
                    }}>
                      <img src={r.pngDataUrl} alt={r.itemName} style={{ width: '110px', height: '110px', objectFit: 'contain' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>{r.itemName}</span>
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af', fontFamily: 'monospace' }}>
                        {r.inventoryCode || r.itemId.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                records[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      backgroundColor: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <img src={records[0].pngDataUrl} alt={records[0].itemName} style={{ width: '200px', height: '200px' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1a1a2e' }}>{records[0].itemName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '0.25rem' }}>
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

        {/* Footer */}
        {!loading && records.length > 0 && (
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '0.625rem',
            backgroundColor: '#f9fafb'
          }}>
            <button
              onClick={handleDownloadAll}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                fontSize: '0.8125rem', fontWeight: 500,
                cursor: 'pointer', color: '#374151',
                fontFamily: 'inherit'
              }}
            >
              <Download size={14} />
              Download PNG{records.length > 1 ? 's' : ''}
            </button>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1.25rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#3b5bdb',
                color: '#fff',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flex: 1
              }}
            >
              <Printer size={14} />
              {isBatch ? `Print ${records.length} Labels` : 'Print Label'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
