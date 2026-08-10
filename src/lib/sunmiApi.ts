import { parseEscPos, escapedStringToBytes, textToBytes } from './escpos';
import { renderReceiptToHtml, renderReceiptToSvg } from './renderHtml';

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/\s+/g, '');
  if (cleanHex.length % 2 !== 0) return new Uint8Array(0);
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function convertPayloadToEscPos(body: any): string {
  if (!body) return '\\x1b\\x40\\x1b\\x61\\x01 SUNMI STORE \\n--------------------------------\\nSample Receipt\\n\\x1d\\x56\\x00';
  if (typeof body === 'string') {
    return body;
  }
  if (body.raw || body.text || body.content) {
    return body.raw || body.text || body.content;
  }
  
  const store = body.storeName || body.store || body.merchant || 'SUNMI CLOUD STORE';
  const orderId = body.orderId || body.tradeNo || body.trade_no || 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const items = Array.isArray(body.items) ? body.items : [
    { name: 'Order Item 1', qty: 1, price: 12.50 }
  ];
  const calculatedTotal = items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
  const total = body.total ?? calculatedTotal;

  let escStr = `\\x1b\\x40\\x1b\\x61\\x01\\x1d\\x42\\x01 ${store.toUpperCase()} \\x1d\\x42\\x00\\n`;
  escStr += `ORDER #${orderId}\\n--------------------------------\\n`;
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
  escStr += `[ SUNMI PUSH CONTENT EVENT ]\\n`;
  escStr += `Thank You!\\n\\x1d\\x56\\x00`;
  return escStr;
}

export function handleSunmiBindShop(params: any = {}) {
  const sn = params.sn || params.printer_sn || 'N302LDY000353';
  const shopId = params.shop_id ?? params.shopId ?? 2441;
  return {
    code: 1,
    msg: 'success',
    data: null
  };
}

export function handleSunmiUnbindShop(params: any = {}) {
  const sn = params.sn || params.printer_sn || 'N302LDY000353';
  const shopId = params.shop_id ?? params.shopId ?? 2441;
  return {
    code: 1,
    msg: 'success',
    data: null
  };
}

export function handleSunmiOnlineStatus(snParam?: string, params: any = {}) {
  const sn = snParam || params.sn || params.printer_sn || 'N302LDY000353';
  const pageNo = Number(params.page_no || params.pageNo || 1);
  const pageSize = Number(params.page_size || params.pageSize || 10);
  
  return {
    code: 1,
    msg: 'success',
    data: {
      list: [
        {
          sn: sn,
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

export function handleSunmiOnlineStatuses(params: any = {}) {
  let sns: string[] = ['N302LDY000353', 'N301203540661'];
  if (params?.snList) {
    if (Array.isArray(params.snList)) sns = params.snList;
    else if (typeof params.snList === 'string') sns = params.snList.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (params?.sns && Array.isArray(params.sns)) {
    sns = params.sns;
  } else if (params?.sn) {
    sns = [params.sn];
  }

  const pageNo = Number(params.page_no || params.pageNo || 1);
  const pageSize = Number(params.page_size || params.pageSize || 100);

  return {
    code: 1,
    msg: 'success',
    data: {
      list: sns.map(sn => ({
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

export function handleSunmiClearPrintJob(params: any = {}) {
  const sn = params.sn || 'N302LDY000353';
  return {
    code: 1,
    msg: 'success',
    data: null
  };
}

export function handleSunmiPrintStatus(tradeNoParam?: string, params: any = {}) {
  const tradeNo = tradeNoParam || params.trade_no || params.tradeNo || '3433134';
  const sn = params.sn || 'N302LDY000353';
  return {
    code: 1,
    msg: 'success',
    data: {
      sn: sn,
      trade_no: tradeNo,
      is_print: 1,
      print_time: Math.floor(Date.now() / 1000)
    }
  };
}

export function handleSunmiPushContent(params: any = {}) {
  const sn = params.sn || params.printer_sn || 'N302LDY000353';
  const tradeNo = params.trade_no || params.tradeNo || '3433135';
  const widthVal = params.width === '58mm' ? '58mm' : '80mm';
  const count = Number(params.count || params.cycles || params.cycle || 1);

  let bytes: Uint8Array;
  const contentInput = params.content || params.raw || params.text || convertPayloadToEscPos(params);

  if (typeof contentInput === 'string') {
    const cleanStr = contentInput.trim();
    // Check if hex encoded string
    if (/^[0-9a-fA-F]{4,}$/.test(cleanStr) && cleanStr.length % 2 === 0) {
      bytes = hexToBytes(cleanStr);
    } else if (params.mode === 'text') {
      bytes = textToBytes(cleanStr);
    } else {
      bytes = escapedStringToBytes(cleanStr);
    }
  } else {
    bytes = escapedStringToBytes(convertPayloadToEscPos(params));
  }

  const outputType = (params.outputType || params.output_type || 'base64').toString().toLowerCase();

  const receiptData = parseEscPos(bytes);
  const html = renderReceiptToHtml(receiptData, { width: widthVal, theme: 'light' });
  const svg = renderReceiptToSvg(receiptData, { width: widthVal, theme: 'light' });
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(svg).toString('base64')
    : btoa(unescape(encodeURIComponent(svg)));
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  let receiptObj: Record<string, any> = { width: widthVal, outputType, receiptData };
  if (outputType === 'html') {
    receiptObj.html = html;
  } else if (outputType === 'svg') {
    receiptObj.svg = svg;
  } else if (outputType === 'dataurl' || outputType === 'data_url' || outputType === 'data-url') {
    receiptObj.dataUrl = dataUrl;
  } else if (outputType === 'all') {
    receiptObj = { width: widthVal, outputType, html, svg, base64, dataUrl, receiptData };
  } else {
    receiptObj.base64 = base64;
  }

  return {
    code: 1,
    msg: 'success',
    data: {
      trade_no: tradeNo,
      sn: sn,
      is_print: 1,
      print_time: Math.floor(Date.now() / 1000),
      count: count,
      receipt: receiptObj
    }
  };
}
