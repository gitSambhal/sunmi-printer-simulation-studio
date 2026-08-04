import express from 'express';
import path from 'path';
import { parseEscPos, escapedStringToBytes, textToBytes, hexToBytes } from './src/lib/escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './src/lib/renderHtml';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers for automation integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
  res.json({ status: 'ok', service: 'ESC/POS Receipt Generator API', version: '1.0.0' });
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// GET or POST /api/render-receipt -> Returns JSON with HTML, SVG, stats, and parsed structure
const handleRenderReceipt = (req: any, res: any) => {
  try {
    const raw = req.method === 'POST' ? req.body?.raw : req.query?.raw;
    const mode = (req.method === 'POST' ? req.body?.mode : req.query?.mode) || 'raw';
    const width = (req.method === 'POST' ? req.body?.width : req.query?.width) || '80mm';
    const theme = (req.method === 'POST' ? req.body?.theme : req.query?.theme) || 'light';

    const rawString = typeof raw === 'string' ? raw : (req.body?.text || req.query?.text || '');

    if (!rawString && req.method === 'POST') {
      return res.status(400).json({ error: 'Field "raw" is required in request body' });
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
      lines: receiptData.lines,
    });
  } catch (err: any) {
    console.error('Error rendering receipt API:', err);
    return res.status(500).json({ error: 'Failed to process receipt input', details: err?.message });
  }
};

app.get('/api/render-receipt', handleRenderReceipt);
app.post('/api/render-receipt', handleRenderReceipt);
app.get('/render-receipt', handleRenderReceipt);
app.post('/render-receipt', handleRenderReceipt);

// GET or POST /api/render-image -> Returns direct image/svg+xml or JSON image representation
const handleRenderImage = (req: any, res: any) => {
  try {
    const raw = req.method === 'POST' ? req.body?.raw : req.query?.raw;
    const mode = req.method === 'POST' ? req.body?.mode : req.query?.mode;
    const width = req.method === 'POST' ? req.body?.width : req.query?.width;
    const format = (req.method === 'POST' ? req.body?.format : req.query?.format) || 'svg';

    const rawString = typeof raw === 'string' ? raw : (req.body?.text || req.query?.text || '');
    
    const receiptData = parsePayloadToReceipt(rawString, mode || 'raw');
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

app.get('/api/render-image', handleRenderImage);
app.post('/api/render-image', handleRenderImage);
app.get('/render-image', handleRenderImage);
app.post('/render-image', handleRenderImage);

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
