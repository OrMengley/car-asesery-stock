import { db, firebaseConfig } from "./config";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
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

export async function createUser(data: { name: string; username: string; role: Role; email: string; password?: string; avatar_url?: string, warehouse_id?: string }) {
    if (!data.password) throw new Error("Password is required for new users");

    // Check if username already exists
    const existingQ = query(
        collection(db, "users"),
        where("username", "==", data.username.toLowerCase())
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
        throw new Error(`Username "${data.username}" is already taken.`);
    }

    await addDoc(collection(db, "users"), {
        name: data.name,
        username: data.username.toLowerCase(),
        email: data.email || "",
        password: data.password,
        role: data.role,
        warehouse_id: data.warehouse_id || "",
        avatar_url: data.avatar_url || "",
        created_at: serverTimestamp(),
        is_archived: false,
    });
}

export async function loginUser(identifier: string, pass: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    
    // Search by username
    const qUsername = query(
        collection(db, "users"),
        where("username", "==", cleanId),
        where("is_archived", "==", false)
    );
    let snap = await getDocs(qUsername);

    if (snap.empty) {
        // Search by email
        const qEmail = query(
            collection(db, "users"),
            where("email", "==", cleanId),
            where("is_archived", "==", false)
        );
        snap = await getDocs(qEmail);
    }

    if (snap.empty) {
        throw new Error("Invalid username/email or password.");
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data() as User;

    if (userData.password !== pass) {
        throw new Error("Invalid username/email or password.");
    }

    return {
        ...userData,
        id: userDoc.id,
        created_at: userData.created_at,
    };
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

export async function changeOwnPassword(userId: string, currentPass: string, newPass: string) {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);
    
    if (!userSnap.exists()) throw new Error("User not found.");
    if (userSnap.data().password !== currentPass) {
        throw new Error("auth/wrong-password");
    }

    await updateDoc(userDocRef, {
        password: newPass,
        password_updated_at: serverTimestamp(),
        updated_at: serverTimestamp(),
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

export async function createProduct(data: Omit<Product, "id" | "created_at" | "is_archived">) {
    await addDoc(collection(db, "products"), {
        ...data,
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
