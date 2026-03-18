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
import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  User as UserIcon,
  UserCog,
  Mail,
  Lock,
  ShieldCheck,
  Sparkles,
  Camera,
  ImagePlus,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role, User } from "@/types";
import Image from "next/image";
import imageCompression from "browser-image-compression";

const CLOUDINARY_CLOUD_NAME = "dpap4mb1z";
const UPLOAD_PRESET = "products";

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
  password: z
    .string()
    .optional()
    .refine((val) => {
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
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatar_url || "");
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
      setAvatarUrl(initialData.avatar_url || "");
    } else {
      form.reset({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "sale",
      });
      setAvatarUrl("");
    }
  }, [initialData, form]);

  // ─── Avatar upload to Cloudinary ───────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let processedFile: File = file;

      // Compress if > 1MB
      if (file.size > 1024 * 1024) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 512,
          useWebWorker: true,
        });
        processedFile = new File([compressed], file.name, { type: file.type });
      }

      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "users");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Upload failed");
      }

      const data = await response.json();
      setAvatarUrl(data.secure_url);
      toast.success("Avatar uploaded!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isEditing && (!values.password || values.password.length < 6)) {
      form.setError("password", {
        message:
          "Password is required and must be at least 6 characters for new users.",
      });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && initialData) {
        const { password, ...updateData } = values;
        // Only include password if it's been changed
        const finalData = password ? values : updateData;
        await updateUser(initialData.id, {
          ...(finalData as any),
          avatar_url: avatarUrl || "",
        });
        toast.success("User updated successfully");
      } else {
        await createUser({
          ...(values as any),
          avatar_url: avatarUrl || "",
        });
        toast.success("User created successfully");
      }

      if (!isEditing) {
        form.reset();
        setAvatarUrl("");
      }
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(
        isEditing ? "Failed to update user" : "Failed to create user"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* ─── Avatar Upload Section ─────────────────── */}
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm mb-2">
            <Camera className="h-4 w-4" />
            Profile Photo
          </div>
          <div className="flex items-center gap-4">
            <div
              className="relative h-20 w-20 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors overflow-hidden group shrink-0"
              onClick={() => avatarInputRef.current?.click()}
            >
              {uploading ? (
                <div className="h-full w-full flex items-center justify-center bg-muted/50">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
              ) : avatarUrl ? (
                <>
                  <Image
                    src={avatarUrl}
                    alt="Avatar preview"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-1">
                  <ImagePlus className="h-6 w-6 text-emerald-400/60" />
                  <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-400/60">
                    Upload
                  </span>
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Click to upload a profile photo. Supported formats: JPG, PNG,
                WebP. Max 5MB.
              </p>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 px-2 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAvatarUrl("");
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove photo
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Account Information ────────────────────── */}
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
                  <Input
                    placeholder="John Doe"
                    className="bg-background/50 border-blue-100 focus-visible:ring-blue-500"
                    {...field}
                  />
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
                    <Input
                      placeholder="johndoe"
                      className="bg-background/50 border-blue-100 focus-visible:ring-blue-500"
                      {...field}
                    />
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

        {/* ─── Security & Login ───────────────────────── */}
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
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    className="bg-background/50 border-purple-100 focus-visible:ring-purple-500"
                    {...field}
                  />
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
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="bg-background/50 border-purple-100 focus-visible:ring-purple-500"
                    {...field}
                  />
                </FormControl>
                {isEditing && (
                  <p className="text-[10px] text-muted-foreground">
                    Leave empty to keep current password
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={loading || uploading}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20"
        >
          {loading ? (
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
          ) : isEditing ? (
            <UserCog className="h-5 w-5 mr-2" />
          ) : (
            <Sparkles className="h-5 w-5 mr-2" />
          )}
          <span className="font-semibold tracking-wide uppercase">
            {isEditing ? "Update User Account" : "Create User Account"}
          </span>
        </Button>
      </form>
    </Form>
  );
}
