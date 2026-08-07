/**
 * ESC/POS Command Types, Control Event Detectors, and Rich Parser
 */

export enum Alignment {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export type PrintColor = 'black' | 'red';

export interface TextStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  doubleHeight: boolean;
  doubleWidth: boolean;
  scaleX: number;
  scaleY: number;
  reverse: boolean; // White text on black background
  color: PrintColor;
}

export interface TextSpan {
  text: string;
  style: TextStyle;
}

export interface ReceiptLine {
  id: string;
  spans: TextSpan[];
  align: Alignment;
  hasCutHere?: boolean;
  hasBeepHere?: boolean;
  hasDrawerHere?: boolean;
}

export interface ControlEvent {
  type: 'cut' | 'beep' | 'drawer' | 'color' | 'reverse' | 'reset';
  label: string;
  lineIndex: number;
  details?: string;
}

export interface ReceiptData {
  lines: ReceiptLine[];
  hasCut: boolean;
  controlEvents: ControlEvent[];
  stats: {
    totalChars: number;
    redSpanCount: number;
    reverseSpanCount: number;
    boldSpanCount: number;
    cutCount: number;
    beepCount: number;
  };
}

const DEFAULT_STYLE: TextStyle = {
  bold: false,
  italic: false,
  underline: false,
  doubleHeight: false,
  doubleWidth: false,
  scaleX: 1,
  scaleY: 1,
  reverse: false,
  color: 'black',
};

