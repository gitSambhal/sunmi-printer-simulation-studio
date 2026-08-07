/// <reference lib="webworker" />
import { parseEscPos, escapedStringToBytes, textToBytes } from './lib/escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './lib/renderHtml';
import { openApiSpec, getSwaggerHtml } from './lib/openapi';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'receipt-simulation-studio-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Service Worker Install
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW API Engine] Pre-caching offline app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker Activate
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('[SW API Engine] Deleting old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Helper CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Webhook-Secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Helper parser function
function parsePayloadToReceipt(rawInput: string, mode: string = 'raw') {
  let bytes: Uint8Array;
  if (mode === 'text') {
    bytes = textToBytes(rawInput);
  } else {
    bytes = escapedStringToBytes(rawInput);
  }
  return parseEscPos(bytes);
}

// Helper: Convert Webhook Order JSON into ESC/POS Command string
function convertWebhookOrderToEscPos(body: any) {
  const store = body.storeName || body.store || 'WEBHOOK EPOINT POS';
  const orderId = body.orderId || body.id || 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const items = Array.isArray(body.items) ? body.items : [
    { name: 'Order Item 1', qty: 1, price: 15.00 },
  ];
  const calculatedTotal = items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
  const total = body.total ?? calculatedTotal;

  let escStr = `\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 ${store.toUpperCase()} \\x1d\\x42\\x00\\n`;
  escStr += `WEBHOOK ORDER #${orderId}\\n--------------------------------\\n`;
  items.forEach((item: any) => {
    const qty = item.qty || 1;
    const name = item.name || 'Item';
    const priceStr = `$${((Number(item.price) || 0) * qty).toFixed(2)}`;
    const lineStr = `${qty}x ${name}`;
    const pad = Math.max(1, 32 - lineStr.length - priceStr.length);
    escStr += `${lineStr}${' '.repeat(pad)}${priceStr}\\n`;
  });
  escStr += `--------------------------------\\n`;
  const totalValStr = `$${Number(total).toFixed(2)}`;
  const totalLabel = `Total:`;
  const totalPad = Math.max(1, 32 - totalLabel.length - totalValStr.length);
  escStr += `\\x1b\\x45\\x01${totalLabel}${' '.repeat(totalPad)}${totalValStr}\\x1b\\x45\\x00\\n\\n`;
  escStr += `[ WEBHOOK EVENT: ${body.event || 'order.created'} ]\\n`;
  escStr += `Thank You!\\n\\x1d\\x56\\x00`;
  return escStr;
}

// API Handler Function
async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle CORS preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Route 1: Health check (/api/health or /health)
  if (pathname.endsWith('/api/health') || pathname.endsWith('/health')) {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'ESC/POS Receipt Generator MSW/SW API',
        version: '2.5.0 (Client-Side SW Engine)',
        serverlessMode: 'Service Worker Interceptor',
        endpoints: ['/api/health', '/api/render-receipt', '/api/render-image', '/api/webhook', '/api/openapi.json', '/api/docs'],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  // Route: OpenAPI Specification (/api/openapi.json or /openapi.json)
  if (pathname.includes('/openapi.json')) {
    return new Response(JSON.stringify(openApiSpec, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  // Route: Swagger UI Docs (/api/docs or /docs)
  if (pathname.endsWith('/api/docs') || pathname.endsWith('/docs')) {
    return new Response(getSwaggerHtml('/api/openapi.json'), {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders,
      },
    });
  }

  // Route: Webhook Receiver (/api/webhook or /webhook)
  if (pathname.includes('/webhook')) {
    try {
      let rawStr = '';
      let modeVal = 'raw';
      let widthVal = '80mm';
      let eventName = 'webhook_received';
      let orderId = 'ORD-WEBHOOK';

      if (request.method === 'POST') {
        const cloned = request.clone();
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await cloned.json();
          eventName = body.event || eventName;
          orderId = body.orderId || body.id || orderId;
          if (body.raw || body.text) {
            rawStr = body.raw || body.text;
          } else {
            rawStr = convertWebhookOrderToEscPos(body);
          }
          modeVal = body.mode || modeVal;
          widthVal = body.width || widthVal;
        } else {
          rawStr = await cloned.text();
        }
      }

      if (!rawStr) {
        rawStr = convertWebhookOrderToEscPos({ event: 'order.created', storeName: 'Epoint Cafe', items: [{ name: 'Test Item', qty: 1, price: 10.0 }] });
      }

      const receiptData = parsePayloadToReceipt(rawStr, modeVal);
      const wVal = widthVal === '58mm' ? '58mm' : '80mm';
      const html = renderReceiptToHtml(receiptData, { width: wVal, theme: 'light' });
      const svg = renderReceiptToSvg(receiptData, { width: wVal, theme: 'light' });

      return new Response(
        JSON.stringify({
          success: true,
          event: eventName,
          timestamp: new Date().toISOString(),
          orderId,
          width: wVal,
          receipt: {
            html,
            svg,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: 'Failed to process webhook event in SW', details: err?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  }

  // Parse parameters from body (POST) or search params (GET)
  let raw = url.searchParams.get('raw') || url.searchParams.get('text') || '';
  let mode = url.searchParams.get('mode') || 'raw';
  let width = url.searchParams.get('width') || '80mm';
  let theme = url.searchParams.get('theme') || 'light';
  let format = url.searchParams.get('format') || 'svg';

  if (request.method === 'POST') {
    try {
      const cloned = request.clone();
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await cloned.json();
        if (body) {
          raw = body.raw ?? body.text ?? raw;
          mode = body.mode ?? mode;
          width = body.width ?? width;
          theme = body.theme ?? theme;
          format = body.format ?? format;
        }
      } else {
        const textBody = await cloned.text();
        if (textBody) raw = textBody;
      }
    } catch (err) {
      console.warn('[SW API Engine] Failed to parse POST body:', err);
    }
  }

  if (!raw) {
    raw = "Epoint Store Test\n--------------------------------\nSample ESC/POS Receipt\nItem 1                     $10.00\nItem 2                      $5.00\n--------------------------------\nTotal                      $15.00\nThank You!\n";
  }

  // Route 2: Render Receipt JSON (/api/render-receipt or /render-receipt)
  if (pathname.includes('/render-receipt')) {
    try {
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
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: 'Failed to process receipt input',
          details: err?.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  // Route 3: Render Image SVG (/api/render-image or /render-image)
  if (pathname.includes('/render-image')) {
    try {
      const receiptData = parsePayloadToReceipt(raw, mode);
      const widthVal = width === '58mm' ? '58mm' : '80mm';
      const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: theme as any });

      if (format === 'json') {
        return new Response(
          JSON.stringify({
            success: true,
            svg,
            dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
            engine: 'Service Worker Client-Side API',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      return new Response(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
          ...corsHeaders,
        },
      });
    } catch (err: any) {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="50" fill="red">Error: ${err?.message}</text></svg>`,
        {
          status: 500,
          headers: {
            'Content-Type': 'image/svg+xml',
            ...corsHeaders,
          },
        }
      );
    }
  }

  // Generic API fallback
  return new Response(
    JSON.stringify({
      error: 'Endpoint not found',
      availableEndpoints: ['/api/health', '/api/render-receipt', '/api/render-image'],
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

// Fetch event listener
self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  const url = new URL(request.url);

  // Intercept all /api/, /render-, /docs, or /openapi.json requests in SW!
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/render-receipt') ||
    url.pathname.includes('/render-image') ||
    url.pathname.includes('/docs') ||
    url.pathname.includes('openapi.json')
  ) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets & navigation requests: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return null;
        });

      return (cachedResponse || fetchPromise) as Promise<Response>;
    })
  );
});
