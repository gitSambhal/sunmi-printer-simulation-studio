import { parseEscPos, escapedStringToBytes, textToBytes } from './escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './renderHtml';
import { openApiSpec, getSwaggerHtml } from './openapi';
import {
  handleSunmiBindShop,
  handleSunmiUnbindShop,
  handleSunmiOnlineStatus,
  handleSunmiOnlineStatuses,
  handleSunmiClearPrintJob,
  handleSunmiPrintStatus,
  handleSunmiPushContent,
} from './sunmiApi';

function parsePayloadToReceipt(rawInput: string, mode: string = 'raw') {
  let bytes: Uint8Array;
  if (mode === 'text') {
    bytes = textToBytes(rawInput);
  } else {
    bytes = escapedStringToBytes(rawInput);
  }
  return parseEscPos(bytes);
}

export function registerApiInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept local relative /api/, /v2/printer/, /sunmi, /docs, /openapi.json, or Sunmi routes
    if (
      urlStr.includes('/api/') ||
      urlStr.includes('/v2/printer/') ||
      urlStr.includes('/sunmi') ||
      urlStr.includes('bind') ||
      urlStr.includes('online') ||
      urlStr.includes('print') ||
      urlStr.includes('push') ||
      urlStr.includes('/render-receipt') ||
      urlStr.includes('/render-image') ||
      urlStr.includes('/docs') ||
      urlStr.includes('openapi.json')
    ) {
      try {
        const urlObj = new URL(urlStr, window.location.origin);
        const pathname = urlObj.pathname;
        const lowerPath = pathname.toLowerCase();

        // Route 1: Health check
        if (pathname.endsWith('/api/health') || pathname.endsWith('/health')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              service: 'ESC/POS Receipt Generator MSW Engine',
              version: '2.5.0 (Client-Side Interceptor)',
              serverlessMode: 'Client Browser MSW/SW Engine',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Route: OpenAPI JSON spec
        if (pathname.includes('openapi.json')) {
          return new Response(JSON.stringify(openApiSpec, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Route: Swagger UI Docs
        if (pathname.endsWith('/api/docs') || pathname.endsWith('/docs') || pathname.endsWith('/docs/')) {
          return new Response(getSwaggerHtml('/api/openapi.json'), {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Sunmi Mock Endpoints in Fetch Interceptor
        if (lowerPath.includes('/unbindshop') || lowerPath.includes('/unbind-shop')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          return new Response(JSON.stringify(handleSunmiUnbindShop(params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/bindshop') || lowerPath.includes('/bind-shop')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          return new Response(JSON.stringify(handleSunmiBindShop(params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/online-statuses')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          return new Response(JSON.stringify(handleSunmiOnlineStatuses(params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/onlinestatus') || lowerPath.includes('/online-status')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          const segments = pathname.split('/').filter(Boolean);
          const lastSeg = segments[segments.length - 1];
          const snInPath = lastSeg && lastSeg.toLowerCase() !== 'onlinestatus' && lastSeg.toLowerCase() !== 'online-status' ? lastSeg : undefined;
          return new Response(JSON.stringify(handleSunmiOnlineStatus(snInPath, params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/clearprintjob') || lowerPath.includes('/clear-print-job')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          return new Response(JSON.stringify(handleSunmiClearPrintJob(params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/printstatus') || lowerPath.includes('/print-status')) {
          let bodyObj: any = {};
          if (init?.body) {
            try { bodyObj = JSON.parse(init.body as string); } catch {}
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          const segments = pathname.split('/').filter(Boolean);
          const lastSeg = segments[segments.length - 1];
          const tradeNoInPath = lastSeg && lastSeg.toLowerCase() !== 'printstatus' && lastSeg.toLowerCase() !== 'print-status' ? lastSeg : undefined;
          return new Response(JSON.stringify(handleSunmiPrintStatus(tradeNoInPath, params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (lowerPath.includes('/pushcontent') || lowerPath.includes('/push-content')) {
          let bodyObj: any = {};
          if (init?.body) {
            try {
              bodyObj = JSON.parse(init.body as string);
            } catch {
              bodyObj = { content: init.body };
            }
          }
          const queryObj = Object.fromEntries(urlObj.searchParams.entries());
          const params = { ...queryObj, ...bodyObj };
          return new Response(JSON.stringify(handleSunmiPushContent(params)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Extract params
        let raw = urlObj.searchParams.get('raw') || urlObj.searchParams.get('text') || '';
        let mode = urlObj.searchParams.get('mode') || 'raw';
        let width = urlObj.searchParams.get('width') || '80mm';
        let theme = urlObj.searchParams.get('theme') || 'light';
        let format = urlObj.searchParams.get('format') || 'svg';

        if (init?.method === 'POST' && init.body) {
          try {
            if (typeof init.body === 'string') {
              const bodyJson = JSON.parse(init.body);
              raw = bodyJson.raw ?? bodyJson.text ?? raw;
              mode = bodyJson.mode ?? mode;
              width = bodyJson.width ?? width;
              theme = bodyJson.theme ?? theme;
              format = bodyJson.format ?? format;
            }
          } catch {
            if (typeof init.body === 'string') raw = init.body;
          }
        }

        if (!raw) {
          raw = "Epoint Store Test\n--------------------------------\nSample ESC/POS Receipt\nItem 1                     $10.00\nItem 2                      $5.00\n--------------------------------\nTotal                      $15.00\nThank You!\n";
        }

        // Route 2: Render Receipt JSON
        if (pathname.includes('/render-receipt')) {
          const receiptData = parsePayloadToReceipt(raw, mode);
          const widthVal = width === '58mm' ? '58mm' : '80mm';
          const html = renderReceiptToHtml(receiptData, { width: widthVal, theme: theme as any });
          const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: theme as any });

          return new Response(
            JSON.stringify({
              success: true,
              width: widthVal,
              html,
              svg,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Route 3: Render Image SVG
        if (pathname.includes('/render-image')) {
          const receiptData = parsePayloadToReceipt(raw, mode);
          const widthVal = width === '58mm' ? '58mm' : '80mm';
          const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: theme as any });

          if (format === 'json') {
            return new Response(
              JSON.stringify({
                success: true,
                svg,
                dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
                engine: 'Client-Side Local MSW API Engine',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(svg, {
            status: 200,
            headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
          });
        }
      } catch (err: any) {
        console.warn('API Interceptor caught error, falling back to network fetch:', err);
      }
    }

    return originalFetch.apply(window, [input, init]);
  };

  try {
    (window as any).fetch = customFetch;
  } catch {
    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      console.log('[API Engine] Window fetch override skipped; Service Worker sw.js will handle network intercept');
    }
  }

  console.log('[API Engine] Client-side Service Worker & Fetch Interceptor active');
}
