(() => {
  // src/lib/escpos.ts
  var DEFAULT_STYLE = {
    bold: false,
    italic: false,
    underline: false,
    doubleHeight: false,
    doubleWidth: false,
    scaleX: 1,
    scaleY: 1,
    reverse: false,
    color: "black"
  };
  function parseEscPos(data) {
    const lines = [];
    let currentLineSpans = [];
    let currentLineAlign = "left" /* LEFT */;
    let currentStyle = { ...DEFAULT_STYLE };
    let currentText = "";
    let hasCut = false;
    let pendingBeep = false;
    let pendingDrawer = false;
    let justFlushedOnAlignChange = false;
    const controlEvents = [];
    let redSpanCount = 0;
    let reverseSpanCount = 0;
    let boldSpanCount = 0;
    let cutCount = 0;
    let beepCount = 0;
    let drawerCount = 0;
    let totalChars = 0;
    const currentLineIndex = () => lines.length;
    const flushSpan = () => {
      if (currentText.length > 0) {
        totalChars += currentText.length;
        if (currentStyle.color === "red") redSpanCount++;
        if (currentStyle.reverse) reverseSpanCount++;
        if (currentStyle.bold) boldSpanCount++;
        currentLineSpans.push({
          text: currentText,
          style: { ...currentStyle }
        });
        currentText = "";
      }
    };
    const flushLine = (hasCutHere = false, forceBeep = false, forceDrawer = false) => {
      flushSpan();
      const hasBeepHere = forceBeep || pendingBeep;
      const hasDrawerHere = forceDrawer || pendingDrawer;
      pendingBeep = false;
      pendingDrawer = false;
      lines.push({
        id: `line-${lines.length}-${Math.random().toString(36).substring(2, 7)}`,
        spans: [...currentLineSpans],
        align: currentLineAlign,
        hasCutHere,
        hasBeepHere,
        hasDrawerHere
      });
      currentLineSpans = [];
    };
    let i = 0;
    while (i < data.length) {
      const byte = data[i];
      if (byte === 7) {
        flushSpan();
        beepCount++;
        pendingBeep = true;
        controlEvents.push({ type: "beep", label: "Buzzer Sound (BEL \\x07)", lineIndex: currentLineIndex() });
        i++;
      } else if (byte === 27) {
        i++;
        if (i >= data.length) break;
        const next = data[i];
        if (next === 64) {
          flushSpan();
          currentStyle = { ...DEFAULT_STYLE };
          currentLineAlign = "left" /* LEFT */;
          controlEvents.push({ type: "reset", label: "Printer Reset (ESC @)", lineIndex: currentLineIndex() });
          i++;
        } else if (next === 97) {
          flushSpan();
          const n = data[i + 1] ?? 0;
          let newAlign = currentLineAlign;
          if (n === 0 || n === 48) newAlign = "left" /* LEFT */;
          else if (n === 1 || n === 49) newAlign = "center" /* CENTER */;
          else if (n === 2 || n === 50) newAlign = "right" /* RIGHT */;
          if (newAlign !== currentLineAlign) {
            if (currentText.length > 0 || currentLineSpans.length > 0) {
              flushLine();
              justFlushedOnAlignChange = true;
            }
            currentLineAlign = newAlign;
          }
          i += 2;
        } else if (next === 69) {
          flushSpan();
          const val = (data[i + 1] & 1) === 1;
          currentStyle.bold = val;
          i += 2;
        } else if (next === 52) {
          flushSpan();
          currentStyle.italic = true;
          i++;
        } else if (next === 53) {
          flushSpan();
          currentStyle.italic = false;
          i++;
        } else if (next === 45) {
          flushSpan();
          const param = data[i + 1] ?? 0;
          currentStyle.underline = param === 1 || param === 2 || param === 49 || param === 50;
          i += 2;
        } else if (next === 123) {
          flushSpan();
          const param = data[i + 1] ?? 0;
          const val = param === 1 || param === 49 || param > 0 && param !== 48;
          currentStyle.reverse = val;
          i += 2;
        } else if (next === 33) {
          flushSpan();
          const n = data[i + 1] ?? 0;
          currentStyle.bold = (n & 8) !== 0;
          currentStyle.doubleHeight = (n & 16) !== 0;
          currentStyle.doubleWidth = (n & 32) !== 0;
          currentStyle.underline = (n & 128) !== 0;
          currentStyle.scaleX = currentStyle.doubleWidth ? 2 : 1;
          currentStyle.scaleY = currentStyle.doubleHeight ? 2 : 1;
          i += 2;
        } else if (next === 114) {
          flushSpan();
          const n = data[i + 1] ?? 0;
          const newColor = n === 1 || n === 49 ? "red" : "black";
          if (currentStyle.color !== newColor) {
            currentStyle.color = newColor;
            controlEvents.push({
              type: "color",
              label: `Print Color: ${newColor.toUpperCase()} (ESC r ${n})`,
              lineIndex: currentLineIndex()
            });
          }
          i += 2;
        } else if (next === 66) {
          flushSpan();
          beepCount++;
          pendingBeep = true;
          controlEvents.push({ type: "beep", label: "Buzzer Sound (ESC B)", lineIndex: currentLineIndex() });
          i += 3;
        } else if (next === 112) {
          flushSpan();
          drawerCount++;
          pendingDrawer = true;
          controlEvents.push({ type: "drawer", label: "Open Cash Drawer (ESC p)", lineIndex: currentLineIndex() });
          i += 4;
        } else {
          i++;
        }
      } else if (byte === 29) {
        i++;
        if (i >= data.length) break;
        const next = data[i];
        if (next === 33) {
          flushSpan();
          const n = data[i + 1] ?? 0;
          const width = (n >> 4 & 7) + 1;
          const height = (n & 7) + 1;
          currentStyle.scaleX = width;
          currentStyle.scaleY = height;
          i += 2;
        } else if (next === 86) {
          flushSpan();
          hasCut = true;
          cutCount++;
          controlEvents.push({ type: "cut", label: "Cut Paper (GS V)", lineIndex: currentLineIndex() });
          flushLine(true);
          const m = data[i + 1] ?? 0;
          if (m === 65 || m === 66) {
            i += 3;
          } else {
            i += 2;
          }
        } else if (next === 66) {
          flushSpan();
          const param = data[i + 1] ?? 0;
          const val = param === 1 || param === 49 || param > 0 && param !== 48;
          if (currentStyle.reverse !== val) {
            currentStyle.reverse = val;
            controlEvents.push({
              type: "reverse",
              label: `Reverse Mode: ${val ? "ON" : "OFF"} (GS B ${data[i + 1]})`,
              lineIndex: currentLineIndex()
            });
          }
          i += 2;
        } else {
          i++;
        }
      } else if (byte === 10) {
        if (justFlushedOnAlignChange && currentText.length === 0 && currentLineSpans.length === 0) {
        } else {
          flushLine();
        }
        justFlushedOnAlignChange = false;
        i++;
      } else if (byte === 13) {
        i++;
      } else {
        justFlushedOnAlignChange = false;
        let start = i;
        while (i < data.length && data[i] !== 27 && data[i] !== 29 && data[i] !== 10 && data[i] !== 13 && data[i] !== 7) {
          i++;
        }
        const textChunk = new TextDecoder("utf-8", { fatal: false }).decode(data.slice(start, i));
        currentText += textChunk;
      }
    }
    if (currentText.length > 0 || currentLineSpans.length > 0 || pendingDrawer || pendingBeep) {
      flushLine();
    }
    return {
      lines,
      hasCut,
      controlEvents,
      stats: {
        totalChars,
        cutCount,
        beepCount,
        drawerCount
      }
    };
  }
  function textToBytes(text) {
    return new TextEncoder().encode(text);
  }
  function escapedStringToBytes(text) {
    const unescaped = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "	");
    const result = [];
    for (let i = 0; i < unescaped.length; i++) {
      const charCode = unescaped.charCodeAt(i);
      if (charCode <= 255) {
        result.push(charCode);
      } else {
        const encoded = new TextEncoder().encode(unescaped[i]);
        encoded.forEach((b) => result.push(b));
      }
    }
    return new Uint8Array(result);
  }

  // src/lib/renderHtml.ts
  function renderReceiptToHtml(data, options = {}) {
    const is58 = options.width === "58mm";
    const widthVal = is58 ? "320px" : "400px";
    const paddingVal = is58 ? "20px 14px" : "24px 18px";
    const isDark = options.theme === "dark";
    const bgColor = isDark ? "#1e293b" : "#ffffff";
    const textColor = isDark ? "#f8fafc" : "#111827";
    const borderColor = isDark ? "#334155" : "#e5e7eb";
    const linesHtml = data.lines.map((line) => {
      const alignCss = line.align === "center" /* CENTER */ ? "text-align: center;" : line.align === "right" /* RIGHT */ ? "text-align: right;" : "text-align: left;";
      const spansHtml = line.spans.map((span) => {
        const style = span.style;
        const isRed = style.color === "red";
        const isReverse = style.reverse;
        let colorCss = `color: ${textColor};`;
        if (isReverse) {
          colorCss = "color: #ffffff; background-color: #000000; padding: 1px 4px; font-weight: 700; border-radius: 2px;";
        } else if (isRed) {
          colorCss = "color: #dc2626; font-weight: 600;";
        }
        const fontCss = style.bold || isReverse || style.scaleX > 1 || style.scaleY > 1 ? "font-weight: 700;" : "font-weight: 400;";
        const italicCss = style.italic ? "font-style: italic;" : "";
        const underlineCss = style.underline ? "text-decoration: underline;" : "";
        const scaleY = style.scaleY > 1 ? style.scaleY : 1;
        const scaleX = style.scaleX > 1 ? style.scaleX : 1;
        const fontSize = `${Math.min(20, 11.5 * scaleY)}px`;
        const letterSpacing = scaleX > 1 ? "0.08em" : "0px";
        const escapedText = span.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        return `<span style='font-size: ${fontSize}; letter-spacing: ${letterSpacing}; ${fontCss} ${italicCss} ${colorCss} ${underlineCss} display: inline; white-space: pre-wrap; word-break: break-all;'>${escapedText}</span>`;
      }).join("");
      let beepDivider = "";
      if (line.hasBeepHere) {
        beepDivider = `<div style='margin: 10px 0; border-top: 1px dashed #f59e0b; position: relative; text-align: center;'><span style='position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 9px; color: #d97706; font-weight: bold; border: 1px solid #fde68a; border-radius: 10px;'>\u{1F514} POS BUZZER BEEP (ESC B)</span></div>`;
      }
      let drawerDivider = "";
      if (line.hasDrawerHere) {
        drawerDivider = `<div style='margin: 10px 0; border-top: 1px dashed #f97316; position: relative; text-align: center;'><span style='position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 9px; color: #ea580c; font-weight: bold; border: 1px solid #fed7aa; border-radius: 10px;'>\u26A1 CASH DRAWER KICK (ESC p)</span></div>`;
      }
      let cutDivider = "";
      if (line.hasCutHere) {
        cutDivider = `<div style='margin: 14px 0; border-top: 2px dashed #ef4444; position: relative; text-align: center;'><span style='position: relative; top: -10px; background: ${bgColor}; padding: 0 8px; font-size: 10px; color: #ef4444; font-weight: bold; border: 1px solid #fca5a5; border-radius: 10px;'>\u2702 PAPER CUT</span></div>`;
      }
      const lineContent = spansHtml.length > 0 ? spansHtml : "&#160;";
      return `<div style='width: 100%; min-height: 1.25em; ${alignCss} margin: 1px 0; white-space: pre-wrap; word-break: break-all; font-family: "Courier New", Courier, "JetBrains Mono", monospace;'>${lineContent}</div>${beepDivider}${drawerDivider}${cutDivider}`;
    }).join("\n");
    return `<div id='receipt-container' data-receipt-width='${options.width || "80mm"}' style='width: 100%; max-width: ${widthVal}; margin: 0 auto; background-color: ${bgColor}; color: ${textColor}; font-family: "Courier New", Courier, "JetBrains Mono", monospace; font-size: 11.5px; line-height: 1.35; padding: ${paddingVal}; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid ${borderColor}; border-radius: 4px; box-sizing: border-box;'><div id='receipt-paper' data-receipt-preview='true' style='width: 100%;'>${linesHtml}</div></div>`;
  }
  function renderReceiptToSvg(data, options = {}) {
    const is58 = options.width === "58mm";
    const widthPx = is58 ? 320 : 400;
    let calculatedHeight = 0;
    if (typeof document !== "undefined") {
      try {
        const temp = document.createElement("div");
        temp.style.position = "fixed";
        temp.style.left = "-9999px";
        temp.style.top = "-9999px";
        temp.style.width = `${widthPx}px`;
        temp.style.visibility = "hidden";
        temp.style.zIndex = "-9999";
        temp.innerHTML = renderReceiptToHtml(data, options);
        document.body.appendChild(temp);
        const container = temp.querySelector("#receipt-container");
        if (container) {
          calculatedHeight = Math.ceil(container.getBoundingClientRect().height);
        }
        document.body.removeChild(temp);
      } catch (e) {
        console.warn("Could not measure offscreen SVG height:", e);
      }
    }
    if (!calculatedHeight || calculatedHeight <= 0) {
      const charsPerLine = is58 ? 32 : 44;
      calculatedHeight = is58 ? 40 : 48;
      data.lines.forEach((line) => {
        let maxScaleY = 1;
        let totalChars = 0;
        line.spans.forEach((s) => {
          if (s.style.scaleY > maxScaleY) maxScaleY = s.style.scaleY;
          totalChars += s.text.length;
        });
        const wrappedLines = Math.max(1, Math.ceil(totalChars / charsPerLine));
        const linePixelHeight = (15.5 * maxScaleY + 2) * wrappedLines;
        calculatedHeight += linePixelHeight;
        if (line.hasCutHere) calculatedHeight += 38;
      });
      calculatedHeight = Math.ceil(calculatedHeight);
    }
    const htmlContent = renderReceiptToHtml(data, options);
    const rawSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${widthPx}' height='${calculatedHeight}' viewBox='0 0 ${widthPx} ${calculatedHeight}'><rect width='100%' height='100%' fill='${options.theme === "dark" ? "#1e293b" : "#ffffff"}' rx='4'/><foreignObject x='0' y='0' width='${widthPx}' height='${calculatedHeight}'><div xmlns='http://www.w3.org/1999/xhtml' style='width: 100%; height: 100%; box-sizing: border-box;'><style>* { box-sizing: border-box; } div, span { font-family: "Courier New", Courier, "JetBrains Mono", monospace; }</style>${htmlContent}</div></foreignObject></svg>`;
    return rawSvg.replace(/\r?\n\s*/g, "");
  }

  // src/lib/openapi.ts
  var openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "ESC/POS Thermal Receipt Generator & Visualizer API",
      description: "High-performance ESC/POS thermal receipt rendering engine. Parses raw binary ESC/POS escape sequences, text formatting, and reverse printing mode into HTML, SVG, and structured JSON.",
      version: "2.5.0",
      contact: {
        name: "Suhail Akhtar",
        url: "https://suhail.top"
      }
    },
    servers: [
      {
        url: "/api",
        description: "Relative API Base Path"
      },
      {
        url: "http://localhost:3000/api",
        description: "Local Express Server"
      }
    ],
    paths: {
      "/health": {
        get: {
          summary: "API Health Check",
          description: "Verifies server status, service availability, and version details.",
          operationId: "getHealth",
          responses: {
            "200": {
              description: "API is healthy and operational",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      service: { type: "string", example: "ESC/POS Receipt Generator API" },
                      version: { type: "string", example: "2.5.0" },
                      endpoints: {
                        type: "array",
                        items: { type: "string" },
                        example: ["/api/health", "/api/render-receipt", "/api/render-image", "/api/webhook"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/render-receipt": {
        post: {
          summary: "Render ESC/POS to JSON (HTML + SVG + Stats)",
          description: "Parses raw ESC/POS commands or plain text and returns rendered HTML markup, standalone vector SVG, line statistics, and hardware control events.",
          operationId: "renderReceipt",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ReceiptRequest"
                }
              },
              "text/plain": {
                schema: {
                  type: "string",
                  example: "\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 EPOINT STORE \\x1d\\x42\\x00\\nItem 1  $10.00\\n\\x1d\\x56\\x00"
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Receipt rendered successfully",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ReceiptResponse"
                  }
                }
              }
            },
            "500": {
              description: "Failed to process receipt payload",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/ErrorResponse"
                  }
                }
              }
            }
          }
        },
        get: {
          summary: "Render Receipt via Query Parameters",
          description: "Renders receipt using URL query string parameters for quick cURL tests and GET integrations.",
          operationId: "renderReceiptGet",
          parameters: [
            { name: "raw", in: "query", schema: { type: "string" }, description: "ESC/POS raw escaped string" },
            { name: "text", in: "query", schema: { type: "string" }, description: "Plain text string" },
            { name: "width", in: "query", schema: { type: "string", enum: ["80mm", "58mm"], default: "80mm" } },
            { name: "mode", in: "query", schema: { type: "string", enum: ["raw", "text"], default: "raw" } },
            { name: "theme", in: "query", schema: { type: "string", enum: ["light", "dark"], default: "light" } }
          ],
          responses: {
            "200": {
              description: "Receipt rendered successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReceiptResponse" }
                }
              }
            }
          }
        }
      },
      "/render-image": {
        get: {
          summary: "Render Receipt as Vector SVG Image",
          description: "Generates direct image/svg+xml or JSON payload with base64 data URL for direct embedding in <img> tags or HTML previews.",
          operationId: "renderImage",
          parameters: [
            { name: "raw", in: "query", schema: { type: "string" } },
            { name: "text", in: "query", schema: { type: "string" } },
            { name: "width", in: "query", schema: { type: "string", enum: ["80mm", "58mm"], default: "80mm" } },
            { name: "format", in: "query", schema: { type: "string", enum: ["svg", "json"], default: "svg" } }
          ],
          responses: {
            "200": {
              description: "Returns SVG XML image or JSON image object",
              content: {
                "image/svg+xml": {
                  schema: { type: "string", format: "binary" }
                },
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      svg: { type: "string" },
                      dataUrl: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/webhook": {
        post: {
          summary: "Receive E-Commerce or POS Webhook & Convert to Thermal Receipt",
          description: "Accepts incoming order webhooks from Shopify, Stripe, Square, or custom POS systems and automatically compiles structured JSON orders or raw ESC/POS commands into thermal receipts.",
          operationId: "receiveWebhook",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WebhookPayload"
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Webhook processed and receipt generated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      event: { type: "string", example: "webhook_received" },
                      timestamp: { type: "string", example: "2026-08-07T04:18:00.000Z" },
                      orderId: { type: "string", example: "ORD-8821" },
                      receipt: { $ref: "#/components/schemas/ReceiptResponse" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/device/pushContent": {
        post: {
          summary: "Sunmi Push Content Official Cloud API",
          description: "Pushes printing tasks directly to Sunmi cloud printers. Accepts ESC/POS command hex strings, text, or order JSON and returns official Sunmi task metadata along with receipt visual assets.",
          operationId: "sunmiPushContentOfficial",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sn: { type: "string", example: "N302LDY000353", description: "Sunmi printer serial number" },
                    trade_no: { type: "string", example: "3433135", description: "Merchant order unique ID" },
                    content: { type: "string", example: "1b2130e58d97e59bbde8b685e5b882", description: "Hex encoded ESC/POS commands or plain string" },
                    count: { type: "number", example: 1, description: "Number of printed receipts" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Print task pushed successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: {
                        type: "object",
                        properties: {
                          trade_no: { type: "string", example: "3433135" },
                          sn: { type: "string", example: "N302LDY000353" },
                          is_print: { type: "number", example: 1 },
                          print_time: { type: "number", example: 1639621476 },
                          receipt: { $ref: "#/components/schemas/ReceiptResponse" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/device/bindShop": {
        post: {
          summary: "Sunmi Bind Shop Official Cloud API",
          description: "Binds a Sunmi printer device serial number to a merchant shop ID.",
          operationId: "sunmiBindShopOfficial",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sn: { type: "string", example: "N302LDY000353" },
                    shop_id: { type: "number", example: 2441 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Shop bound successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: { type: "object", nullable: true, example: null }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/device/unbindShop": {
        post: {
          summary: "Sunmi Unbind Shop Official Cloud API",
          description: "Unbinds a Sunmi printer serial number from a shop.",
          operationId: "sunmiUnbindShopOfficial",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sn: { type: "string", example: "N302LDY000353" },
                    shop_id: { type: "number", example: 2441 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Shop unbound successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: { type: "object", nullable: true, example: null }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/device/onlineStatus": {
        post: {
          summary: "Sunmi Device Online Status Official Cloud API",
          description: "Queries online status of device(s) under shop_id or sn.",
          operationId: "sunmiOnlineStatusOfficial",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sn: { type: "string", example: "N302LDY000353" },
                    page_no: { type: "number", example: 1 },
                    page_size: { type: "number", example: 100 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Online status retrieved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: {
                        type: "object",
                        properties: {
                          list: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                sn: { type: "string", example: "N302LDY000353" },
                                is_online: { type: "number", example: 1 }
                              }
                            }
                          },
                          page: {
                            type: "object",
                            properties: {
                              total: { type: "number", example: 1 },
                              page_no: { type: "number", example: 1 },
                              page_size: { type: "number", example: 100 }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/device/clearPrintJob": {
        post: {
          summary: "Sunmi Clear Print Job Official Cloud API",
          description: "Clears print queue cached in the cloud for a Sunmi printer device.",
          operationId: "sunmiClearPrintJobOfficial",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sn: { type: "string", example: "N302LDY000353" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Queue cleared successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: { type: "object", nullable: true, example: null }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/v2/printer/open/open/ticket/printStatus": {
        post: {
          summary: "Sunmi Ticket Print Status Official Cloud API",
          description: "Queries order printing completion status by trade_no.",
          operationId: "sunmiTicketPrintStatusOfficial",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    trade_no: { type: "string", example: "3433134" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Print status retrieved",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      code: { type: "number", example: 1 },
                      msg: { type: "string", example: "success" },
                      data: {
                        type: "object",
                        properties: {
                          sn: { type: "string", example: "N302LDY000353" },
                          is_print: { type: "number", example: 1 },
                          print_time: { type: "number", example: 1639621476 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        ReceiptRequest: {
          type: "object",
          properties: {
            raw: { type: "string", description: "Raw ESC/POS command string with escape codes", example: "\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 EPOINT STORE \\x1d\\x42\\x00\\nItem 1  $10.00\\n\\x1d\\x56\\x00" },
            text: { type: "string", description: "Plain text fallback if raw is not provided" },
            mode: { type: "string", enum: ["raw", "text"], default: "raw" },
            width: { type: "string", enum: ["80mm", "58mm"], default: "80mm" },
            theme: { type: "string", enum: ["light", "dark"], default: "light" }
          }
        },
        ReceiptResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            width: { type: "string", example: "80mm" },
            html: { type: "string", description: "Rendered DOM HTML string" },
            svg: { type: "string", description: "Standalone vector SVG markup" }
          }
        },
        WebhookPayload: {
          type: "object",
          properties: {
            event: { type: "string", example: "order.created" },
            orderId: { type: "string", example: "ORD-9912" },
            storeName: { type: "string", example: "Epoint Cafe" },
            customer: { type: "string", example: "Jane Doe" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Cappuccino" },
                  qty: { type: "number", example: 2 },
                  price: { type: "number", example: 4.5 }
                }
              }
            },
            total: { type: "number", example: 9 },
            raw: { type: "string", description: "Optional explicit ESC/POS binary or text commands" }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Failed to process receipt input" },
            details: { type: "string", example: "Invalid byte string" }
          }
        }
      }
    }
  };
  function getSwaggerHtml(specUrl = "/api/openapi.json") {
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
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"><\/script>
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
  <\/script>
</body>
</html>`;
  }

  // src/lib/sunmiApi.ts
  function hexToBytes(hex) {
    const cleanHex = hex.replace(/\s+/g, "");
    if (cleanHex.length % 2 !== 0) return new Uint8Array(0);
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
  }
  function convertPayloadToEscPos(body) {
    if (!body) return "\\x1b\\x40\\x1b\\x61\\x01 SUNMI STORE \\n--------------------------------\\nSample Receipt\\n\\x1d\\x56\\x00";
    if (typeof body === "string") {
      return body;
    }
    if (body.raw || body.text || body.content) {
      return body.raw || body.text || body.content;
    }
    const store = body.storeName || body.store || body.merchant || "SUNMI CLOUD STORE";
    const orderId = body.orderId || body.tradeNo || body.trade_no || "ORD-" + Math.floor(1e3 + Math.random() * 9e3);
    const items = Array.isArray(body.items) ? body.items : [
      { name: "Order Item 1", qty: 1, price: 12.5 }
    ];
    const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
    const total = body.total ?? calculatedTotal;
    let escStr = `\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 ${store.toUpperCase()} \\x1d\\x42\\x00\\n`;
    escStr += `ORDER #${orderId}\\n--------------------------------\\n`;
    items.forEach((item) => {
      const qty = item.qty || 1;
      const name = item.name || "Item";
      const priceStr = `$${((Number(item.price) || 0) * qty).toFixed(2)}`;
      const lineStr = `${qty}x ${name}`;
      const pad = Math.max(1, 32 - lineStr.length - priceStr.length);
      escStr += `${lineStr}${" ".repeat(pad)}${priceStr}\\n`;
    });
    escStr += `--------------------------------\\n`;
    const totalValStr = `$${Number(total).toFixed(2)}`;
    const totalLabel = `Total:`;
    const totalPad = Math.max(1, 32 - totalLabel.length - totalValStr.length);
    escStr += `\\x1b\\x45\\x01${totalLabel}${" ".repeat(totalPad)}${totalValStr}\\x1b\\x45\\x00\\n\\n`;
    escStr += `[ SUNMI PUSH CONTENT EVENT ]\\n`;
    escStr += `Thank You!\\n\\x1d\\x56\\x00`;
    return escStr;
  }
  function handleSunmiBindShop(params = {}) {
    const sn = params.sn || params.printer_sn || "N302LDY000353";
    const shopId = params.shop_id ?? params.shopId ?? 2441;
    return {
      code: 1,
      msg: "success",
      data: null
    };
  }
  function handleSunmiUnbindShop(params = {}) {
    const sn = params.sn || params.printer_sn || "N302LDY000353";
    const shopId = params.shop_id ?? params.shopId ?? 2441;
    return {
      code: 1,
      msg: "success",
      data: null
    };
  }
  function handleSunmiOnlineStatus(snParam, params = {}) {
    const sn = snParam || params.sn || params.printer_sn || "N302LDY000353";
    const pageNo = Number(params.page_no || params.pageNo || 1);
    const pageSize = Number(params.page_size || params.pageSize || 10);
    return {
      code: 1,
      msg: "success",
      data: {
        list: [
          {
            sn,
            is_online: 1
          }
        ],
        page: {
          total: 1,
          page_no: pageNo,
          page_size: pageSize
        }
      }
    };
  }
  function handleSunmiOnlineStatuses(params = {}) {
    let sns = ["N302LDY000353", "N301203540661"];
    if (params?.snList) {
      if (Array.isArray(params.snList)) sns = params.snList;
      else if (typeof params.snList === "string") sns = params.snList.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (params?.sns && Array.isArray(params.sns)) {
      sns = params.sns;
    } else if (params?.sn) {
      sns = [params.sn];
    }
    const pageNo = Number(params.page_no || params.pageNo || 1);
    const pageSize = Number(params.page_size || params.pageSize || 100);
    return {
      code: 1,
      msg: "success",
      data: {
        list: sns.map((sn) => ({
          sn,
          is_online: 1
        })),
        page: {
          total: sns.length,
          page_no: pageNo,
          page_size: pageSize
        }
      }
    };
  }
  function handleSunmiClearPrintJob(params = {}) {
    const sn = params.sn || "N302LDY000353";
    return {
      code: 1,
      msg: "success",
      data: null
    };
  }
  function handleSunmiPrintStatus(tradeNoParam, params = {}) {
    const tradeNo = tradeNoParam || params.trade_no || params.tradeNo || "3433134";
    const sn = params.sn || "N302LDY000353";
    return {
      code: 1,
      msg: "success",
      data: {
        sn,
        trade_no: tradeNo,
        is_print: 1,
        print_time: Math.floor(Date.now() / 1e3)
      }
    };
  }
  function handleSunmiPushContent(params = {}) {
    const sn = params.sn || params.printer_sn || "N302LDY000353";
    const tradeNo = params.trade_no || params.tradeNo || "3433135";
    const widthVal = params.width === "58mm" ? "58mm" : "80mm";
    const count = Number(params.count || params.cycles || params.cycle || 1);
    let bytes;
    const contentInput = params.content || params.raw || params.text || convertPayloadToEscPos(params);
    if (typeof contentInput === "string") {
      const cleanStr = contentInput.trim();
      if (/^[0-9a-fA-F]{4,}$/.test(cleanStr) && cleanStr.length % 2 === 0) {
        bytes = hexToBytes(cleanStr);
      } else if (params.mode === "text") {
        bytes = textToBytes(cleanStr);
      } else {
        bytes = escapedStringToBytes(cleanStr);
      }
    } else {
      bytes = escapedStringToBytes(convertPayloadToEscPos(params));
    }
    const receiptData = parseEscPos(bytes);
    const html = renderReceiptToHtml(receiptData, { width: widthVal, theme: "light" });
    const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: "light" });
    return {
      code: 1,
      msg: "success",
      data: {
        trade_no: tradeNo,
        sn,
        is_print: 1,
        print_time: Math.floor(Date.now() / 1e3),
        count,
        receipt: {
          width: widthVal,
          html,
          svg,
          receiptData
        }
      }
    };
  }

  // src/sw.ts
  var CACHE_NAME = "receipt-simulation-studio-v2";
  var ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/manifest.json",
    "/favicon.svg"
  ];
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        console.log("[SW API Engine] Pre-caching offline app shell");
        return cache.addAll(ASSETS_TO_CACHE);
      }).then(() => self.skipWaiting())
    );
  });
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log("[SW API Engine] Deleting old cache:", cache);
              return caches.delete(cache);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  });
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Webhook-Secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
  function parsePayloadToReceipt(rawInput, mode = "raw") {
    let bytes;
    if (mode === "text") {
      bytes = textToBytes(rawInput);
    } else {
      bytes = escapedStringToBytes(rawInput);
    }
    return parseEscPos(bytes);
  }
  function convertWebhookOrderToEscPos(body) {
    const store = body.storeName || body.store || "WEBHOOK EPOINT POS";
    const orderId = body.orderId || body.id || "ORD-" + Math.floor(1e3 + Math.random() * 9e3);
    const items = Array.isArray(body.items) ? body.items : [
      { name: "Order Item 1", qty: 1, price: 15 }
    ];
    const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
    const total = body.total ?? calculatedTotal;
    let escStr = `\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 ${store.toUpperCase()} \\x1d\\x42\\x00\\n`;
    escStr += `WEBHOOK ORDER #${orderId}\\n--------------------------------\\n`;
    items.forEach((item) => {
      const qty = item.qty || 1;
      const name = item.name || "Item";
      const priceStr = `$${((Number(item.price) || 0) * qty).toFixed(2)}`;
      const lineStr = `${qty}x ${name}`;
      const pad = Math.max(1, 32 - lineStr.length - priceStr.length);
      escStr += `${lineStr}${" ".repeat(pad)}${priceStr}\\n`;
    });
    escStr += `--------------------------------\\n`;
    const totalValStr = `$${Number(total).toFixed(2)}`;
    const totalLabel = `Total:`;
    const totalPad = Math.max(1, 32 - totalLabel.length - totalValStr.length);
    escStr += `\\x1b\\x45\\x01${totalLabel}${" ".repeat(totalPad)}${totalValStr}\\x1b\\x45\\x00\\n\\n`;
    escStr += `[ WEBHOOK EVENT: ${body.event || "order.created"} ]\\n`;
    escStr += `Thank You!\\n\\x1d\\x56\\x00`;
    return escStr;
  }
  async function handleApiRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
    if (pathname.endsWith("/api/health") || pathname.endsWith("/health")) {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "ESC/POS Receipt Generator MSW/SW API",
          version: "2.5.0 (Client-Side SW Engine)",
          serverlessMode: "Service Worker Interceptor",
          endpoints: ["/api/health", "/api/render-receipt", "/api/render-image", "/api/webhook", "/api/openapi.json", "/api/docs"]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }
    if (pathname.includes("/openapi.json")) {
      return new Response(JSON.stringify(openApiSpec, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (pathname.endsWith("/api/docs") || pathname.endsWith("/docs")) {
      return new Response(getSwaggerHtml("/api/openapi.json"), {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          ...corsHeaders
        }
      });
    }
    if (pathname.includes("/webhook")) {
      try {
        let rawStr = "";
        let modeVal = "raw";
        let widthVal = "80mm";
        let eventName = "webhook_received";
        let orderId = "ORD-WEBHOOK";
        if (request.method === "POST") {
          const cloned = request.clone();
          const contentType = request.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
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
          rawStr = convertWebhookOrderToEscPos({ event: "order.created", storeName: "Epoint Cafe", items: [{ name: "Test Item", qty: 1, price: 10 }] });
        }
        const receiptData = parsePayloadToReceipt(rawStr, modeVal);
        const wVal = widthVal === "58mm" ? "58mm" : "80mm";
        const html = renderReceiptToHtml(receiptData, { width: wVal, theme: "light" });
        const svg = renderReceiptToSvg(receiptData, { width: wVal, theme: "light" });
        return new Response(
          JSON.stringify({
            success: true,
            event: eventName,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            orderId,
            width: wVal,
            receipt: {
              html,
              svg
            }
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Failed to process webhook event in SW", details: err?.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.includes("/unbindshop") || lowerPath.includes("/unbind-shop")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      return new Response(JSON.stringify(handleSunmiUnbindShop(params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/bindshop") || lowerPath.includes("/bind-shop")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      return new Response(JSON.stringify(handleSunmiBindShop(params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/online-statuses")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      return new Response(JSON.stringify(handleSunmiOnlineStatuses(params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/onlinestatus") || lowerPath.includes("/online-status")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      const segments = pathname.split("/").filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      const snInPath = lastSeg && lastSeg.toLowerCase() !== "onlinestatus" && lastSeg.toLowerCase() !== "online-status" ? lastSeg : void 0;
      return new Response(JSON.stringify(handleSunmiOnlineStatus(snInPath, params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/clearprintjob") || lowerPath.includes("/clear-print-job")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      return new Response(JSON.stringify(handleSunmiClearPrintJob(params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/printstatus") || lowerPath.includes("/print-status")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          bodyObj = await request.clone().json();
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      const segments = pathname.split("/").filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      const tradeNoInPath = lastSeg && lastSeg.toLowerCase() !== "printstatus" && lastSeg.toLowerCase() !== "print-status" ? lastSeg : void 0;
      return new Response(JSON.stringify(handleSunmiPrintStatus(tradeNoInPath, params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (lowerPath.includes("/pushcontent") || lowerPath.includes("/push-content")) {
      let bodyObj = {};
      if (request.method === "POST") {
        try {
          const cloned = request.clone();
          const contentType = request.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            bodyObj = await cloned.json();
          } else {
            const textVal = await cloned.text();
            bodyObj = { content: textVal };
          }
        } catch {
        }
      }
      const queryObj = Object.fromEntries(url.searchParams.entries());
      const params = { ...queryObj, ...bodyObj };
      return new Response(JSON.stringify(handleSunmiPushContent(params)), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    let raw = url.searchParams.get("raw") || url.searchParams.get("text") || "";
    let mode = url.searchParams.get("mode") || "raw";
    let width = url.searchParams.get("width") || "80mm";
    let theme = url.searchParams.get("theme") || "light";
    let format = url.searchParams.get("format") || "svg";
    if (request.method === "POST") {
      try {
        const cloned = request.clone();
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
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
        console.warn("[SW API Engine] Failed to parse POST body:", err);
      }
    }
    if (!raw) {
      raw = "Epoint Store Test\n--------------------------------\nSample ESC/POS Receipt\nItem 1                     $10.00\nItem 2                      $5.00\n--------------------------------\nTotal                      $15.00\nThank You!\n";
    }
    if (pathname.includes("/render-receipt")) {
      try {
        const receiptData = parsePayloadToReceipt(raw, mode);
        const widthVal = width === "58mm" ? "58mm" : "80mm";
        const html = renderReceiptToHtml(receiptData, { width: widthVal, theme });
        const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme });
        return new Response(
          JSON.stringify({
            success: true,
            width: widthVal,
            html,
            svg
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "Failed to process receipt input",
            details: err?.message
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    }
    if (pathname.includes("/render-image")) {
      try {
        const receiptData = parsePayloadToReceipt(raw, mode);
        const widthVal = width === "58mm" ? "58mm" : "80mm";
        const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme });
        if (format === "json") {
          return new Response(
            JSON.stringify({
              success: true,
              svg,
              dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
              engine: "Service Worker Client-Side API"
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }
        return new Response(svg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-cache",
            ...corsHeaders
          }
        });
      } catch (err) {
        return new Response(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="50" fill="red">Error: ${err?.message}</text></svg>`,
          {
            status: 500,
            headers: {
              "Content-Type": "image/svg+xml",
              ...corsHeaders
            }
          }
        );
      }
    }
    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        availableEndpoints: ["/api/health", "/api/render-receipt", "/api/render-image"]
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (url.pathname.includes("/api/") || url.pathname.includes("/render-receipt") || url.pathname.includes("/render-image") || url.pathname.includes("/docs") || url.pathname.includes("openapi.json")) {
      event.respondWith(handleApiRequest(request));
      return;
    }
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === "GET") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return null;
        });
        return cachedResponse || fetchPromise;
      })
    );
  });
})();
