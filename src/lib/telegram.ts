"use server";

import { db } from "./firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

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

export interface TransferData {
  productName: string;
  quantity: number;
  fromWarehouseName: string;
  toWarehouseName: string;
  note?: string;
  transferTime: Date;
  createdByName?: string;
}

/**
 * Base function to send any message to the configured Telegram group.
 * Supports forum topics via message_thread_id.
 */
export async function sendTelegramMessage(message: string, topicId?: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const groupId = process.env.TELEGRAM_ADMIN_GROUP_ID || process.env.TELEGRAM_GROUP_ID;

  if (!botToken || !groupId) {
    console.warn('Missing Telegram configuration (TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_ID). Notification skipped.');
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: groupId,
    text: message,
    parse_mode: 'HTML',
  };

  // If a topicId is provided, include it to target a specific forum topic
  if (topicId) {
    body.message_thread_id = topicId;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

// ─── TOPIC HELPERS ──────────────────────────────────────────────

function getSaleTopicId(): number | undefined {
  const val = process.env.TELEGRAM_TOPIC_SALE;
  return val ? parseInt(val, 10) : undefined;
}

function getTransferTopicId(): number | undefined {
  const val = process.env.TELEGRAM_TOPIC_TRANSFER;
  return val ? parseInt(val, 10) : undefined;
}

function getStockTopicId(): number | undefined {
  const val = process.env.TELEGRAM_TOPIC_STOCK;
  return val ? parseInt(val, 10) : undefined;
}

// ─── SALE NOTIFICATION ──────────────────────────────────────────

/**
 * Triggered when a new sale is successfully created.
 * Sends to TELEGRAM_TOPIC_SALE topic.
 */
export async function sendSaleNotification(sale: SaleData) {
  const d = sale.saleTime instanceof Date ? sale.saleTime : new Date(sale.saleTime);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  };
  const dateStr = d.toLocaleString('en-GB', dateOptions).replace(',', '');

  let message = `🛍️ <b>SALE RECEIPT</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 <b>Invoice:</b> <code>#${sale.invoiceNo}</code>\n`;
  message += `🏢 <b>Warehouse:</b> ${sale.warehouseName || "Warehouse"}\n`;
  message += `📅 <b>Date:</b> ${dateStr}\n`;
  message += `👤 <b>Customer:</b> ${sale.customerName}\n`;
  message += `👨‍💼 <b>Seller:</b> ${sale.cashierName}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📦 <b>ITEMS :</b>\n\n`;

  let subTotal = 0;
  sale.products.forEach((p, idx) => {
    const originalPrice = p.originalPrice ?? p.price;
    const discount = originalPrice - p.price;
    const total = p.quantity * p.price;
    subTotal += total;

    message += `${idx + 1}. <b>${p.name}</b>\n`;
    message += `   └ <code>${p.quantity}</code> × <code>$${originalPrice.toFixed(2)}</code> = <b>$${total.toFixed(2)}</b>\n`;

    if (discount > 0) {
      message += `   <i>(disc: -$${discount.toFixed(2)}/ea)</i>\n`;
    }
    message += `\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💵 <b>Sub Total:</b> $${subTotal.toFixed(2)}\n`;

  if (sale.discount && sale.discount > 0) {
    message += `🏷️ <b>Discount:</b> -$${sale.discount.toFixed(2)}\n`;
  }

  if (sale.tax && sale.tax > 0) {
    message += `📊 <b>Tax:</b> +$${sale.tax.toFixed(2)}\n`;
  }

  message += `💳 <b>Payment:</b> <code>${sale.paymentMethod.toUpperCase()}</code> (${sale.status.toUpperCase()})\n`;
  message += `💰 <b>TOTAL: $${sale.totalAmount.toFixed(2)}</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🙏 <i>Thank you for your business!</i>`;

  return sendTelegramMessage(message, getSaleTopicId());
}

// ─── LOW STOCK ALERT ────────────────────────────────────────────

/**
 * Triggered when a product stock drops to 5 or below.
 * Sends to TELEGRAM_TOPIC_STOCK topic.
 */
export async function sendLowStockAlert(stockData: LowStockData) {
  if (stockData.remainingQuantity > 5) return false;

  const message = `
⚠️ <b>LOW STOCK ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>Product:</b> ${stockData.productName}
📉 <b>Remaining Stock:</b> <code>${stockData.remainingQuantity} pcs</code>

<i>Please consider restocking soon!</i>
  `.trim();

  return sendTelegramMessage(message, getStockTopicId());
}

// ─── REFUND ALERT ───────────────────────────────────────────────

/**
 * Triggered when an order is refunded.
 * Sends to TELEGRAM_TOPIC_SALE topic.
 */
export async function sendRefundAlert(refund: RefundData) {
  const message = `
🔄 <b>ORDER REFUNDED</b>
━━━━━━━━━━━━━━━━━━━━━━
📄 <b>Invoice:</b> <code>#${refund.invoiceNo}</code>
👤 <b>Customer:</b> ${refund.customerName}
💵 <b>Refund Amount:</b> <code>$${refund.refundAmount.toFixed(2)}</code>
${refund.reason ? `📝 <b>Reason:</b> ${refund.reason}` : ''}
  `.trim();

  return sendTelegramMessage(message, getSaleTopicId());
}

// ─── TRANSFER NOTIFICATION ─────────────────────────────────────

/**
 * Triggered when stock is transferred between warehouses.
 * Sends to TELEGRAM_TOPIC_TRANSFER topic.
 */
export async function sendTransferNotification(transferData: TransferData) {
  const d = transferData.transferTime;
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  };
  const dateStr = d.toLocaleString('en-GB', dateOptions).replace(',', '');

  const message = `
🔄 <b>STOCK TRANSFER</b>
━━━━━━━━━━━━━━━━━━━━━━
📦 <b>Product:</b> ${transferData.productName}
🔢 <b>Quantity:</b> <code>${transferData.quantity} pcs</code>
🏭 <b>From:</b> ${transferData.fromWarehouseName}
🏢 <b>To:</b> ${transferData.toWarehouseName}
${transferData.note ? `📝 <b>Note:</b> ${transferData.note}\n` : ''}${transferData.createdByName ? `👤 <b>By:</b> ${transferData.createdByName}\n` : ''}📅 <b>Date:</b> ${dateStr}
  `.trim();

  return sendTelegramMessage(message, getTransferTopicId());
}

/**
 * Triggered after a batch of transfers. Sends a summary.
 * Sends to TELEGRAM_TOPIC_TRANSFER topic.
 */
export async function sendBatchTransferNotification(transfers: TransferData[], fromWarehouseName: string, toWarehouseName: string) {
  const totalItems = transfers.length;
  const totalQty = transfers.reduce((sum, t) => sum + t.quantity, 0);

  const d = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  };
  const dateStr = d.toLocaleString('en-GB', dateOptions).replace(',', '');

  let message = `📦 <b>BATCH STOCK TRANSFER</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🏭 <b>From:</b> ${fromWarehouseName}\n`;
  message += `🏢 <b>To:</b> ${toWarehouseName}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const t of transfers) {
    message += `• <b>${t.productName}</b> × <code>${t.quantity}</code>\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 <b>Total:</b> <code>${totalItems} products</code> (<code>${totalQty} units</code>)\n`;
  if (transfers[0]?.note) {
    message += `📝 <b>Note:</b> ${transfers[0].note}\n`;
  }
  message += `📅 <b>Date:</b> ${dateStr}`;

  return sendTelegramMessage(message, getTransferTopicId());
}

// ─── STOCK UPDATE NOTIFICATION ──────────────────────────────────

/**
 * Sends a stock summary for a specific warehouse.
 * Queries all non-archived stocks in the warehouse, groups by product,
 * and sends a formatted notification to TELEGRAM_TOPIC_STOCK topic.
 */
export async function sendStockUpdateNotification(warehouseId: string) {
  try {
    // Fetch warehouse name
    const warehouseRef = doc(db, "warehouses", warehouseId);
    const warehouseSnap = await getDoc(warehouseRef);
    const warehouseName = warehouseSnap.exists()
      ? (warehouseSnap.data() as { name: string }).name
      : warehouseId;

    // Fetch all active stocks for this warehouse
    const stocksQuery = query(
      collection(db, "stocks"),
      where("warehouse_id", "==", warehouseId),
      where("is_archived", "==", false)
    );
    const stockSnaps = await getDocs(stocksQuery);

    // Group stock by product, summing quantities
    const productStockMap = new Map<string, { name: string; quantity: number }>();

    for (const stockDoc of stockSnaps.docs) {
      const data = stockDoc.data();
      const productId = data.product_id as string;
      const qty = (data.quantity as number) || 0;

      if (qty <= 0) continue;

      const existing = productStockMap.get(productId);
      if (existing) {
        existing.quantity += qty;
      } else {
        // Get product name from embedded product data or fetch it
        let productName = (data.product?.name as string) || "";
        if (!productName) {
          try {
            const productRef = doc(db, "products", productId);
            const productSnap = await getDoc(productRef);
            productName = productSnap.exists()
              ? (productSnap.data() as { name: string }).name
              : productId;
          } catch {
            productName = productId;
          }
        }
        productStockMap.set(productId, { name: productName, quantity: qty });
      }
    }

    if (productStockMap.size === 0) {
      // No stock to report
      return false;
    }

    // Sort by product name
    const sortedProducts = Array.from(productStockMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    const d = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    };
    const dateStr = d.toLocaleString('en-GB', dateOptions).replace(',', '');

    let message = `📦 <b>STOCK UPDATE — ${warehouseName}</b>\n`;
    message += `📅 <i>${dateStr}</i>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    let totalProducts = 0;
    let totalQty = 0;

    for (const product of sortedProducts) {
      message += `• <b>${product.name}</b>: <code>${product.quantity}</code>\n`;
      totalProducts++;
      totalQty += product.quantity;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 <b>Total:</b> <code>${totalProducts} products</code> (<code>${totalQty} units</code>)`;

    return sendTelegramMessage(message, getStockTopicId());
  } catch (error) {
    console.error('Error sending stock update notification:', error);
    return false;
  }
}
