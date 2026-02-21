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
import { purchase, purchase_item, purchase_payment, Product, Stock, StockMovement } from "@/types";

// --- Purchases ---

export async function getPurchases() {
    const q = query(collection(db, "purchases"));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                date: data.date?.toDate() || new Date(),
                updated_at: data.updated_at?.toDate() || new Date(),
                created_at: data.created_at?.toDate() || new Date(),
            } as purchase;
        })
        .filter((p) => !p.is_deleted)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getPurchaseById(id: string) {
    const docRef = doc(db, "purchases", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        updated_at: data.updated_at?.toDate() || new Date(),
        created_at: data.created_at?.toDate() || new Date(),
    } as purchase;
}

export async function createPurchase(
    purchaseData: Omit<purchase, "id" | "created_at" | "updated_at" | "is_deleted">,
    items: Omit<purchase_item, "id" | "purchase_id" | "created_at">[]
) {
    // 0. PRE-TRANSACTION: Find potential existing stock records to update
    const existingStockMap: Record<string, string> = {}; // "pid_cost" -> stockDocId

    for (const item of items) {
        const key = `${item.product_id}_${item.cost}`;
        if (existingStockMap[key]) continue;

        const q = query(
            collection(db, "stocks"),
            where("product_id", "==", item.product_id),
            where("warehouse_id", "==", purchaseData.warehouse_id),
            where("cost", "==", item.cost),
            where("is_archived", "==", false)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            existingStockMap[key] = snap.docs[0].id;
        }
    }

    return await runTransaction(db, async (transaction) => {
        // 1. READ PHASE
        const productSnapshots: Record<string, { snap: any, data: Product }> = {};
        const stockSnapshots: Record<string, { currentQty: number, data: any }> = {};

        for (const item of items) {
            // Fetch product
            if (!productSnapshots[item.product_id]) {
                const productRef = doc(db, "products", item.product_id);
                const productSnap = await transaction.get(productRef);

                if (!productSnap.exists()) {
                    throw new Error(`Product ${item.product_id} not found`);
                }

                productSnapshots[item.product_id] = {
                    snap: productSnap,
                    data: productSnap.data() as Product
                };
            }

            // Fetch existing stock record if it matches pid+warehouse+cost
            const key = `${item.product_id}_${item.cost}`;
            const existingId = existingStockMap[key];
            if (existingId && !stockSnapshots[existingId]) {
                const stockSnap = await transaction.get(doc(db, "stocks", existingId));
                if (stockSnap.exists()) {
                    stockSnapshots[existingId] = {
                        currentQty: stockSnap.data().quantity || 0,
                        data: stockSnap.data()
                    };
                }
            }
        }

        // 2. WRITE PHASE

        // a. Create Purchase Document
        const purchaseRef = doc(collection(db, "purchases"));
        const purchaseDoc = {
            ...purchaseData,
            date: Timestamp.fromDate(new Date(purchaseData.date)),
            is_deleted: false,
            updated_at: serverTimestamp(),
            created_at: serverTimestamp(),
        };
        transaction.set(purchaseRef, purchaseDoc);

        // b. Process Items
        for (const item of items) {
            const { snap: productSnap, data: productData } = productSnapshots[item.product_id];

            // i. Create Purchase Item
            const itemRef = doc(collection(db, "purchase_items"));
            transaction.set(itemRef, {
                ...item,
                purchase_id: purchaseRef.id,
                created_at: serverTimestamp(),
            });

            // ii. Update Product Stock
            const previousStockTotal = productData.current_stock || 0;
            const newStockTotal = previousStockTotal + item.quantity;

            const productRef = doc(db, "products", item.product_id);
            transaction.update(productRef, {
                current_stock: newStockTotal,
                cost_recommand: item.cost, // Update recommended cost to latest purchase price
                updated_at: serverTimestamp(),
            });

            // iii. Create or Update Stock Record (Grouped by cost)
            const key = `${item.product_id}_${item.cost}`;
            const existingId = existingStockMap[key];

            if (existingId && stockSnapshots[existingId]) {
                const stockRef = doc(db, "stocks", existingId);
                const currentQtyInStock = stockSnapshots[existingId].currentQty;
                const updatedQty = currentQtyInStock + item.quantity;

                transaction.update(stockRef, {
                    quantity: updatedQty,
                    updated_at: serverTimestamp(),
                });

                // Update local memory for same item in same purchase
                stockSnapshots[existingId].currentQty = updatedQty;
            } else {
                // Create new stock entry for this cost
                const stockRef = doc(collection(db, "stocks"));
                const stockDoc = {
                    product_id: item.product_id,
                    product_barcode: productData.barcode,
                    warehouse_id: purchaseData.warehouse_id,
                    product: { ...productData, id: productSnap.id },
                    cost: item.cost,
                    date: Timestamp.fromDate(purchaseData.date),
                    quantity: item.quantity,
                    is_archived: false,
                    created_by: purchaseData.created_by,
                    created_at: serverTimestamp(),
                };
                transaction.set(stockRef, stockDoc);

                // Add to memory in case same cost appears again in same purchase
                existingStockMap[key] = stockRef.id;
                stockSnapshots[stockRef.id] = {
                    currentQty: item.quantity,
                    data: stockDoc
                };
            }

            // iv. Create Stock Movement Record
            const movementRef = doc(collection(db, "stock_movements"));
            const movementDoc = {
                product_id: item.product_id,
                type: "stock_in",
                quantity: item.quantity,
                unit_cost: item.cost,
                total_cost: item.total,
                to_warehouse_id: purchaseData.warehouse_id,
                previous_stock_level: previousStockTotal,
                new_stock_level: newStockTotal,
                note: `Purchase from PO: ${purchaseData.reference_no}`,
                reference: purchaseData.reference_no,
                created_by: purchaseData.created_by,
                date: Timestamp.fromDate(purchaseData.date),
                created_at: serverTimestamp(),
            };
            transaction.set(movementRef, movementDoc);

            // Update local memory for same product in same purchase
            productSnapshots[item.product_id].data.current_stock = newStockTotal;
        }

        return purchaseRef.id;
    });
}

export async function updatePurchase(
    id: string,
    purchaseData: Partial<purchase>
) {
    const docRef = doc(db, "purchases", id);
    await updateDoc(docRef, {
        ...purchaseData,
        updated_at: serverTimestamp(),
    });
}

export async function deletePurchase(id: string) {
    const docRef = doc(db, "purchases", id);
    await updateDoc(docRef, {
        is_deleted: true,
        updated_at: serverTimestamp(),
    });
}

// --- Purchase Items ---

export async function getPurchaseItems(purchaseId?: string) {
    const q = query(collection(db, "purchase_items"));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            created_at: data.created_at?.toDate() || new Date(),
        } as purchase_item;
    });

    if (purchaseId) {
        return items.filter((item) => item.purchase_id === purchaseId);
    }
    return items;
}

// --- Purchase Payments ---

export async function getPurchasePayments(purchaseId?: string) {
    const q = query(collection(db, "purchase_payments"));
    const snapshot = await getDocs(q);
    const payments = snapshot.docs
        .map((d) => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                created_at: data.created_at?.toDate() || new Date(),
            } as purchase_payment;
        })
        .filter((p) => !p.is_deleted);

    if (purchaseId) {
        return payments.filter((p) => p.purchase_id === purchaseId);
    }
    return payments;
}

export async function createPurchasePayment(
    data: Omit<purchase_payment, "id" | "created_at" | "is_deleted">
) {
    await addDoc(collection(db, "purchase_payments"), {
        ...data,
        is_deleted: false,
        created_at: serverTimestamp(),
    });
}
