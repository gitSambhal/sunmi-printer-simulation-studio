import express from 'express';
import path from 'path';
import { parseEscPos, escapedStringToBytes, textToBytes, hexToBytes } from './src/lib/escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './src/lib/renderHtml';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: ['text/*', 'plain/*', 'application/x-www-form-urlencoded'] }));

// CORS headers for automation integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Helper parser handler
const parsePayloadToReceipt = (rawInput: string, mode: string = 'raw') => {
  let bytes: Uint8Array;
  if (mode === 'hex') {
    bytes = hexToBytes(rawInput);
  } else if (mode === 'text') {
    bytes = textToBytes(rawInput);
  } else {
    bytes = escapedStringToBytes(rawInput);
  }
  return parseEscPos(bytes);
};

// API Health Check
const handleHealth = (req: any, res: any) => {
  res.json({
    status: 'ok',
    service: 'ESC/POS Receipt Generator API',
    version: '2.0.0',
    endpoints: ['/api/health', '/api/render-receipt', '/api/render-image']
  });
};

// GET or POST /api/render-receipt -> Returns JSON with HTML, SVG, stats, and controlEvents (lines removed)
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

    const receiptData = parsePayloadToReceipt(rawString, mode);
    const widthVal = width === '58mm' ? '58mm' : '80mm';

    const html = renderReceiptToHtml(receiptData, { width: widthVal, theme });
    const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme });

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

// Mount multi-path API endpoints for maximum curl and client router compatibility
app.all(['/api/health', '/health'], handleHealth);
app.all(['/api/render-receipt', '/render-receipt'], handleRenderReceipt);
app.all(['/api/render-image', '/render-image'], handleRenderImage);

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
