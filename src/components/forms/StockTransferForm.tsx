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
import { createStockTransfer } from "@/lib/firebase/stock-transfer-actions";
import { getProducts } from "@/lib/firebase/actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { useState, useEffect } from "react";
import { 
  Package01Icon, 
  Home01Icon, 
  NoteIcon, 
  Sorting01Icon, 
  Loading01Icon,
  ArrowRight01Icon
} from "hugeicons-react";
import { Product, Warehouse } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  product_id: z.string().min(1, "Please select a product"),
  from_warehouse_id: z.string().min(1, "Please select origin warehouse"),
  to_warehouse_id: z.string().min(1, "Please select destination warehouse"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  note: z.string().optional(),
}).refine((data) => data.from_warehouse_id !== data.to_warehouse_id, {
  message: "Origin and destination warehouses must be different",
  path: ["to_warehouse_id"],
});

type FormValues = z.infer<typeof formSchema>;

interface StockTransferFormProps {
  onSuccess?: () => void;
}

export function StockTransferForm({ onSuccess }: StockTransferFormProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    async function fetchData() {
      const [prodData, whData] = await Promise.all([
        getProducts(),
        getWarehouses()
      ]);
      setProducts(prodData);
      setWarehouses(whData);
    }
    fetchData();
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      product_id: "",
      from_warehouse_id: "",
      to_warehouse_id: "",
      quantity: 1,
      note: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      await createStockTransfer({
        ...values,
        created_by: "admin", // Replace with auth user id
      });
      toast.success("Stock transfer recorded successfully");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to record stock transfer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100/50 space-y-4">
          <div className="flex items-center gap-2 text-violet-600 font-medium text-sm mb-2">
            <Package01Icon className="h-4 w-4" />
            Product & Quantity
          </div>
          
          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-background/50 border-violet-100 focus:ring-violet-500">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.barcode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity to Transfer</FormLabel>
                <FormControl>
                  <Input type="number" min={1} className="bg-background/50 border-violet-100 focus-visible:ring-violet-500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-medium text-sm mb-2">
            <Home01Icon className="h-4 w-4" />
            Warehouses
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="from_warehouse_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Warehouse</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 border-blue-100 focus:ring-blue-500">
                        <SelectValue placeholder="Origin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="to_warehouse_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Warehouse</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 border-blue-100 focus:ring-blue-500">
                        <SelectValue placeholder="Destination" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl>
                  <Input placeholder="Optional transfer note..." className="bg-background/50 border-gray-200 focus-visible:ring-primary" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20">
          {loading ? <Loading01Icon className="animate-spin h-5 w-5 mr-2" /> : <Sorting01Icon className="h-5 w-5 mr-2" />}
          <span className="font-semibold tracking-wide uppercase">Confirm Stock Transfer</span>
        </Button>
      </form>
    </Form>
  );
}
