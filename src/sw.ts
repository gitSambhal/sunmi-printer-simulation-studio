/// <reference lib="webworker" />
import { parseEscPos, escapedStringToBytes, hexToBytes, textToBytes } from './lib/escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './lib/renderHtml';

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
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Helper parser function
function parsePayloadToReceipt(rawInput: string, mode: string = 'raw') {
  let bytes: Uint8Array;
  if (mode === 'hex') {
    bytes = hexToBytes(rawInput);
  } else if (mode === 'text') {
    bytes = textToBytes(rawInput);
  } else {
    bytes = escapedStringToBytes(rawInput);
  }
  return parseEscPos(bytes);
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
        version: '2.0.0 (Client-Side SW Engine)',
        serverlessMode: 'Service Worker Interceptor',
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
          stats: receiptData.stats,
          controlEvents: receiptData.controlEvents,
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

  // Intercept all /api/ or /render- requests in SW!
  if (url.pathname.includes('/api/') || url.pathname.includes('/render-receipt') || url.pathname.includes('/render-image')) {
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
