# ESC/POS Thermal Receipt Visualizer & Renderer API

An interactive thermal printer preview emulator and high-performance ESC/POS receipt rendering engine for POS (Point of Sale), automation workflows, webhook integrations, and client/server applications.

---

## 🚀 Key Features

- **Real-time ESC/POS Visualizer**: Emulates 80mm and 58mm thermal printers with live feed animations and automatic guillotine cut displays.
- **Full ESC/POS Command Parsing**: Supports text formatting (bold, underline, double width/height, reverse text), alignment (left, center, right), red print commands, barcodes (JAN13, JAN8, CODE39, ITF, CODABAR, CODE93, CODE128), QR codes, cut commands (`GS V`), and cash drawer kick pulses (`ESC p`).
- **REST API & Direct SVG Engine**: Generates clean HTML, JSON metadata, and standalone vector SVG receipts.
- **Client & Server Unified Architecture**: Works both as an Express server backend for automation tools (`curl`, Postman, Python, Node.js) and client-side (Service Worker + local fetch interceptor) for standalone browser deployment.

---

## 📡 API Reference & Endpoints

All endpoints support both **GET** and **POST** requests, and accept payload input via JSON body, URL query parameters, or raw plain text body (`Content-Type: text/plain`).

### 1. Health Check

Verifies server status and listed endpoints.

- **Endpoint**: `/api/health` or `/health`
- **Method**: `GET`

**Example Response**:
```json
{
  "status": "ok",
  "service": "ESC/POS Receipt Generator API",
  "version": "2.0.0",
  "endpoints": [
    "/api/health",
    "/api/render-receipt",
    "/api/render-image"
  ]
}
```

---

### 2. Render Receipt (JSON Response)

Parses ESC/POS binary or raw text commands and returns structured JSON with rendered HTML markup, vector SVG, printer statistics, and control events.

- **Endpoint**: `/api/render-receipt` or `/render-receipt`
- **Methods**: `GET` | `POST`

#### Parameters

| Parameter | Type | Options / Default | Description |
| :--- | :--- | :--- | :--- |
| `raw` / `text` | `string` | *(Required)* | The ESC/POS input payload. Can contain escape sequences (e.g. `\x1b\x45\x01`), hex string, or plain text. |
| `mode` | `string` | `"raw"` (default), `"hex"`, `"text"` | Parsing mode. `"raw"` processes byte escapes (`\x1b`, `\x1d`), `"hex"` processes raw hex pairs (`1b4501`), `"text"` treats input as plain text. |
| `width` | `string` | `"80mm"` (default), `"58mm"` | Receipt paper width specification. |
| `theme` | `string` | `"light"` (default), `"dark"` | Aesthetic color theme for output HTML/SVG. |

#### Example JSON Response

```json
{
  "success": true,
  "width": "80mm",
  "html": "<div class=\"receipt-container\">...</div>",
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"384\" height=\"420\">...</svg>",
  "stats": {
    "characterCount": 182,
    "lineCount": 12,
    "cutCount": 1,
    "barcodeCount": 1,
    "qrCount": 0,
    "hasCashDrawerPulse": true,
    "redSpanCount": 0,
    "reverseSpanCount": 0
  },
  "controlEvents": [
    {
      "type": "CASH_DRAWER_PULSE",
      "pin": "pin2",
      "onTimeMs": 50,
      "offTimeMs": 500,
      "description": "Drawer kick pulse sent to Pin 2 (50ms on / 500ms off)"
    },
    {
      "type": "CUT",
      "mode": "partial",
      "description": "Partial Paper Cut (GS V)"
    }
  ]
}
```

---

### 3. Render Receipt Image / SVG

Generates a direct image output or JSON data URL suitable for `<img>` tags, PDF export, or instant browser preview.

- **Endpoint**: `/api/render-image` or `/render-image`
- **Methods**: `GET` | `POST`

#### Parameters

| Parameter | Type | Options / Default | Description |
| :--- | :--- | :--- | :--- |
| `raw` / `text` | `string` | *(Optional)* | ESC/POS input string or hex payload. |
| `mode` | `string` | `"raw"` (default), `"hex"`, `"text"` | Input parser mode. |
| `width` | `string` | `"80mm"` (default), `"58mm"` | Paper width. |
| `format` | `string` | `"svg"` (default), `"json"` | Returns `image/svg+xml` directly when `"svg"`, or a JSON payload containing SVG and Base64 Data URL when `"json"`. |

---

## 💻 Automation & cURL Examples

### cURL GET JSON Receipt
```bash
curl "http://localhost:3000/api/render-receipt?width=80mm&text=Epoint%20Store%0A--------------------------------%0ASample%20Receipt%0AItem%201%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%2410.00%0ATotal%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%2410.00"
```

### cURL POST JSON Payload (ESC/POS Control Escapes)
```bash
curl -X POST http://localhost:3000/api/render-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "raw": "\\x1b\\x40\\x1b\\x61\\x01\\x1b\\x45\\x01EPOINT STORE\\x1b\\x45\\x00\\n--------------------------------\\nItem A                   $25.00\\n\\x1d\\x56\\x41\\x00",
    "width": "80mm",
    "mode": "raw"
  }'
```

### cURL GET Direct SVG Image
```bash
curl "http://localhost:3000/api/render-image?width=80mm&text=Epoint%20Store%20Test" -o receipt.svg
```

### Python Integration Example
```python
import requests

url = "http://localhost:3000/api/render-receipt"
payload = {
    "raw": "\x1b\x61\x01EPOINT STORE TEST\n\x1b\x61\x00Item 1             $10.00\n\x1d\x56\x00",
    "width": "80mm",
    "mode": "raw"
}

response = requests.post(url, json=payload)
data = response.json()
print("Generated SVG:", data.get("svg"))
```

---

## 🛠️ Local Development & Execution

### Running with Docker Compose (Recommended)
```bash
# Build image and start container locally
docker compose up --build -d

# View live application logs
docker compose logs -f

# Stop container
docker compose down
```

### Running with Docker CLI directly
```bash
# Build Docker image
docker build -t escpos-renderer .

# Run container on port 3000
docker run -p 3000:3000 escpos-renderer
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

The Express server binds to `0.0.0.0:3000` with CORS enabled for seamless integration across all automation platforms.
