import React from 'react';
import { X, Sparkles, Tag, ExternalLink, Calendar } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs transition-opacity" 
      />

      {/* Modal Dialog */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="changelog-title" className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                What's New
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Version history &amp; release updates
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Changelog List */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-neutral-600 dark:text-neutral-300">
          {/* Version 1.2.1 */}
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">v1.2.1</span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-sm">
                  Latest
                </span>
              </div>
              <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1 text-[11px]">
                <Calendar size={12} />
                Oct 06, 2026
              </span>
            </div>

            <ul className="space-y-1.5 list-disc list-inside text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <li><strong className="text-neutral-800 dark:text-neutral-200">SVG &amp; PNG Export Fix:</strong> Fully resolved vector SVG and high-resolution PNG export for complex ESC/POS sequences (`ESC 3 n`, `ESC 2`, `ESC ! 0`, `GS B`) and Unicode box-drawing tables.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Control Character Sanitization:</strong> Added strict character sanitization to prevent illegal XML parser errors in SVG and image rendering.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">High-DPI Canvas Fallback:</strong> Added guaranteed 2x high-resolution Canvas renderer for instant, fail-safe PNG downloads.</li>
            </ul>
          </div>

          {/* Version 1.2.0 */}
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">v1.2.0</span>
              <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1 text-[11px]">
                <Calendar size={12} />
                Oct 06, 2026
              </span>
            </div>

            <ul className="space-y-1.5 list-disc list-inside text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <li><strong className="text-neutral-800 dark:text-neutral-200">New Flat Receipt Page:</strong> Clutter-free, distraction-free document presentation designed for clean receipt previewing.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Expanded Export Suite:</strong> Instant export to 2x high-res PNG, scalable SVG, direct thermal print (with print media styles), HTML, and plain text.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Paper Finish Modes:</strong> Switch between Crisp White, Warm Cream, and Monochromatic Inverted paper looks.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Zoom &amp; Scale Controls:</strong> Fine-tune zoom from 60% to 180% with 1-click reset.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Non-Intrusive Edit Drawer:</strong> Modify ESC/POS commands without cluttering the main preview page.</li>
            </ul>
          </div>

          {/* Version 1.1.0 */}
          <div className="border-b border-neutral-100 dark:border-neutral-800 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">v1.1.0</span>
              <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1 text-[11px]">
                <Calendar size={12} />
                Aug 10, 2026
              </span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <li>Standardized consistent <code>outputType</code> parameter across all REST, SW, and API interceptor endpoints.</li>
              <li>Integrated OpenAPI 3.0 specification at <code>/api/openapi.json</code> and Swagger UI at <code>/docs</code>.</li>
              <li>Added <code>/api/webhook</code> endpoint for direct POS and e-commerce order conversion.</li>
            </ul>
          </div>

          {/* Version 1.0.0 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">v1.0.0</span>
              <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1 text-[11px]">
                <Calendar size={12} />
                Apr 29, 2026
              </span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <li>Interactive 3D Sunmi Cloud thermal printer emulator.</li>
              <li>ESC/POS escape code real-time parser with hex viewer and sound effects.</li>
              <li>100% offline local PWA service worker support.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 flex justify-between items-center text-[11px] text-neutral-500">
          <a
            href="https://suhail.top"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            <span>suhail.top</span>
            <ExternalLink size={10} />
          </a>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
