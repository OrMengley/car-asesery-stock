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
import { sendTransferNotification, sendStockUpdateNotification, sendBatchTransferNotification, TransferData } from "../telegram";

export async function getStockMovements() {
    const q = query(collection(db, "stock_movements"), where("type", "==", "transfer"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        let parsedDate = new Date();
        if (data.date) {
            if (typeof data.date.toDate === 'function') {
                parsedDate = data.date.toDate();
            } else if (typeof data.date === 'string' || typeof data.date === 'number') {
                parsedDate = new Date(data.date);
            }
        }
        let parsedCreatedAt = new Date();
        if (data.created_at) {
            if (typeof data.created_at.toDate === 'function') {
                parsedCreatedAt = data.created_at.toDate();
            } else if (typeof data.created_at === 'string' || typeof data.created_at === 'number') {
                parsedCreatedAt = new Date(data.created_at);
            }
        }
        return {
            id: doc.id,
            ...data,
            date: parsedDate,
            created_at: parsedCreatedAt,
        };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()) as StockMovement[];
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

    // Fetch all target stock docs to find existing ones
    const targetStocksQuery = query(
        collection(db, "stocks"),
        where("product_id", "==", data.product_id),
        where("warehouse_id", "==", data.to_warehouse_id),
        where("is_archived", "==", false)
    );
    const targetStockSnaps = await getDocs(targetStocksQuery);

    // ─── TRANSACTION ─────────────────────────────────────────────
    const { movementId, notificationData } = await runTransaction(db, async (transaction) => {
        // 1. READ PHASE — re-read all docs inside transaction for isolation
        const productRef = doc(db, "products", data.product_id);
        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) throw new Error("Product not found");
        const productData = productSnap.data() as Product;

        // Read warehouse names for notification
        const fromWarehouseRef = doc(db, "warehouses", data.from_warehouse_id);
        const fromWarehouseSnap = await transaction.get(fromWarehouseRef);
        const fromWarehouseName = fromWarehouseSnap.exists() ? (fromWarehouseSnap.data() as { name: string }).name : data.from_warehouse_id;

        const toWarehouseRef = doc(db, "warehouses", data.to_warehouse_id);
        const toWarehouseSnap = await transaction.get(toWarehouseRef);
        const toWarehouseName = toWarehouseSnap.exists() ? (toWarehouseSnap.data() as { name: string }).name : data.to_warehouse_id;

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

        // Re-read target stock docs
        const targetStockDocs = await Promise.all(
            targetStockSnaps.docs.map(d => transaction.get(doc(db, "stocks", d.id)))
        );
        const targetStocks = targetStockDocs
            .filter(d => d.exists())
            .map(d => ({ id: d.id, ...d.data() } as Stock));

        // 2. WRITE PHASE
        let remainingToTransfer = data.quantity;
        const now = new Date();

        // Map to group additions to target warehouse by cost
        const targetAdditionsByCost = new Map<number, number>();

        for (const sourceStock of sourceStocks) {
            if (remainingToTransfer <= 0) break;

            const takeQty = Math.min(sourceStock.quantity, remainingToTransfer);

            // a. Deduct from Source Stock
            const sourceStockRef = doc(db, "stocks", sourceStock.id);
            transaction.update(sourceStockRef, {
                quantity: sourceStock.quantity - takeQty,
                updated_at: serverTimestamp(),
            });

            // Keep track of how much to add to the target warehouse per cost
            const currentAddition = targetAdditionsByCost.get(sourceStock.cost) ?? 0;
            targetAdditionsByCost.set(sourceStock.cost, currentAddition + takeQty);

            remainingToTransfer -= takeQty;
        }

        // b. Apply target warehouse additions
        for (const [cost, addQty] of targetAdditionsByCost.entries()) {
            const existingTarget = targetStocks.find(t => t.cost === cost);
            if (existingTarget) {
                const targetRef = doc(db, "stocks", existingTarget.id);
                transaction.update(targetRef, {
                    quantity: existingTarget.quantity + addQty,
                    updated_at: serverTimestamp(),
                });
            } else {
                // Find a source stock with this cost to copy product details from
                const sourceStock = sourceStocks.find(s => s.cost === cost)!;
                const targetRef = doc(collection(db, "stocks"));
                transaction.set(targetRef, {
                    product_id: sourceStock.product_id,
                    product_barcode: sourceStock.product_barcode,
                    warehouse_id: data.to_warehouse_id,
                    product: sourceStock.product,
                    cost: sourceStock.cost,
                    date: Timestamp.fromDate(now),
                    quantity: addQty,
                    is_archived: false,
                    created_by: data.created_by,
                    created_at: serverTimestamp(),
                });
            }
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

        // Prepare notification data
        const notificationData: TransferData = {
            productName: productData.name,
            quantity: data.quantity,
            fromWarehouseName,
            toWarehouseName,
            note: data.note,
            transferTime: now,
        };

        return { movementId: movementRef.id, notificationData };
    });

    // Send notifications after successful transaction
    try {
        await sendTransferNotification(notificationData);
        // Send stock update for both warehouses
        await sendStockUpdateNotification(data.from_warehouse_id);
        await sendStockUpdateNotification(data.to_warehouse_id);
    } catch (e) {
        console.error("Failed to send transfer telegram notifications", e);
    }

    return movementId;
}

export async function createMultipleStockTransfers(data: {
    from_warehouse_id: string;
    to_warehouse_id: string;
    items: {
        product_id: string;
        quantity: number;
    }[];
    note?: string;
    created_by: string;
}) {
    if (!data.items || data.items.length === 0) {
        throw new Error("Please add at least one product item to transfer");
    }

    const transferIds: string[] = [];
    const transferNotifications: TransferData[] = [];

    // Fetch warehouse names once for the batch
    const fromWarehouseSnap = await getDoc(doc(db, "warehouses", data.from_warehouse_id));
    const fromWarehouseName = fromWarehouseSnap.exists() ? (fromWarehouseSnap.data() as { name: string }).name : data.from_warehouse_id;
    const toWarehouseSnap = await getDoc(doc(db, "warehouses", data.to_warehouse_id));
    const toWarehouseName = toWarehouseSnap.exists() ? (toWarehouseSnap.data() as { name: string }).name : data.to_warehouse_id;

    for (const item of data.items) {
        // Fetch product name for the notification
        const productSnap = await getDoc(doc(db, "products", item.product_id));
        const productName = productSnap.exists() ? (productSnap.data() as { name: string }).name : item.product_id;

        const id = await createStockTransfer({
            product_id: item.product_id,
            from_warehouse_id: data.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id,
            quantity: item.quantity,
            note: data.note,
            created_by: data.created_by,
        });
        transferIds.push(id);

        transferNotifications.push({
            productName,
            quantity: item.quantity,
            fromWarehouseName,
            toWarehouseName,
            note: data.note,
            transferTime: new Date(),
        });
    }

    // Send batch notification and stock update for both warehouses (once, not per item)
    try {
        if (transferNotifications.length > 1) {
            await sendBatchTransferNotification(transferNotifications, fromWarehouseName, toWarehouseName);
        }
        // Stock updates are already sent per individual transfer in createStockTransfer
        // No need to send again here
    } catch (e) {
        console.error("Failed to send batch transfer telegram notifications", e);
    }

    return transferIds;
}


export async function getAllStockMovements() {
    const q = query(collection(db, "stock_movements"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Handle date
        let parsedDate = new Date();
        if (data.date) {
            if (typeof data.date.toDate === 'function') {
                parsedDate = data.date.toDate();
            } else if (typeof data.date === 'string' || typeof data.date === 'number') {
                parsedDate = new Date(data.date);
            }
        }
        
        // Handle created_at
        let parsedCreatedAt = new Date();
        if (data.created_at) {
            if (typeof data.created_at.toDate === 'function') {
                parsedCreatedAt = data.created_at.toDate();
            } else if (typeof data.created_at === 'string' || typeof data.created_at === 'number') {
                parsedCreatedAt = new Date(data.created_at);
            }
        }

        return {
            id: doc.id,
            ...data,
            date: parsedDate,
            created_at: parsedCreatedAt,
        };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()) as StockMovement[];
}


