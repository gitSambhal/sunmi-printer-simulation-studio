import { ReceiptData, Alignment } from './escpos';

export interface RenderOptions {
  width?: '58mm' | '80mm';
  theme?: 'light' | 'dark';
  title?: string;
}

/**
 * Strips non-printable ASCII control characters and escapes XML special entities
 */
export function sanitizeXmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render Receipt to Clean HTML DOM String
 */
export function renderReceiptToHtml(data: ReceiptData, options: RenderOptions = {}): string {
  const is58 = options.width === '58mm';
  const widthVal = is58 ? '320px' : '400px';
  const paddingVal = is58 ? '20px 14px' : '24px 18px';
  const isDark = options.theme === 'dark';

  const bgColor = isDark ? '#18181b' : '#ffffff';
  const textColor = isDark ? '#f4f4f5' : '#111827';
  const borderColor = isDark ? '#27272a' : '#e4e4e7';

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

          let colorCss = `color: ${textColor};`;
          if (isReverse) {
            colorCss = 'color: #ffffff; background-color: #09090b; padding: 1px 4px; font-weight: 700; border-radius: 2px;';
          } else if (isRed) {
            colorCss = 'color: #dc2626; font-weight: 600;';
          }

          const fontCss = (style.bold || isReverse || style.scaleX > 1 || style.scaleY > 1) ? 'font-weight: 700;' : 'font-weight: 400;';
          const italicCss = style.italic ? 'font-style: italic;' : '';
          const underlineCss = style.underline ? 'text-decoration: underline;' : '';

          const scaleY = style.scaleY > 1 ? style.scaleY : 1;
          const scaleX = style.scaleX > 1 ? style.scaleX : 1;
          const fontSize = `${Math.min(22, 12 * scaleY)}px`;
          const letterSpacing = scaleX > 1 ? '0.08em' : '0px';

          const sanitized = sanitizeXmlText(span.text);

          return `<span style="font-size: ${fontSize}; letter-spacing: ${letterSpacing}; ${fontCss} ${italicCss} ${colorCss} ${underlineCss} display: inline; white-space: pre-wrap; word-break: break-all;">${sanitized}</span>`;
        })
        .join('');

      let beepDivider = '';
      if (line.hasBeepHere) {
        beepDivider = `<div style="margin: 10px 0; border-top: 1px dashed #f59e0b; position: relative; text-align: center;"><span style="position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 9px; color: #d97706; font-weight: bold; border: 1px solid #fde68a; border-radius: 10px;">🔔 POS BUZZER BEEP (ESC B)</span></div>`;
      }

      let drawerDivider = '';
      if (line.hasDrawerHere) {
        drawerDivider = `<div style="margin: 10px 0; border-top: 1px dashed #f97316; position: relative; text-align: center;"><span style="position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 9px; color: #ea580c; font-weight: bold; border: 1px solid #fed7aa; border-radius: 10px;">⚡ CASH DRAWER KICK (ESC p)</span></div>`;
      }

      let cutDivider = '';
      if (line.hasCutHere) {
        cutDivider = `<div style="margin: 14px 0; border-top: 2px dashed #ef4444; position: relative; text-align: center;"><span style="position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 10px; color: #ef4444; font-weight: bold; border: 1px solid #fca5a5; border-radius: 10px;">✂ PAPER CUT</span></div>`;
      }

      const lineContent = spansHtml.length > 0 ? spansHtml : '&nbsp;';
      return `<div style="width: 100%; min-height: 1.25em; ${alignCss} margin: 1.5px 0; white-space: pre-wrap; word-break: break-all; font-family: 'Courier New', Courier, 'JetBrains Mono', monospace;">${lineContent}</div>${beepDivider}${drawerDivider}${cutDivider}`;
    })
    .join('\n');

  return `<div id="receipt-container" data-receipt-width="${options.width || '80mm'}" style="width: 100%; max-width: ${widthVal}; margin: 0 auto; background-color: ${bgColor}; color: ${textColor}; font-family: 'Courier New', Courier, 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.35; padding: ${paddingVal}; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid ${borderColor}; border-radius: 4px; box-sizing: border-box;"><div id="receipt-paper" data-receipt-preview="true" style="width: 100%;">${linesHtml}</div></div>`;
}

