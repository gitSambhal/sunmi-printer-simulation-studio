import express from 'express';
import path from 'path';
import { parseEscPos, escapedStringToBytes, textToBytes } from './src/lib/escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './src/lib/renderHtml';
import { openApiSpec, getSwaggerHtml } from './src/lib/openapi';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: ['text/*', 'plain/*', 'application/x-www-form-urlencoded'] }));

// CORS headers for automation integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Webhook-Secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper parser handler
const parsePayloadToReceipt = (rawInput: string, mode: string = 'raw') => {
  let bytes: Uint8Array;
  if (mode === 'text') {
    bytes = textToBytes(rawInput);
  } else {
    bytes = escapedStringToBytes(rawInput);
  }
  return parseEscPos(bytes);
};

// Helper: Convert Webhook Order JSON into ESC/POS Command string
const convertWebhookOrderToEscPos = (body: any) => {
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
};

// API Health Check
const handleHealth = (req: any, res: any) => {
  res.json({
    status: 'ok',
    service: 'ESC/POS Receipt Generator API',
    version: '2.5.0',
    endpoints: ['/api/health', '/api/render-receipt', '/api/render-image', '/api/webhook', '/api/openapi.json', '/api/docs']
  });
};

// OpenAPI Spec & Swagger Docs
const handleOpenApiSpec = (req: any, res: any) => {
  res.json(openApiSpec);
};

const handleSwaggerDocs = (req: any, res: any) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getSwaggerHtml('/api/openapi.json'));
};

// Webhook Receiver Endpoint
const handleWebhook = (req: any, res: any) => {
  try {
    let rawString = '';
    let mode = 'raw';
    let width = '80mm';

    if (req.body && typeof req.body === 'object') {
      if (req.body.raw || req.body.text) {
        rawString = req.body.raw || req.body.text;
      } else {
        rawString = convertWebhookOrderToEscPos(req.body);
      }
      mode = req.body.mode ?? mode;
      width = req.body.width ?? width;
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed.raw || parsed.text) {
          rawString = parsed.raw || parsed.text;
        } else {
          rawString = convertWebhookOrderToEscPos(parsed);
        }
      } catch {
        rawString = req.body;
      }
    }

    if (!rawString) {
      rawString = convertWebhookOrderToEscPos({ event: 'order.created', storeName: 'Epoint Cafe', items: [{ name: 'Test Coffee', qty: 1, price: 4.50 }] });
    }

    const receiptData = parsePayloadToReceipt(rawString, mode);
    const widthVal = width === '58mm' ? '58mm' : '80mm';
    const html = renderReceiptToHtml(receiptData, { width: widthVal, theme: 'light' });
    const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: 'light' });

    return res.json({
      success: true,
      event: req.body?.event || 'webhook_received',
      timestamp: new Date().toISOString(),
      orderId: req.body?.orderId || req.body?.id || 'ORD-WEBHOOK',
      width: widthVal,
      receipt: {
        html,
        svg,
        stats: receiptData.stats,
        controlEvents: receiptData.controlEvents,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process webhook event', details: err?.message });
  }
};

// GET or POST /api/render-receipt -> Returns JSON with HTML, SVG, stats, and controlEvents
const handleRenderReceipt = (req: any, res: any) => {
  try {
    let rawString = '';
    let mode = 'raw';
    let width = '80mm';
    let theme = 'light';

    if (req.method === 'POST') {
      if (typeof req.body === 'string') {
        try {
          const parsedJson = JSON.parse(req.body);
          rawString = parsedJson.raw ?? parsedJson.text ?? req.body;
          mode = parsedJson.mode ?? mode;
          width = parsedJson.width ?? width;
          theme = parsedJson.theme ?? theme;
        } catch {
          rawString = req.body;
        }
      } else if (req.body && typeof req.body === 'object') {
        rawString = req.body.raw ?? req.body.text ?? '';
        mode = req.body.mode ?? mode;
        width = req.body.width ?? width;
        theme = req.body.theme ?? theme;
      }
    }

    if (!rawString) {
      rawString = (req.query?.raw as string) || (req.query?.text as string) || '';
      mode = (req.query?.mode as string) || mode;
      width = (req.query?.width as string) || width;
      theme = (req.query?.theme as string) || theme;
    }

    if (!rawString) {
      rawString = "Epoint Store Test\n--------------------------------\nSample ESC/POS Receipt\nItem 1                     $10.00\nItem 2                      $5.00\n--------------------------------\nTotal                      $15.00\nThank You!\n";
    }

    const receiptData = parsePayloadToReceipt(rawString, mode);
    const widthVal = width === '58mm' ? '58mm' : '80mm';
    const themeVal: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';

    const html = renderReceiptToHtml(receiptData, { width: widthVal, theme: themeVal });
    const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: themeVal });

    return res.json({
      success: true,
      width: widthVal,
      html,
      svg,
      stats: receiptData.stats,
      controlEvents: receiptData.controlEvents,
    });
  } catch (err: any) {
    console.error('Error rendering receipt API:', err);
    return res.status(500).json({ error: 'Failed to process receipt input', details: err?.message });
  }
};

