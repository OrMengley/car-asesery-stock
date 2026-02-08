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
import { useState } from "react";
import { Loader2, Tag, Sparkles } from "lucide-react";
import { createCategory, updateCategory } from "@/lib/firebase/actions";
import { Category } from "@/types";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Category name must be at least 2 characters.",
  }),
});

interface CategoryFormProps {
  initialData?: Category;
  onSuccess?: () => void;
}

export function CategoryForm({ initialData, onSuccess }: CategoryFormProps) {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      if (initialData?.id) {
        await updateCategory(initialData.id, values.name);
        toast.success("Category updated successfully");
      } else {
        await createCategory(values.name);
        toast.success("Category created successfully");
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(initialData?.id ? "Failed to update category" : "Failed to create category");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-100/50 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-teal-600 font-bold text-base mb-2">
            <Tag className="h-5 w-5" />
            General Information
          </div>
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold text-slate-700">Category Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Electronics, Car Parts, etc." 
                    className="h-12 bg-background/50 border-teal-100 focus-visible:ring-teal-500 text-base" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full h-12 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-teal-500/20"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />}
          <span className="font-semibold tracking-wide uppercase">
            {initialData ? "Update Category" : "Create Category"}
          </span>
        </Button>
      </form>
    </Form>
  );
}
