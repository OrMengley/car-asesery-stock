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
import { adjustStock } from "@/lib/firebase/stock-actions";
import { getProducts } from "@/lib/firebase/actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { sendAdjustmentNotification } from "@/lib/telegram";
import { useState, useEffect, useMemo } from "react";
import {
  Package01Icon,
  Home01Icon,
  Loading01Icon,
  Search01Icon,
  QrCodeIcon,
  NoteIcon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  MoneyReceiveSquareIcon,
} from "hugeicons-react";
import { Product, Warehouse } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProductSelectModal } from "@/components/modals/ProductSelectModal";
import Image from "next/image";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

const ADJUSTMENT_REASONS = [
  "Count Correction",
  "Damaged Goods",
  "Expired",
  "Lost / Missing",
  "Found / Recovered",
  "Return to Stock",
  "Sample / Giveaway",
  "Other",
] as const;

const formSchema = z.object({
  type: z.enum(["up", "down"], { message: "Select adjustment type" }),
  warehouse_id: z.string().min(1, "Please select a warehouse"),
  product_id: z.string().min(1, "Please select a product"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  cost: z.coerce.number().min(0).optional(),
  reason: z.string().min(1, "Please select a reason"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface StockAdjustmentFormProps {
  onSuccess?: () => void;
}

export function StockAdjustmentForm({ onSuccess }: StockAdjustmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [prodData, whData] = await Promise.all([
        getProducts(),
        getWarehouses(),
      ]);
      setProducts(prodData);
      setWarehouses(whData);
    }
    fetchData();
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      type: "up",
      warehouse_id: "",
      product_id: "",
      quantity: 1,
      cost: 0,
      reason: "",
      note: "",
    },
  });

  const watchType = form.watch("type");
  const watchProductId = form.watch("product_id");
  const watchWarehouseId = form.watch("warehouse_id");

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  const selectedProduct = watchProductId
    ? productMap[watchProductId]
    : null;
  const thumbnail =
    selectedProduct?.thumbnails?.[0] || selectedProduct?.images?.[0];

  // Fetch current stock when product+warehouse change
  useEffect(() => {
    async function fetchCurrentStock() {
      if (!watchProductId || !watchWarehouseId) {
        setCurrentStock(null);
        return;
      }
      try {
        const stocksQuery = query(
          collection(db, "stocks"),
          where("product_id", "==", watchProductId),
          where("warehouse_id", "==", watchWarehouseId),
          where("is_archived", "==", false)
        );
        const snap = await getDocs(stocksQuery);
        let total = 0;
        snap.forEach((d) => (total += d.data().quantity || 0));
        setCurrentStock(total);
      } catch {
        setCurrentStock(null);
      }
    }
    fetchCurrentStock();
  }, [watchProductId, watchWarehouseId]);

  // Set default cost from product's cost_recommand when product changes
  useEffect(() => {
    if (selectedProduct?.cost_recommand && watchType === "up") {
      form.setValue("cost", selectedProduct.cost_recommand);
    }
  }, [watchProductId, watchType]);

  const handleSelectProduct = (product: Product) => {
    form.setValue("product_id", product.id, { shouldValidate: true });
  };

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      // Get user info
      let createdBy = "admin";
      let createdByName = "Admin";
      try {
        const authStr = localStorage.getItem("user_auth");
        if (authStr) {
          const authData = JSON.parse(authStr);
          createdBy = authData?.uid || "admin";
          createdByName = authData?.user_info?.name || "Admin";
        }
      } catch {}

      const reasonText =
        values.reason === "Other" && values.note
          ? `${values.reason}: ${values.note}`
          : values.reason;

      await adjustStock({
        product_id: values.product_id,
        warehouse_id: values.warehouse_id,
        type: values.type,
        quantity: values.quantity,
        cost: values.type === "up" ? values.cost : undefined,
        note: reasonText,
        created_by: createdBy,
      });

      // Send Telegram notification
      const product = productMap[values.product_id];
      const warehouse = warehouses.find((w) => w.id === values.warehouse_id);

      // Calculate stock levels for notification
      const prevStock = currentStock ?? 0;
      const newStock =
        values.type === "up"
          ? prevStock + values.quantity
          : prevStock - values.quantity;

      try {
        await sendAdjustmentNotification({
          productName: product?.name || "Unknown",
          direction: values.type,
          quantity: values.quantity,
          warehouseName: warehouse?.name || "Unknown",
          reason: reasonText,
          performedBy: createdByName,
          adjustmentTime: new Date(),
          previousStock: prevStock,
          newStock: Math.max(0, newStock),
        });
      } catch (e) {
        console.error("Failed to send adjustment notification", e);
      }

      const label = values.type === "up" ? "increased" : "decreased";
      toast.success(
        `Stock ${label} by ${values.quantity} for ${product?.name || "product"}`
      );

      form.reset({
        type: "up",
        warehouse_id: "",
        product_id: "",
        quantity: 1,
        cost: 0,
        reason: "",
        note: "",
      });
      setCurrentStock(null);
      onSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Adjustment Type Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs tracking-wider uppercase">
              Adjustment Type
            </div>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => field.onChange("up")}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                          field.value === "up"
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/10"
                            : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/30"
                        }`}
                      >
                        <ArrowUp01Icon className="h-5 w-5" />
                        Increase Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("down")}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                          field.value === "down"
                            ? "border-rose-400 bg-rose-50 text-rose-700 shadow-sm shadow-rose-500/10"
                            : "border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50/30"
                        }`}
                      >
                        <ArrowDown01Icon className="h-5 w-5" />
                        Decrease Stock
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* Warehouse Selection */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs tracking-wider uppercase">
              <Home01Icon className="h-4 w-4 text-blue-600" />
              Warehouse
            </div>
            <FormField
              control={form.control}
              name="warehouse_id"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[11px] font-medium text-slate-500">
                    Select Warehouse
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white border-slate-200 focus:ring-2 focus:ring-blue-500 text-xs font-medium rounded-xl">
                        <SelectValue placeholder="Select Warehouse" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      {warehouses.map((w) => (
                        <SelectItem
                          key={w.id}
                          value={w.id}
                          className="text-xs"
                        >
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* Product Selection */}
          <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-100 space-y-3">
            <div className="flex items-center gap-2 text-violet-900 font-bold text-sm">
              <Package01Icon className="h-4 w-4 text-violet-600" />
              Product
            </div>

            <FormField
              control={form.control}
              name="product_id"
              render={() => (
                <FormItem className="space-y-0">
                  <FormControl>
                    {selectedProduct ? (
                      <div
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-violet-100 bg-violet-50/30 hover:bg-violet-50/70 hover:border-violet-300 cursor-pointer transition-all group"
                      >
                        <div className="h-10 w-10 rounded-lg bg-white border border-slate-200/70 flex items-center justify-center shrink-0 overflow-hidden relative shadow-2xs">
                          {thumbnail ? (
                            <Image
                              src={thumbnail}
                              alt={selectedProduct.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <Package01Icon className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                            {selectedProduct.name}
                          </p>
                          {selectedProduct.barcode && (
                            <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                              <QrCodeIcon className="h-2.5 w-2.5 text-violet-500" />
                              {selectedProduct.barcode}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] text-violet-600 border-violet-200 bg-white group-hover:bg-violet-100 font-medium"
                          >
                            Change
                          </Badge>
                          {currentStock !== null && (
                            <span className="text-[10px] font-semibold text-slate-500">
                              Stock: <span className="text-slate-900 font-bold">{currentStock}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setModalOpen(true)}
                        className="w-full h-11 border-dashed border-violet-300 text-violet-600 hover:bg-violet-50/80 hover:border-violet-400 justify-center text-xs gap-2 font-semibold rounded-xl bg-violet-50/30"
                      >
                        <Search01Icon className="h-4 w-4 text-violet-500" />
                        Search & Select Product...
                      </Button>
                    )}
                  </FormControl>
                  <FormMessage className="text-[11px] mt-1" />
                </FormItem>
              )}
            />
          </div>

          {/* Quantity & Cost */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Adjustment Quantity
              </span>
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange(
                              Math.max(1, (Number(field.value) || 1) - 1)
                            )
                          }
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-bold border-r border-slate-100 transition-colors text-sm"
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          min={1}
                          className="w-16 h-9 text-center text-xs font-bold text-slate-900 border-none focus-visible:ring-0 focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            field.onChange((Number(field.value) || 0) + 1)
                          }
                          className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-bold border-l border-slate-100 transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost — only for Increase */}
            {watchType === "up" && (
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                      <MoneyReceiveSquareIcon className="h-3.5 w-3.5 text-emerald-500" />
                      Unit Cost ($)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        className="bg-white border-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500 text-xs h-10 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Reason */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs tracking-wider uppercase">
              <NoteIcon className="h-4 w-4 text-amber-600" />
              Reason
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[11px] font-medium text-slate-500">
                    Adjustment Reason
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 bg-white border-amber-200 focus:ring-2 focus:ring-amber-500 text-xs font-medium rounded-xl">
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      {ADJUSTMENT_REASONS.map((reason) => (
                        <SelectItem
                          key={reason}
                          value={reason}
                          className="text-xs"
                        >
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {/* Additional Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[11px] font-medium text-slate-500">
                    Additional Note (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Add more details..."
                      className="bg-white border-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500 text-xs h-10 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className={`w-full h-12 rounded-xl shadow-md transition-all font-bold tracking-wide uppercase text-xs gap-2 ${
              watchType === "down"
                ? "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-700 hover:to-red-800 text-white shadow-rose-500/25"
                : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-500/25"
            }`}
          >
            {loading ? (
              <Loading01Icon className="animate-spin h-5 w-5" />
            ) : watchType === "up" ? (
              <ArrowUp01Icon className="h-5 w-5" />
            ) : (
              <ArrowDown01Icon className="h-5 w-5" />
            )}
            <span>
              Confirm{" "}
              {watchType === "up" ? "Stock Increase" : "Stock Decrease"}
            </span>
          </Button>
        </form>
      </Form>

      {/* Product Selection Modal */}
      <ProductSelectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={products}
        selectedProductIds={watchProductId ? [watchProductId] : []}
        onSelectProduct={handleSelectProduct}
      />
    </>
  );
}
