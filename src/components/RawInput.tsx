import React, { useState, useRef } from 'react';
import { Terminal, FileText, Trash2, Clipboard, Sparkles, Code2, Scissors, Bell, Flame, Palette, WrapText } from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';

interface RawInputProps {
  value: string;
  onChange: (value: string) => void;
  mode: 'text' | 'raw';
  onModeChange: (mode: 'text' | 'raw') => void;
  onClear: () => void;
  onLoadPreset: (key: string) => void;
}

export const RawInput: React.FC<RawInputProps> = ({
  value,
  onChange,
  mode,
  onModeChange,
  onClear,
  onLoadPreset,
}) => {
  const [copied, setCopied] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const insertCommandAtCursor = (code: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = value.substring(0, start) + code + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + code.length, start + code.length);
    }, 50);
  };

  const commandChips = [
    { label: 'Paper Cut', code: '\\u001dV\\u0000', icon: Scissors, color: 'hover:border-blue-500 hover:text-blue-500' },
    { label: 'Buzzer Beep', code: '\\u001bB\\u0001\\u0001', icon: Bell, color: 'hover:border-yellow-500 hover:text-yellow-500' },
    { label: 'Red Print', code: '\\u001br\\u0001', icon: Flame, color: 'hover:border-red-500 hover:text-red-500' },
    { label: 'Black Print', code: '\\u001br\\u0000', icon: Palette, color: 'hover:border-neutral-500' },
    { label: 'Bold On', code: '\\u001bE\\u0001', icon: Code2, color: 'hover:border-amber-500 hover:text-amber-500' },
    { label: 'Bold Off', code: '\\u001bE\\u0000', icon: Code2, color: 'hover:border-neutral-400' },
    { label: 'Italic On', code: '\\u001b4', icon: Code2, color: 'hover:border-indigo-500 hover:text-indigo-500' },
    { label: 'Italic Off', code: '\\u001b5', icon: Code2, color: 'hover:border-neutral-400' },
    { label: 'Reverse On', code: '\\u001dB\\u0001', icon: Sparkles, color: 'hover:border-purple-500 hover:text-purple-500' },
    { label: 'Reverse Off', code: '\\u001dB\\u0000', icon: Sparkles, color: 'hover:border-neutral-400' },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 transition-colors duration-300">
      {/* Header Tabs & Actions */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg">
            <button
              onClick={() => onModeChange('raw')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                mode === 'raw'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Terminal size={14} />
              Raw Escape
            </button>
            <button
              onClick={() => onModeChange('text')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                mode === 'text'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <FileText size={14} />
              Plain Text
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsWordWrap(!isWordWrap)}
              className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-colors border ${
                isWordWrap
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600'
              }`}
              title={isWordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}
            >
              <WrapText size={13} />
              <span>{isWordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
              title="Copy Buffer"
            >
              <Clipboard size={16} className={copied ? 'text-emerald-500' : ''} />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
              title="Clear Editor"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Quick Sample Presets Bar */}
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Presets:</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onLoadPreset('complex')}
              className="px-2 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900 hover:scale-105 transition-all text-[10px] font-bold"
            >
              🚨 POS Timeout Alert
            </button>
            <button
              onClick={() => onLoadPreset('kitchen')}
              className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900 hover:scale-105 transition-all text-[10px] font-bold"
            >
              🍕 Kitchen Order
            </button>
            <button
              onClick={() => onLoadPreset('standard')}
              className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600 hover:scale-105 transition-all text-[10px] font-bold"
            >
              🧾 Standard Receipt
            </button>
          </div>
        </div>
      </div>

      {/* ESC/POS Quick Insertion Bar */}
      {mode === 'raw' && (
        <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 whitespace-nowrap">
            Quick Insert:
          </span>
          {commandChips.map((chip, idx) => {
            const Icon = chip.icon;
            return (
              <button
                key={idx}
                onClick={() => insertCommandAtCursor(chip.code)}
                className={`px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1 transition-all whitespace-nowrap ${chip.color}`}
                title={`Insert ${chip.code}`}
              >
                <Icon size={12} />
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Code Editor TextArea Area */}
      <div className="flex-1 relative bg-neutral-50/50 dark:bg-neutral-900/30 overflow-hidden">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          wrap={isWordWrap ? 'soft' : 'off'}
          placeholder={
            mode === 'raw'
              ? 'Paste or type raw ESC/POS string with escape codes like \\u001bE\\u0001, \\u001br\\u0001, \\u001dV\\u0000...'
              : 'Type plain text receipt...'
          }
          className={`w-full h-full p-4 font-mono text-xs leading-relaxed resize-none bg-transparent focus:outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 ${
            isWordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'
          }`}
          spellCheck={false}
          id="raw-input-area"
        />

        {/* Floating Code Info Badge */}
        <div className="absolute bottom-3 right-3 pointer-events-none flex items-center gap-2">
          <div className="px-2 py-1 bg-white/90 dark:bg-neutral-800/90 backdrop-blur border border-neutral-200 dark:border-neutral-700 rounded text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shadow-xs flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{value.length} Chars</span>
            <span>•</span>
            <span className="uppercase font-bold">{mode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
