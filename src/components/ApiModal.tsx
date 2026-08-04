import React, { useState } from 'react';
import { X, Copy, Check, Code, Terminal, Cpu, Globe, Play, Loader2, Sparkles, Image as ImageIcon, WrapText } from 'lucide-react';

interface ApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawString: string;
  width: '58mm' | '80mm';
}

type TabType = 'curl_post' | 'curl_get' | 'get_image' | 'nodejs' | 'python' | 'n8n';

export const ApiModal: React.FC<ApiModalProps> = ({ isOpen, onClose, rawString, width }) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('curl_post');
  const [isWordWrapped, setIsWordWrapped] = useState<boolean>(false);
  
  // Interactive "Try Now" state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    timeMs: number;
    contentType: string;
    data: any;
    mode: 'post_receipt' | 'get_image';
  } | null>(null);
  const [testViewMode, setTestViewMode] = useState<'json' | 'svg' | 'html'>('json');

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const encodedRaw = encodeURIComponent(rawString);

  // Snippets
  const curlPostSnippet = `curl -X POST "${appUrl}/api/render-receipt" \\
  -H "Content-Type: application/json" \\
  -d '{
    "raw": ${JSON.stringify(rawString)},
    "mode": "raw",
    "width": "${width}"
  }'`;

  const curlGetSnippet = `curl -X GET "${appUrl}/api/render-receipt?width=${width}&raw=${encodedRaw}"`;

  const getImageSnippet = `# Returns direct image/svg+xml payload
curl -X GET "${appUrl}/api/render-image?width=${width}&raw=${encodedRaw}"

# Or use directly in <img> tag:
<img src="${appUrl}/api/render-image?width=${width}&raw=${encodedRaw}" alt="Thermal Receipt" />`;

  const nodejsSnippet = `// Node.js (ESM / CommonJS with native fetch)
import fetch from 'node-fetch'; // Native in Node.js 18+

async function renderReceipt() {
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
  console.log("Status:", response.status);
  console.log("Parsed Lines Count:", data.lines?.length);
  console.log("SVG Vector Output:", data.svg);
}

renderReceipt();`;

  const pythonSnippet = `import requests

# POST request to obtain JSON with HTML and SVG string
url = "${appUrl}/api/render-receipt"
payload = {
    "raw": ${JSON.stringify(rawString)},
    "mode": "raw",
    "width": "${width}"
}

response = requests.post(url, json=payload)
data = response.json()

print("Status:", response.status_code)
print("Parsed Lines Count:", len(data.get("lines", [])))
print("SVG Vector Output:", data.get("svg"))`;

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

  const htmlDivSnippet = `<div id="receipt-container" data-receipt-width="${width}">
  <div id="receipt-paper" data-receipt-preview="true">
    <!-- Rendered receipt content here -->
  </div>
</div>`;

  const getCurrentSnippet = () => {
    switch (activeTab) {
      case 'curl_post':
        return curlPostSnippet;
      case 'curl_get':
        return curlGetSnippet;
      case 'get_image':
        return getImageSnippet;
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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(key);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  // Run "Try Now" Live API Request
  const handleRunTest = async (testType: 'post_receipt' | 'get_image') => {
    setIsTesting(true);
    const start = performance.now();
    try {
      if (testType === 'post_receipt') {
        const res = await fetch('/api/render-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raw: rawString,
            mode: 'raw',
            width,
          }),
        });
        const duration = Math.round(performance.now() - start);
        const json = await res.json();
        setTestResult({
          status: res.status,
          timeMs: duration,
          contentType: 'application/json',
          data: json,
          mode: 'post_receipt',
        });
        setTestViewMode('json');
      } else {
        const res = await fetch(`/api/render-image?width=${width}&raw=${encodedRaw}`);
        const duration = Math.round(performance.now() - start);
        const svgText = await res.text();
        setTestResult({
          status: res.status,
          timeMs: duration,
          contentType: 'image/svg+xml',
          data: svgText,
          mode: 'get_image',
        });
        setTestViewMode('svg');
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setTestResult({
        status: 500,
        timeMs: duration,
        contentType: 'application/json',
        data: { error: err?.message || 'Failed to execute test request' },
        mode: testType,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Automation & REST API Access
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Send raw ESC/POS input via HTTP POST / GET and receive instant HTML &amp; SVG Image outputs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target Element ID Info */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs mb-1">
              <Code size={16} />
              <span>Special DOM Div Target IDs for Scraping &amp; Styling</span>
            </div>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed mb-2.5">
              The receipt component is wrapped in dedicated elements with fixed IDs so headless browser tools, automation scripts, or CSS selectors can reliably locate the rendered DOM:
            </p>
            <div className="bg-neutral-900 text-neutral-200 font-mono text-[11px] p-2.5 rounded-lg flex items-center justify-between">
              <code>id="receipt-paper" &amp; id="receipt-container"</code>
              <button
                onClick={() => handleCopy(htmlDivSnippet, 'divs')}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
              >
                {copiedTab === 'divs' ? <Check size={14} /> : <Copy size={14} />}
                {copiedTab === 'divs' ? 'Copied' : 'Copy HTML Markup'}
              </button>
            </div>
          </div>

          {/* Interactive "Try Now" API Sandbox */}
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Interactive API Sandbox (Try Now)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunTest('post_receipt')}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>Try POST API</span>
                </button>

                <button
                  onClick={() => handleRunTest('get_image')}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 font-bold text-xs rounded-lg transition-all border border-neutral-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTesting ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                  <span>Try GET SVG Image</span>
                </button>
              </div>
            </div>

            {/* Live Response Box */}
            {testResult && (
              <div className="mt-3 bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold ${testResult.status === 200 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400'}`}>
                      HTTP {testResult.status} OK
                    </span>
                    <span className="text-neutral-400 text-[11px]">
                      Time: <strong className="text-amber-300">{testResult.timeMs}ms</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {testResult.mode === 'post_receipt' && (
                      <>
                        <button
                          onClick={() => setTestViewMode('json')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${testViewMode === 'json' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
                        >
                          JSON Output
                        </button>
                        <button
                          onClick={() => setTestViewMode('svg')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${testViewMode === 'svg' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
                        >
                          SVG Preview
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Body Viewer */}
                <div className="max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-neutral-300 bg-black/40 p-2.5 rounded border border-neutral-800/80">
                  {testViewMode === 'json' && (
                    <pre>{JSON.stringify(testResult.data, null, 2)}</pre>
                  )}
                  {testViewMode === 'svg' && (
                    <div className="flex flex-col items-center justify-center p-2 bg-white rounded">
                      <div dangerouslySetInnerHTML={{ __html: typeof testResult.data === 'string' ? testResult.data : testResult.data?.svg || '' }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Endpoints Quick Navigation Tabs */}
          <div>
            <div className="flex items-center gap-1.5 border-b border-neutral-200 dark:border-neutral-800 mb-3 overflow-x-auto pb-1">
              {[
                { id: 'curl_post', label: 'cURL (POST)', icon: Terminal },
                { id: 'curl_get', label: 'cURL (GET)', icon: Globe },
                { id: 'get_image', label: 'SVG Image URL', icon: ImageIcon },
                { id: 'nodejs', label: 'Node.js', icon: Code },
                { id: 'python', label: 'Python Script', icon: Code },
                { id: 'n8n', label: 'n8n / Zapier', icon: Cpu },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                        : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Code Snippet Box Container */}
            <div className="bg-neutral-900 text-neutral-100 rounded-xl border border-neutral-800 flex flex-col overflow-hidden shadow-inner">
              {/* Code Pre Container */}
              <div className="p-4 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto text-neutral-200">
                <pre className={isWordWrapped ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'}>
                  {getCurrentSnippet()}
                </pre>
              </div>

              {/* Toolbar UNDER the Code Section */}
              <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs font-sans">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 font-mono tracking-wider">
                    Language: <strong className="text-amber-400">{activeTab.toUpperCase()}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Word Wrap Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsWordWrapped(!isWordWrapped)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                      isWordWrapped
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
                    }`}
                    title="Toggle Word Wrap"
                  >
                    <WrapText size={13} />
                    <span>{isWordWrapped ? 'Wrap: On' : 'Wrap: Off'}</span>
                  </button>

                  {/* Copy Code Button Under Code */}
                  <button
                    type="button"
                    onClick={() => handleCopy(getCurrentSnippet(), activeTab)}
                    className="px-3.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded text-[11px] flex items-center gap-1.5 transition-all shadow-sm"
                    title="Copy snippet code to clipboard"
                  >
                    {copiedTab === activeTab ? <Check size={13} className="text-black" /> : <Copy size={13} />}
                    <span>{copiedTab === activeTab ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <span className="text-neutral-500 dark:text-neutral-400 font-mono">
            API Server: Port 3000 | Output: JSON / SVG / HTML
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
