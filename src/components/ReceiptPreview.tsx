import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, RotateCcw, Volume2, VolumeX, Scissors, Sparkles, 
  AlertCircle, Bell, DollarSign, CheckCircle2, Download, 
  Image as ImageIcon, Code, Cpu, ChevronDown, Check, Printer, Gauge,
  Box, FileText, Zap, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen,
  Sun, Moon
} from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { ReceiptData, Alignment } from '../lib/escpos';
import { printerAudio } from '../lib/audio';
import { renderReceiptToSvg, renderReceiptToHtml, renderReceiptToPngDataUrl } from '../lib/renderHtml';
import { copyToClipboard } from '../lib/clipboard';
import { ApiModal } from './ApiModal';
import { Sunmi3DPrinter } from './Sunmi3DPrinter';

interface ReceiptPreviewProps {
  data: ReceiptData;
  width: '58mm' | '80mm';
  onWidthChange?: (width: '58mm' | '80mm') => void;
  rawString: string;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ 
  data, 
  width, 
  onWidthChange,
  rawString,
  isZenMode = false,
  onToggleZenMode,
  isSidebarOpen = true,
  onToggleSidebar,
  isDarkMode = true,
  onToggleDarkMode,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '2d';
      } catch {
        return '2d';
      }
    }
    return '3d';
  });
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
  const [apiModalInitialTab, setApiModalInitialTab] = useState<'playground' | 'swagger' | 'webhook' | 'snippets'>('playground');

  // Route check for /docs or /api/docs (e.g. on Netlify static hosting)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/docs') || path.startsWith('/api/docs')) {
      setApiModalInitialTab('swagger');
      setIsApiModalOpen(true);
    }
  }, []);

  const handleCloseApiModal = () => {
    setIsApiModalOpen(false);
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/docs') || path.startsWith('/api/docs')) {
        window.history.pushState({}, '', '/');
      }
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const zenExportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        exportDropdownRef.current && !exportDropdownRef.current.contains(target) &&
        zenExportDropdownRef.current && !zenExportDropdownRef.current.contains(target)
      ) {
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
    try {
      // 1. Direct high-DPI canvas generation (100% reliable, no network/font failures)
      const dataUrl = renderReceiptToPngDataUrl(data, { width, theme: 'light' });
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `receipt-${width}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        return;
      }
      throw new Error('Canvas renderer returned empty data');
    } catch (err) {
      console.warn('Canvas export fallback, trying html-to-image:', err);
      let tempContainer: HTMLDivElement | null = null;
      try {
        const htmlString = renderReceiptToHtml(data, { width, theme: 'light' });

        tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = width === '58mm' ? '320px' : '400px';
        tempContainer.style.backgroundColor = '#ffffff';
        tempContainer.style.zIndex = '-9999';
        tempContainer.innerHTML = htmlString;
        document.body.appendChild(tempContainer);

        const targetNode = (tempContainer.querySelector('#receipt-container') as HTMLElement) || tempContainer;
        const domDataUrl = await toPng(targetNode, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipAutoScale: true,
        });

        const link = document.createElement('a');
        link.download = `receipt-${width}-${Date.now()}.png`;
        link.href = domDataUrl;
        link.click();
      } catch (domErr) {
        console.error('Failed to export PNG:', domErr);
      } finally {
        if (tempContainer && tempContainer.parentNode) {
          tempContainer.parentNode.removeChild(tempContainer);
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Export Receipt as SVG Vector
  const handleSaveAsSvg = () => {
    setIsExportMenuOpen(false);
    try {
      const svgString = renderReceiptToSvg(data, { width, theme: 'light' });
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `receipt-${width}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export SVG vector:', err);
    }
  };

  // Copy Clean HTML Code
  const handleCopyHtml = async () => {
    setIsExportMenuOpen(false);
    try {
      const htmlString = renderReceiptToHtml(data, { width, theme: 'light' });
      await copyToClipboard(htmlString);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch (err) {
      console.error('Failed to copy HTML code:', err);
    }
  };

  // Direct Browser Thermal Print
  const handleDirectPrint = () => {
    setIsExportMenuOpen(false);
    // Switch to 2D view momentarily if in 3D so the DOM paper element is active
    if (viewMode === '3d') {
      setViewMode('2d');
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      window.print();
    }
  };

  // Control events audio & visual playback triggers
  useEffect(() => {
    if (data.stats.beepCount > 0) {
      printerAudio.playBuzzerSound();
      setActiveBeepAlert(`Beep Triggered (${data.stats.beepCount}x)`);
      const timer = setTimeout(() => setActiveBeepAlert(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [data.stats.beepCount]);

  useEffect(() => {
    if (data.stats.drawerCount > 0) {
      printerAudio.playDrawerSound();
      setActiveDrawerAlert(`Cash Drawer Kicked (${data.stats.drawerCount}x)`);
      const timer = setTimeout(() => setActiveDrawerAlert(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [data.stats.drawerCount]);

  // Audio & Animation Print Simulator Loop
  useEffect(() => {
    if (isInstantMode) {
      setPrintedLineCount(data.lines.length);
      setIsPrinting(false);
      return;
    }

    if (!isPrinting) {
      return;
    }

    if (printedLineCount >= data.lines.length) {
      setIsPrinting(false);
      if (data.hasCut) {
        triggerCutEffect();
      }
      return;
    }

    // Line printing delay based on speed multiplier
    const baseDelay = 65; // ms per line at 1x
    const delay = Math.max(16, baseDelay / speed);

    const timer = setTimeout(() => {
      setPrintedLineCount((prev) => {
        const next = prev + 1;
        printerAudio.playLineFeedSound();
        // Check if next line contains ESC B (beep) or ESC p (drawer)
        const curLine = data.lines[prev];
        if (curLine) {
          if (curLine.hasBeepHere) printerAudio.playBuzzerSound();
          if (curLine.hasDrawerHere) printerAudio.playDrawerSound();
          if (curLine.hasCutHere) triggerCutEffect();
        }
        return next;
      });
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [isPrinting, printedLineCount, data.lines, speed, isInstantMode, data.hasCut]);

  // Handle feed button click
  const handleStartPrintAnimation = () => {
    printerAudio.resume();
    setIsInstantMode(false);
    setPrintedLineCount(0);
    setIsPrinting(true);
  };

  const triggerCutEffect = () => {
    printerAudio.playCutSound();
    setActiveCutAnimation(true);
    setTimeout(() => setActiveCutAnimation(false), 900);
  };

  // Sync line count on input edit when instant mode is active
  useEffect(() => {
    if (isInstantMode) {
      setPrintedLineCount(data.lines.length);
    }
  }, [data.lines.length, isInstantMode]);

  const visibleLines = isInstantMode ? data.lines : data.lines.slice(0, printedLineCount);
  const containerWidth = width === '58mm' ? 'max-w-[340px]' : 'max-w-[420px]';

  return (
    <div className="flex flex-col h-full w-full bg-neutral-100 dark:bg-neutral-950 overflow-hidden relative font-sans">
      {/* OpenAPI / Webhook / REST Playground Modal */}
      <ApiModal
        isOpen={isApiModalOpen}
        onClose={handleCloseApiModal}
        rawString={rawString}
        width={width}
        initialTab={apiModalInitialTab}
      />

      {/* ------------------------------------------------------------- */}
      {/* ZEN MODE FLOATING HUD CONTROLS BAR (Appears when Zen is ON)    */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {isZenMode && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 inset-x-0 z-50 flex items-center justify-center px-4 pointer-events-none"
          >
            <div className="pointer-events-auto flex items-center gap-2 bg-neutral-900/90 dark:bg-neutral-800/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-2xl border border-neutral-700/80 text-xs">
              {/* Exit Zen Button */}
              <button
                onClick={onToggleZenMode}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all shadow-xs"
                title="Exit Zen Mode (Press Esc or Z)"
              >
                <Minimize2 size={13} />
                <span>Exit Zen</span>
                <span className="text-[10px] opacity-80 font-mono bg-black/20 px-1 py-0.2 rounded">Esc</span>
              </button>

              <div className="h-4 w-px bg-neutral-700" />

              {/* View Switcher (3D vs 2D) */}
              <div className="flex items-center bg-neutral-950/60 p-0.5 rounded-lg border border-neutral-700">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    viewMode === '3d'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Box size={12} />
                  <span>3D</span>
                </button>
                <button
                  onClick={() => setViewMode('2d')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    viewMode === '2d'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Printer size={12} />
                  <span>2D</span>
                </button>
              </div>

              {/* Width Selector */}
              {onWidthChange && (
                <div className="flex items-center bg-neutral-950/60 p-0.5 rounded-lg border border-neutral-700 text-[11px]">
                  <button
                    onClick={() => onWidthChange('58mm')}
                    className={`px-2 py-0.5 rounded font-semibold transition-all ${
                      width === '58mm' ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    58mm
                  </button>
                  <button
                    onClick={() => onWidthChange('80mm')}
                    className={`px-2 py-0.5 rounded font-semibold transition-all ${
                      width === '80mm' ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    80mm
                  </button>
                </div>
              )}

              {/* Play / Print Feed Button */}
              <button
                onClick={handleStartPrintAnimation}
                className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-neutral-200 rounded-lg font-semibold transition-all"
                title="Simulate thermal feed print"
              >
                <Play size={12} fill="currentColor" />
                <span className="hidden sm:inline">Feed</span>
              </button>

              <button
                onClick={triggerCutEffect}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Trigger Scissors Cut"
              >
                <Scissors size={13} />
              </button>

              <div className="h-4 w-px bg-neutral-700" />

              {/* Zen Export Dropdown */}
              <div className="relative" ref={zenExportDropdownRef}>
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 rounded-lg font-semibold transition-all"
                  title="Export Receipt"
                >
                  <Download size={13} />
                  <span>Export</span>
                  <ChevronDown size={11} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExportMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-700 py-1.5 z-50 overflow-hidden text-xs text-neutral-200"
                    >
                      <button
                        onClick={handleSaveAsPng}
                        disabled={isExporting}
                        className="w-full px-3.5 py-2 text-left hover:bg-neutral-800 flex items-center justify-between font-semibold transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <ImageIcon size={14} className="text-amber-500" />
                          <span>Save PNG Image</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">.png</span>
                      </button>

                      <button
                        onClick={handleSaveAsSvg}
                        className="w-full px-3.5 py-2 text-left hover:bg-neutral-800 flex items-center justify-between font-semibold transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Download size={14} className="text-amber-500" />
                          <span>Save SVG Vector</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">.svg</span>
                      </button>

                      <button
                        onClick={handleDirectPrint}
                        className="w-full px-3.5 py-2 text-left hover:bg-neutral-800 flex items-center justify-between font-semibold transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Printer size={14} className="text-amber-500" />
                          <span>Direct Thermal Print</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">Ctrl+P</span>
                      </button>

                      <div className="my-1 border-t border-neutral-800" />

                      <button
                        onClick={handleCopyHtml}
                        className="w-full px-3.5 py-2 text-left hover:bg-neutral-800 flex items-center justify-between font-semibold transition-colors"
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

              {/* Optional Editor Sidebar Toggle in Zen mode */}
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isSidebarOpen ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={isSidebarOpen ? 'Hide Editor Sidebar' : 'Show Editor Sidebar'}
                >
                  {isSidebarOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
                </button>
              )}

              {/* Theme toggle in Zen mode */}
              {onToggleDarkMode && (
                <button
                  onClick={onToggleDarkMode}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Toggle Theme"
                >
                  {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* STANDARD TOP CONTROLS TOOLBAR (Hidden when in Zen Mode)        */}
      {/* ------------------------------------------------------------- */}
      {!isZenMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs z-30 shrink-0">
          {/* View Mode Switcher: 3D Terminal vs 2D Flat Sheet */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-2xs">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === '3d'
                    ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="Full 3D Sunmi Terminal Simulator with WebGL paper curve animation"
              >
                <Box size={14} className={viewMode === '3d' ? 'text-amber-500' : ''} />
                <span>3D Terminal</span>
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === '2d'
                    ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title="100% Crisp flat digital receipt sheet view"
              >
                <Printer size={14} className={viewMode === '2d' ? 'text-amber-500' : ''} />
                <span>2D Flat Sheet</span>
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
                <span>Simulate Feed</span>
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
                  printerAudio.resume();
                  printerAudio.playDrawerSound();
                  setActiveDrawerAlert('ESC p / Cash Drawer Kick');
                  setTimeout(() => setActiveDrawerAlert(null), 1800);
                }}
                className="p-1 text-neutral-600 hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-400 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                title="Test Cash Drawer Pulse Signal (ESC p)"
              >
                <DollarSign size={14} />
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

            {/* Zen Mode Toggle Button */}
            {onToggleZenMode && (
              <button
                onClick={onToggleZenMode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold transition-all"
                title="Activate Zen Mode — Distraction-Free Clutter-Free View (Shortcut: Z or Esc)"
              >
                <Maximize2 size={13} className="text-amber-500" />
                <span className="hidden sm:inline">Zen Mode</span>
              </button>
            )}

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

                      <button
                        onClick={handleDirectPrint}
                        className="w-full px-3.5 py-2 text-left text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between font-semibold transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Printer size={14} className="text-amber-500" />
                          <span>Direct Thermal Print</span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">Ctrl+P</span>
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
                <span className="hidden lg:inline">API / Webhooks</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Toast Floating Notifications */}
      <AnimatePresence>
        {activeBeepAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-18 z-50 bg-amber-500 text-white px-5 py-2.5 rounded-full shadow-2xl border border-amber-400/50 text-xs font-bold flex items-center gap-2 pointer-events-none"
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
            className="absolute top-18 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-2xl border border-emerald-500/50 text-xs font-bold flex items-center gap-2 pointer-events-none"
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
            onSwitchTo2D={() => setViewMode('2d')}
          />
        </div>
      ) : (
        /* 2D Flat Thermal Printer Enclosure Stage */
        <div
          ref={containerRef}
          id="receipt-container"
          data-receipt-width={width}
          className={`flex-1 w-full px-4 sm:px-6 md:px-8 pb-12 overflow-y-auto flex flex-col items-center justify-start relative ${
            isZenMode ? 'pt-16 sm:pt-20' : 'pt-4 sm:pt-6'
          }`}
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
                const isTight = (line.lineSpacing ?? 30) <= 24;
                const hasAnyReverse = line.spans.some((s) => s.style.reverse);

                return (
                  <div key={line.id} className={`relative group/line w-full max-w-full ${isTight || hasAnyReverse ? 'my-0' : 'my-[1.5px]'}`}>
                    {/* Thermal Line Sweep Highlight during active animation */}
                    {isLatestLine && (
                      <motion.div
                        initial={{ opacity: 0.8, x: -10 }}
                        animate={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-amber-400/20 pointer-events-none rounded"
                      />
                    )}

                    <div className={`w-full max-w-full overflow-hidden ${alignmentClass} min-h-[1.15em] whitespace-pre font-mono`} style={{ lineHeight: isTight || hasAnyReverse ? '1.2' : '1.35' }}>
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
                                whitespace-pre font-mono transition-colors duration-150
                                ${spanStyle.bold || isReverse ? 'font-bold' : 'font-normal'}
                                ${spanStyle.italic ? 'italic' : ''}
                                ${spanStyle.underline ? 'underline decoration-1 underline-offset-2' : ''}
                              `}
                              style={{
                                fontSize,
                                letterSpacing,
                                fontWeight: spanStyle.bold || hasScaleX || hasScaleY || isReverse ? 700 : 400,
                                backgroundColor: isReverse ? '#000000' : 'transparent',
                                color: isReverse ? '#ffffff' : isRed ? '#dc2626' : '#111827',
                                display: isReverse ? 'inline-block' : 'inline',
                                padding: 0,
                                borderRadius: 0,
                                lineHeight: isTight || isReverse ? '1.2' : undefined,
                              }}
                            >
                              {span.text || '\u00A0'}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Beep Line Visual Indicator */}
                    {line.hasBeepHere && (
                      <div className="my-2 relative flex items-center justify-center">
                        <div className="w-full border-t border-dashed border-amber-400 dark:border-amber-500/80" />
                        <span className="absolute bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1 shadow-xs">
                          <Bell size={10} />
                          POS BUZZER BEEP COMMAND (ESC B / BEL)
                        </span>
                      </div>
                    )}

                    {/* Drawer Line Visual Indicator */}
                    {line.hasDrawerHere && (
                      <div className="my-2 relative flex items-center justify-center">
                        <div className="w-full border-t border-dashed border-orange-400 dark:border-orange-500/80" />
                        <span className="absolute bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 flex items-center gap-1 shadow-xs">
                          <Zap size={10} className="text-orange-500 fill-orange-500" />
                          CASH DRAWER KICK PULSE (ESC p)
                        </span>
                      </div>
                    )}

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
                <div className="w-full border-b-2 border-dashed border-red-400 flex items-center justify-center relative">
                  <span className="text-[9px] font-mono font-bold text-red-500 bg-white dark:bg-stone-50 px-2 py-0.5 rounded -mb-2 border border-red-200">
                    --- TEAR OFF / GUILLOTINE CUT ---
                  </span>
                </div>
              ) : (
                /* Jagged Thermal Paper Edge Effect */
                <div className="w-full h-2 bg-radial from-neutral-200 to-transparent opacity-60 flex items-center overflow-hidden">
                  <div className="w-full border-b border-dotted border-neutral-400" />
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
