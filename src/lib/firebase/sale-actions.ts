import { db } from "./config";
import {
    collection,
    doc,
    getDocs,
    updateDoc,
    query,
    where,
    serverTimestamp,
    runTransaction,
    Timestamp,
} from "firebase/firestore";
import { SaleInvoice, Product, Stock, StockMovement } from "@/types";
import { sendSaleNotification, sendLowStockAlert } from "../telegram";

export async function createSale(data: {
    customer_id: string;
    warehouse_id: string;
    items: {
        product_id: string;
        quantity: number;
        price: number;
        discount: number;
    }[];
    discount: number;
    tax: number;
    status: 'paid' | 'not paid';
    payment_method: 'cash' | 'aba' | 'aclida' | 'wing';
    created_by: string;
}) {
    const { invoiceId, notificationData, lowStockItems } = await runTransaction(db, async (transaction) => {
        let subTotal = 0;
        const invoiceItems: any[] = [];
        const now = new Date();

        // 1. READ PHASE: Gather all necessary data for all items first
        const productDatas = new Map();
        const availableStocksMap = new Map();
        const productTotalStockMap = new Map();

        // Fetch names for Telegram notification during READ phase
        const customerRef = doc(db, "customers", data.customer_id);
        const customerSnap = await transaction.get(customerRef);
        const customerName = customerSnap.exists() ? (customerSnap.data() as any).name : data.customer_id;

        const userRef = doc(db, "users", data.created_by);
        const userSnap = await transaction.get(userRef);
        const cashierName = userSnap.exists() ? (userSnap.data() as any).name : data.created_by;

        const warehouseRef = doc(db, "warehouses", data.warehouse_id);
        const warehouseSnap = await transaction.get(warehouseRef);
        const warehouseName = warehouseSnap.exists() ? (warehouseSnap.data() as any).name : "ឃ្លាំងពេជ្រដា";

        for (const item of data.items) {
            const productRef = doc(db, "products", item.product_id);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error(`Product ${item.product_id} not found`);
            const productData = productSnap.data() as Product;
            productDatas.set(item.product_id, productData);

            // Fetch available stock records in warehouse (FIFO)
            const stocksQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", item.product_id),
                where("warehouse_id", "==", data.warehouse_id),
                where("is_archived", "==", false)
            );
            const stockSnaps = await getDocs(stocksQuery);
            
            // Also fetch all product stocks to get accurate overall total for movement tracking
            const allStocksQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", item.product_id),
                where("is_archived", "==", false)
            );
            const allStockSnaps = await getDocs(allStocksQuery);
            let productTotalStock = 0;
            allStockSnaps.forEach(d => productTotalStock += d.data().quantity);
            productTotalStockMap.set(item.product_id, productTotalStock);

            const availableStocks = stockSnaps.docs
                .map(d => ({ id: d.id, ...d.data() } as Stock))
                .filter(s => s.quantity > 0)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const totalAvailable = availableStocks.reduce((sum, s) => sum + s.quantity, 0);
            if (totalAvailable < item.quantity) {
                throw new Error(`Insufficient stock for ${productData.name}. Available: ${totalAvailable}, Requested: ${item.quantity}`);
            }
            availableStocksMap.set(item.product_id, availableStocks);
        }

        // 2. WRITE PHASE: Deduct from stocks FIFO for all items
        for (const item of data.items) {
            const productData = productDatas.get(item.product_id);
            const availableStocks = availableStocksMap.get(item.product_id);
            let productTotalStock = productTotalStockMap.get(item.product_id);

            let remainingToDeduct = item.quantity;
            for (const stockRecord of availableStocks) {
                if (remainingToDeduct <= 0) break;

                const takeQty = Math.min(stockRecord.quantity, remainingToDeduct);
                const stockRef = doc(db, "stocks", stockRecord.id);

                transaction.update(stockRef, {
                    quantity: stockRecord.quantity - takeQty,
                    updated_at: serverTimestamp(),
                });

                // Create a stock movement for this SPECIFIC deduction (lot tracking)
                const movementRef = doc(collection(db, "stock_movements"));
                const movementDoc = {
                    product_id: item.product_id,
                    type: "stock_out",
                    quantity: takeQty,
                    unit_cost: stockRecord.cost,
                    from_warehouse_id: data.warehouse_id,
                    previous_stock_level: productTotalStock,
                    new_stock_level: productTotalStock - takeQty,
                    note: `Sale to customer ${data.customer_id}`,
                    created_by: data.created_by,
                    date: Timestamp.fromDate(now),
                    created_at: serverTimestamp(),
                };
                transaction.set(movementRef, movementDoc);

                // Add to invoice items
                const itemTotalPrice = (item.price * takeQty) - (item.discount * takeQty);
                invoiceItems.push({
                    stock_movement_id: movementRef.id,
                    cost: stockRecord.cost,
                    price: item.price,
                    product_id: item.product_id,
                    product_name: productData.name,
                    product_barcode: productData.barcode,
                    product_image: productData.thumbnails?.[0] || productData.images?.[0] || "",
                    quantity: takeQty,
                    discount: item.discount,
                    total_price: itemTotalPrice,
                });

                subTotal += itemTotalPrice;
                remainingToDeduct -= takeQty;
                productTotalStock -= takeQty; // Update local tracker for next batch
            }
        }

        // 3. Create Sale Invoice
        const finalTotalPrice = (subTotal - data.discount) + data.tax;
        const invoiceRef = doc(collection(db, "sale_invoices"));
        const invoiceDoc = {
            customer_id: data.customer_id,
            warehouse_id: data.warehouse_id,
            items: invoiceItems,
            sub_total: subTotal,
            discount: data.discount,
            tax: data.tax,
            total_price: finalTotalPrice,
            status: data.status,
            payment_method: data.payment_method,
            created_by: data.created_by,
            created_at: serverTimestamp(),
            is_archived: false,
        };
        transaction.set(invoiceRef, invoiceDoc);

        const notificationData = {
            invoiceNo: invoiceRef.id,
            customerName,
            totalAmount: finalTotalPrice,
            discount: data.discount,
            tax: data.tax,
            paymentMethod: data.payment_method,
            status: data.status,
            cashierName,
            warehouseName,
            saleTime: now,
            products: invoiceItems.map(item => ({
                name: item.product_name,
                quantity: item.quantity,
                price: item.price - item.discount,
                originalPrice: item.price
            }))
        };

        const lowStockItems = invoiceItems.map(item => {
            // Need to deduct the quantity taken in this transaction from the total
            const finalStock = productTotalStockMap.get(item.product_id) - item.quantity;
            return {
                productName: item.product_name,
                remainingQuantity: finalStock
            };
        }).filter(item => item.remainingQuantity <= 5);

        return { invoiceId: invoiceRef.id, notificationData, lowStockItems };
    });

    try {
        await sendSaleNotification(notificationData);
        for (const item of lowStockItems) {
            await sendLowStockAlert(item);
        }
    } catch (e) {
        console.error("Failed to send telegram notifications", e);
    }

    return invoiceId;
}

// --- Read Sale Invoices ---

export async function getSaleInvoices() {
    const q = query(
        collection(db, "sale_invoices"),
        where("is_archived", "==", false)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                created_at: data.created_at?.toDate() || new Date(),
            } as SaleInvoice;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// --- Delete (archive) Sale Invoice ---

export async function deleteSaleInvoice(id: string) {
    const docRef = doc(db, "sale_invoices", id);
    await updateDoc(docRef, {
        is_archived: true,
        updated_at: serverTimestamp(),
    });
}

// --- Mark Sale Invoice as Paid ---

export async function updateSalePayment(
    id: string,
    data: {
        payment_method: "cash" | "aba" | "aclida" | "wing";
        amount_received: number;
    }
) {
    const docRef = doc(db, "sale_invoices", id);
    await updateDoc(docRef, {
        status: "paid",
        payment_method: data.payment_method,
        amount_received: data.amount_received,
        paid_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    });
}
