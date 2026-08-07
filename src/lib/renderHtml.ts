import { ReceiptData, Alignment } from './escpos';

export interface RenderOptions {
  width?: '58mm' | '80mm';
  theme?: 'light' | 'dark';
  title?: string;
}

export function renderReceiptToHtml(data: ReceiptData, options: RenderOptions = {}): string {
  const is58 = options.width === '58mm';
  const widthVal = is58 ? '320px' : '400px';
  const paddingVal = is58 ? '20px 14px' : '24px 18px';
  const isDark = options.theme === 'dark';

  const bgColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#111827';
  const borderColor = isDark ? '#334155' : '#e5e7eb';

  const linesHtml = data.lines
    .map((line) => {
      const alignCss =
        line.align === Alignment.CENTER
          ? 'text-align: center;'
          : line.align === Alignment.RIGHT
          ? 'text-align: right;'
          : 'text-align: left;';

      const spansHtml = line.spans
        .map((span) => {
          const style = span.style;
          const isRed = style.color === 'red';
          const isReverse = style.reverse;

          const colorCss = isRed
            ? 'color: #dc2626; font-weight: 600;'
            : isReverse
            ? 'color: #ffffff; background-color: #000000; padding: 0 3px; font-weight: 700; border-radius: 2px;'
            : `color: ${textColor};`;

          const fontCss = style.bold ? 'font-weight: 700;' : 'font-weight: 400;';
          const italicCss = style.italic ? 'font-style: italic;' : '';
          const underlineCss = style.underline ? 'text-decoration: underline;' : '';

          const scaleY = style.scaleY > 1 ? style.scaleY : 1;
          const scaleX = style.scaleX > 1 ? style.scaleX : 1;
          const fontSize = `${Math.min(20, 11.5 * scaleY)}px`;
          const letterSpacing = scaleX > 1 ? '0.08em' : '0px';

          const escapedText = span.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

          return `<span style='font-size: ${fontSize}; letter-spacing: ${letterSpacing}; ${fontCss} ${italicCss} ${colorCss} ${underlineCss} display: inline; white-space: pre-wrap; word-break: break-all;'>${escapedText}</span>`;
        })
        .join('');

      let cutDivider = '';
      if (line.hasCutHere) {
        cutDivider = `<div style='margin: 14px 0; border-top: 2px dashed #ef4444; position: relative; text-align: center;'><span style='position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 10px; color: #ef4444; font-weight: bold; border: 1px solid #fca5a5; border-radius: 10px;'>✂ PAPER CUT</span></div>`;
      }

      return `<div style='width: 100%; min-height: 1.25em; ${alignCss} margin: 1px 0; white-space: pre-wrap; word-break: break-all; font-family: "Courier New", Courier, "JetBrains Mono", monospace;'>${spansHtml}</div>${cutDivider}`;
    })
    .join('');

  const rawHtml = `<div id='receipt-container' data-receipt-width='${options.width || '80mm'}' style='width: 100%; max-width: ${widthVal}; margin: 0 auto; background-color: ${bgColor}; color: ${textColor}; font-family: "Courier New", Courier, "JetBrains Mono", monospace; font-size: 11.5px; line-height: 1.35; padding: ${paddingVal}; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid ${borderColor}; border-radius: 4px; box-sizing: border-box;'><div id='receipt-paper' data-receipt-preview='true' style='width: 100%;'>${linesHtml}</div></div>`;

  return rawHtml.replace(/\r?\n\s*/g, '');
}

export function renderReceiptToSvg(data: ReceiptData, options: RenderOptions = {}): string {
  const is58 = options.width === '58mm';
  const widthPx = is58 ? 320 : 400;

  let calculatedHeight = 0;

  // Measure exact rendered height in browser DOM
  if (typeof document !== 'undefined') {
    try {
      const temp = document.createElement('div');
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      temp.style.top = '-9999px';
      temp.style.width = `${widthPx}px`;
      temp.style.visibility = 'hidden';
      temp.style.zIndex = '-9999';
      temp.innerHTML = renderReceiptToHtml(data, options);
      document.body.appendChild(temp);

      const container = temp.querySelector('#receipt-container') as HTMLElement;
      if (container) {
        calculatedHeight = Math.ceil(container.getBoundingClientRect().height);
      }
      document.body.removeChild(temp);
    } catch (e) {
      console.warn('Could not measure offscreen SVG height:', e);
    }
  }

  // Fallback math calculation if offscreen document is unavailable
  if (!calculatedHeight || calculatedHeight <= 0) {
    const charsPerLine = is58 ? 32 : 44;
    calculatedHeight = is58 ? 40 : 48; // Padding top & bottom
    data.lines.forEach(line => {
      let maxScaleY = 1;
      let totalChars = 0;
      line.spans.forEach(s => {
        if (s.style.scaleY > maxScaleY) maxScaleY = s.style.scaleY;
        totalChars += s.text.length;
      });

      const wrappedLines = Math.max(1, Math.ceil(totalChars / charsPerLine));
      const linePixelHeight = (15.5 * maxScaleY + 2) * wrappedLines;
      calculatedHeight += linePixelHeight;

      if (line.hasCutHere) calculatedHeight += 38;
    });
    calculatedHeight = Math.ceil(calculatedHeight);
  }

  const htmlContent = renderReceiptToHtml(data, options);

  const rawSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${widthPx}' height='${calculatedHeight}' viewBox='0 0 ${widthPx} ${calculatedHeight}'><rect width='100%' height='100%' fill='${options.theme === 'dark' ? '#1e293b' : '#ffffff'}' rx='4'/><foreignObject x='0' y='0' width='${widthPx}' height='${calculatedHeight}'><div xmlns='http://www.w3.org/1999/xhtml' style='width: 100%; height: 100%; box-sizing: border-box;'><style>* { box-sizing: border-box; } div, span { font-family: "Courier New", Courier, "JetBrains Mono", monospace; }</style>${htmlContent}</div></foreignObject></svg>`;

  return rawSvg.replace(/\r?\n\s*/g, '');
}