// GET or POST /api/render-image -> Returns direct image/svg+xml or JSON image representation
const handleRenderImage = (req: any, res: any) => {
  try {
    let rawString = '';
    let mode = 'raw';
    let width = '80mm';
    let format = 'svg';

    if (req.method === 'POST') {
      if (typeof req.body === 'string') {
        try {
          const parsedJson = JSON.parse(req.body);
          rawString = parsedJson.raw ?? parsedJson.text ?? req.body;
          mode = parsedJson.mode ?? mode;
          width = parsedJson.width ?? width;
          format = parsedJson.format ?? format;
        } catch {
          rawString = req.body;
        }
      } else if (req.body && typeof req.body === 'object') {
        rawString = req.body.raw ?? req.body.text ?? '';
        mode = req.body.mode ?? mode;
        width = req.body.width ?? width;
        format = req.body.format ?? format;
      }
    }

    if (!rawString) {
      rawString = (req.query?.raw as string) || (req.query?.text as string) || '';
      mode = (req.query?.mode as string) || mode;
      width = (req.query?.width as string) || width;
      format = (req.query?.format as string) || format;
    }

    if (!rawString) {
      rawString = "Epoint Store Test\n--------------------------------\nSample ESC/POS Receipt\nItem 1                     $10.00\nItem 2                      $5.00\n--------------------------------\nTotal                      $15.00\nThank You!\n";
    }
    
    const receiptData = parsePayloadToReceipt(rawString, mode);
    const widthVal = width === '58mm' ? '58mm' : '80mm';
    const svg = renderReceiptToSvg(receiptData, { width: widthVal });

    if (format === 'json') {
      return res.json({
        success: true,
        svg,
        dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      });
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(svg);
  } catch (err: any) {
    return res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="50" fill="red">Error: ${err?.message}</text></svg>`);
  }
};

// Mount multi-path API endpoints for maximum curl, automation, and client router compatibility
app.use('/api/health', handleHealth);
app.use('/health', handleHealth);

app.use('/api/openapi.json', handleOpenApiSpec);
app.use('/openapi.json', handleOpenApiSpec);

app.use('/api/docs', handleSwaggerDocs);
app.use('/docs', handleSwaggerDocs);

app.use('/api/webhook', handleWebhook);
app.use('/webhook', handleWebhook);

app.use('/api/render-receipt', handleRenderReceipt);
app.use('/render-receipt', handleRenderReceipt);

app.use('/api/render-image', handleRenderImage);
app.use('/render-image', handleRenderImage);

async function startServer() {
  const PORT = 3000;

  // Vite development or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunmi Printer Simulation Studio App & API running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
