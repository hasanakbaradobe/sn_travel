import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Edit2,
  Trash2,
  CheckCircle2,
  Download,
  Building2,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Globe,
  DollarSign,
  AlertCircle,
  FileText,
  Share2,
  Loader2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { domToCanvas } from 'modern-screenshot';
import html2canvas from 'html2canvas-pro';
import { api } from '../services/api';
import { Invoice, InvoiceSettings, InvoiceStatus } from '../types';
import { getInvoiceLogoCandidates } from '../utils/imageUrl';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: number) => void;
  onInvoiceUpdated?: (invoice: Invoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onEditInvoice,
  onDeleteInvoice,
  onInvoiceUpdated,
}) => {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [logoCandidateIdx, setLogoCandidateIdx] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const invoicePrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPdfSuccess(false);
    api.getInvoiceSettings().then(s => {
      setSettings(s);
      setLogoCandidateIdx(0);
      setLogoFailed(false);
    }).catch(console.error);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const displayCurrency = !invoice.currency || invoice.currency === 'MYR' ? 'RM' : invoice.currency;
  const logoCandidates = getInvoiceLogoCandidates(settings?.logo_url);
  const currentLogoSrc = !logoFailed && logoCandidates.length > 0 ? logoCandidates[logoCandidateIdx] : '';

  const loadLogoDataUrl = async (src: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    if (!src) return null;
    try {
      return await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 200;
            canvas.height = img.naturalHeight || 80;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            resolve({
              dataUrl: canvas.toDataURL('image/png'),
              width: canvas.width,
              height: canvas.height,
            });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    } catch {
      return null;
    }
  };

  const handlePrint = async () => {
    if (printingPdf || !invoicePrintRef.current) return;
    setPrintingPdf(true);
    setPdfSuccess(false);

    let offscreenHost: HTMLDivElement | null = null;

    try {
      const sourceEl = invoicePrintRef.current;

      // Create an offscreen A4-proportioned container (794px = 210mm at 96 DPI)
      // so the captured PDF always matches the full desktop website design 1:1
      offscreenHost = document.createElement('div');
      offscreenHost.style.position = 'fixed';
      offscreenHost.style.left = '-10000px';
      offscreenHost.style.top = '0';
      offscreenHost.style.width = '794px';
      offscreenHost.style.backgroundColor = '#ffffff';
      offscreenHost.style.zIndex = '-9999';
      offscreenHost.style.pointerEvents = 'none';

      const clone = sourceEl.cloneNode(true) as HTMLElement;
      clone.style.width = '794px';
      clone.style.maxWidth = '794px';
      clone.style.margin = '0';
      clone.style.borderRadius = '0';
      clone.style.border = 'none';
      clone.style.boxShadow = 'none';
      clone.style.backgroundColor = '#ffffff';

      // Pre-inline all <img> elements as base64 data URLs so the snapshot renderer
      // never suffers from CORS tainting or missing external images
      const liveImgs = Array.from(sourceEl.querySelectorAll('img'));
      const cloneImgs = Array.from(clone.querySelectorAll('img'));

      for (let i = 0; i < cloneImgs.length; i++) {
        const clonedImg = cloneImgs[i];
        const liveImg = liveImgs[i];
        let inlinedDataUrl: string | null = null;

        if (liveImg && liveImg.complete && liveImg.naturalWidth > 0) {
          try {
            const c = document.createElement('canvas');
            c.width = liveImg.naturalWidth;
            c.height = liveImg.naturalHeight;
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.drawImage(liveImg, 0, 0);
              inlinedDataUrl = c.toDataURL('image/png');
            }
          } catch {
            // Tainted live image, fall back to candidate loader below
          }
        }

        if (!inlinedDataUrl) {
          const rawUrl = clonedImg.getAttribute('data-raw-url') || clonedImg.getAttribute('src') || '';
          const imgCandidates = getInvoiceLogoCandidates(rawUrl);
          for (const candidateUrl of (imgCandidates.length > 0 ? imgCandidates : logoCandidates)) {
            const loaded = await loadLogoDataUrl(candidateUrl);
            if (loaded?.dataUrl) {
              inlinedDataUrl = loaded.dataUrl;
              break;
            }
          }
        }

        if (inlinedDataUrl) {
          clonedImg.removeAttribute('crossorigin');
          clonedImg.src = inlinedDataUrl;
          try {
            await clonedImg.decode();
          } catch {
            // Ignore decode warning
          }
        }
      }

      offscreenHost.appendChild(clone);
      document.body.appendChild(offscreenHost);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // Render the exact DOM node at 3x scale for crisp Retina-grade typography & icons
      let renderedCanvas: HTMLCanvasElement | null = null;
      try {
        renderedCanvas = await domToCanvas(clone, {
          scale: 3,
          backgroundColor: '#ffffff',
        });
      } catch (domErr) {
        console.warn('modern-screenshot fallback to html2canvas-pro:', domErr);
      }

      if (!renderedCanvas || renderedCanvas.width === 0 || renderedCanvas.height === 0) {
        renderedCanvas = await html2canvas(clone, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          windowWidth: 1024,
        });
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

      const imgWidthMm = pageWidth;
      const imgHeightMm = (renderedCanvas.height * imgWidthMm) / renderedCanvas.width;

      if (imgHeightMm <= pageHeight) {
        // Fits on 1 A4 page at full width
        const imgData = renderedCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, imgWidthMm, imgHeightMm, undefined, 'FAST');
      } else if (imgHeightMm <= pageHeight * 1.22) {
        // Slightly taller than 1 A4 page: scale proportionally to fit cleanly on 1 page
        const imgData = renderedCanvas.toDataURL('image/png');
        const fitHeightMm = pageHeight;
        const fitWidthMm = (renderedCanvas.width * fitHeightMm) / renderedCanvas.height;
        const offsetX = (pageWidth - fitWidthMm) / 2;
        doc.addImage(imgData, 'PNG', offsetX, 0, fitWidthMm, fitHeightMm, undefined, 'FAST');
      } else {
        // Multi-page invoice: slice canvas cleanly into A4 page chunks
        const pageSliceHeightPx = Math.floor((renderedCanvas.width * pageHeight) / pageWidth);
        let currentPxY = 0;
        let pageIndex = 0;

        while (currentPxY < renderedCanvas.height) {
          if (pageIndex > 0) {
            doc.addPage();
          }
          const sliceH = Math.min(pageSliceHeightPx, renderedCanvas.height - currentPxY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = renderedCanvas.width;
          sliceCanvas.height = sliceH;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(
              renderedCanvas,
              0,
              currentPxY,
              renderedCanvas.width,
              sliceH,
              0,
              0,
              renderedCanvas.width,
              sliceH
            );
            const sliceData = sliceCanvas.toDataURL('image/png');
            const sliceHeightMm = (sliceH * pageWidth) / renderedCanvas.width;
            doc.addImage(sliceData, 'PNG', 0, 0, pageWidth, sliceHeightMm, undefined, 'FAST');
          }
          currentPxY += sliceH;
          pageIndex++;
        }
      }

      const safeFileName = `Invoice-${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(safeFileName);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to generate invoice PDF:', err);
      try {
        window.print();
      } catch {
        // Ignore
      }
    } finally {
      if (offscreenHost && offscreenHost.parentNode) {
        offscreenHost.parentNode.removeChild(offscreenHost);
      }
      setPrintingPdf(false);
    }
  };

  const handleQuickMarkPaid = async () => {
    if (!invoice) return;
    setMarkingPaid(true);
    try {
      const updated = await api.updateInvoice(invoice.id, {
        status: 'Paid',
        paid_amount: invoice.total_amount,
      });
      if (onInvoiceUpdated) onInvoiceUpdated(updated);
    } catch (err) {
      console.error('Failed to mark invoice as paid', err);
    } finally {
      setMarkingPaid(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid in Full
          </span>
        );
      case 'Partial':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-50 text-[#0284C7] border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" /> Partial Payment
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" /> Payment Pending
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Print-specific style tag: ensures only the invoice printable section is printed with exact subtle theme colors */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          html, body, #root {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-invoice-container, #printable-invoice-container * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-invoice-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print px-6 py-3.5 bg-[#0B2A5B] text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <span className="text-sm font-bold tracking-wide">
              Invoice #{invoice.invoice_number}
            </span>
            <span className="text-xs text-white/30">|</span>
            <span className="text-xs text-sky-100 font-medium">
              {invoice.client_name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status !== 'Paid' && (
              <button
                type="button"
                onClick={handleQuickMarkPaid}
                disabled={markingPaid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-300 hover:bg-emerald-200 rounded-lg transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Paid</span>
              </button>
            )}

            {onEditInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditInvoice(invoice);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition border border-white/15 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {onDeleteInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteInvoice(invoice.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:text-white bg-white/10 hover:bg-rose-600 rounded-lg transition border border-white/15 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={printingPdf}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white rounded-lg transition shadow-xs cursor-pointer ${
                pdfSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-[#0284C7] hover:bg-sky-500 disabled:opacity-60'
              }`}
            >
              {printingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PDF Saved!</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70">
          <div
            id="printable-invoice-container"
            ref={invoicePrintRef}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/90 max-w-3xl mx-auto overflow-hidden text-slate-800"
          >
            {/* Subtle Minimal Tri-Tone Brand Accent Bar (Logo Palette: Aviation Navy, Sky Blue, Golden Amber) */}
            <div className="h-1.5 w-full flex">
              <div className="h-full w-[62%] bg-[#0B2A5B]" />
              <div className="h-full w-[24%] bg-[#0284C7]" />
              <div className="h-full w-[14%] bg-[#F59E0B]" />
            </div>

            <div className="p-7 sm:p-11 space-y-8">
              {/* Header: Company Branding & Invoice Metadata */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-7 border-b border-slate-200/80">
                {/* Left: Logo & Agency Details */}
                <div className="space-y-3.5 max-w-md">
                  <div className="flex items-center gap-3.5">
                    {currentLogoSrc ? (
                      <img
                        src={currentLogoSrc}
                        crossOrigin="anonymous"
                        alt={settings?.company_name || 'Agency Logo'}
                        className="h-16 w-auto max-w-[160px] object-contain shrink-0"
                        onError={() => {
                          if (logoCandidateIdx + 1 < logoCandidates.length) {
                            setLogoCandidateIdx(prev => prev + 1);
                          } else {
                            setLogoFailed(true);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#0B2A5B] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                        SN
                      </div>
                    )}

                    <div>
                      <h1 className="text-xl font-black tracking-tight text-[#0B2A5B]">
                        {settings?.company_name || 'SN Travels Agency'}
                      </h1>
                      {settings?.company_tagline && (
                        <p className="text-xs text-[#0284C7] font-semibold mt-0.5">
                          {settings.company_tagline}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 pt-0.5 leading-relaxed">
                    {settings?.address && (
                      <p className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
                        <span className="break-words">{settings.address}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {settings?.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
                          <span>{settings.phone}</span>
                        </span>
                      )}
                      {settings?.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#0284C7]" />
                          <span>{settings.email}</span>
                        </span>
                      )}
                      {settings?.website && (
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[#0284C7]" />
                          <span>{settings.website}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Invoice Title, Number Badge, Status & Dates */}
                <div className="w-full sm:w-auto text-left sm:text-right space-y-2.5 shrink-0">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0284C7] block">
                      Official Billing Statement
                    </span>
                    <h2 className="text-3xl font-black tracking-tight text-[#0B2A5B] leading-none">
                      INVOICE
                    </h2>
                    <div className="pt-0.5">
                      <span className="inline-block font-mono text-xs font-bold text-[#0B2A5B] bg-[#F0F7FF] border border-[#BAE6FD] px-2.5 py-1 rounded-md">
                        #{invoice.invoice_number}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">{getStatusBadge(invoice.status)}</div>

                  <div className="text-xs space-y-1 pt-1.5 text-slate-600">
                    <div className="flex sm:justify-end items-center gap-2.5">
                      <span className="text-slate-400">Issued:</span>
                      <span className="font-semibold text-slate-800">{invoice.issue_date}</span>
                    </div>
                    {invoice.payment_method && (
                      <div className="flex sm:justify-end items-center gap-2.5">
                        <span className="text-slate-400">Method:</span>
                        <span className="font-semibold text-[#0B2A5B]">{invoice.payment_method}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billed To Customer Card (Minimal soft surface with Aviation Navy left border & Golden Amber dot) */}
              <div className="relative bg-[#F8FAFC] border border-slate-200/80 border-l-4 border-l-[#0B2A5B] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span className="text-[10px] font-bold text-[#0B2A5B] uppercase tracking-widest">
                    Billed To Customer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 break-words">
                      {invoice.client_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {invoice.client_code && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                          Ref: <strong className="text-[#0B2A5B]">{invoice.client_code}</strong>
                        </span>
                      )}
                      {invoice.client_passport && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                          Passport: <strong className="text-[#0B2A5B]">{invoice.client_passport}</strong>
                        </span>
                      )}
                      {invoice.client_country && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          • {invoice.client_country}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-slate-600 sm:text-right flex flex-col sm:items-end justify-center min-w-0">
                    {invoice.client_phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                        <span>{invoice.client_phone}</span>
                      </p>
                    )}
                    {invoice.client_email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
                        <span className="break-all">{invoice.client_email}</span>
                      </p>
                    )}
                    {invoice.client_address && (
                      <p className="flex items-start gap-1.5 sm:justify-end">
                        <MapPin className="w-3.5 h-3.5 text-[#0284C7] shrink-0 mt-0.5" />
                        <span className="text-left sm:text-right break-words">{invoice.client_address}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200/80">
                <table className="w-full table-fixed text-left text-xs">
                  <thead>
                    <tr className="bg-[#F0F7FF] border-b border-[#BAE6FD] text-[#0B2A5B] font-bold uppercase tracking-wider text-[10.5px]">
                      <th className="py-3 px-3.5 w-12">#</th>
                      <th className="py-3 px-3.5">Service / Description</th>
                      <th className="py-3 px-3.5 text-center w-16">Qty</th>
                      <th className="py-3 px-3.5 text-right w-28">Unit Price</th>
                      <th className="py-3 px-3.5 text-right w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((it, idx) => (
                        <tr
                          key={it.id || idx}
                          className="hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3.5 px-3.5 align-top">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#F0F7FF] text-[#0284C7] font-mono text-[11px] font-bold">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 align-top break-words [overflow-wrap:anywhere]">
                            <span className="font-semibold text-slate-900 block leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {it.description}
                            </span>
                          </td>
                          <td className="py-3.5 px-3.5 align-top text-center font-semibold text-slate-700 whitespace-nowrap">
                            {it.quantity}
                          </td>
                          <td className="py-3.5 px-3.5 align-top text-right font-mono text-slate-600 whitespace-nowrap">
                            {displayCurrency} {Number(it.unit_price).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-3.5 align-top text-right font-mono font-bold text-[#0B2A5B] whitespace-nowrap">
                            {displayCurrency} {Number(it.total).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No itemized services listed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary & Totals Calculation */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-1">
                {/* Left: Payment Instructions & Bank Details */}
                <div className="w-full sm:flex-1 min-w-0 space-y-3.5">
                  {settings?.bank_details && (
                    <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-4 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                        <span className="text-[10px] font-bold text-[#0B2A5B] uppercase tracking-wider">
                          Bank Transfer Details
                        </span>
                      </div>
                      <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed pl-3.5">
                        {settings.bank_details}
                      </pre>
                    </div>
                  )}

                  {invoice.notes && (
                    <div className="text-xs text-slate-600 space-y-1 px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Special Notes / Instructions
                      </span>
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-700">
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Financial Totals Box */}
                <div className="w-full sm:w-80 shrink-0 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 px-3 text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {displayCurrency} {Number(invoice.subtotal).toFixed(2)}
                    </span>
                  </div>

                  {invoice.discount > 0 && (
                    <div className="flex justify-between items-center py-1.5 px-3 text-emerald-700">
                      <span>Discount</span>
                      <span className="font-mono font-semibold">
                        - {displayCurrency} {Number(invoice.discount).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {invoice.tax_rate > 0 && (
                    <div className="flex justify-between items-center py-1.5 px-3 text-slate-600">
                      <span>Tax ({invoice.tax_rate}%)</span>
                      <span className="font-mono text-slate-800">
                        {displayCurrency} {Number(invoice.tax_amount).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Highlighted Total Amount Pill Box */}
                  <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-[#F0F7FF] border border-[#BAE6FD] text-[#0B2A5B]">
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      Total Amount
                    </span>
                    <span className="font-mono text-base font-black">
                      {displayCurrency} {Number(invoice.total_amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 px-3 text-emerald-700 font-semibold">
                    <span>Amount Paid</span>
                    <span className="font-mono">
                      {displayCurrency} {Number(invoice.paid_amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 border border-slate-200/70 text-sm font-bold">
                    <span className={invoice.balance_due > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                      Balance Due
                    </span>
                    <span
                      className={`font-mono ${
                        invoice.balance_due > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {displayCurrency} {Number(invoice.balance_due).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions (Left) & Authorized Signature Block (Right) */}
              {(settings?.terms_and_conditions || (settings?.signature_enabled ?? 1) === 1) && (
                <div className="pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8">
                  {/* Left: Terms & Conditions */}
                  <div className="flex-1 min-w-0 text-[10.5px] text-slate-500 space-y-1.5">
                    {settings?.terms_and_conditions && (
                      <>
                        <span className="font-bold text-[#0B2A5B] uppercase tracking-wider block text-[10px]">
                          Terms &amp; Conditions
                        </span>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {settings.terms_and_conditions}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Right: Signature Block (Line + Signatory Name + Designation) */}
                  {(settings?.signature_enabled ?? 1) === 1 && (
                    <div className="w-52 sm:w-56 shrink-0 text-center flex flex-col items-center self-end sm:self-auto">
                      {/* Area above signature line */}
                      <div className="h-11 flex items-end justify-center pb-1 w-full">
                        {settings?.signature_style === 'image' && settings?.signature_image_url ? (
                          <img
                            src={getInvoiceLogoCandidates(settings.signature_image_url)[0] || settings.signature_image_url}
                            data-raw-url={settings.signature_image_url}
                            crossOrigin="anonymous"
                            alt={settings?.signature_name || 'Authorized Signature'}
                            className="max-h-10 max-w-[170px] object-contain"
                          />
                        ) : (settings?.signature_style || 'script') === 'script' ? (
                          <span
                            className="text-xl text-[#0B2A5B] italic font-serif select-none tracking-wide"
                            style={{
                              fontFamily: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', 'Apple Chancery', cursive",
                            }}
                          >
                            {(settings?.signature_name ?? 'Sarah Nadeem').trim() || 'Authorized Signatory'}
                          </span>
                        ) : null}
                      </div>

                      {/* Signature Horizontal Line & Controlled Text Below */}
                      <div className="w-full border-t-[1.5px] border-slate-800 pt-1.5">
                        {(settings?.signature_name ?? 'Sarah Nadeem').trim() && (
                          <div className="text-xs font-bold text-slate-900 leading-tight">
                            {(settings?.signature_name ?? 'Sarah Nadeem').trim()}
                          </div>
                        )}
                        {(settings?.signature_designation ?? 'Managing Director').trim() && (() => {
                          const rawDesig = (settings?.signature_designation ?? 'Managing Director').trim();
                          const formattedDesig =
                            rawDesig.startsWith('(') && rawDesig.endsWith(')')
                              ? rawDesig
                              : `(${rawDesig})`;
                          return (
                            <div className="text-[11px] font-medium text-slate-600 mt-0.5 leading-tight">
                              {formattedDesig}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B2A5B]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Thank you for trusting{' '}
                  <span className="text-[#0B2A5B] font-semibold">
                    {settings?.company_name || 'SN Travels Agency'}
                  </span>{' '}
                  with your China visa and travel arrangements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