/**
 * Render Receipt to Pure Vector Scalable SVG String
 * Generates 100% compliant, standalone SVG with native <text>, <rect>, and <line> tags
 * that renders perfectly in all browsers, Illustrator, Figma, Inkscape, and image viewers.
 */
export function renderReceiptToSvg(data: ReceiptData, options: RenderOptions = {}): string {
  const is58 = options.width === '58mm';
  const widthPx = is58 ? 360 : 440;
  const paddingX = is58 ? 16 : 22;
  const paddingY = is58 ? 24 : 28;
  const printableWidth = widthPx - paddingX * 2;
  const isDark = options.theme === 'dark';

  const bgColor = isDark ? '#18181b' : '#ffffff';
  const defaultTextColor = isDark ? '#f4f4f5' : '#111827';
  const borderColor = isDark ? '#27272a' : '#e4e4e7';

  // Base font size & line calculations
  const baseFontSize = is58 ? 11.5 : 12;
  const approxCharWidth = baseFontSize * 0.602; // Standard monospace char aspect ratio

  let currentY = paddingY;
  const svgElements: string[] = [];

  // Background rectangle
  svgElements.push(
    `<rect width="100%" height="100%" fill="${bgColor}" rx="6" stroke="${borderColor}" stroke-width="1"/>`
  );

  data.lines.forEach((line, lineIdx) => {
    let maxScaleY = 1;
    let maxScaleX = 1;
    line.spans.forEach((s) => {
      if (s.style.scaleY > maxScaleY) maxScaleY = s.style.scaleY;
      if (s.style.scaleX > maxScaleX) maxScaleX = s.style.scaleX;
    });

    const lineHeight = Math.round(baseFontSize * 1.38 * maxScaleY);
    const baselineOffset = Math.round(lineHeight * 0.76);

    // Calculate total line width for alignment
    let totalTextLen = 0;
    line.spans.forEach((s) => {
      const sScaleX = s.style.scaleX > 1 ? s.style.scaleX : 1;
      totalTextLen += s.text.length * approxCharWidth * sScaleX;
    });

    let startX = paddingX;
    if (line.align === Alignment.CENTER) {
      startX = Math.max(paddingX, Math.round(paddingX + (printableWidth - totalTextLen) / 2));
    } else if (line.align === Alignment.RIGHT) {
      startX = Math.max(paddingX, Math.round(widthPx - paddingX - totalTextLen));
    }

    let cursorX = startX;

    line.spans.forEach((span) => {
      const style = span.style;
      const spanScaleX = style.scaleX > 1 ? style.scaleX : 1;
      const spanScaleY = style.scaleY > 1 ? style.scaleY : 1;
      const fontSize = Math.round(baseFontSize * spanScaleY);
      const spanCharWidth = approxCharWidth * spanScaleX;
      const spanPixelWidth = Math.round(span.text.length * spanCharWidth);

      const isReverse = style.reverse;
      const isRed = style.color === 'red';
      const isBold = style.bold || isReverse || style.scaleX > 1 || style.scaleY > 1;
      const isItalic = style.italic;

      const textColor = isReverse ? '#ffffff' : isRed ? '#dc2626' : defaultTextColor;
      const fontWeight = isBold ? '700' : '400';
      const fontStyle = isItalic ? 'italic' : 'normal';

      // If reverse, draw solid background pill
      if (isReverse) {
        const padX = 3;
        svgElements.push(
          `<rect x="${cursorX - padX}" y="${currentY}" width="${spanPixelWidth + padX * 2}" height="${lineHeight}" fill="#09090b" rx="2"/>`
        );
      }

      // Draw sanitized text
      const sanitized = sanitizeXmlText(span.text);
      if (sanitized.length > 0) {
        svgElements.push(
          `<text x="${cursorX}" y="${currentY + baselineOffset}" fill="${textColor}" font-family="'Courier New', Courier, 'JetBrains Mono', monospace" font-size="${fontSize}px" font-weight="${fontWeight}" font-style="${fontStyle}" xml:space="preserve">${sanitized}</text>`
        );
      }

      // If underline, draw line beneath text
      if (style.underline) {
        svgElements.push(
          `<line x1="${cursorX}" y1="${currentY + lineHeight - 1}" x2="${cursorX + spanPixelWidth}" y2="${currentY + lineHeight - 1}" stroke="${textColor}" stroke-width="1.2"/>`
        );
      }

      cursorX += spanPixelWidth;
    });

    currentY += lineHeight + 2;

    // Hardware Event Dividers
    if (line.hasBeepHere) {
      currentY += 6;
      svgElements.push(
        `<line x1="${paddingX}" y1="${currentY}" x2="${widthPx - paddingX}" y2="${currentY}" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,4"/>`
      );
      svgElements.push(
        `<text x="${widthPx / 2}" y="${currentY - 3}" fill="#d97706" font-family="'Courier New', monospace" font-size="9px" font-weight="700" text-anchor="middle">🔔 POS BUZZER BEEP</text>`
      );
      currentY += 10;
    }

    if (line.hasDrawerHere) {
      currentY += 6;
      svgElements.push(
        `<line x1="${paddingX}" y1="${currentY}" x2="${widthPx - paddingX}" y2="${currentY}" stroke="#f97316" stroke-width="1" stroke-dasharray="4,4"/>`
      );
      svgElements.push(
        `<text x="${widthPx / 2}" y="${currentY - 3}" fill="#ea580c" font-family="'Courier New', monospace" font-size="9px" font-weight="700" text-anchor="middle">⚡ CASH DRAWER KICK</text>`
      );
      currentY += 10;
    }

    if (line.hasCutHere) {
      currentY += 8;
      svgElements.push(
        `<line x1="${paddingX}" y1="${currentY}" x2="${widthPx - paddingX}" y2="${currentY}" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="6,5"/>`
      );
      svgElements.push(
        `<text x="${widthPx / 2}" y="${currentY - 4}" fill="#ef4444" font-family="'Courier New', monospace" font-size="10px" font-weight="700" text-anchor="middle">✂ PAPER CUT</text>`
      );
      currentY += 12;
    }
  });

  const totalHeight = Math.max(120, currentY + paddingY);

  // Wrap inside pure SVG root
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${totalHeight}" viewBox="0 0 ${widthPx} ${totalHeight}">
  <style>
    text { font-family: "Courier New", Courier, "JetBrains Mono", monospace; }
  </style>
  ${svgElements.join('\n  ')}
</svg>`;
}

/**
 * Render Receipt directly to an HTML5 Canvas and export as PNG Data URL
 * Guaranteed 100% reliability with zero font or CORS loading issues
 */
export function renderReceiptToPngDataUrl(data: ReceiptData, options: RenderOptions = {}): string {
  if (typeof document === 'undefined') {
    // In Node or SSR environment, fallback to base64 SVG data URI
    const svg = renderReceiptToSvg(data, options);
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  const is58 = options.width === '58mm';
  const widthPx = is58 ? 360 : 440;
  const paddingX = is58 ? 16 : 22;
  const paddingY = is58 ? 24 : 28;
  const printableWidth = widthPx - paddingX * 2;
  const isDark = options.theme === 'dark';

  const bgColor = isDark ? '#18181b' : '#ffffff';
  const defaultTextColor = isDark ? '#f4f4f5' : '#111827';
  const borderColor = isDark ? '#27272a' : '#e4e4e7';

  const baseFontSize = is58 ? 12 : 13;
  const approxCharWidth = baseFontSize * 0.602;

  // First pass: Calculate canvas height
  let totalHeight = paddingY * 2;
  data.lines.forEach((line) => {
    let maxScaleY = 1;
    line.spans.forEach((s) => {
      if (s.style.scaleY > maxScaleY) maxScaleY = s.style.scaleY;
    });
    totalHeight += Math.round(baseFontSize * 1.38 * maxScaleY) + 2;
    if (line.hasBeepHere) totalHeight += 16;
    if (line.hasDrawerHere) totalHeight += 16;
    if (line.hasCutHere) totalHeight += 20;
  });
  totalHeight = Math.max(120, totalHeight);

  // Setup High-DPI Canvas (2x scale)
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, widthPx, totalHeight);

  // Border outline
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, widthPx - 1, totalHeight - 1);

  // Render text lines
  let currentY = paddingY;

  data.lines.forEach((line) => {
    let maxScaleY = 1;
    let maxScaleX = 1;
    line.spans.forEach((s) => {
      if (s.style.scaleY > maxScaleY) maxScaleY = s.style.scaleY;
      if (s.style.scaleX > maxScaleX) maxScaleX = s.style.scaleX;
    });

    const lineHeight = Math.round(baseFontSize * 1.38 * maxScaleY);
    const baselineOffset = Math.round(lineHeight * 0.76);

    // Calculate total line text width for alignment
    let totalTextLen = 0;
    line.spans.forEach((s) => {
      const sScaleX = s.style.scaleX > 1 ? s.style.scaleX : 1;
      totalTextLen += s.text.length * approxCharWidth * sScaleX;
    });

    let startX = paddingX;
    if (line.align === Alignment.CENTER) {
      startX = Math.max(paddingX, Math.round(paddingX + (printableWidth - totalTextLen) / 2));
    } else if (line.align === Alignment.RIGHT) {
      startX = Math.max(paddingX, Math.round(widthPx - paddingX - totalTextLen));
    }

    let cursorX = startX;

    line.spans.forEach((span) => {
      const style = span.style;
      const spanScaleX = style.scaleX > 1 ? style.scaleX : 1;
      const spanScaleY = style.scaleY > 1 ? style.scaleY : 1;
      const fontSize = Math.round(baseFontSize * spanScaleY);
      const spanCharWidth = approxCharWidth * spanScaleX;
      const spanPixelWidth = Math.round(span.text.length * spanCharWidth);

      const isReverse = style.reverse;
      const isRed = style.color === 'red';
      const isBold = style.bold || isReverse || style.scaleX > 1 || style.scaleY > 1;
      const isItalic = style.italic;

      const fontStyle = isItalic ? 'italic ' : '';
      const fontWeight = isBold ? 'bold ' : 'normal ';
      ctx.font = `${fontStyle}${fontWeight}${fontSize}px "Courier New", Courier, monospace`;

      // If reverse, draw black background box
      if (isReverse) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(cursorX - 2, currentY, spanPixelWidth + 4, lineHeight);
        ctx.fillStyle = '#ffffff';
      } else if (isRed) {
        ctx.fillStyle = '#dc2626';
      } else {
        ctx.fillStyle = defaultTextColor;
      }

      ctx.fillText(span.text, cursorX, currentY + baselineOffset);

      if (style.underline) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cursorX, currentY + lineHeight - 1);
        ctx.lineTo(cursorX + spanPixelWidth, currentY + lineHeight - 1);
        ctx.stroke();
      }

      cursorX += spanPixelWidth;
    });

    currentY += lineHeight + 2;

    // Hardware Event Dividers
    if (line.hasBeepHere) {
      currentY += 6;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingX, currentY);
      ctx.lineTo(widthPx - paddingX, currentY);
      ctx.stroke();
      ctx.setLineDash([]);
      currentY += 10;
    }

    if (line.hasDrawerHere) {
      currentY += 6;
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingX, currentY);
      ctx.lineTo(widthPx - paddingX, currentY);
      ctx.stroke();
      ctx.setLineDash([]);
      currentY += 10;
    }

    if (line.hasCutHere) {
      currentY += 8;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(paddingX, currentY);
      ctx.lineTo(widthPx - paddingX, currentY);
      ctx.stroke();
      ctx.setLineDash([]);
      currentY += 12;
    }
  });

  return canvas.toDataURL('image/png');
}
