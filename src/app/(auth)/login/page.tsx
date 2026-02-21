"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get ID Token which includes expiration
      const tokenResult = await user.getIdTokenResult();
      
      // Fetch user info from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      if (userData?.is_archived) {
        throw new Error("Your account has been archived. Please contact an administrator.");
      }

      // Save to local storage
      const authData = {
        uid: user.uid,
        email: user.email,
        token: tokenResult.token,
        expirationTime: tokenResult.expirationTime,
        user_info: userData,
        lastLogin: new Date().toISOString()
      };
      
      localStorage.setItem("user_auth", JSON.stringify(authData));
      
      router.push("/"); // Redirect to dashboard after login
    } catch (err: any) {
      console.error("Login error details:", err);
      
      const errorCode = err.code;
      if (errorCode === "auth/invalid-credential") {
        setError("Invalid email or password. Please try again.");
      } else if (errorCode === "auth/user-not-found") {
        setError("No account found with this email.");
      } else if (errorCode === "auth/wrong-password") {
        setError("Incorrect password.");
      } else if (errorCode === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to login. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Login</h1>
            <p className="text-balance text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>
          <form onSubmit={handleLogin} className="grid gap-4">
            {error && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@antigravity.inc"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden bg-zinc-900 lg:flex items-center justify-center">
        <h1 className="text-4xl font-bold text-white tracking-widest">
            ANTIGRAVITY
        </h1>
      </div>
    </div>
  );
}
