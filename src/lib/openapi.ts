export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ESC/POS Thermal Receipt Generator & Visualizer API',
    description: 'High-performance ESC/POS thermal receipt rendering engine. Parses raw binary ESC/POS escape sequences, text formatting, and reverse printing mode into HTML, SVG, and structured JSON.',
    version: '2.5.0',
    contact: {
      name: 'Suhail Akhtar',
      url: 'https://suhail.top',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Relative API Base Path',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Local Express Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'API Health Check',
        description: 'Verifies server status, service availability, and version details.',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'API is healthy and operational',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'ESC/POS Receipt Generator API' },
                    version: { type: 'string', example: '2.5.0' },
                    endpoints: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['/api/health', '/api/render-receipt', '/api/render-image', '/api/webhook'],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/render-receipt': {
      post: {
        summary: 'Render ESC/POS to JSON (HTML + SVG + Stats)',
        description: 'Parses raw ESC/POS commands or plain text and returns rendered HTML markup, standalone vector SVG, line statistics, and hardware control events.',
        operationId: 'renderReceipt',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ReceiptRequest',
              },
            },
            'text/plain': {
              schema: {
                type: 'string',
                example: '\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 EPOINT STORE \\x1d\\x42\\x00\\nItem 1  $10.00\\n\\x1d\\x56\\x00',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Receipt rendered successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReceiptResponse',
                },
              },
            },
          },
          '500': {
            description: 'Failed to process receipt payload',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
      get: {
        summary: 'Render Receipt via Query Parameters',
        description: 'Renders receipt using URL query string parameters for quick cURL tests and GET integrations.',
        operationId: 'renderReceiptGet',
        parameters: [
          { name: 'raw', in: 'query', schema: { type: 'string' }, description: 'ESC/POS raw escaped string' },
          { name: 'text', in: 'query', schema: { type: 'string' }, description: 'Plain text string' },
          { name: 'width', in: 'query', schema: { type: 'string', enum: ['80mm', '58mm'], default: '80mm' } },
          { name: 'mode', in: 'query', schema: { type: 'string', enum: ['raw', 'text'], default: 'raw' } },
          { name: 'theme', in: 'query', schema: { type: 'string', enum: ['light', 'dark'], default: 'light' } },
        ],
        responses: {
          '200': {
            description: 'Receipt rendered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReceiptResponse' },
              },
            },
          },
        },
      },
    },
    '/render-image': {
      get: {
        summary: 'Render Receipt as Vector SVG Image',
        description: 'Generates direct image/svg+xml or JSON payload with base64 data URL for direct embedding in <img> tags or HTML previews.',
        operationId: 'renderImage',
        parameters: [
          { name: 'raw', in: 'query', schema: { type: 'string' } },
          { name: 'text', in: 'query', schema: { type: 'string' } },
          { name: 'width', in: 'query', schema: { type: 'string', enum: ['80mm', '58mm'], default: '80mm' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['svg', 'json'], default: 'svg' } },
        ],
        responses: {
          '200': {
            description: 'Returns SVG XML image or JSON image object',
            content: {
              'image/svg+xml': {
                schema: { type: 'string', format: 'binary' },
              },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    svg: { type: 'string' },
                    dataUrl: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/webhook': {
      post: {
        summary: 'Receive E-Commerce or POS Webhook & Convert to Thermal Receipt',
        description: 'Accepts incoming order webhooks from Shopify, Stripe, Square, or custom POS systems and automatically compiles structured JSON orders or raw ESC/POS commands into thermal receipts.',
        operationId: 'receiveWebhook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookPayload',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook processed and receipt generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    event: { type: 'string', example: 'webhook_received' },
                    timestamp: { type: 'string', example: '2026-08-07T04:18:00.000Z' },
                    orderId: { type: 'string', example: 'ORD-8821' },
                    receipt: { $ref: '#/components/schemas/ReceiptResponse' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ReceiptRequest: {
        type: 'object',
        properties: {
          raw: { type: 'string', description: 'Raw ESC/POS command string with escape codes', example: '\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 EPOINT STORE \\x1d\\x42\\x00\\nItem 1  $10.00\\n\\x1d\\x56\\x00' },
          text: { type: 'string', description: 'Plain text fallback if raw is not provided' },
          mode: { type: 'string', enum: ['raw', 'text'], default: 'raw' },
          width: { type: 'string', enum: ['80mm', '58mm'], default: '80mm' },
          theme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
        },
      },
      ReceiptResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          width: { type: 'string', example: '80mm' },
          html: { type: 'string', description: 'Rendered DOM HTML string' },
          svg: { type: 'string', description: 'Standalone vector SVG markup' },
        },
      },
      WebhookPayload: {
        type: 'object',
        properties: {
          event: { type: 'string', example: 'order.created' },
          orderId: { type: 'string', example: 'ORD-9912' },
          storeName: { type: 'string', example: 'Epoint Cafe' },
          customer: { type: 'string', example: 'Jane Doe' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Cappuccino' },
                qty: { type: 'number', example: 2 },
                price: { type: 'number', example: 4.5 },
              },
            },
          },
          total: { type: 'number', example: 9.0 },
          raw: { type: 'string', description: 'Optional explicit ESC/POS binary or text commands' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Failed to process receipt input' },
          details: { type: 'string', example: 'Invalid byte string' },
        },
      },
    },
  },
};

// Generates direct Swagger UI HTML page
export function getSwaggerHtml(specUrl = '/api/openapi.json') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ESC/POS Receipt Generator API Docs - Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { filter: invert(0.88) hue-rotate(180deg); max-width: 1200px; margin: 0 auto; padding: 20px; }
    .swagger-ui .info { margin: 20px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = function() {
      const specObj = ${JSON.stringify(openApiSpec)};
      window.ui = SwaggerUIBundle({
        spec: specObj,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}