export function parseEscPos(data: Uint8Array): ReceiptData {
  const lines: ReceiptLine[] = [];
  let currentLineSpans: TextSpan[] = [];
  let currentLineAlign = Alignment.LEFT;
  let currentStyle: TextStyle = { ...DEFAULT_STYLE };
  let currentText = '';
  let hasCut = false;
  let pendingBeep = false;
  let pendingDrawer = false;
  const controlEvents: ControlEvent[] = [];

  let redSpanCount = 0;
  let reverseSpanCount = 0;
  let boldSpanCount = 0;
  let cutCount = 0;
  let beepCount = 0;
  let totalChars = 0;

  const currentLineIndex = () => lines.length;

  const flushSpan = () => {
    if (currentText.length > 0) {
      totalChars += currentText.length;
      if (currentStyle.color === 'red') redSpanCount++;
      if (currentStyle.reverse) reverseSpanCount++;
      if (currentStyle.bold) boldSpanCount++;

      currentLineSpans.push({
        text: currentText,
        style: { ...currentStyle },
      });
      currentText = '';
    }
  };

  const flushLine = (hasCutHere = false, forceBeep = false, forceDrawer = false) => {
    flushSpan();
    const hasBeepHere = forceBeep || pendingBeep;
    const hasDrawerHere = forceDrawer || pendingDrawer;
    pendingBeep = false;
    pendingDrawer = false;

    lines.push({
      id: `line-${lines.length}-${Math.random().toString(36).substring(2, 7)}`,
      spans: [...currentLineSpans],
      align: currentLineAlign,
      hasCutHere,
      hasBeepHere,
      hasDrawerHere,
    });
    currentLineSpans = [];
  };

  let i = 0;
  while (i < data.length) {
    const byte = data[i];

    if (byte === 0x07) { // BEL (Buzzer sound)
      flushSpan();
      beepCount++;
      pendingBeep = true;
      controlEvents.push({ type: 'beep', label: 'Buzzer Sound (BEL \\x07)', lineIndex: currentLineIndex() });
      i++;
    } else if (byte === 0x1B) { // ESC
      i++;
      if (i >= data.length) break;
      const next = data[i];

      if (next === 0x40) { // ESC @ (Initialize)
        flushSpan();
        currentStyle = { ...DEFAULT_STYLE };
        currentLineAlign = Alignment.LEFT;
        controlEvents.push({ type: 'reset', label: 'Printer Reset (ESC @)', lineIndex: currentLineIndex() });
        i++;
      } else if (next === 0x61) { // ESC a (Alignment)
        flushSpan();
        const n = data[i + 1] ?? 0;
        if (n === 0 || n === 48) currentLineAlign = Alignment.LEFT;
        else if (n === 1 || n === 49) currentLineAlign = Alignment.CENTER;
        else if (n === 2 || n === 50) currentLineAlign = Alignment.RIGHT;
        i += 2;
      } else if (next === 0x45) { // ESC E (Bold)
        flushSpan();
        const val = (data[i + 1] & 1) === 1;
        currentStyle.bold = val;
        i += 2;
      } else if (next === 0x34) { // ESC 4 (Italic ON)
        flushSpan();
        currentStyle.italic = true;
        i++;
      } else if (next === 0x35) { // ESC 5 (Italic OFF)
        flushSpan();
        currentStyle.italic = false;
        i++;
      } else if (next === 0x2D) { // ESC - (Underline)
        flushSpan();
        const param = data[i + 1] ?? 0;
        currentStyle.underline = param === 1 || param === 2 || param === 49 || param === 50;
        i += 2;
      } else if (next === 0x7B) { // ESC { (Reverse Mode)
        flushSpan();
        const param = data[i + 1] ?? 0;
        const val = param === 1 || param === 49 || (param > 0 && param !== 48);
        currentStyle.reverse = val;
        i += 2;
      } else if (next === 0x21) { // ESC ! (Print mode bitmask)
        flushSpan();
        const n = data[i + 1] ?? 0;
        currentStyle.bold = (n & 0x08) !== 0;
        currentStyle.doubleHeight = (n & 0x10) !== 0;
        currentStyle.doubleWidth = (n & 0x20) !== 0;
        currentStyle.underline = (n & 0x80) !== 0;
        currentStyle.scaleX = currentStyle.doubleWidth ? 2 : 1;
        currentStyle.scaleY = currentStyle.doubleHeight ? 2 : 1;
        i += 2;
      } else if (next === 0x72) { // ESC r (Color select: 0=Black, 1=Red)
        flushSpan();
        const n = data[i + 1] ?? 0;
        const newColor: PrintColor = (n === 1 || n === 49) ? 'red' : 'black';
        if (currentStyle.color !== newColor) {
          currentStyle.color = newColor;
          controlEvents.push({ 
            type: 'color', 
            label: `Print Color: ${newColor.toUpperCase()} (ESC r ${n})`, 
            lineIndex: currentLineIndex() 
          });
        }
        i += 2;
      } else if (next === 0x42) { // ESC B (Buzzer sound)
        flushSpan();
        beepCount++;
        pendingBeep = true;
        controlEvents.push({ type: 'beep', label: 'Buzzer Sound (ESC B)', lineIndex: currentLineIndex() });
        i += 3; // ESC B n t
      } else if (next === 0x70) { // ESC p (Pulse / Cash drawer)
        flushSpan();
        pendingDrawer = true;
        controlEvents.push({ type: 'drawer', label: 'Open Cash Drawer (ESC p)', lineIndex: currentLineIndex() });
        i += 4; // ESC p m t1 t2
      } else {
        i++;
      }
    } else if (byte === 0x1D) { // GS
      i++;
      if (i >= data.length) break;
      const next = data[i];

      if (next === 0x21) { // GS ! (Character size width/height)
        flushSpan();
        const n = data[i + 1] ?? 0;
        const width = ((n >> 4) & 0x07) + 1;
        const height = (n & 0x07) + 1;
        currentStyle.scaleX = width;
        currentStyle.scaleY = height;
        i += 2;
      } else if (next === 0x56) { // GS V (Paper Cut)
        flushSpan();
        hasCut = true;
        cutCount++;
        controlEvents.push({ type: 'cut', label: 'Cut Paper (GS V)', lineIndex: currentLineIndex() });
        flushLine(true);
        i += 2; // GS V m
      } else if (next === 0x42) { // GS B (White/Black Reverse Mode)
        flushSpan();
        const param = data[i + 1] ?? 0;
        const val = param === 1 || param === 49 || (param > 0 && param !== 48);
        if (currentStyle.reverse !== val) {
          currentStyle.reverse = val;
          controlEvents.push({ 
            type: 'reverse', 
            label: `Reverse Mode: ${val ? 'ON' : 'OFF'} (GS B ${data[i+1]})`, 
            lineIndex: currentLineIndex() 
          });
        }
        i += 2;
      } else {
        i++;
      }
    } else if (byte === 0x0A) { // LF (Line feed)
      flushLine();
      i++;
    } else if (byte === 0x0D) { // CR
      i++;
    } else {
      // Regular character - parse string
      let start = i;
      while (
        i < data.length && 
        data[i] !== 0x1B && 
        data[i] !== 0x1D && 
        data[i] !== 0x0A && 
        data[i] !== 0x0D
      ) {
        i++;
      }
      const textChunk = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(start, i));
      currentText += textChunk;
    }
  }

  // Flush remaining text
  if (currentText.length > 0 || currentLineSpans.length > 0) {
    flushLine();
  }

  return {
    lines,
    hasCut,
    controlEvents,
    stats: {
      totalChars,
      redSpanCount,
      reverseSpanCount,
      boldSpanCount,
      cutCount,
      beepCount,
    },
  };
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(Math.floor(cleanHex.length / 2));
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function escapedStringToBytes(text: string): Uint8Array {
  // Convert escaped strings like \u001b, \x1b, \n, \r, \t into raw ESC/POS bytes
  const unescaped = text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');

  const result: number[] = [];
  for (let i = 0; i < unescaped.length; i++) {
    const charCode = unescaped.charCodeAt(i);
    if (charCode <= 0xFF) {
      result.push(charCode);
    } else {
      const encoded = new TextEncoder().encode(unescaped[i]);
      encoded.forEach(b => result.push(b));
    }
  }
  return new Uint8Array(result);
}
