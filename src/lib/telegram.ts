"use server";

export interface SaleItem {
  name: string;
  quantity: number;
  price: number;
  originalPrice?: number;
}

export interface SaleData {
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  discount?: number;
  tax?: number;
  paymentMethod: string;
  status: string;
  cashierName: string;
  warehouseName?: string;
  saleTime: string | Date;
  products: SaleItem[];
}

export interface LowStockData {
  productName: string;
  remainingQuantity: number;
}

export interface RefundData {
  invoiceNo: string;
  refundAmount: number;
  customerName: string;
  reason?: string;
}

/**
 * Base function to send any message to the configured Telegram group
 */
export async function sendTelegramMessage(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  // Use a specific admin group ID if you have multiple groups, or default to the existing one
  const groupId = process.env.TELEGRAM_ADMIN_GROUP_ID || process.env.TELEGRAM_GROUP_ID;

  if (!botToken || !groupId) {
    console.warn('Missing Telegram configuration (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_GROUP_ID). Notification skipped.');
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: groupId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to send Telegram message:', errorData);
      return false;
    }

    console.log('Telegram notification sent');
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Triggered when a new sale is successfully created
 */
export async function sendSaleNotification(sale: SaleData) {
  const w = 38;
  const sep = '-'.repeat(w);
  const thickSep = '='.repeat(w);

  const alignLR = (l: string, r: string) => {
    const spaces = Math.max(1, w - l.length - r.length);
    return l + ' '.repeat(spaces) + r;
  };

  const center = (text: string) => {
    const spaces = Math.max(0, w - text.length);
    return ' '.repeat(Math.floor(spaces / 2)) + text;
  };

  // Format the date like "24 Jun 2026, 22:53"
  const d = sale.saleTime instanceof Date ? sale.saleTime : new Date(sale.saleTime);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  };
  const dateStr = d.toLocaleString('en-GB', dateOptions).replace(',', '');

  let receipt = `<pre>\n`;
  receipt += `${center("CAR ACCESSORIES")}\n`;
  receipt += `${center("Neo Sale")}\n`;
  receipt += `${center(sale.warehouseName || "Warehouse")}\n`;
  receipt += `${thickSep}\n`;
  receipt += `${alignLR("Invoice:", `#${sale.invoiceNo}`)}\n`;
  receipt += `${alignLR("Date:", dateStr)}\n`;
  receipt += `${alignLR("Customer:", sale.customerName)}\n`;
  receipt += `${alignLR("Seller:", sale.cashierName)}\n`;
  receipt += `${sep}\n`;

  receipt += "ITEM                 QTY   PRICE   TOTAL\n";
  receipt += `${sep}\n`;

  let subTotal = 0;
  sale.products.forEach(p => {
    const originalPrice = p.originalPrice ?? p.price;
    const discount = originalPrice - p.price;
    const total = p.quantity * p.price;
    subTotal += total;

    let name = p.name;
    if (name.length > 18) name = name.substring(0, 15) + "...";

    const n = name.padEnd(18, ' ');
    const q = p.quantity.toString().padStart(4, ' ');
    const pr = `$${originalPrice.toFixed(2)}`.padStart(8, ' ');
    const t = `$${total.toFixed(2)}`.padStart(8, ' ');

    receipt += `${n}${q}${pr}${t}\n`;
    
    if (discount > 0) {
      const discStr = `disc: -$${discount.toFixed(2)}/ea`;
      receipt += `${discStr.padStart(w, ' ')}\n`;
    }
  });

  receipt += `${sep}\n`;
  receipt += `${alignLR("Sub Total", `$${subTotal.toFixed(2)}`)}\n`;

  if (sale.discount && sale.discount > 0) {
    receipt += `${alignLR("Discount", `-$${sale.discount.toFixed(2)}`)}\n`;
  }

  if (sale.tax && sale.tax > 0) {
    receipt += `${alignLR("Tax", `+$${sale.tax.toFixed(2)}`)}\n`;
  }

  receipt += `${thickSep}\n`;
  receipt += `${alignLR("TOTAL", `$${sale.totalAmount.toFixed(2)}`)}\n`;
  receipt += `${sep}\n`;
  receipt += `${alignLR("Payment:", sale.paymentMethod.toUpperCase())}\n`;
  receipt += `${alignLR("Status:", sale.status.toUpperCase())}\n`;
  receipt += `${sep}\n`;
  // The QR code is a placeholder here but we can skip it or just add the spacing
  // We'll just leave it out, but add the bottom thick separator as in image
  receipt += `${center("Thank You!")}\n`;
  receipt += `${center("Please keep this receipt for your records")}\n`;
  receipt += `${thickSep}\n`;
  receipt += `${alignLR("Tech By :", "Dambang Tech Stack")}\n`;
  receipt += `${alignLR("Telegram contact :", "+855 98943324")}\n`;
  receipt += `${alignLR("another line:", "+855 187166671")}\n`;
  receipt += `</pre>`;

  return sendTelegramMessage(receipt);
}

/**
 * Triggered when a product stock drops to 5 or below
 */
export async function sendLowStockAlert(stockData: LowStockData) {
  if (stockData.remainingQuantity > 5) return false;

  const message = `
<b>⚠️ Low Stock Alert</b>

<b>Product:</b> ${stockData.productName}
<b>Remaining Quantity:</b> ${stockData.remainingQuantity}

Please consider restocking soon!
  `.trim();

  return sendTelegramMessage(message);
}

/**
 * Triggered when an order is refunded
 */
export async function sendRefundAlert(refund: RefundData) {
  const message = `
<b>🔄 Order Refunded</b>

<b>Invoice:</b> ${refund.invoiceNo}
<b>Customer:</b> ${refund.customerName}
<b>Refund Amount:</b> $${refund.refundAmount.toFixed(2)}
${refund.reason ? `<b>Reason:</b> ${refund.reason}` : ''}
  `.trim();

  return sendTelegramMessage(message);
}
