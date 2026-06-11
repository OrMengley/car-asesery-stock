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
    // ─── PRE-TRANSACTION QUERIES ──────────────────────────────────
    // Firestore transactions don't support getDocs() inside them.
    // We query the doc IDs first, then re-read them with transaction.get() inside.

    // Fetch source stock docs for this product in the source warehouse
    const sourceStocksQuery = query(
        collection(db, "stocks"),
        where("product_id", "==", data.product_id),
        where("warehouse_id", "==", data.from_warehouse_id),
        where("is_archived", "==", false)
    );
    const sourceStockSnaps = await getDocs(sourceStocksQuery);

    // Fetch all product stock docs (for movement record calculation)
    const allProductStocksQuery = query(
        collection(db, "stocks"),
        where("product_id", "==", data.product_id),
        where("is_archived", "==", false)
    );
    const allStockSnaps = await getDocs(allProductStocksQuery);

    // ─── TRANSACTION ─────────────────────────────────────────────
    return await runTransaction(db, async (transaction) => {
        // 1. READ PHASE — re-read all docs inside transaction for isolation
        const productRef = doc(db, "products", data.product_id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Product not found");

        // Re-read source stock docs via transaction.get()
        const sourceStockDocs = await Promise.all(
            sourceStockSnaps.docs.map(d => transaction.get(doc(db, "stocks", d.id)))
        );
        const sourceStocks = sourceStockDocs
            .filter(d => d.exists() && (d.data()?.quantity ?? 0) > 0)
            .map(d => ({ id: d.id, ...d.data() } as Stock))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalAvailable = sourceStocks.reduce((sum, s) => sum + s.quantity, 0);
        if (totalAvailable < data.quantity) {
            throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${data.quantity}`);
        }

        // Re-read all product stock docs for the movement record
        const allStockDocs = await Promise.all(
            allStockSnaps.docs.map(d => transaction.get(doc(db, "stocks", d.id)))
        );
        let productTotalStock = 0;
        allStockDocs.forEach(d => {
            if (d.exists()) productTotalStock += d.data()?.quantity ?? 0;
        });

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

            // b. Find existing target stock with SAME COST (query done outside, re-read inside)
            const targetStockQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", data.product_id),
                where("warehouse_id", "==", data.to_warehouse_id),
                where("cost", "==", sourceStock.cost),
                where("is_archived", "==", false)
            );
            // getDocs for the target is unavoidable for dynamic lookup; it runs outside the lock
            // but this is a safe read since we validate quantities via source stock only
            const targetStockSnaps = await getDocs(targetStockQuery);

            if (!targetStockSnaps.empty) {
                const targetDoc = targetStockSnaps.docs[0];
                const targetRef = doc(db, "stocks", targetDoc.id);
                const targetSnap = await transaction.get(targetRef);
                const currentQty = targetSnap.exists() ? (targetSnap.data()?.quantity ?? 0) : 0;
                transaction.update(targetRef, {
                    quantity: currentQty + takeQty,
                    updated_at: serverTimestamp(),
                });
            } else {
                // Create new stock record in target warehouse
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

        // 3. Create Movement Record
        const movementRef = doc(collection(db, "stock_movements"));
        const movementDoc = {
            product_id: data.product_id,
            type: "transfer",
            quantity: data.quantity,
            from_warehouse_id: data.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id,
            previous_stock_level: productTotalStock,
            new_stock_level: productTotalStock, // total stays same — just moved
            note: data.note || "Stock transfer",
            created_by: data.created_by,
            date: Timestamp.fromDate(now),
            created_at: serverTimestamp(),
        };
        transaction.set(movementRef, movementDoc);

        return movementRef.id;
    });
}

