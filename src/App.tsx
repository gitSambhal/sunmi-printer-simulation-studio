import React, { useState, useEffect, useMemo } from 'react';
import { Sun, Moon, Printer, Terminal, ShieldCheck, Download, Wifi, WifiOff, Globe, ExternalLink, Smartphone, PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react';
import { RawInput } from './components/RawInput';
import { ReceiptPreview } from './components/ReceiptPreview';
import { parseEscPos, textToBytes, escapedStringToBytes } from './lib/escpos';

const EXAMPLES = {
  complex: `\\u001dB\\u0001\\u001bE\\u0001        ⚠ MANUAL PROCESSING REQUIRED ⚠        \\u001bE\\u0000\\u001dB\\u0000\\n\\u001bE\\u0001               Epoint Store Test                \\u001bE\\u0000\\n\\n------------------------------------------------\\n\\nOrder Type                               Dine In\\nPlaced On                        Apr 29, 1:46 PM\\nOrder ID                               856407029\\nTable                                         19\\nQueue No                                    0004\\n\\n\\u001br\\u0001+----------------------------------------------+\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 \\u001br\\u0001\\u001bE\\u0001ORDER NOT SENT TO POS\\u001bE\\u0000\\u001br\\u0000                        \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000                                              \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 Error Code                               \\u001br\\u0001\\u001bE\\u0001504\\u001bE\\u0000\\u001br\\u0000 \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 Reason           Timeout from POS/cURL error \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000                                              \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001| -------------------------------------------- |\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000                                              \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 Check if order already in POS before         \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001|\\u001br\\u0000 entering manually                            \\u001br\\u0001|\\u001br\\u0000\\n\\u001br\\u0001+----------------------------------------------+\\u001br\\u0000\\n\\n+----------------------------------------------+\\n| [ ] Sent to kitchen manually                 |\\n+----------------------------------------------+\\n\\n------------------------------------------------\\n\\n4x Puff Pastry                             23.20\\n2x Mushroom soup 1                         80.00\\n3x Vegetable                               42.00\\n3x Potato Wedges                          285.30\\n  3x Diane Half                            56.70\\n  3x Diane Whole                          101.70\\n    3x Beef Pie                            55.50\\n    3x Diane Half                          56.70\\n5x Mushroom soup                           50.00\\n\\n\\n------------------------------------------------\\n\\n\\u001bE\\u0001Subtotal\\u001bE\\u0000                              SGD 480.50\\nTotal Items                                   17\\nPayment                                   CASHAC\\nService Charge Charge                 + SGD 3.00\\nGST 8% 8%                            + SGD 38.68\\nTax Type                               EXCLUSIVE\\n------------------------------------------------\\nGrand Total                           SGD 522.18\\n\\n------------------------------------------------\\n\\n\\u001bE\\u0001SPECIAL REQUEST\\u001bE\\u0000\\nThis is special request\\n\\n\\n\\n\\n\\n\\u001dV\\u0000`,

  kitchen: `\\u001b@\\u001ba\\u0001\\u001bE\\u0001*** KITCHEN TICKET #42 ***\\u001bE\\u0000\\n\\u001ba\\u0000Table: 08                       Time: 19:42\\n------------------------------------------------\\n1x Wagyu Steak (Medium Rare)             $48.00\\n\\u001br\\u0001  * SPECIAL: EXTRA SAUCE ON SIDE\\u001br\\u0000\\n2x Truffle Fries                         $24.00\\n1x Caesar Salad                          $14.00\\n\\u001br\\u0001  * ALLERGY: NO CROUTONS\\u001br\\u0000\\n------------------------------------------------\\n\\u001bE\\u0001Total Items: 4\\u001bE\\u0000\\n\\n\\u001dB\\u0001\\u001bE\\u0001RUSH ORDER - IMMEDIATE PREP\\u001bE\\u0000\\u001dB\\u0000\\n\\n\\n\\u001dV\\u0000`,

  standard: `\\u001b@\\u001ba\\u0001\\u001d!\\u0011SUNMI CLOUD\\n\\u001ba\\u0000\\u001d!\\u0000\\nOrder #12345\\n------------------------------------------------\\nCappucino                           $4.50\\nLatte                               $5.00\\n\\n\\u001bE\\u0001Total:                              $9.50\\u001bE\\u0000\\n\\nThank You!\\n\\u001dV\\u0000`,
};

export default function App() {
  const [inputValue, setInputValue] = useState<string>(EXAMPLES.complex);
  const [inputMode, setInputMode] = useState<'text' | 'raw'>('raw');
  const [width, setWidth] = useState<'58mm' | '80mm'>('80mm');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const [sidebarHeight, setSidebarHeight] = useState<number>(240);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<'printer' | 'editor' | 'split'>('printer');
  const [isDesktop, setIsDesktop] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  // Monitor Window Resize for Desktop/Tablet vs Mobile Layout
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Draggable Sidebar Resizing (Mouse & Touch)
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;

      if (isDesktop && clientX !== undefined) {
        // Clamp desktop sidebar width between 240px and 60% of viewport width
        const maxW = Math.max(300, Math.min(window.innerWidth - 300, 650));
        const newWidth = Math.min(Math.max(clientX, 240), maxW);
        setSidebarWidth(newWidth);
      } else if (!isDesktop && clientY !== undefined) {
        // Clamp mobile sidebar height between 120px and 50% of viewport height
        const newHeight = Math.min(Math.max(clientY - 55, 120), Math.min(window.innerHeight - 200, 380));
        setSidebarHeight(newHeight);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, isDesktop]);

  // Online / Offline State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (isDarkMode) {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Online / Offline status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install Prompt listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }
    setDeferredPrompt(null);
  };

  const handleLoadPreset = (key: string) => {
    let presetText = EXAMPLES.complex;
    if (key === 'kitchen') presetText = EXAMPLES.kitchen;
    else if (key === 'standard') presetText = EXAMPLES.standard;

    if (inputMode === 'text') {
      setInputValue(presetText.replace(/\\u[0-9a-fA-F]{4}/g, '').replace(/\\x[0-9a-fA-F]{2}/g, ''));
    } else {
      setInputValue(presetText);
    }
  };

  const handleModeChange = (newMode: 'text' | 'raw') => {
    if (newMode === inputMode) return;

    // Derive current byte buffer
    let currentBytes: Uint8Array;
    if (inputMode === 'raw') {
      currentBytes = escapedStringToBytes(inputValue);
    } else {
      currentBytes = textToBytes(inputValue);
    }

    if (newMode === 'text') {
      setInputValue(new TextDecoder().decode(currentBytes));
    } else {
      // Reconstruct raw escape string representation
      let rawStr = '';
      for (let i = 0; i < currentBytes.length; i++) {
        const b = currentBytes[i];
        if (b === 0x0A) rawStr += '\\n';
        else if (b === 0x0D) rawStr += '\\r';
        else if (b === 0x09) rawStr += '\\t';
        else if (b === 0x1B) rawStr += '\\u001b';
        else if (b === 0x1D) rawStr += '\\u001d';
        else if (b < 32 || b > 126) rawStr += `\\x${b.toString(16).padStart(2, '0')}`;
        else rawStr += String.fromCharCode(b);
      }
      setInputValue(rawStr);
    }
    setInputMode(newMode);
  };

  const receiptData = useMemo(() => {
    try {
      let bytes: Uint8Array;
      if (inputMode === 'raw') {
        bytes = escapedStringToBytes(inputValue);
      } else {
        bytes = textToBytes(inputValue);
      }
      return parseEscPos(bytes);
    } catch (e) {
      console.error('ESC/POS Parsing error:', e);
      return {
        lines: [],
        hasCut: false,
        controlEvents: [],
        stats: { totalChars: 0, redSpanCount: 0, reverseSpanCount: 0, boldSpanCount: 0, cutCount: 0, beepCount: 0 },
      };
    }
  }, [inputValue, inputMode]);

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-lg text-white shadow-xs">
            <Printer size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Sunmi Printer Simulation Studio</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                ESC/POS v2.0
              </span>
              {/* Online / Offline Indicator Badge */}
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  isOnline
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse'
                }`}
                title={isOnline ? 'Online - Local & API services active' : 'Offline Mode Active - 100% Local Engine Running'}
              >
                {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                {isOnline ? 'Online' : 'Offline Ready'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Professional ESC/POS &amp; Sunmi Cloud Thermal Printer Emulator with Escape Code Parsing &amp; SVG/PNG Exports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-semibold ${
              isSidebarOpen
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            title={isSidebarOpen ? 'Collapse Editor Sidebar' : 'Expand Editor Sidebar'}
          >
            {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            <span className="hidden sm:inline">{isSidebarOpen ? 'Hide Editor' : 'Show Editor'}</span>
          </button>

          {/* PWA Install Button */}
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-all animate-bounce"
              title="Install as App on Desktop or Mobile"
            >
              <Smartphone size={14} />
              <span>Install App</span>
            </button>
          )}

          {/* Paper Width Selector */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setWidth('58mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                width === '58mm'
                  ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setWidth('80mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                width === '80mm'
                  ? 'bg-white dark:bg-neutral-700 shadow-xs text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              80mm
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-300"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Drag Overlay Backdrop during resizing */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 select-none"
          style={{ cursor: isDesktop ? 'col-resize' : 'row-resize' }}
        />
      )}

      {/* Main App Layout */}
      <main className={`flex-1 flex overflow-hidden relative flex-col md:flex-row ${isDragging ? 'select-none' : ''}`}>
        {/* Editor Sidebar */}
        <aside
          style={
            isSidebarOpen
              ? isDesktop
                ? { width: `${sidebarWidth}px`, height: '100%' }
                : { width: '100%', height: `${sidebarHeight}px` }
              : isDesktop
              ? { width: 0, height: '100%' }
              : { width: '100%', height: 0 }
          }
          className={`flex flex-col bg-white dark:bg-neutral-900 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 shrink-0 transition-[opacity] duration-150 ${
            isSidebarOpen ? 'opacity-100 overflow-hidden' : 'opacity-0 overflow-hidden border-0 pointer-events-none'
          }`}
        >
          <RawInput
            value={inputValue}
            onChange={setInputValue}
            mode={inputMode}
            onModeChange={handleModeChange}
            onClear={() => setInputValue('')}
            onLoadPreset={handleLoadPreset}
          />
        </aside>

        {/* Draggable Resizer Bar */}
        {isSidebarOpen && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onTouchStart={() => setIsDragging(true)}
            className={`z-20 flex items-center justify-center transition-colors group select-none shrink-0 ${
              isDesktop
                ? 'w-2 hover:w-2.5 cursor-col-resize h-full border-r border-neutral-200 dark:border-neutral-800'
                : 'h-2.5 w-full cursor-row-resize border-b border-neutral-200 dark:border-neutral-800'
            } ${
              isDragging
                ? 'bg-amber-500'
                : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-amber-500/80 dark:hover:bg-amber-500/80'
            }`}
            title={isDesktop ? "Drag horizontally to resize editor width" : "Drag vertically to resize editor height"}
          >
            <GripVertical
              size={12}
              className={`text-neutral-500 group-hover:text-white transition-all ${
                isDesktop ? 'rotate-0' : 'rotate-90'
              } ${isDragging ? 'opacity-100 text-white' : 'opacity-50 group-hover:opacity-100'}`}
            />
          </div>
        )}

        {/* Main Printer Visualizer Stage */}
        <section className="flex-1 h-full min-w-0 min-h-0 bg-neutral-100 dark:bg-neutral-950 relative flex flex-col overflow-hidden">
          <ReceiptPreview data={receiptData} width={width} rawString={inputValue} />
        </section>
      </main>

      {/* Footer Info Bar */}
      <footer className="px-6 py-2 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex justify-between items-center text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Terminal size={14} className="text-amber-500" />
            <span>Mode: <strong className="uppercase">{inputMode}</strong></span>
          </span>
          <span>•</span>
          <span>Width: <strong>{width}</strong></span>
          <span>•</span>
          <span>Parsed Lines: <strong>{receiptData.lines.length}</strong></span>
        </div>

        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck size={13} />
            100% Offline Local Engine
          </span>

          <span>•</span>

          {/* Developer Attribution */}
          <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300 font-semibold">
            <span>Developed by</span>
            <a
              href="https://suhail.top"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-bold transition-colors"
            >
              <Globe size={11} />
              Suhail Akhtar
              <ExternalLink size={10} className="opacity-70" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

