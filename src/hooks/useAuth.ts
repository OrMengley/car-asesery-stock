import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check local storage for token expiration if exists
                const storedAuth = localStorage.getItem("user_auth");
                if (storedAuth) {
                    try {
                        const authData = JSON.parse(storedAuth);
                        const expirationTime = new Date(authData.expirationTime).getTime();
                        const now = new Date().getTime();

                        if (now > expirationTime) {
                            console.warn("User token expired, signing out...");
                            localStorage.removeItem("user_auth");
                            await auth.signOut();
                            setUser(null);
                        } else {
                            setUser(user);
                        }
                    } catch (e) {
                        setUser(user);
                    }
                } else {
                    setUser(user);
                }
            } else {
                setUser(null);
                localStorage.removeItem("user_auth");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, loading };
}
