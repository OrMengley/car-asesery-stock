import { db } from "./config";
import {
    collection,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "./config";
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
    // To create a user without logging out the current admin session,
    // we use a secondary Firebase app instance.
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);

    try {
        if (!data.password) throw new Error("Password is required for new users");

        // 1. Create the user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            data.email,
            data.password
        );
        const authId = userCredential.user.uid;

        // 2. Create the user document in Firestore using the same ID
        const userDocRef = doc(db, "users", authId);
        await setDoc(userDocRef, {
            name: data.name,
            username: data.username,
            email: data.email,
            role: data.role,
            created_at: serverTimestamp(),
            is_archived: false,
        });

        // We use updateDoc on a doc(db, "users", authId) so we can control the ID, 
        // but if it doesn't exist we should use setDoc.
        // Actually, let's use setDoc to be safe.
    } catch (error) {
        console.error("Error creating auth user:", error);
        throw error;
    } finally {
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
    }
}

export async function archiveUser(id: string) {
    const docRef = doc(db, "users", id);
    await updateDoc(docRef, {
        is_archived: true,
        archived_at: serverTimestamp(),
    });
}

export async function updateUser(id: string, data: Partial<User>) {
    const docRef = doc(db, "users", id);
    await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp(),
    });
}

export async function deleteUserPermanent(id: string) {
    const docRef = doc(db, "users", id);
    await deleteDoc(docRef);
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

export async function createProduct(data: Omit<Product, "id" | "created_at" | "is_archived" | "current_stock">) {
    await addDoc(collection(db, "products"), {
        ...data,
        current_stock: 0, // Initial stock is 0, must be added via movement
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
