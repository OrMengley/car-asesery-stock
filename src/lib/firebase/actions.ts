import { db } from "./config";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
} from "firebase/firestore";
import { Category, Product, User, Role } from "@/types";

// --- Categories ---

export async function getCategories() {
    const q = query(
        collection(db, "categories"),
        where("is_archived", "==", false),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate() || new Date(),
        } as Category;
    });
}

export async function createCategory(name: string) {
    await addDoc(collection(db, "categories"), {
        name,
        created_at: serverTimestamp(),
        is_archived: false,
    });
}

export async function updateCategory(id: string, name: string) {
    const docRef = doc(db, "categories", id);
    await updateDoc(docRef, {
        name,
        updated_at: serverTimestamp(),
    });
}

export async function archiveCategory(id: string) {
    const docRef = doc(db, "categories", id);
    await updateDoc(docRef, {
        is_archived: true,
        archived_at: serverTimestamp(),
    });
}

// --- Users ---

export async function getUsers() {
    const q = query(
        collection(db, "users"),
        where("is_archived", "==", false),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate() || new Date(),
        } as User;
    });
}

export async function createUser(data: { name: string; username: string; role: Role; email: string; password?: string }) {
    // Note: In a real app, you'd create the Auth user here via Admin SDK or secondary app instance.
    // For now, we just create the Firestore document.
    await addDoc(collection(db, "users"), {
        name: data.name,
        username: data.username,
        email: data.email, // Added email to schema for practical use
        role: data.role,
        password: data.password || "", // Storing plain text for mock/demo purposes - NOT SECURE for production
        created_at: serverTimestamp(),
        is_archived: false,
    });
}

export async function archiveUser(id: string) {
    const docRef = doc(db, "users", id);
    await updateDoc(docRef, {
        is_archived: true,
        archived_at: serverTimestamp(),
    });
}

// --- Products ---

export async function getProducts() {
    const q = query(
        collection(db, "products"),
        where("is_archived", "==", false),
        orderBy("created_at", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate() || new Date(),
        } as Product;
    });
}

export async function createProduct(data: Omit<Product, "id" | "created_at" | "is_archived" | "current_stock" | "average_cost">) {
    await addDoc(collection(db, "products"), {
        ...data,
        current_stock: 0, // Initial stock is 0, must be added via movement
        average_cost: 0,
        created_at: serverTimestamp(),
        is_archived: false,
    });
}

export async function updateProduct(id: string, data: Partial<Product>) {
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp(),
    });
}

export async function archiveProduct(id: string) {
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, {
        is_archived: true,
        archived_at: serverTimestamp(),
    });
}
