import { db } from "./config";
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    serverTimestamp,
    Timestamp,
    runTransaction,
} from "firebase/firestore";
import { Stock, StockMovement, StockMovementType, Product } from "@/types";

// --- Stock ---

export async function getStocks() {
    const q = query(collection(db, "stocks"));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                created_at: data.created_at?.toDate() || new Date(),
            } as Stock;
        })
        .filter((s) => !s.is_archived)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Adjusts stock level by deducting FIFO or adding to a batch.
 */
export async function adjustStock(data: {
    product_id: string;
    warehouse_id: string;
    type: 'up' | 'down';
    quantity: number;
    cost?: number; // Needed for 'up'
    note?: string;
    created_by: string;
}) {
    return await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", data.product_id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Product not found");
        const productData = productSnap.data() as Product;

        const now = new Date();
        const previousTotalStock = productData.current_stock || 0;

        if (data.type === 'down') {
            // FIFO Deduction
            const stocksQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", data.product_id),
                where("warehouse_id", "==", data.warehouse_id),
                where("is_archived", "==", false)
            );
            const stockSnaps = await getDocs(stocksQuery);
            const availableStocks = stockSnaps.docs
                .map(d => ({ id: d.id, ...d.data() } as Stock))
                .filter(s => s.quantity > 0)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const totalAvailable = availableStocks.reduce((sum, s) => sum + s.quantity, 0);
            if (totalAvailable < data.quantity) {
                throw new Error(`Insufficient stock. Available: ${totalAvailable}, Requested: ${data.quantity}`);
            }

            let remainingToDeduct = data.quantity;
            for (const stockRecord of availableStocks) {
                if (remainingToDeduct <= 0) break;
                const takeQty = Math.min(stockRecord.quantity, remainingToDeduct);

                transaction.update(doc(db, "stocks", stockRecord.id), {
                    quantity: stockRecord.quantity - takeQty,
                    updated_at: serverTimestamp(),
                });

                remainingToDeduct -= takeQty;
            }

            const newTotalStock = previousTotalStock - data.quantity;
            transaction.update(productRef, {
                current_stock: newTotalStock,
                updated_at: serverTimestamp(),
            });

            // Movement Record
            const movementRef = doc(collection(db, "stock_movements"));
            transaction.set(movementRef, {
                product_id: data.product_id,
                type: "adjustment",
                quantity: data.quantity,
                from_warehouse_id: data.warehouse_id,
                previous_stock_level: previousTotalStock,
                new_stock_level: newTotalStock,
                note: data.note || "Adjustment Down",
                created_by: data.created_by,
                date: Timestamp.fromDate(now),
                created_at: serverTimestamp(),
            });

        } else {
            // Adjustment Up (Add to batch)
            const costValue = data.cost || productData.cost_recommand || 0;

            // Check for existing batch with same cost
            const targetQuery = query(
                collection(db, "stocks"),
                where("product_id", "==", data.product_id),
                where("warehouse_id", "==", data.warehouse_id),
                where("cost", "==", costValue),
                where("is_archived", "==", false)
            );
            const targetSnaps = await getDocs(targetQuery);

            if (!targetSnaps.empty) {
                const targetRef = doc(db, "stocks", targetSnaps.docs[0].id);
                transaction.update(targetRef, {
                    quantity: targetSnaps.docs[0].data().quantity + data.quantity,
                    updated_at: serverTimestamp(),
                });
            } else {
                const targetRef = doc(collection(db, "stocks"));
                transaction.set(targetRef, {
                    product_id: data.product_id,
                    product_barcode: productData.barcode,
                    warehouse_id: data.warehouse_id,
                    product: { ...productData, id: productSnap.id },
                    cost: costValue,
                    date: Timestamp.fromDate(now),
                    quantity: data.quantity,
                    is_archived: false,
                    created_by: data.created_by,
                    created_at: serverTimestamp(),
                });
            }

            const newTotalStock = previousTotalStock + data.quantity;
            transaction.update(productRef, {
                current_stock: newTotalStock,
                updated_at: serverTimestamp(),
            });

            // Movement Record
            const movementRef = doc(collection(db, "stock_movements"));
            transaction.set(movementRef, {
                product_id: data.product_id,
                type: "adjustment",
                quantity: data.quantity,
                to_warehouse_id: data.warehouse_id,
                unit_cost: costValue,
                previous_stock_level: previousTotalStock,
                new_stock_level: newTotalStock,
                note: data.note || "Adjustment Up",
                created_by: data.created_by,
                date: Timestamp.fromDate(now),
                created_at: serverTimestamp(),
            });
        }
    });
}

export async function archiveStock(id: string) {
    const docRef = doc(db, "stocks", id);
    await updateDoc(docRef, {
        is_archived: true,
        archived_at: serverTimestamp(),
    });
}

// --- Stock Movements ---

export async function getStockMovements() {
    const q = query(collection(db, "stock_movements"));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                created_at: data.created_at?.toDate() || new Date(),
            } as StockMovement;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createStockMovement(data: Omit<StockMovement, "id" | "created_at">) {
    await addDoc(collection(db, "stock_movements"), {
        ...data,
        date: Timestamp.fromDate(new Date(data.date)),
        created_at: serverTimestamp(),
    });
}
