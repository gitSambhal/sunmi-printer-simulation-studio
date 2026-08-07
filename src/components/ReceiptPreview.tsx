import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, RotateCcw, Volume2, VolumeX, Scissors, Sparkles, 
  AlertCircle, Bell, DollarSign, CheckCircle2, Download, 
  Image as ImageIcon, Code, Cpu, ChevronDown, Check, Printer, Gauge,
  Box, FileText
} from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { ReceiptData, Alignment } from '../lib/escpos';
import { printerAudio } from '../lib/audio';
import { renderReceiptToSvg, renderReceiptToHtml } from '../lib/renderHtml';
import { copyToClipboard } from '../lib/clipboard';
import { ApiModal } from './ApiModal';
import { Sunmi3DPrinter } from './Sunmi3DPrinter';

interface ReceiptPreviewProps {
  data: ReceiptData;
  width: '58mm' | '80mm';
  rawString: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ data, width, rawString }) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [requestedCameraPreset, setRequestedCameraPreset] = useState<'macro' | '3/4' | 'front' | 'top' | 'floor'>('macro');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printedLineCount, setPrintedLineCount] = useState<number>(data.lines.length);
  const [speed, setSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 100x (Instant)
  const [isMuted, setIsMuted] = useState(false);
  const [activeCutAnimation, setActiveCutAnimation] = useState(false);
  const [activeBeepAlert, setActiveBeepAlert] = useState<string | null>(null);
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<string | null>(null);
  const [isInstantMode, setIsInstantMode] = useState(true);
  
  // Export & API states
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Export Receipt as PNG Image
  const handleSaveAsPng = async () => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    let tempContainer: HTMLDivElement | null = null;
    try {
      // 1. Render full HTML string for light theme receipt
      const htmlString = renderReceiptToHtml(data, { width, theme: 'light' });

      // 2. Mount temporary offscreen DOM node
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = width === '58mm' ? '320px' : '400px';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.zIndex = '-9999';
      tempContainer.style.overflow = 'visible';
      tempContainer.innerHTML = htmlString;

      document.body.appendChild(tempContainer);

      const targetNode = (tempContainer.querySelector('#receipt-container') as HTMLElement) || tempContainer;

      // 3. Convert offscreen DOM node to high-res PNG
      const dataUrl = await toPng(targetNode, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      // 4. Trigger browser download
      const link = document.createElement('a');
      link.download = `receipt-${width}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG receipt:', err);
    } finally {
      if (tempContainer && tempContainer.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
      setIsExporting(false);
    }
  };

  // Export Receipt as SVG Image
  const handleSaveAsSvg = () => {
    setIsExportMenuOpen(false);
    try {
      const svgString = renderReceiptToSvg(data, { width });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `receipt-${width}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export SVG receipt:', err);
    }
  };

  // Copy Rendered HTML Code
  const handleCopyHtml = async () => {
    try {
      const html = renderReceiptToHtml(data, { width, theme: 'light' });
      const success = await copyToClipboard(html);
      if (success) {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      }
      setIsExportMenuOpen(false);
    } catch (err) {
      console.error('Failed to copy HTML receipt:', err);
    }
  };

  // Sync mute state
  useEffect(() => {
    printerAudio.setMuted(isMuted);
  }, [isMuted]);

  // Handle live updates in instant mode
  useEffect(() => {
    if (isInstantMode) {
      setPrintedLineCount(data.lines.length);
    }
  }, [data.lines.length, isInstantMode]);

  // Trigger Print Animation
  const handleStartPrintAnimation = () => {
    printerAudio.resume();
    setIsInstantMode(false);
    setIsPrinting(true);
    setPrintedLineCount(0);
    setActiveCutAnimation(false);
    setActiveBeepAlert(null);
    setActiveDrawerAlert(null);
  };

  // Animation Loop
  useEffect(() => {
    if (!isPrinting || isInstantMode) return;

    if (printedLineCount >= data.lines.length) {
      setIsPrinting(false);
      if (data.hasCut) {
        const cutTimer = setTimeout(() => {
          triggerCutEffect();
        }, 1000);
        return () => clearTimeout(cutTimer);
      }
      return;
    }

    const currentLine = data.lines[printedLineCount];
    const delay = Math.max(30, Math.floor(120 / speed));

    const timer = setTimeout(() => {
      // Play line feed audio tick
      if (!isMuted && printedLineCount % 2 === 0) {
        printerAudio.playLineFeedSound();
      }

      // Check line control events
      if (currentLine.hasBeepHere) {
        printerAudio.playBuzzerSound();
        setActiveBeepAlert('ESC B / Buzzer Command');
        setTimeout(() => setActiveBeepAlert(null), 1800);
      }

      if (currentLine.hasDrawerHere) {
        printerAudio.playDrawerSound();
        setActiveDrawerAlert('ESC p / Cash Drawer Kick');
        setTimeout(() => setActiveDrawerAlert(null), 1800);
      }

      if (currentLine.hasCutHere) {
        triggerCutEffect();
      }

      setPrintedLineCount((prev) => prev + 1);

      // Auto scroll to bottom during printing
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPrinting, printedLineCount, data.lines, speed, isMuted, isInstantMode, data.hasCut]);

  const triggerCutEffect = () => {
    setActiveCutAnimation(true);
    if (!isMuted) {
      printerAudio.playCutSound();
    }
    setTimeout(() => {
      setActiveCutAnimation(false);
      // Automatically zoom camera to landed receipt on floor after cut completes
      setRequestedCameraPreset('floor');
    }, 1200);
  };

  const containerWidth = width === '58mm' ? 'max-w-[320px]' : 'max-w-[400px]';

  // Visible lines up to printedLineCount
  const visibleLines = isInstantMode ? data.lines : data.lines.slice(0, printedLineCount);

  return (
    <div className="flex flex-col items-center w-full h-full bg-neutral-100 dark:bg-neutral-900 transition-colors duration-300 overflow-hidden relative">
      {/* Sunmi Cloud Printer Head Header Control Bar */}
      <div className="w-full bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm z-40 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isPrinting ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider hidden sm:inline">
              {isPrinting ? 'Printing Thermal Feed...' : 'Sunmi Cloud Online'}
            </span>
          </div>

          {/* 2-Way View Switcher */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900/90 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700/80 shadow-xs">
            <button
              onClick={() => {
                setViewMode('3d');
                setRequestedCameraPreset('macro');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === '3d'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="3D POS Printer interactive view"
            >
              <Box size={14} />
              <span>3D Sunmi Printer</span>
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === '2d'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title="100% Crisp flat digital receipt sheet view"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Flat Receipt Sheet</span>
            </button>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Animation & Cut Simulation Controls */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-lg border border-neutral-200/80 dark:border-neutral-700/80">
            <button
              onClick={handleStartPrintAnimation}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-md text-xs font-bold shadow-xs transition-all"
              title="Simulate thermal feed print animation"
            >
              <Play size={13} fill="currentColor" />
              <span>Simulate</span>
            </button>

            <button
              onClick={triggerCutEffect}
              className="p-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Trigger Manual Paper Cut Blade Sound & Line"
            >
              <Scissors size={14} />
            </button>

            <button
              onClick={() => {
                printerAudio.resume();
                printerAudio.playBuzzerSound();
                setActiveBeepAlert('POS Buzzer Beep (ESC B / BEL)');
                setTimeout(() => setActiveBeepAlert(null), 1800);
              }}
              className="p-1 text-neutral-600 hover:text-amber-600 dark:text-neutral-300 dark:hover:text-amber-400 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Test POS Buzzer Sound (ESC B / BEL)"
            >
              <Bell size={14} />
            </button>

            <button
              onClick={() => {
                const newMute = !isMuted;
                setIsMuted(newMute);
                printerAudio.setMuted(newMute);
                if (!newMute) printerAudio.resume();
              }}
              className={`p-1 rounded-md transition-colors ${
                isMuted
                  ? 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
              }`}
              title={isMuted ? 'Unmute Thermal Printer Sound' : 'Mute Thermal Printer Sound'}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            {/* Print Speed Selector */}
            <div className="flex items-center pl-1 border-l border-neutral-300 dark:border-neutral-700 gap-0.5 text-[11px]">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    if (isInstantMode) handleStartPrintAnimation();
                  }}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                    !isInstantMode && speed === s
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
              <button
                onClick={() => {
                  setIsInstantMode(true);
                  setIsPrinting(false);
                  setPrintedLineCount(data.lines.length);
                }}
                className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                  isInstantMode
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Live
              </button>
            </div>
          </div>

          {/* Export Dropdown & API Access Group */}
          <div className="flex items-center gap-1.5 pl-1 border-l border-neutral-200 dark:border-neutral-700">
            {/* Export Dropdown Menu */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 active:scale-95 rounded-lg text-xs font-bold transition-all shadow-xs"
                title="Export or Download Receipt"
              >
                <Download size={14} />
                <span>Export</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-50 overflow-hidden text-xs"
                  >
                    <button
                      onClick={handleSaveAsPng}
                      disabled={isExporting}
                      className="w-full px-3.5 py-2 text-left text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between font-semibold transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <ImageIcon size={14} className="text-amber-500" />
                        <span>Save PNG Image</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">.png</span>
                    </button>

                    <button
                      onClick={handleSaveAsSvg}
                      className="w-full px-3.5 py-2 text-left text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between font-semibold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Download size={14} className="text-amber-500" />
                        <span>Save SVG Vector</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">.svg</span>
                    </button>

                    <div className="my-1 border-t border-neutral-100 dark:border-neutral-700/80" />

                    <button
                      onClick={handleCopyHtml}
                      className="w-full px-3.5 py-2 text-left text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between font-semibold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Code size={14} className="text-amber-500" />
                        <span>{copiedHtml ? 'Copied HTML!' : 'Copy HTML Code'}</span>
                      </div>
                      {copiedHtml ? <Check size={14} className="text-emerald-500" /> : <span className="text-[10px] text-neutral-400 font-mono">&lt;/&gt;</span>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* REST API & Automation Modal Launcher */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 rounded-lg text-xs font-bold transition-all border border-amber-500/30"
              title="Open REST API, OpenAPI Docs, Webhooks & Interactive Playground"
            >
              <Cpu size={14} />
              <span>API / Swagger / Webhooks</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Toast Floating Notifications */}
      <AnimatePresence>
        {activeBeepAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-16 z-30 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2"
          >
            <Bell size={16} className="animate-bounce" />
            <span>POS Buzzer Sound Triggered</span>
          </motion.div>
        )}
        {activeDrawerAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-16 z-30 bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2"
          >
            <DollarSign size={16} className="animate-pulse" />
            <span>Cash Drawer Pulse Signal Sent</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Preview Stage Container */}
      {viewMode === '3d' ? (
        <div className="flex-1 w-full h-full relative overflow-hidden">
          <Sunmi3DPrinter
            data={data}
            width={width}
            printedLineCount={isInstantMode ? data.lines.length : printedLineCount}
            isPrinting={isPrinting}
            activeCutAnimation={activeCutAnimation}
            requestedCameraPreset={requestedCameraPreset}
            onTriggerCut={triggerCutEffect}
            onStartPrint={handleStartPrintAnimation}
          />
        </div>
      ) : (
        /* 2D Flat Thermal Printer Enclosure Stage */
        <div
          ref={containerRef}
          id="receipt-container"
          data-receipt-width={width}
          className="flex-1 w-full px-4 sm:px-6 md:px-8 pb-8 pt-2 sm:pt-4 overflow-y-auto flex flex-col items-center justify-start relative"
        >
          {/* Paper Roll Bay (Upper Housing) - Attached directly to top of thermal paper */}
          <div className={`relative z-20 w-full ${containerWidth} bg-neutral-900 dark:bg-neutral-950 rounded-t-2xl p-3.5 sm:p-4 border border-neutral-700 shadow-xl flex flex-col items-center shrink-0`}>
            {/* Transparent Acrylic Top Bay Window */}
            <div className="w-full bg-neutral-800/80 rounded-xl p-2.5 sm:p-3 border border-neutral-700/60 flex items-center justify-between relative">
              <div className="flex items-center gap-3 min-w-0">
                {/* Animated Rotating Paper Roll */}
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
                  {/* Roll outer paper body */}
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-3 sm:border-4 border-amber-500/80 bg-white shadow-inner flex items-center justify-center relative overflow-hidden ${isPrinting ? 'animate-roll-spin' : ''}`}>
                    {/* Concentric paper layers texture */}
                    <div className="absolute inset-1 rounded-full border-2 border-neutral-200 border-dashed" />
                    <div className="absolute inset-2 rounded-full border border-neutral-300" />
                    {/* Paper roll core spool */}
                    <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-neutral-800 border border-neutral-600 z-10" />
                    {/* Paper feeding indicator strip */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-amber-400" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white tracking-wide uppercase truncate">
                      Thermal Paper Roll ({width})
                    </span>
                    {isPrinting && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-extrabold uppercase animate-pulse shrink-0">
                        FEEDING
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate">
                    Sunmi High-Speed Japanese Thermal Head
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className={`w-2 h-2 rounded-full ${isPrinting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold">
                  {isPrinting ? 'FEEDING' : 'READY'}
                </span>
              </div>
            </div>

            {/* Mechanical Guillotine Cutter Head Assembly Slot */}
            <div className="w-full mt-3 bg-neutral-900 rounded-lg p-2 border-t-2 border-neutral-700 flex items-center justify-between relative">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                  AUTOMATIC CUTTER SLOT
                </span>
              </div>

              {/* Guillotine Cutter Blade Animation Overlay */}
              <AnimatePresence>
                {activeCutAnimation && (
                  <div className="absolute inset-0 z-40 overflow-hidden rounded-lg flex items-center justify-between pointer-events-none">
                    {/* Left Guillotine Blade */}
                    <div className="w-1/2 h-full bg-gradient-to-r from-neutral-300 via-neutral-100 to-amber-300 border-r-2 border-amber-400 shadow-2xl animate-blade-left flex items-center justify-end pr-2">
                      <Scissors size={14} className="text-black animate-spin" />
                    </div>
                    {/* Right Guillotine Blade */}
                    <div className="w-1/2 h-full bg-gradient-to-l from-neutral-300 via-neutral-100 to-amber-300 border-l-2 border-amber-400 shadow-2xl animate-blade-right flex items-center justify-start pl-2">
                      <Scissors size={14} className="text-black animate-spin" />
                    </div>
                    {/* Laser Cut Spark Line */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-400 animate-pulse shadow-[0_0_12px_#f59e0b]" />
                  </div>
                )}
              </AnimatePresence>

              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                <div className="w-2 h-2 rounded-full bg-neutral-700" />
              </div>
            </div>
          </div>

          {/* Paper Container Emerging From Slot */}
          <motion.div
            layout
            className={`bg-white dark:bg-stone-50 text-neutral-900 shadow-2xl w-full ${containerWidth} min-h-[480px] rounded-b-md flex flex-col relative transition-all duration-300 border-x border-b border-neutral-200 dark:border-neutral-700 ${
              activeCutAnimation ? 'translate-y-1 transition-transform' : ''
            }`}
            id="receipt-paper"
          >
            {/* Subtle Scanline Thermal Paper Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%]" />

            {/* Receipt Lines Content */}
            <div className={`flex-1 font-mono text-[11.5px] leading-[1.35] relative overflow-x-hidden ${width === '58mm' ? 'p-3.5' : 'px-4.5 py-6'}`}>
              {visibleLines.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 dark:text-neutral-600 text-center font-sans">
                  <Sparkles size={32} className="mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Feed Paper or Click Print to Preview</p>
                </div>
              )}

              {visibleLines.map((line, idx) => {
                const alignmentClass =
                  line.align === Alignment.CENTER ? 'text-center' :
                  line.align === Alignment.RIGHT ? 'text-right' : 'text-left';

                const isLatestLine = !isInstantMode && idx === visibleLines.length - 1 && isPrinting;

                return (
                  <div key={line.id} className="relative group/line my-[1px] w-full max-w-full">
                    {/* Thermal Line Sweep Highlight during active animation */}
                    {isLatestLine && (
                      <motion.div
                        initial={{ opacity: 0.8, x: -10 }}
                        animate={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-amber-400/20 pointer-events-none rounded"
                      />
                    )}

                    <div className={`w-full max-w-full overflow-hidden ${alignmentClass} min-h-[1.25em] whitespace-pre-wrap break-all font-mono`}>
                      {line.spans.length === 0 ? (
                        '\u00A0'
                      ) : (
                        line.spans.map((span, sIdx) => {
                          const spanStyle = span.style;
                          const hasScaleX = spanStyle.scaleX > 1;
                          const hasScaleY = spanStyle.scaleY > 1;

                          const fontSize = hasScaleY ? `${Math.min(20, 11.5 * spanStyle.scaleY)}px` : '11.5px';
                          const letterSpacing = hasScaleX ? '0.08em' : '0px';

                          const isReverse = spanStyle.reverse;
                          const isRed = spanStyle.color === 'red';

                          return (
                            <span
                              key={sIdx}
                              className={`
                                inline whitespace-pre-wrap break-all transition-colors duration-150
                                ${spanStyle.bold ? 'font-bold' : 'font-normal'}
                                ${spanStyle.italic ? 'italic' : ''}
                                ${spanStyle.underline ? 'underline decoration-1 underline-offset-2' : ''}
                              `}
                              style={{
                                fontSize,
                                letterSpacing,
                                fontWeight: spanStyle.bold || hasScaleX || hasScaleY ? 700 : 400,
                                backgroundColor: isReverse ? '#000000' : 'transparent',
                                color: isReverse ? '#ffffff' : isRed ? '#dc2626' : '#111827',
                                padding: isReverse ? '1px 4px' : '0',
                                borderRadius: isReverse ? '2px' : '0',
                              }}
                            >
                              {span.text || '\u00A0'}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Cut Line Visual Indicator */}
                    {line.hasCutHere && (
                      <div className="my-4 relative flex items-center justify-center">
                        <div className="w-full border-t-2 border-dashed border-red-400 dark:border-red-500/80" />
                        <span className="absolute bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 flex items-center gap-1 shadow-xs">
                          <Scissors size={10} />
                          PAPER CUT COMMAND (GS V)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Paper Cut Bottom Edge */}
            <div className="w-full relative h-6 mt-4 flex flex-col items-center justify-end overflow-hidden">
              {data.hasCut || activeCutAnimation ? (
                <div className="w-full border-t border-dashed border-neutral-300 dark:border-neutral-600 relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-neutral-100 dark:bg-neutral-800 px-3 py-0.5 text-[9px] text-neutral-400 dark:text-neutral-500 font-sans uppercase tracking-widest border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    Cut Paper Edge
                  </div>
                </div>
              ) : (
                <div className="w-full h-6 bg-gradient-to-t from-neutral-200/50 to-transparent dark:from-neutral-900/50" />
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* REST API & Automation Modal */}
      {isApiModalOpen && (
        <ApiModal
          isOpen={isApiModalOpen}
          onClose={() => setIsApiModalOpen(false)}
          rawString={rawString}
          width={width}
        />
      )}
    </div>
  );
};
