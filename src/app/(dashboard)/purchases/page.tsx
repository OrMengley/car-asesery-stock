"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Add01Icon,
  Delete01Icon,
  Loading01Icon,
  ViewIcon,
  Cancel01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  Calendar01Icon,
  Search01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  MoneyReceiveSquareIcon,
  Package01Icon,
  PercentSquareIcon,
  MoneyAdd01Icon,
  CheckmarkCircle01Icon,
  UserIcon,
  NoteIcon,
  FilterIcon,
  Sorting01Icon,
} from "hugeicons-react";
import Image from "next/image";
import { getProducts } from "@/lib/firebase/actions";
import { getPurchases, createPurchase, deletePurchase, getPurchaseItems } from "@/lib/firebase/purchase-actions";
import { getSuppliers } from "@/lib/firebase/supplier-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, purchase, purchase_item, supplier, Warehouse } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOptimizedImageUrl } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Types for local form state ──────────────────────────
interface PurchaseItemDraft {
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  cost: number;
  total: number;
}

// ─── Main Page ───────────────────────────────────────────
export default function PurchasePage() {
  // Data
  const [purchases, setPurchases] = useState<purchase[]>([]);
  const [allPurchaseItems, setAllPurchaseItems] = useState<purchase_item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Detail sheet
  const [viewingPurchase, setViewingPurchase] = useState<purchase | null>(null);
  const [viewingItems, setViewingItems] = useState<purchase_item[]>([]);

  // Form fields
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [supplierName, setSupplierName] = useState(""); // Still keep for display if needed, but ID is primary
  const [referenceNo, setReferenceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [draftItems, setDraftItems] = useState<PurchaseItemDraft[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ─── Product search for adding items ────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // ─── Fetch data ─────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const [purchaseData, productData, itemData, supplierData, warehouseData] = await Promise.all([
        getPurchases(),
        getProducts(),
        getPurchaseItems(),
        getSuppliers(),
        getWarehouses(),
      ]);
      setPurchases(purchaseData);
      setProducts(productData);
      setAllPurchaseItems(itemData);
      setSuppliers(supplierData);
      setWarehouses(warehouseData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load purchase data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Product Map ────────────────────────────────────────
  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  const supplierMap = useMemo(() => {
    const map: Record<string, supplier> = {};
    suppliers.forEach((s) => (map[s.id] = s));
    return map;
  }, [suppliers]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, Warehouse> = {};
    warehouses.forEach((w) => (map[w.id] = w));
    return map;
  }, [warehouses]);

  // ─── Dashboard stats ───────────────────────────────────
  const stats = useMemo(() => {
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, p) => sum + p.total_price, 0);
    const totalItems = allPurchaseItems.reduce((sum, i) => sum + i.quantity, 0);
    const thisMonth = purchases.filter((p) => {
      const now = new Date();
      const d = new Date(p.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthSpent = thisMonth.reduce((sum, p) => sum + p.total_price, 0);
    return { totalPurchases, totalSpent, totalItems, thisMonthSpent };
  }, [purchases, allPurchaseItems]);

  // ─── Draft calculations ─────────────────────────────────
  const draftSubTotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.total, 0),
    [draftItems]
  );
  const draftTotalPrice = useMemo(
    () => draftSubTotal - discount + tax,
    [draftSubTotal, discount, tax]
  );

  // ─── Filtering & pagination ─────────────────────────────
  const filteredPurchases = useMemo(() => {
    let result = [...purchases];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.reference_no.toLowerCase().includes(q) ||
          (supplierMap[p.supplier_id]?.name || "Unknown").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) =>
      sortOrder === "desc"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return result;
  }, [purchases, searchQuery, sortOrder]);

  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const paginatedPurchases = useMemo(
    () => filteredPurchases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredPurchases, currentPage]
  );

  // ─── Product search results ─────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [productSearch, products]);

  // ─── Add item to draft ──────────────────────────────────
  function addItemToDraft(product: Product) {
    const existing = draftItems.find((d) => d.product_id === product.id);
    if (existing) {
      setDraftItems(
        draftItems.map((d) =>
          d.product_id === product.id
            ? { ...d, quantity: d.quantity + 1, total: (d.quantity + 1) * d.cost }
            : d
        )
      );
    } else {
      setDraftItems([
        ...draftItems,
        {
          product_id: product.id,
          product_name: product.name,
          product_image: product.thumbnails?.[0] || product.images?.[0],
          quantity: 1,
          cost: product.cost_recommand || 0,
          total: product.cost_recommand || 0,
        },
      ]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
    toast.success(`Added ${product.name}`);
  }

  function updateDraftItem(idx: number, field: "quantity" | "cost", value: number) {
    setDraftItems(
      draftItems.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.cost;
        return updated;
      })
    );
  }

  function removeDraftItem(idx: number) {
    setDraftItems(draftItems.filter((_, i) => i !== idx));
  }

  // ─── Generate ref ───────────────────────────────────────
  function generateRefNo() {
    const d = format(new Date(), "yyyyMMdd");
    const r = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    setReferenceNo(`PO-${d}-${r}`);
  }

  // ─── Create purchase ───────────────────────────────────
  async function handleCreate() {
    if (draftItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (!referenceNo) {
      toast.error("Reference number is required");
      return;
    }
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    setCreating(true);
    try {
      const purchaseData = {
        supplier_id: selectedSupplierId,
        warehouse_id: selectedWarehouseId,
        reference_no: referenceNo,
        created_by: "admin",
        date: new Date(purchaseDate),
        sub_total: draftSubTotal,
        discount,
        tax,
        total_price: draftTotalPrice,
        updated_by: "admin",
      };

      const items = draftItems.map((d) => ({
        product_id: d.product_id,
        quantity: d.quantity,
        cost: d.cost,
        total: d.total,
      }));

      await createPurchase(purchaseData, items);
      toast.success("Purchase created successfully!");
      resetForm();
      setCreateOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to create purchase");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setSelectedSupplierId("");
    setSelectedWarehouseId("");
    setSupplierName("");
    setReferenceNo("");
    setPurchaseDate(format(new Date(), "yyyy-MM-dd"));
    setDiscount(0);
    setTax(0);
    setDraftItems([]);
  }

  // ─── View purchase detail ──────────────────────────────
  async function handleViewPurchase(p: purchase) {
    setViewingPurchase(p);
    const items = allPurchaseItems.filter((i) => i.purchase_id === p.id);
    setViewingItems(items);
  }

  // ─── Delete purchase ───────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await deletePurchase(id);
      toast.success("Purchase deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  }

  // ─── Loading state ─────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loading01Icon className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading purchases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-4">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <ShoppingCart01Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">Manage purchase orders and supplier expenses</p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm();
            generateRefNo();
            setCreateOpen(true);
          }}
          className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 gap-2"
        >
          <Add01Icon className="h-4 w-4" />
          New Purchase
        </Button>
      </div>

      {/* ─── Dashboard Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200/50 dark:border-violet-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Total Purchases</p>
              <Invoice01Icon className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-2xl font-black text-violet-700 dark:text-violet-300">{stats.totalPurchases}</p>
            <p className="text-xs text-muted-foreground mt-1">All-time orders</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200/50 dark:border-emerald-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Spent</p>
              <MoneyReceiveSquareIcon className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">${stats.totalSpent.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all purchases</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200/50 dark:border-blue-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Items Purchased</p>
              <Package01Icon className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{stats.totalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">Total units purchased</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">This Month</p>
              <Calendar01Icon className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300">${stats.thisMonthSpent.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{format(new Date(), "MMMM yyyy")}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filters ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference or supplier..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 h-10 bg-background border-border/60"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          className="h-10 w-10 shrink-0"
          title={sortOrder === "desc" ? "Newest first" : "Oldest first"}
        >
          {sortOrder === "desc" ? (
            <ArrowDown01Icon className="h-4 w-4" />
          ) : (
            <ArrowUp01Icon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* ─── Purchase Table ────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 font-semibold text-xs">#</TableHead>
              <TableHead className="font-semibold text-xs">Reference</TableHead>
              <TableHead className="font-semibold text-xs">Supplier</TableHead>
              <TableHead className="font-semibold text-xs text-right">Sub Total</TableHead>
              <TableHead className="font-semibold text-xs text-right">Discount</TableHead>
              <TableHead className="font-semibold text-xs text-right">Tax</TableHead>
              <TableHead className="font-semibold text-xs text-right">Total</TableHead>
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ShoppingCart01Icon className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No purchases found.</p>
                    <p className="text-sm">Create a new purchase to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPurchases.map((p, idx) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleViewPurchase(p)}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800 font-mono text-xs">
                        {p.reference_no}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {supplierMap[p.supplier_id]?.name || p.supplier_id}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">${p.sub_total.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm font-mono text-orange-600 dark:text-orange-400">
                    {p.discount > 0 ? `-$${p.discount.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-blue-600 dark:text-blue-400">
                    {p.tax > 0 ? `$${p.tax.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-sm font-mono">${p.total_price.toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(p.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/50"
                        onClick={() => handleViewPurchase(p)}
                      >
                        <ViewIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Delete01Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredPurchases.length)} of {filteredPurchases.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-8 w-8 text-xs"
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── CREATE PURCHASE SHEET ─────────────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="!w-full sm:!max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <ShoppingCart01Icon className="h-4 w-4 text-white" />
              </div>
              New Purchase Order
            </SheetTitle>
            <SheetDescription>Add products and supplier details for this purchase</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">
              {/* Purchase Info */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Invoice01Icon className="h-4 w-4 text-violet-500" />
                  Purchase Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Reference No.</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="PO-20260213-001"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Supplier</Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No suppliers found. Please create one first.
                          </div>
                        ) : (
                          suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{s.name}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Warehouse (Destination)</Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No warehouses found. Please create one first.
                          </div>
                        ) : (
                          warehouses.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{w.name}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Add Products */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package01Icon className="h-4 w-4 text-blue-500" />
                  Purchase Items
                  {draftItems.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{draftItems.length} items</Badge>
                  )}
                </h3>

                {/* Product search */}
                <div className="relative">
                  <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products by name or barcode..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="pl-10 h-10"
                  />
                  {/* Dropdown */}
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-popover shadow-xl max-h-64 overflow-auto">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => addItemToDraft(product)}
                        >
                          <div className="h-9 w-9 rounded-lg overflow-hidden bg-muted shrink-0 border">
                            {product.thumbnails?.[0] || product.images?.[0] ? (
                              <Image
                                src={getOptimizedImageUrl(product.thumbnails?.[0] || product.images[0])}
                                alt={product.name}
                                width={36}
                                height={36}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Package01Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{product.barcode}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold">${product.cost_recommand?.toFixed(2) || "0.00"}</p>
                            <p className="text-[10px] text-muted-foreground">cost</p>
                            <p className="text-[10px] text-emerald-600 font-medium">Stock: {product.current_stock || 0}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Draft items list */}
                {draftItems.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center">
                    <Package01Icon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Search and add products above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {draftItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        {/* Product image */}
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0 border">
                          {item.product_image ? (
                            <Image
                              src={getOptimizedImageUrl(item.product_image)}
                              alt={item.product_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package01Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">QTY</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateDraftItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                            className="h-8 w-16 text-center text-sm"
                          />
                        </div>

                        {/* Cost */}
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">$</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.cost}
                            onChange={(e) => updateDraftItem(idx, "cost", Math.max(0, Number(e.target.value)))}
                            className="h-8 w-20 text-right text-sm font-mono"
                          />
                        </div>

                        {/* Total */}
                        <div className="w-20 text-right">
                          <p className="text-sm font-bold font-mono">${item.total.toFixed(2)}</p>
                        </div>

                        {/* Remove */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
                          onClick={() => removeDraftItem(idx)}
                        >
                          <Cancel01Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              {draftItems.length > 0 && (
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MoneyAdd01Icon className="h-4 w-4 text-emerald-500" />
                    Order Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span className="font-mono font-semibold">${draftSubTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-4">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <PercentSquareIcon className="h-3.5 w-3.5" /> Discount
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className="h-8 w-28 text-right text-sm font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm gap-4">
                      <span className="text-muted-foreground">Tax</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tax}
                        onChange={(e) => setTax(Number(e.target.value))}
                        className="h-8 w-28 text-right text-sm font-mono"
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Total</span>
                      <span className="text-xl font-black font-mono text-violet-700 dark:text-violet-300">
                        ${draftTotalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Bottom action */}
          <div className="p-6 border-t bg-muted/30 shrink-0">
            <Button
              onClick={handleCreate}
              disabled={creating || draftItems.length === 0}
              className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 gap-2"
            >
              {creating ? (
                <Loading01Icon className="h-5 w-5 animate-spin" />
              ) : (
                <CheckmarkCircle01Icon className="h-5 w-5" />
              )}
              <span className="font-semibold tracking-wide">
                {creating ? "Creating..." : "Create Purchase Order"}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── VIEW PURCHASE DETAIL SHEET ────────────────── */}
      <Sheet open={!!viewingPurchase} onOpenChange={(open) => !open && setViewingPurchase(null)}>
        <SheetContent side="right" className="!w-full sm:!max-w-xl p-0 flex flex-col">
          {viewingPurchase && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 shrink-0">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Invoice01Icon className="h-4 w-4 text-white" />
                  </div>
                  Purchase Details
                </SheetTitle>
                <SheetDescription>
                  <Badge variant="outline" className="font-mono bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800">
                    {viewingPurchase.reference_no}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6 space-y-6">
                  {/* Order Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted/40 p-4 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier</p>
                      <p className="text-sm font-bold">{supplierMap[viewingPurchase.supplier_id]?.name || viewingPurchase.supplier_id}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Warehouse</p>
                      <p className="text-sm font-bold">{warehouseMap[viewingPurchase.warehouse_id]?.name || viewingPurchase.warehouse_id}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</p>
                      <p className="text-sm font-bold">{format(new Date(viewingPurchase.date), "dd MMM yyyy")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Created By</p>
                      <p className="text-sm font-bold">{viewingPurchase.created_by}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Items */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package01Icon className="h-4 w-4 text-blue-500" />
                      Items ({viewingItems.length})
                    </h4>
                    {viewingItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No items found for this purchase.</p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="text-xs font-semibold">Product</TableHead>
                              <TableHead className="text-xs font-semibold text-center">Qty</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Cost</TableHead>
                              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {viewingItems.map((item) => {
                              const product = productMap[item.product_id];
                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded-md overflow-hidden bg-muted shrink-0 border">
                                        {product?.thumbnails?.[0] || product?.images?.[0] ? (
                                          <Image
                                            src={getOptimizedImageUrl(product.thumbnails?.[0] || product.images[0])}
                                            alt={product?.name || "Product"}
                                            width={32}
                                            height={32}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="h-full w-full flex items-center justify-center">
                                            <Package01Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-sm font-medium truncate">
                                        {product?.name || item.product_id}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-sm font-mono">{item.quantity}</TableCell>
                                  <TableCell className="text-right text-sm font-mono">${item.cost.toFixed(2)}</TableCell>
                                  <TableCell className="text-right text-sm font-bold font-mono">${item.total.toFixed(2)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Summary */}
                  <div className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 p-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span className="font-mono">${viewingPurchase.sub_total.toFixed(2)}</span>
                    </div>
                    {viewingPurchase.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600">Discount</span>
                        <span className="font-mono text-orange-600">-${viewingPurchase.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingPurchase.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Tax</span>
                        <span className="font-mono text-blue-600">${viewingPurchase.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-base">Grand Total</span>
                      <span className="text-2xl font-black font-mono text-violet-700 dark:text-violet-300">
                        ${viewingPurchase.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
