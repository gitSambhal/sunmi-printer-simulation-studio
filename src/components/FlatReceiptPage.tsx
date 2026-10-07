import React, { useState, useRef, useMemo } from 'react';
import { 
  Download, Printer, Copy, FileText, Image as ImageIcon, 
  Code, SlidersHorizontal, ZoomIn, ZoomOut, RotateCcw, 
  Check, Sparkles, X, ChevronDown, Share2, Layers,
  FileCode, Scissors, Eye, RefreshCw
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { ReceiptData, Alignment, receiptDataToPlainText, escapedStringToBytes } from '../lib/escpos';
import { renderReceiptToSvg, renderReceiptToHtml, renderReceiptToPngDataUrl } from '../lib/renderHtml';
import { copyToClipboard } from '../lib/clipboard';

export interface FlatReceiptPageProps {
  data: ReceiptData;
  rawString: string;
  width: '58mm' | '80mm';
  onWidthChange: (w: '58mm' | '80mm') => void;
  onRawStringChange: (newStr: string) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const PRESETS = [
  {
    id: 'complex',
    name: 'Dine-In Restaurant',
    subtitle: 'Table order, modifiers & tax breakdown',
    raw: `\\u001dB\\u0001\\u001bE\\u0001        ⚠ MANUAL PROCESSING REQUIRED ⚠        \\u001bE\\u0000\\u001dB\\u0000\\n\\u001bE\\u0001               Epoint Store Test                \\u001bE\\u0000\\n\\n------------------------------------------------\\n\\nOrder Type                               Dine In\\nPlaced On                        Apr 29, 1:46 PM\\nOrder ID                               856407029\\nTable                                         19\\nQueue No                                    0004\\n\\n\\u001br\\u0001+----------------------------------------------+\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 \\u001br\\u0001\\u001bE\\u0001ORDER NOT SENT TO POS\\u001bE\\u0000\\u001br\\u0000                        \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 Error Code                               \\u001br\\u0001\\u001bE\\u0001504\\u001bE\\u0000\\u001br\\u0000 \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 Reason           Timeout from POS/cURL error \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001+----------------------------------------------+\\u001br\\u0000\\n\\n4x Puff Pastry                             23.20\\n2x Mushroom soup 1                         80.00\\n3x Vegetable                               42.00\\n3x Potato Wedges                          285.30\\n  3x Diane Half                            56.70\\n  3x Diane Whole                          101.70\\n    3x Beef Pie                            55.50\\n\\n------------------------------------------------\\n\\n\\u001bE\\u0001Subtotal\\u001bE\\u0000                              SGD 480.50\\nTotal Items                                   17\\nPayment                                   CASHAC\\nService Charge Charge                 + SGD 3.00\\nGST 8%                                + SGD 38.68\\n------------------------------------------------\\n\\u001bE\\u0001Grand Total                           SGD 522.18\\u001bE\\u0000\\n\\n\\u001bE\\u0001SPECIAL REQUEST\\u001bE\\u0000\\nServe desserts after main course\\n\\n\\u001dV\\u0000`,
  },
  {
    id: 'cafe',
    name: 'Artisan Cafe Order',
    subtitle: 'Espresso bar quick counter receipt',
    raw: `\\u001b@\\u001ba\\u0001\\u001d!\\u0011BLUE BOTTLE COFFEE\\n\\u001ba\\u0001\\u001d!\\u0000Roastery & Espresso Bar\\n123 Market Street, San Francisco\\n\\n\\u001ba\\u0000Order #0482                    10:24 AM\\nCashier: Maya                     Reg: 02\\n================================================\\n1x Oat Flat White (Double)               $5.75\\n   + Extra Shot                          $1.25\\n1x Kyoto Cold Brew                       $6.00\\n1x Cardamom Bun                          $4.50\\n1x Avocado Sourdough Toast              $11.00\\n   * Gluten-free bread\\n------------------------------------------------\\nSubtotal                                $28.50\\nTax (8.5%)                               $2.42\\nTip (18%)                                $5.50\\n\\u001bE\\u0001TOTAL                                   $36.42\\u001bE\\u0000\\n================================================\\nPayment: Apple Pay (**** 8821)\\nAuth: #839201\\n\\n\\u001ba\\u0001Wi-Fi: BlueBottleGuest | Pass: craftcoffee\\n\\u001bE\\u0001Thank you for supporting local coffee!\\u001bE\\u0000\\n\\n\\u001dV\\u0000`,
  },
  {
    id: 'kitchen',
    name: 'Kitchen Expediter Ticket',
    subtitle: 'High-contrast rush ticket with prep notes',
    raw: `\\u001b@\\u001ba\\u0001\\u001d!\\u0011*** KITCHEN TICKET #42 ***\\n\\u001ba\\u0000\\u001d!\\u0000Table: 08        Server: Jack        19:42:15\\n================================================\\n\\u001bE\\u00011x Wagyu Ribeye Steak (Med-Rare)       $52.00\\u001bE\\u0000\\n\\u001br\\u0001  * SPECIAL: EXTRA CHIMICHURRI SAUCE\\u001br\\u0000\\n\\u001bE\\u00012x Truffle Parmesan Fries              $24.00\\u001bE\\u0000\\n\\u001bE\\u00011x Caesar Salad (No Croutons)          $14.00\\u001bE\\u0000\\n\\u001br\\u0001  * SEVERE GLUTEN ALLERGY - CLEAN GRILL\\u001br\\u0000\\n\\u001bE\\u00011x Grilled Salmon Fillet               $34.00\\u001bE\\u0000\\n------------------------------------------------\\n\\u001bE\\u0001Total Items: 5\\u001bE\\u0000\\n\\n\\u001dB\\u0001\\u001bE\\u0001RUSH ORDER - EXPEDITE IMMEDIATELY\\u001bE\\u0000\\u001dB\\u0000\\n\\n\\u001dV\\u0000`,
  },
  {
    id: 'retail',
    name: 'Boutique Retail Store',
    subtitle: 'Itemized inventory with return policy',
    raw: `\\u001b@\\u001ba\\u0001\\u001d!\\u0011NORDIC APPAREL\\n\\u001ba\\u0001\\u001d!\\u0000Flagship Store #01\\nsupport@nordicapparel.com\\n\\n\\u001ba\\u0000Date: Oct 06, 2026               Receipt: 77124\\nAssociate: Linnea                 Terminal: T-04\\n------------------------------------------------\\nSKU-9921 Merino Wool Crewneck          $145.00\\nSKU-4402 Cotton Canvas Chino            $98.00\\nSKU-1108 Silk Knit Socks (3-pack)       $32.00\\nSKU-8820 Leather Minimalist Belt        $65.00\\n------------------------------------------------\\nSubtotal                               $340.00\\nAutumn Discount (-15%)                 -$51.00\\nSales Tax (8.25%)                       $23.84\\n\\u001bE\\u0001Total Charged                          $312.84\\u001bE\\u0000\\n------------------------------------------------\\nCard: Visa Contactless ************4192\\nAuth Code: 098442\\n\\n\\u001ba\\u0001[||||||||||||||||||||||||||||||||||||||||||||]\\nBARCODE: 77124098442\\n\\nReturns accepted within 30 days with receipt.\\nKeep this ticket for exchange verification.\\n\\n\\u001dV\\u0000`,
  },
];

export const FlatReceiptPage: React.FC<FlatReceiptPageProps> = ({
  data,
  rawString,
  width,
  onWidthChange,
  onRawStringChange,
  onShowToast,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [paperTheme, setPaperTheme] = useState<'pure-white' | 'warm-cream' | 'monochrome-dark'>('pure-white');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate paper dimension stats
  const estimatedHeightMm = useMemo(() => {
    // Thermal paper standard: roughly 3.5mm to 4.2mm per line + 15mm margins
    const lineCount = data?.lines?.length || 0;
    return Math.max(40, Math.round(lineCount * 3.8 + 16));
  }, [data?.lines?.length]);

  // Export handlers
  const handleExportPng = async () => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    try {
      // 1. Direct high-DPI canvas generation (100% reliable, no network/font failures)
      const dataUrl = renderReceiptToPngDataUrl(data, { 
        width, 
        theme: paperTheme === 'monochrome-dark' ? 'dark' : 'light' 
      });

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `receipt-${width}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        onShowToast('PNG image downloaded (crisp 2x high-resolution)', 'success');
        return;
      }
      throw new Error('Canvas renderer returned empty data');
    } catch (err) {
      console.warn('Canvas export fallback, trying html-to-image:', err);
      let tempContainer: HTMLDivElement | null = null;
      try {
        const htmlString = renderReceiptToHtml(data, { 
          width, 
          theme: paperTheme === 'monochrome-dark' ? 'dark' : 'light' 
        });

        tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = width === '58mm' ? '320px' : '400px';
        tempContainer.style.backgroundColor = paperTheme === 'monochrome-dark' ? '#18181b' : '#ffffff';
        tempContainer.style.zIndex = '-9999';
        tempContainer.innerHTML = htmlString;
        document.body.appendChild(tempContainer);

        const targetNode = (tempContainer.querySelector('#receipt-container') as HTMLElement) || tempContainer;
        const domDataUrl = await toPng(targetNode, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: paperTheme === 'monochrome-dark' ? '#18181b' : '#ffffff',
          skipFonts: true,
        });

        const link = document.createElement('a');
        link.download = `receipt-${width}-${Date.now()}.png`;
        link.href = domDataUrl;
        link.click();
        onShowToast('PNG image downloaded', 'success');
      } catch (fallbackErr) {
        console.error('Failed to export PNG:', fallbackErr);
        onShowToast('Failed to export PNG image', 'error');
      } finally {
        if (tempContainer && tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSvg = () => {
    setIsExportMenuOpen(false);
    try {
      const svgString = renderReceiptToSvg(data, { 
        width, 
        theme: paperTheme === 'monochrome-dark' ? 'dark' : 'light' 
      });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `receipt-${width}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onShowToast('Scalable vector SVG downloaded', 'success');
    } catch (err) {
      console.error('Failed to export SVG:', err);
      onShowToast('Failed to export SVG', 'error');
    }
  };

  const handlePrint = () => {
    setIsExportMenuOpen(false);
    onShowToast('Opening browser print dialog...', 'info');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCopyText = async () => {
    setIsExportMenuOpen(false);
    try {
      const plainText = receiptDataToPlainText(data, width);
      const success = await copyToClipboard(plainText);
      if (success) {
        onShowToast('Formatted plain text copied to clipboard', 'success');
      } else {
        onShowToast('Could not access clipboard', 'error');
      }
    } catch (err) {
      console.error('Copy plain text error:', err);
      onShowToast('Failed to copy text', 'error');
    }
  };

  const handleCopyHtml = async () => {
    setIsExportMenuOpen(false);
    try {
      const html = renderReceiptToHtml(data, { 
        width, 
        theme: paperTheme === 'monochrome-dark' ? 'dark' : 'light' 
      });
      const success = await copyToClipboard(html);
      if (success) {
        onShowToast('Stand-alone HTML receipt code copied', 'success');
      } else {
        onShowToast('Could not access clipboard', 'error');
      }
    } catch (err) {
      console.error('Copy HTML error:', err);
      onShowToast('Failed to copy HTML code', 'error');
    }
  };

  const handleDownloadEscPos = () => {
    setIsExportMenuOpen(false);
    try {
      const bytes = escapedStringToBytes(rawString);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `receipt-${Date.now()}.bin`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onShowToast(`Downloaded raw ESC/POS binary (${bytes.length} bytes)`, 'success');
    } catch (err) {
      console.error('Download ESC/POS binary error:', err);
      onShowToast('Failed to create binary file', 'error');
    }
  };

  const handleCopyDataUrl = async () => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    let tempContainer: HTMLDivElement | null = null;
    try {
      const htmlString = renderReceiptToHtml(data, { 
        width, 
        theme: paperTheme === 'monochrome-dark' ? 'dark' : 'light' 
      });

      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = width === '58mm' ? '320px' : '400px';
      tempContainer.style.backgroundColor = paperTheme === 'monochrome-dark' ? '#18181b' : '#ffffff';
      tempContainer.style.zIndex = '-9999';
      tempContainer.innerHTML = htmlString;
      document.body.appendChild(tempContainer);

      const targetNode = (tempContainer.querySelector('#receipt-container') as HTMLElement) || tempContainer;
      const dataUrl = await toPng(targetNode, {
        quality: 0.95,
        pixelRatio: 1.5,
        backgroundColor: paperTheme === 'monochrome-dark' ? '#18181b' : '#ffffff',
      });

      const success = await copyToClipboard(dataUrl);
      if (success) {
        onShowToast('Image Data URL (base64) copied to clipboard', 'success');
      }
    } catch (err) {
      console.error('Data URL copy error:', err);
      onShowToast('Failed to copy Data URL', 'error');
    } finally {
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      setIsExporting(false);
    }
  };

  // Determine paper container styling
  const paperBgColor = 
    paperTheme === 'warm-cream' 
      ? 'bg-[#faf8f2] text-neutral-900 border-[#eae4d3]' 
      : paperTheme === 'monochrome-dark'
      ? 'bg-[#18181b] text-neutral-100 border-neutral-800'
      : 'bg-white text-neutral-900 border-neutral-200';

  const paperWidthPx = width === '58mm' ? 'w-[320px]' : 'w-[400px]';

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-100/70 dark:bg-neutral-950 overflow-hidden relative font-sans">
      {/* Pristine Clean Toolbar */}
      <nav aria-label="Flat receipt controls" className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 z-30">
        {/* Left Section: Preset Selection & Paper Width */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Preset Selector Dropdown */}
          <div className="relative group">
            <select
              aria-label="Receipt Preset"
              onChange={(e) => {
                const found = PRESETS.find((p) => p.id === e.target.value);
                if (found) {
                  onRawStringChange(found.raw);
                  onShowToast(`Loaded "${found.name}" preset`, 'info');
                }
              }}
              defaultValue="complex"
              className="appearance-none bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-200 text-xs font-semibold py-1.5 pl-3 pr-8 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer transition-colors focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          </div>

          {/* Width Segmented Control */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium">
            <button
              onClick={() => onWidthChange('58mm')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                width === '58mm'
                  ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => onWidthChange('80mm')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                width === '80mm'
                  ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              80mm
            </button>
          </div>

          {/* Paper Theme Picker */}
          <div className="hidden md:flex items-center gap-1 text-xs">
            <button
              onClick={() => setPaperTheme('pure-white')}
              className={`px-2 py-1 rounded-md border text-xs transition-colors ${
                paperTheme === 'pure-white'
                  ? 'border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
              title="Clean White Thermal Paper"
            >
              White
            </button>
            <button
              onClick={() => setPaperTheme('warm-cream')}
              className={`px-2 py-1 rounded-md border text-xs transition-colors ${
                paperTheme === 'warm-cream'
                  ? 'border-amber-600 dark:border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
              title="Warm Tinted Thermal Paper"
            >
              Warm
            </button>
            <button
              onClick={() => setPaperTheme('monochrome-dark')}
              className={`px-2 py-1 rounded-md border text-xs transition-colors ${
                paperTheme === 'monochrome-dark'
                  ? 'border-neutral-400 bg-neutral-900 text-white font-semibold shadow-2xs'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
              title="Dark Mode Receipt"
            >
              Inverted
            </button>
          </div>
        </div>

        {/* Right Section: Zoom, Edit Drawer & Export Button */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-700 text-xs">
            <button
              onClick={() => setZoom((prev) => Math.max(60, prev - 15))}
              className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-sm transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-2 text-[11px] font-mono font-medium text-neutral-600 dark:text-neutral-300 select-none">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(180, prev + 15))}
              className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-sm transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
            {zoom !== 100 && (
              <button
                onClick={() => setZoom(100)}
                className="px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 hover:underline border-l border-neutral-200 dark:border-neutral-700 ml-0.5"
                title="Reset zoom"
              >
                100%
              </button>
            )}
          </div>

          {/* Edit Drawer Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 transition-colors"
            title="Edit Receipt Raw Content"
          >
            <SlidersHorizontal size={13} />
            <span>Edit Data</span>
          </button>

          {/* Quick Print Button */}
          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 transition-colors"
            title="Print Receipt Directly (window.print)"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          {/* Export Dropdown Group */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              <Download size={13} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown size={13} className="opacity-80" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Image &amp; Vector
                </div>
                <button
                  onClick={handleExportPng}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <ImageIcon size={14} className="text-amber-500" />
                  <div>
                    <div className="font-semibold">Download PNG</div>
                    <div className="text-[10px] text-neutral-400">High-resolution 2x raster image</div>
                  </div>
                </button>
                <button
                  onClick={handleExportSvg}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <Code size={14} className="text-sky-500" />
                  <div>
                    <div className="font-semibold">Download SVG</div>
                    <div className="text-[10px] text-neutral-400">Crisp scalable vector graphic</div>
                  </div>
                </button>

                <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Documents &amp; Code
                </div>
                <button
                  onClick={handlePrint}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <Printer size={14} className="text-emerald-500" />
                  <div>
                    <div className="font-semibold">Print / Save as PDF</div>
                    <div className="text-[10px] text-neutral-400">Native browser print formatted</div>
                  </div>
                </button>
                <button
                  onClick={handleCopyHtml}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <FileCode size={14} className="text-purple-500" />
                  <div>
                    <div className="font-semibold">Copy HTML Code</div>
                    <div className="text-[10px] text-neutral-400">Self-contained styled HTML</div>
                  </div>
                </button>
                <button
                  onClick={handleCopyText}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <FileText size={14} className="text-neutral-500" />
                  <div>
                    <div className="font-semibold">Copy Plain Text</div>
                    <div className="text-[10px] text-neutral-400">Clean text stripped of escape codes</div>
                  </div>
                </button>

                <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Developer Data
                </div>
                <button
                  onClick={handleDownloadEscPos}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <Download size={14} className="text-indigo-500" />
                  <div>
                    <div className="font-semibold">Download .bin Binary</div>
                    <div className="text-[10px] text-neutral-400">Raw byte stream for hardware</div>
                  </div>
                </button>
                <button
                  onClick={handleCopyDataUrl}
                  className="w-full text-left px-3.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-neutral-700 dark:text-neutral-200 transition-colors"
                >
                  <Share2 size={14} className="text-rose-500" />
                  <div>
                    <div className="font-semibold">Copy Image Data URL</div>
                    <div className="text-[10px] text-neutral-400">Base64 PNG URI for embeds</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Stage: Clean, Distraction-Free Receipt Viewing Canvas */}
      <main className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center justify-start min-h-0 relative select-text">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="pb-16 flex flex-col items-center"
        >
          {/* Flat Printable Receipt Card */}
          <article
            ref={receiptRef}
            id="flat-receipt-printable"
            data-receipt-width={width}
            className={`${paperWidthPx} ${paperBgColor} relative rounded-sm shadow-xl transition-all duration-200 border overflow-hidden`}
          >
            {/* Top Perforated Tear Edge SVG */}
            <div className="w-full overflow-hidden leading-none h-2.5 opacity-40 select-none">
              <svg
                viewBox="0 0 400 10"
                preserveAspectRatio="none"
                className="w-full h-full text-neutral-300 dark:text-neutral-800 fill-current"
              >
                <path d="M0,10 L5,0 L10,10 L15,0 L20,10 L25,0 L30,10 L35,0 L40,10 L45,0 L50,10 L55,0 L60,10 L65,0 L70,10 L75,0 L80,10 L85,0 L90,10 L95,0 L100,10 L105,0 L110,10 L115,0 L120,10 L125,0 L130,10 L135,0 L140,10 L145,0 L150,10 L155,0 L160,10 L165,0 L170,10 L175,0 L180,10 L185,0 L190,10 L195,0 L200,10 L205,0 L210,10 L215,0 L220,10 L225,0 L230,10 L235,0 L240,10 L245,0 L250,10 L255,0 L260,10 L265,0 L270,10 L275,0 L280,10 L285,0 L290,10 L295,0 L300,10 L305,0 L310,10 L315,0 L320,10 L325,0 L330,10 L335,0 L340,10 L345,0 L350,10 L355,0 L360,10 L365,0 L370,10 L375,0 L380,10 L385,0 L390,10 L395,0 L400,10 Z" />
              </svg>
            </div>

            {/* Inner Content Area */}
            <div className={`p-4 sm:p-6 font-mono text-[11.5px] leading-[1.38] select-text break-all`}>
              {data.lines.map((line, lIdx) => {
                const alignClass =
                  line.align === Alignment.CENTER
                    ? 'text-center'
                    : line.align === Alignment.RIGHT
                    ? 'text-right'
                    : 'text-left';

                return (
                  <React.Fragment key={line.id || lIdx}>
                    <div className={`w-full min-h-[1.2em] my-[1px] ${alignClass}`}>
                      {line.spans.length === 0 ? (
                        <span>&nbsp;</span>
                      ) : (
                        line.spans.map((span, sIdx) => {
                          const style = span.style;
                          const isBold = style.bold || style.scaleX > 1 || style.scaleY > 1;
                          const isItalic = style.italic;
                          const isUnderline = style.underline;
                          const isReverse = style.reverse;
                          const isRed = style.color === 'red';

                          let customClasses = '';
                          if (isReverse) {
                            customClasses += ' bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-1 py-0.5 font-bold rounded-2xs inline-block';
                          } else if (isRed) {
                            customClasses += ' text-rose-600 dark:text-rose-400 font-semibold';
                          }

                          if (isBold) customClasses += ' font-bold';
                          if (isItalic) customClasses += ' italic';
                          if (isUnderline) customClasses += ' underline underline-offset-2';

                          // Scaled fonts
                          const scaleStyle: React.CSSProperties = {};
                          if (style.scaleY > 1) {
                            scaleStyle.fontSize = `${Math.min(20, 11.5 * style.scaleY)}px`;
                          }
                          if (style.scaleX > 1) {
                            scaleStyle.letterSpacing = '0.08em';
                          }

                          return (
                            <span
                              key={sIdx}
                              style={scaleStyle}
                              className={`whitespace-pre-wrap ${customClasses}`}
                            >
                              {span.text}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Paper Cut Marker if detected */}
                    {line.hasCutHere && (
                      <div className="my-3 py-1 border-t border-dashed border-rose-400/80 flex items-center justify-center gap-1.5 text-[9.5px] text-rose-500 font-sans font-semibold tracking-wider uppercase select-none">
                        <Scissors size={11} />
                        <span>Paper Cut (GS V)</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bottom Perforated Tear Edge SVG */}
            <div className="w-full overflow-hidden leading-none h-2.5 opacity-40 select-none">
              <svg
                viewBox="0 0 400 10"
                preserveAspectRatio="none"
                className="w-full h-full text-neutral-300 dark:text-neutral-800 fill-current"
              >
                <path d="M0,0 L5,10 L10,0 L15,10 L20,0 L25,10 L30,0 L35,10 L40,0 L45,10 L50,0 L55,10 L60,0 L65,10 L70,0 L75,10 L80,0 L85,10 L90,0 L95,10 L100,0 L105,10 L110,0 L115,10 L120,0 L125,10 L130,0 L135,10 L140,0 L145,10 L150,0 L155,10 L160,0 L165,10 L170,0 L175,10 L180,0 L185,10 L190,0 L195,10 L200,0 L205,10 L210,0 L215,10 L220,0 L225,10 L230,0 L235,10 L240,0 L245,10 L250,0 L255,10 L260,0 L265,10 L270,0 L275,10 L280,0 L285,10 L290,0 L295,10 L300,0 L305,10 L310,0 L315,10 L320,0 L325,10 L330,0 L335,10 L340,0 L345,10 L350,0 L355,10 L360,0 L365,10 L370,0 L375,10 L380,0 L385,10 L390,0 L395,10 L400,0 Z" />
              </svg>
            </div>
          </article>

          {/* Clean Unboxed Document Metadata (Zero-Pill Discipline) */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
            <span>{width} paper</span>
            <span aria-hidden="true">·</span>
            <span>Est. ~{estimatedHeightMm}mm length</span>
            <span aria-hidden="true">·</span>
            <span>{data?.lines?.length || 0} lines</span>
            <span aria-hidden="true">·</span>
            <span>{data?.stats?.totalChars || 0} characters</span>
            {data?.hasCut && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-500 font-medium">Guillotine Cut Included</span>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Slide-Over Quick Content Editor Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Body */}
          <aside
            aria-label="Edit receipt content"
            className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200"
          >
            {/* Drawer Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Edit Receipt Content</h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Update ESC/POS escape codes or text to see changes live on the flat receipt.
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors"
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Preset Bar */}
            <div className="px-5 py-2.5 bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[11px] font-semibold text-neutral-500 shrink-0">Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onRawStringChange(p.raw);
                    onShowToast(`Loaded "${p.name}"`, 'info');
                  }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 shrink-0 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Drawer Editor Area */}
            <div className="flex-1 p-5 flex flex-col min-h-0">
              <label htmlFor="drawer-receipt-input" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 flex justify-between items-center">
                <span>Payload Content (ESC/POS escape characters)</span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {rawString.length} chars
                </span>
              </label>
              <textarea
                id="drawer-receipt-input"
                value={rawString}
                onChange={(e) => onRawStringChange(e.target.value)}
                placeholder="Enter ESC/POS text or raw hex codes..."
                className="flex-1 w-full p-3 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg resize-none focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 leading-relaxed text-neutral-800 dark:text-neutral-200"
              />
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 flex items-center justify-between">
              <button
                onClick={() => {
                  onRawStringChange('');
                  onShowToast('Receipt cleared', 'info');
                }}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                Clear Receipt
              </button>

              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 transition-colors"
              >
                Done
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
