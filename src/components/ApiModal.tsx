import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code,
  Terminal,
  Cpu,
  Globe,
  Play,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  WrapText,
  BookOpen,
  Webhook,
  Send,
  ExternalLink,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { copyToClipboard } from '../lib/clipboard';
import { openApiSpec, getSwaggerHtml } from '../lib/openapi';

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawString: string;
  width: '58mm' | '80mm';
  initialTab?: MainTabType;
}

type MainTabType = 'playground' | 'swagger' | 'webhook' | 'snippets';
type CodeTabType = 'curl_post' | 'curl_get' | 'get_image' | 'webhook_curl' | 'nodejs' | 'python' | 'n8n';

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose, rawString, width, initialTab }) => {
  const [mainTab, setMainTab] = useState<MainTabType>(initialTab || 'playground');

  React.useEffect(() => {
    if (initialTab) {
      setMainTab(initialTab);
    }
  }, [initialTab]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<CodeTabType>('curl_post');
  const [isWordWrapped, setIsWordWrapped] = useState<boolean>(false);

  // Live Testing Studio State
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/render-receipt');
  const [selectedMethod, setSelectedMethod] = useState<'POST' | 'GET'>('POST');
  const [testMode, setTestMode] = useState<'raw' | 'text'>('raw');
  const [testWidth, setTestWidth] = useState<'58mm' | '80mm'>(width);
  const [customHeader, setCustomHeader] = useState<string>('Content-Type: application/json');
  const [customRequestBody, setCustomRequestBody] = useState<string>(
    JSON.stringify({ raw: rawString, mode: 'raw', width }, null, 2)
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    statusText: string;
    timeMs: number;
    contentType: string;
    data: any;
    endpoint: string;
  } | null>(null);
  const [testViewMode, setTestViewMode] = useState<'json' | 'svg' | 'html'>('json');

  // Outbound Webhook Test Dispatcher State
  const [outboundUrl, setOutboundUrl] = useState<string>('https://httpbin.org/post');
  const [outboundSecret, setOutboundSecret] = useState<string>('whsec_epoint_live_secret_987');
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<{
    id: string;
    timestamp: string;
    url: string;
    status: number;
    timeMs: number;
    success: boolean;
    response: string;
  }[]>([]);

  // Webhook Order Emulator Payload
  const [webhookOrderPayload, setWebhookOrderPayload] = useState<string>(
    JSON.stringify(
      {
        event: 'order.created',
        orderId: 'ORD-9821',
        storeName: 'EPOINT CAFE & BAKERY',
        customer: 'Sarah Connor',
        items: [
          { name: 'Iced Artisan Latte', qty: 2, price: 5.5 },
          { name: 'Almond Croissant', qty: 1, price: 4.2 },
          { name: 'Avocado Toast', qty: 1, price: 12.0 },
        ],
        total: 27.2,
        width: width,
      },
      null,
      2
    )
  );

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const encodedRaw = encodeURIComponent(rawString);

  const handleCopy = async (text: string, key: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownloadOpenApi = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(openApiSpec, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'openapi.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Run Live Playground Request
  const handleExecuteRequest = async () => {
    setIsTesting(true);
    const start = performance.now();
    try {
      let url = selectedEndpoint;
      let options: RequestInit = {
        method: selectedMethod,
        headers: {},
      };

      // Headers parsing
      if (customHeader.trim()) {
        const lines = customHeader.split('\n');
        lines.forEach((line) => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            (options.headers as Record<string, string>)[parts[0].trim()] = parts.slice(1).join(':').trim();
          }
        });
      }

      if (selectedMethod === 'POST') {
        options.body = customRequestBody;
      } else if (selectedEndpoint === '/api/render-receipt') {
        url = `${selectedEndpoint}?width=${testWidth}&mode=${testMode}&raw=${encodedRaw}`;
      } else if (selectedEndpoint === '/api/render-image') {
        url = `${selectedEndpoint}?width=${testWidth}&mode=${testMode}&raw=${encodedRaw}`;
      }

      const res = await fetch(url, options);
      const duration = Math.round(performance.now() - start);
      const contentType = res.headers.get('content-type') || '';

      let bodyData: any;
      if (contentType.includes('application/json')) {
        bodyData = await res.json();
      } else if (contentType.includes('image/svg') || contentType.includes('text/html')) {
        bodyData = await res.text();
      } else {
        bodyData = await res.text();
      }

      setTestResult({
        status: res.status,
        statusText: res.statusText || 'OK',
        timeMs: duration,
        contentType,
        data: bodyData,
        endpoint: selectedEndpoint,
      });

      if (contentType.includes('image/svg')) {
        setTestViewMode('svg');
      } else if (contentType.includes('text/html')) {
        setTestViewMode('html');
      } else {
        setTestViewMode('json');
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setTestResult({
        status: 500,
        statusText: 'Network Error',
        timeMs: duration,
        contentType: 'application/json',
        data: { error: err?.message || 'Failed to execute request' },
        endpoint: selectedEndpoint,
      });
      setTestViewMode('json');
    } finally {
      setIsTesting(false);
    }
  };

  // Dispatch Outbound Webhook Test
  const handleDispatchOutboundWebhook = async () => {
    if (!outboundUrl.trim()) return;
    setIsSendingWebhook(true);
    const start = performance.now();
    try {
      // First generate receipt payload
      const renderRes = await fetch('/api/render-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawString, width }),
      });
      const receiptData = await renderRes.json();

      const webhookPayload = {
        event: 'thermal_receipt.rendered',
        timestamp: new Date().toISOString(),
        secret: outboundSecret,
        receipt: receiptData,
      };

      const dispatchRes = await fetch(outboundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': outboundSecret,
          'User-Agent': 'Epoint-ESC-POS-Webhook-Engine/2.5',
        },
        body: JSON.stringify(webhookPayload),
      });

      const duration = Math.round(performance.now() - start);
      const resText = await dispatchRes.text();

      setWebhookLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          url: outboundUrl,
          status: dispatchRes.status,
          timeMs: duration,
          success: dispatchRes.ok,
          response: resText.substring(0, 300),
        },
        ...prev,
      ]);
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setWebhookLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          url: outboundUrl,
          status: 0,
          timeMs: duration,
          success: false,
          response: `Dispatch Error: ${err?.message || 'Failed to deliver webhook'}`,
        },
        ...prev,
      ]);
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Code Snippets
  const curlPostSnippet = `curl -X POST "${appUrl}/api/render-receipt" \\
  -H "Content-Type: application/json" \\
  -d '{
    "raw": ${JSON.stringify(rawString)},
    "mode": "raw",
    "width": "${width}"
  }'`;

  const curlGetSnippet = `curl -X GET "${appUrl}/api/render-receipt?width=${width}&raw=${encodedRaw}"`;

  const getImageSnippet = `# Direct SVG Vector Image Endpoint
curl -X GET "${appUrl}/api/render-image?width=${width}&raw=${encodedRaw}"

# Embed directly in HTML <img> tag:
<img src="${appUrl}/api/render-image?width=${width}&raw=${encodedRaw}" alt="Receipt Preview" />`;

  const webhookCurlSnippet = `# Webhook endpoint converts E-Commerce/POS JSON Orders directly to Receipt HTML/SVG
curl -X POST "${appUrl}/api/webhook" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: ${outboundSecret}" \\
  -d '${webhookOrderPayload}'`;

  const nodejsSnippet = `import fetch from 'node-fetch'; // Built-in in Node.js 18+

async function generateThermalReceipt() {
  const response = await fetch("${appUrl}/api/render-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: ${JSON.stringify(rawString)},
      mode: "raw",
      width: "${width}"
    })
  });

  const data = await response.json();
  console.log("Status Code:", response.status);
  console.log("SVG Vector Output:", data.svg);
}

generateThermalReceipt();`;

  const pythonSnippet = `import requests

url = "${appUrl}/api/render-receipt"
payload = {
    "raw": ${JSON.stringify(rawString)},
    "mode": "raw",
    "width": "${width}"
}

response = requests.post(url, json=payload)
data = response.json()

print("Status:", response.status_code)
print("SVG Output:", data.get("svg"))`;

  const n8nSnippet = `{
  "method": "POST",
  "url": "${appUrl}/api/render-receipt",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "raw": "={{ $json.rawEscPosString }}",
    "width": "${width}"
  }
}`;

  const getCurrentSnippet = () => {
    switch (codeTab) {
      case 'curl_post':
        return curlPostSnippet;
      case 'curl_get':
        return curlGetSnippet;
      case 'get_image':
        return getImageSnippet;
      case 'webhook_curl':
        return webhookCurlSnippet;
      case 'nodejs':
        return nodejsSnippet;
      case 'python':
        return pythonSnippet;
      case 'n8n':
        return n8nSnippet;
      default:
        return curlPostSnippet;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-5 animate-fadeIn">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  Developer API &amp; Integration Hub
                </h3>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] rounded-md border border-amber-500/20 uppercase tracking-wider">
                  v2.5 REST + OpenAPI + Webhooks
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                OpenAPI 3.0 specification, live API testing studio, automated webhook receivers &amp; outbound delivery testers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary Tab Bar */}
        <div className="px-6 bg-neutral-100/80 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'playground', label: 'Interactive Live Tester', icon: Play },
            { id: 'swagger', label: 'OpenAPI / Swagger UI', icon: BookOpen },
            { id: 'webhook', label: 'Webhook Emulator', icon: Webhook },
            { id: 'snippets', label: 'Code Snippets & SDKs', icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id as MainTabType)}
                className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-neutral-800 shadow-xs rounded-t-lg'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-neutral-900">
          {/* TAB 1: INTERACTIVE LIVE API TESTER */}
          {mainTab === 'playground' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <strong className="font-bold">Live Request Sandbox:</strong> Test endpoint execution live against the running Express backend or local Service Worker engine. Inspect real-time status codes, latency in milliseconds, response headers, and rendered output.
                </div>
              </div>

              {/* Endpoint & Method Selector Bar */}
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-white space-y-4 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Method
                    </label>
                    <select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value as any)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    >
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Mode
                    </label>
                    <select
                      value={testMode}
                      onChange={(e) => {
                        const m = e.target.value as 'raw' | 'text';
                        setTestMode(m);
                        setCustomRequestBody(
                          JSON.stringify({ raw: rawString, mode: m, width: testWidth }, null, 2)
                        );
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                    >
                      <option value="raw">raw</option>
                      <option value="text">text</option>
                    </select>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Target API Endpoint
                    </label>
                    <select
                      value={selectedEndpoint}
                      onChange={(e) => {
                        const ep = e.target.value;
                        setSelectedEndpoint(ep);
                        if (ep === '/api/health') setSelectedMethod('GET');
                        else if (ep === '/api/webhook') setSelectedMethod('POST');
                        else if (ep === '/api/render-receipt') setSelectedMethod('POST');
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="/api/render-receipt">/api/render-receipt (Full HTML + SVG)</option>
                      <option value="/api/render-image">/api/render-image (Direct SVG Vector)</option>
                      <option value="/api/webhook">/api/webhook (E-Commerce Receiver)</option>
                      <option value="/api/health">/api/health (API Status)</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <button
                      onClick={handleExecuteRequest}
                      disabled={isTesting}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      <span>Execute Request</span>
                    </button>
                  </div>
                </div>

                {/* Body & Parameter Configurator */}
                {selectedMethod === 'POST' && selectedEndpoint !== '/api/health' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-400 font-bold">Request Payload (JSON):</span>
                      <button
                        onClick={() =>
                          setCustomRequestBody(
                            JSON.stringify({ raw: rawString, mode: 'raw', width: testWidth }, null, 2)
                          )
                        }
                        className="text-amber-400 hover:underline text-[11px]"
                      >
                        Reset to Editor Input
                      </button>
                    </div>
                    <textarea
                      value={customRequestBody}
                      onChange={(e) => setCustomRequestBody(e.target.value)}
                      rows={5}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500/80 leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* Live Response Result Box */}
              {testResult && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-white space-y-3 animate-fadeIn shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-md font-mono font-bold text-xs ${
                          testResult.status >= 200 && testResult.status < 300
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        }`}
                      >
                        HTTP {testResult.status} {testResult.statusText}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        Latency: <strong className="text-amber-300">{testResult.timeMs} ms</strong>
                      </span>
                      <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
                        Type: <span className="text-neutral-300">{testResult.contentType || 'application/json'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                      <button
                        onClick={() => setTestViewMode('json')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                          testViewMode === 'json' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        JSON Data
                      </button>
                      <button
                        onClick={() => setTestViewMode('svg')}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                          testViewMode === 'svg' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        SVG Vector
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(
                            typeof testResult.data === 'string'
                              ? testResult.data
                              : JSON.stringify(testResult.data, null, 2),
                            'test_result'
                          )
                        }
                        className="px-2.5 py-1 text-[11px] font-bold rounded text-neutral-300 hover:text-white flex items-center gap-1"
                      >
                        {copiedKey === 'test_result' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedKey === 'test_result' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Body Viewer */}
                  <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-300 bg-black/60 p-3 rounded-lg border border-neutral-800">
                    {testViewMode === 'json' && (
                      <pre className="whitespace-pre-wrap break-all">
                        {typeof testResult.data === 'string'
                          ? testResult.data
                          : JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    )}
                    {testViewMode === 'svg' && (
                      <div className="flex flex-col items-center justify-center p-4 bg-stone-100 rounded-lg">
                        <div
                          dangerouslySetInnerHTML={{
                            __html:
                              typeof testResult.data === 'string'
                                ? testResult.data
                                : testResult.data?.svg || testResult.data?.receipt?.svg || '',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OPENAPI / SWAGGER UI */}
          {mainTab === 'swagger' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white">
                <div>
                  <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <BookOpen size={18} />
                    <span>OpenAPI 3.0.3 Specification &amp; Interactive Swagger UI</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Complete machine-readable REST API documentation. View schema definitions, parameters, and interactive Swagger interface at <code className="text-amber-300">/docs</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadOpenApi}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 border border-neutral-700"
                  >
                    <Download size={14} />
                    <span>download openapi.json</span>
                  </button>
                </div>
              </div>

              {/* Live Embedded Swagger UI Frame */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="px-4 py-2.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Globe size={14} />
                    <span>Interactive Swagger UI Explorer</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                    OpenAPI 3.0.3
                  </span>
                </div>
                <iframe
                  title="Swagger UI API Documentation"
                  srcDoc={getSwaggerHtml('/api/openapi.json')}
                  className="w-full h-[600px] border-0 bg-slate-900"
                />
              </div>

              {/* Endpoint Schema Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-200 dark:divide-neutral-800">
                {Object.entries(openApiSpec.paths).map(([pathKey, pathObj]: [string, any]) => (
                  <div key={pathKey} className="p-4 space-y-2 bg-neutral-50/50 dark:bg-neutral-950/40">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 bg-amber-500 text-black font-extrabold text-[11px] rounded uppercase font-mono">
                        {Object.keys(pathObj)[0].toUpperCase()}
                      </span>
                      <code className="text-xs font-mono font-bold text-neutral-900 dark:text-white">
                        {pathKey}
                      </code>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {pathObj[Object.keys(pathObj)[0]]?.summary} — {pathObj[Object.keys(pathObj)[0]]?.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Raw OpenAPI Spec Viewer */}
              <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-neutral-200 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800 pb-2">
                  <span className="font-bold">Raw openapi.json Specification Schema</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(openApiSpec, null, 2), 'openapi_spec')}
                    className="text-amber-400 hover:underline flex items-center gap-1 font-sans text-xs"
                  >
                    {copiedKey === 'openapi_spec' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey === 'openapi_spec' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="max-h-56 overflow-y-auto whitespace-pre text-neutral-300">
                  {JSON.stringify(openApiSpec, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: WEBHOOK INTEGRATION */}
          {mainTab === 'webhook' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold text-sm mb-1 text-amber-800 dark:text-amber-300">
                  <Webhook size={18} />
                  <span>Webhook Event Receiver &amp; Outbound Dispatcher</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  The <code className="font-mono font-bold text-amber-700 dark:text-amber-300">/api/webhook</code> endpoint converts order JSON payloads from platforms like Shopify, Stripe, Square, or custom POS into formatted thermal receipts automatically.
                </p>
              </div>

              {/* Webhook Payload Test & Outbound Dispatcher */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Receiver Test */}
                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-white space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Send size={14} />
                    <span>Incoming Webhook Receiver Test</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Post an order payload to <code className="text-white">/api/webhook</code> to test instant ESC/POS rendering:
                  </p>

                  <textarea
                    value={webhookOrderPayload}
                    onChange={(e) => setWebhookOrderPayload(e.target.value)}
                    rows={8}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-[11px] font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  />

                  <button
                    onClick={async () => {
                      setSelectedEndpoint('/api/webhook');
                      setSelectedMethod('POST');
                      setCustomRequestBody(webhookOrderPayload);
                      setMainTab('playground');
                      setTimeout(() => handleExecuteRequest(), 100);
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Play size={14} />
                    <span>Test Receiving Webhook in Playground</span>
                  </button>
                </div>

                {/* Outbound Dispatcher */}
                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-white space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Globe size={14} />
                    <span>Outbound Webhook Delivery Tester</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Test firing a rendered thermal receipt event to an external webhook URL or server:
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                        Destination Webhook Target URL
                      </label>
                      <input
                        type="url"
                        value={outboundUrl}
                        onChange={(e) => setOutboundUrl(e.target.value)}
                        placeholder="https://webhook.site/your-id"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                        X-Webhook-Secret Header
                      </label>
                      <input
                        type="text"
                        value={outboundSecret}
                        onChange={(e) => setOutboundSecret(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleDispatchOutboundWebhook}
                    disabled={isSendingWebhook}
                    className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-300 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingWebhook ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Dispatch Receipt Webhook</span>
                  </button>

                  {/* Webhook Delivery Log */}
                  {webhookLogs.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                      <span className="text-[10px] uppercase font-bold text-neutral-400">Dispatch Log:</span>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {webhookLogs.map((log) => (
                          <div
                            key={log.id}
                            className="bg-neutral-950 p-2 rounded text-[10px] font-mono flex items-center justify-between border border-neutral-800"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {log.success ? (
                                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                              ) : (
                                <AlertCircle size={12} className="text-red-400 shrink-0" />
                              )}
                              <span className="text-neutral-300 truncate">{log.url}</span>
                            </div>
                            <span className="text-amber-400 font-bold shrink-0 ml-2">{log.timeMs}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CODE SNIPPETS & AUTOMATION */}
          {mainTab === 'snippets' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Target Element ID Info */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs mb-1">
                  <Code size={15} />
                  <span>Fixed DOM Target Selector IDs for Scraping &amp; Automation</span>
                </div>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed mb-2">
                  Use fixed element selectors <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1 rounded">id="receipt-paper"</code> and <code className="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1 rounded">id="receipt-container"</code> for headless browser testing or DOM scraping.
                </p>
              </div>

              {/* Code Snippets Sub-navigation Tabs */}
              <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-1 overflow-x-auto">
                {[
                  { id: 'curl_post', label: 'cURL (POST JSON)', icon: Terminal },
                  { id: 'curl_get', label: 'cURL (GET)', icon: Globe },
                  { id: 'get_image', label: 'SVG Vector URL', icon: ImageIcon },
                  { id: 'webhook_curl', label: 'Webhook Order Payload', icon: Webhook },
                  { id: 'nodejs', label: 'Node.js Script', icon: Code },
                  { id: 'python', label: 'Python Requests', icon: Code },
                  { id: 'n8n', label: 'n8n / Zapier Workflow', icon: Cpu },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setCodeTab(tab.id as CodeTabType)}
                      className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                        codeTab === tab.id
                          ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                          : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Code Block Box */}
              <div className="bg-neutral-900 text-neutral-100 rounded-xl border border-neutral-800 flex flex-col overflow-hidden shadow-inner">
                <div className="p-4 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto text-neutral-200">
                  <pre className={isWordWrapped ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'}>
                    {getCurrentSnippet()}
                  </pre>
                </div>

                <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 font-mono tracking-wider">
                    Format: <strong className="text-amber-400">{codeTab.toUpperCase()}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsWordWrapped(!isWordWrapped)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                        isWordWrapped
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                      }`}
                    >
                      <WrapText size={13} />
                      <span>{isWordWrapped ? 'Wrap: On' : 'Wrap: Off'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(getCurrentSnippet(), codeTab)}
                      className="px-3.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold rounded text-[11px] flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      {copiedKey === codeTab ? <Check size={13} className="text-black" /> : <Copy size={13} />}
                      <span>{copiedKey === codeTab ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <span className="text-neutral-500 dark:text-neutral-400 font-mono text-[11px]">
            API Base: <strong className="text-amber-500">/api/render-receipt</strong> | Docs: <strong className="text-amber-500">/docs</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
