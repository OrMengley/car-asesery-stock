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
import { sale_invoice, Product, Stock, StockMovement } from "@/types";

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
    return await runTransaction(db, async (transaction) => {
        let subTotal = 0;
        const invoiceItems: any[] = [];
        const now = new Date();

        for (const item of data.items) {
            // 1. READ PHASE: Get Product
            const productRef = doc(db, "products", item.product_id);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error(`Product ${item.product_id} not found`);
            const productData = productSnap.data() as Product;

            // Fetch available stock records in warehouse (FIFO)
            const stocksQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", item.product_id),
                where("warehouse_id", "==", data.warehouse_id),
                where("is_archived", "==", false)
            );
            const stockSnaps = await getDocs(stocksQuery);
            const availableStocks = stockSnaps.docs
                .map(d => ({ id: d.id, ...d.data() } as Stock))
                .filter(s => s.quantity > 0)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const totalAvailable = availableStocks.reduce((sum, s) => sum + s.quantity, 0);
            if (totalAvailable < item.quantity) {
                throw new Error(`Insufficient stock for ${productData.name}. Available: ${totalAvailable}, Requested: ${item.quantity}`);
            }

            // 2. WRITE PHASE: Deduct from stocks FIFO
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
                    previous_stock_level: productData.current_stock,
                    new_stock_level: productData.current_stock - takeQty,
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

                subTotal += (item.price * takeQty);
                remainingToDeduct -= takeQty;
                productData.current_stock -= takeQty; // Update local tracker for next batch
            }

            // Update Product Total Stock
            transaction.update(productRef, {
                current_stock: productData.current_stock,
                updated_at: serverTimestamp(),
            });
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

        return invoiceRef.id;
    });
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
            } as sale_invoice;
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
