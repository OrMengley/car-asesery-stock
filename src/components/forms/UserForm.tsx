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
import { createUser, updateUser } from "@/lib/firebase/actions";
import { useState, useEffect } from "react";
import { Loader2, User as UserIcon, UserCog, Mail, Lock, ShieldCheck, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role, User } from "@/types";

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
  password: z.string().optional().refine((val) => {
    // If it's a new user (no initialData), password must be at least 6 chars
    // This refined check will be more dynamic if we pass mode to schema, 
    // but for now we can handle basic validation here.
    return true; 
  }),
  role: z.enum(["admin", "sale", "logistic"] as const),
});

interface UserFormProps {
  onSuccess?: () => void;
  initialData?: User;
}

export function UserForm({ onSuccess, initialData }: UserFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      username: initialData?.username || "",
      email: (initialData as any)?.email || "",
      password: "",
      role: initialData?.role || "sale",
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        username: initialData.username,
        email: (initialData as any).email || "",
        password: "",
        role: initialData.role,
      });
    } else {
      form.reset({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "sale",
      });
    }
  }, [initialData, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isEditing && (!values.password || values.password.length < 6)) {
      form.setError("password", { message: "Password is required and must be at least 6 characters for new users." });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && initialData) {
        const { password, ...updateData } = values;
        // Only include password if it's been changed
        const finalData = password ? values : updateData;
        await updateUser(initialData.id, finalData as any);
        toast.success("User updated successfully");
      } else {
        await createUser(values as any);
        toast.success("User created successfully");
      }
      
      if (!isEditing) form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(isEditing ? "Failed to update user" : "Failed to create user");
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
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  {isEditing ? "New Password (Optional)" : "Security Password"}
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" className="bg-background/50 border-purple-100 focus-visible:ring-purple-500" {...field} />
                </FormControl>
                {isEditing && <p className="text-[10px] text-muted-foreground">Leave empty to keep current password</p>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20">
          {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : (isEditing ? <UserCog className="h-5 w-5 mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />)}
          <span className="font-semibold tracking-wide uppercase">
            {isEditing ? "Update User Account" : "Create User Account"}
          </span>
        </Button>
      </form>
    </Form>
  );
}
