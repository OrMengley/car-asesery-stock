import { db } from "./config";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    serverTimestamp,
    runTransaction,
    Timestamp,
} from "firebase/firestore";
import { StockMovement, Stock, Product } from "@/types";

export async function getStockMovements() {
    const q = query(collection(db, "stock_movements"), where("type", "==", "transfer"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        created_at: doc.data().created_at?.toDate() || new Date(),
    })) as StockMovement[];
}

export async function createStockTransfer(data: {
    product_id: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    quantity: number;
    note?: string;
    created_by: string;
}) {
    return await runTransaction(db, async (transaction) => {
        // 1. READ PHASE
        const productRef = doc(db, "products", data.product_id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Product not found");
        const productData = productSnap.data() as Product;

        // Fetch available stock records in SOURCE warehouse (FIFO: Sort by date)
        const stocksQuery = query(
            collection(db, "stocks"),
            where("product_id", "==", data.product_id),
            where("warehouse_id", "==", data.from_warehouse_id),
            where("is_archived", "==", false)
        );
        const stockSnaps = await getDocs(stocksQuery);
        const sourceStocks = stockSnaps.docs
            .map(d => ({ id: d.id, ...d.data() } as Stock))
            .filter(s => s.quantity > 0)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalAvailable = sourceStocks.reduce((sum, s) => sum + s.quantity, 0);
        if (totalAvailable < data.quantity) {
            throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${data.quantity}`);
        }

        // 2. WRITE PHASE
        let remainingToTransfer = data.quantity;
        const now = new Date();

        for (const sourceStock of sourceStocks) {
            if (remainingToTransfer <= 0) break;

            const takeQty = Math.min(sourceStock.quantity, remainingToTransfer);

            // a. Deduct from Source Stock
            const sourceStockRef = doc(db, "stocks", sourceStock.id);
            transaction.update(sourceStockRef, {
                quantity: sourceStock.quantity - takeQty,
                updated_at: serverTimestamp(),
            });

            // b. Find or Create Target Stock with SAME COST
            const targetStockQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", data.product_id),
                where("warehouse_id", "==", data.to_warehouse_id),
                where("cost", "==", sourceStock.cost),
                where("is_archived", "==", false)
            );
            const targetStockSnaps = await getDocs(targetStockQuery);

            if (!targetStockSnaps.empty) {
                // Update existing record in target warehouse
                const targetRef = doc(db, "stocks", targetStockSnaps.docs[0].id);
                transaction.update(targetRef, {
                    quantity: targetStockSnaps.docs[0].data().quantity + takeQty,
                    updated_at: serverTimestamp(),
                });
            } else {
                // Create new record in target warehouse
                const targetRef = doc(collection(db, "stocks"));
                transaction.set(targetRef, {
                    product_id: sourceStock.product_id,
                    product_barcode: sourceStock.product_barcode,
                    warehouse_id: data.to_warehouse_id,
                    product: sourceStock.product,
                    cost: sourceStock.cost,
                    date: Timestamp.fromDate(now),
                    quantity: takeQty,
                    is_archived: false,
                    created_by: data.created_by,
                    created_at: serverTimestamp(),
                });
            }

            remainingToTransfer -= takeQty;
        }

        // Create Movement Record
        const movementRef = doc(collection(db, "stock_movements"));
        const movementDoc = {
            product_id: data.product_id,
            type: "transfer",
            quantity: data.quantity,
            from_warehouse_id: data.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id,
            previous_stock_level: productData.current_stock || 0,
            new_stock_level: productData.current_stock || 0,
            note: data.note || "Stock transfer",
            created_by: data.created_by,
            date: Timestamp.fromDate(now),
            created_at: serverTimestamp(),
        };
        transaction.set(movementRef, movementDoc);

        return movementRef.id;
    });
}
