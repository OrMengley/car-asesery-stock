"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createUser } from "@/lib/firebase/actions";
import { useState } from "react";
import { Loader2, User, UserCog, Mail, Lock, ShieldCheck, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@/types";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  username: z.string().min(3, {
    message: "Username must be at least 3 characters.",
  }),
  email: z.string().email({
    message: "Invalid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  role: z.enum(["admin", "sale", "logistic"] as const),
});

interface UserFormProps {
  onSuccess?: () => void;
}

export function UserForm({ onSuccess }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "sale",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await createUser(values as any);
      toast.success("User created successfully");
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-medium text-sm mb-2">
            <Sparkles className="h-4 w-4" />
            Account Information
          </div>
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" className="bg-background/50 border-blue-100 focus-visible:ring-blue-500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="johndoe" className="bg-background/50 border-blue-100 focus-visible:ring-blue-500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    Role
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 border-blue-100 focus:ring-blue-500">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="logistic">Logistic</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/50 space-y-4">
          <div className="flex items-center gap-2 text-purple-600 font-medium text-sm mb-2">
            <Lock className="h-4 w-4" />
            Security & Login
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john@example.com" className="bg-background/50 border-purple-100 focus-visible:ring-purple-500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Security Password
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className="bg-background/50 border-purple-100 focus-visible:ring-purple-500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20">
          {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />}
          <span className="font-semibold tracking-wide uppercase">Create User Account</span>
        </Button>
      </form>
    </Form>
  );
}
