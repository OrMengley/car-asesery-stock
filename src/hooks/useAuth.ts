import { useEffect, useState } from "react";
import { User, Role } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const storedAuth = localStorage.getItem("user_auth");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        if (parsed?.user_info) {
          setUser(parsed.user_info);
          setRole(parsed.user_info.role || null);
        }
      } catch (e) {
        console.error("Error reading stored user session", e);
        localStorage.removeItem("user_auth");
      }
    }
    setLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    setRole(userData.role);
    localStorage.setItem("user_auth", JSON.stringify({
      uid: userData.id,
      user_info: userData,
      lastLogin: new Date().toISOString(),
    }));
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem("user_auth");
  };

  return { user, loading, role, userInfo: user, login, logout };
}
