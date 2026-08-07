# Sunmi Printer Simulator & ESC/POS Receipt Visualizer

An interactive Sunmi thermal printer preview simulator and high-performance ESC/POS receipt rendering engine for POS (Point of Sale), automation workflows, webhook integrations, and client/server applications.

---

## 🚀 Key Features

- **Real-time ESC/POS Visualizer**: Emulates 80mm and 58mm thermal printers with live feed animations, interactive 3D Sunmi printer simulator, and automatic guillotine cut displays.
- **OpenAPI 3.0 & Interactive Swagger UI**: Built-in interactive Swagger UI endpoint at `/docs` and raw OpenAPI schema at `/api/openapi.json`.
- **E-Commerce & POS Webhook Integration**: Dedicated `/api/webhook` endpoint converts JSON orders (from Shopify, Stripe, Square, or custom POS) directly into formatted thermal receipts.
- **Interactive Live API Testing Studio**: Built-in REST API playground with custom header controls, real-time response latency timer in milliseconds, JSON/SVG response viewers, and outbound webhook delivery testing.
- **Full ESC/POS Command Parsing**:
  - **Text Formatting**: Bold (`ESC E`), Underline (`ESC -`), Double Width/Height (`GS !`), Reverse Mode / Inverted White-on-Black (`GS B`, `ESC {`), Red Print (`ESC r`).
  - **Alignment**: Left, Center, Right (`ESC a`).
  - **Barcodes**: JAN13 (EAN13), JAN8 (EAN8), CODE39, ITF, CODABAR, CODE93, CODE128 (`GS k`).
  - **QR Codes**: Model 2 QR Code generation (`GS ( k`).
  - **Hardware Controls**: Automatic paper cut detection (`GS V`), cash drawer kick pulse triggers (`ESC p`), and buzzer alerts (`ESC B`).
- **REST API & SVG Engine**: Generates clean HTML, structured JSON metadata, and standalone vector SVG receipts.
- **Client & Server Unified Architecture**: Works both as an Express server backend for automation tools (`curl`, Postman, Python, Node.js) and client-side (Service Worker + local fetch interceptor) for standalone browser deployment.

---

## 📖 OpenAPI 3.0 & Swagger UI Documentation

- **Interactive Swagger UI**: Navigate to `http://localhost:3000/docs` or click **API / Swagger / Webhooks** in the UI to open the interactive documentation.
- **OpenAPI JSON Spec**: Fetch machine-readable schema at `http://localhost:3000/api/openapi.json`.

---

## 📡 API Reference & Endpoints

All endpoints support both **GET** and **POST** requests, and accept payload input via JSON body, URL query parameters, or raw plain text body (`Content-Type: text/plain`).

### 1. Health Check

Verifies server status, engine version, and available endpoints.

- **Endpoint**: `/api/health` or `/health`
- **Method**: `GET`

**Example Response**:
```json
{
  "status": "ok",
  "service": "ESC/POS Receipt Generator API",
  "version": "2.5.0",
  "endpoints": [
    "/api/health",
    "/api/render-receipt",
    "/api/render-image",
    "/api/webhook",
    "/api/openapi.json",
    "/api/docs"
  ]
}
```

---

### 2. Webhook Receiver Endpoint

Accepts incoming order webhooks from e-commerce platforms or POS systems and automatically compiles them into thermal receipts.

- **Endpoint**: `/api/webhook` or `/webhook`
- **Method**: `POST`

**Example Payload**:
```json
{
  "event": "order.created",
  "orderId": "ORD-9821",
  "storeName": "EPOINT CAFE",
  "customer": "Sarah Connor",
  "items": [
    { "name": "Iced Artisan Latte", "qty": 2, "price": 5.50 },
    { "name": "Avocado Toast", "qty": 1, "price": 12.00 }
  ],
  "total": 23.00,
  "width": "80mm"
}
```

**Example Response**:
```json
{
  "success": true,
  "event": "order.created",
  "timestamp": "2026-08-07T04:18:00.000Z",
  "orderId": "ORD-9821",
  "receipt": {
    "html": "<div class=\"receipt-container\">...</div>",
    "svg": "<svg ...>...</svg>",
    "stats": { "lineCount": 10, "cutCount": 1 }
  }
}
```

---

### 3. Render Receipt (JSON Response)

Parses ESC/POS binary or raw text commands and returns structured JSON with rendered HTML markup, vector SVG, printer statistics, and control events.

- **Endpoint**: `/api/render-receipt` or `/render-receipt`
- **Methods**: `GET` | `POST`

#### Parameters

| Parameter | Type | Options / Default | Description |
| :--- | :--- | :--- | :--- |
| `raw` / `text` | `string` | *(Required)* | The ESC/POS input payload. Can contain escape sequences (e.g. `\x1b\x45\x01`) or plain text. |
| `mode` | `string` | `"raw"` (default), `"text"` | Parsing mode. `"raw"` processes byte escapes (`\x1b`, `\x1d`), `"text"` treats input as plain text. |
| `width` | `string` | `"80mm"` (default), `"58mm"` | Receipt paper width specification. |
| `theme` | `string` | `"light"` (default), `"dark"` | Aesthetic color theme for output HTML/SVG. |

---

### 4. Render Receipt Image / SVG

Generates direct image output or JSON data URL suitable for `<img>` tags, PDF export, or instant browser preview.

- **Endpoint**: `/api/render-image` or `/render-image`
- **Methods**: `GET` | `POST`

---

## 💻 Automation & cURL Examples

### cURL POST JSON Payload with Reverse Text & Cut
```bash
curl -X POST http://localhost:3000/api/render-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "raw": "\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 EPOINT STORE \\x1d\\x42\\x00\\n--------------------------------\\nItem A                   $25.00\\n\\x1d\\x56\\x41\\x00",
    "width": "80mm",
    "mode": "raw"
  }'
```

### cURL Webhook Order Post
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.created",
    "storeName": "Epoint Store",
    "items": [{ "name": "Latte", "qty": 1, "price": 4.50 }]
  }'
```

---

## 🛠️ Local Development & Execution

### Running with Docker Compose (Recommended)

Uses the optimized `sunmi-printer-simulator:latest` image definition:

```bash
# Build image and start container locally
docker compose up --build -d

# View live application logs
docker compose logs -f

# Stop container
docker compose down
```

### Running with Node.js

```bash
# Install dependencies
npm install

# Development Mode (TSX Express + Vite)
npm run dev

# Production Build & Execution
npm run build
npm start
```
