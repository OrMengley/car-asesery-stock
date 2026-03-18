"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getProducts,
  getCategories,
} from "@/lib/firebase/actions";
import { getStocks } from "@/lib/firebase/stock-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, Category, Stock, Warehouse, ProductWithStock } from "@/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search01Icon,
  Package01Icon,
  ViewIcon,
  Calendar01Icon,
  Location01Icon,
  Loading01Icon,
  LayoutGridIcon,
  ListViewIcon,
  FilterIcon,
  Cancel01Icon,
} from "hugeicons-react";
import Image from "next/image";
import { getOptimizedImageUrl } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ProductMenuPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Mobile filter drawer
  const [filterOpen, setFilterOpen] = useState(false);

  // Product detail dialog
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  async function fetchData() {
    try {
      setLoading(true);
      const [p, c, s, w] = await Promise.all([
        getProducts(),
        getCategories(),
        getStocks(),
        getWarehouses(),
      ]);

      const stockMap: Record<string, number> = {};
      s.forEach((stock) => {
        stockMap[stock.product_id] = (stockMap[stock.product_id] || 0) + stock.quantity;
      });

      const productsWithStock = p.map((prod) => ({
        ...prod,
        current_stock: stockMap[prod.id] || 0,
      }));

      setProducts(productsWithStock);
      setCategories(c);
      setStocks(s);
      setWarehouses(w);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.current_stock > 0);
    if (selectedCategoryId !== "all") {
      result = result.filter((p) => p.category_id === selectedCategoryId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedCategoryId, searchQuery]);

  const productBatches = useMemo(() => {
    if (!selectedProduct) return [];
    return stocks
      .filter((s) => s.product_id === selectedProduct.id && s.quantity > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedProduct, stocks]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses.forEach((w) => {
      map[w.id] = w.name;
    });
    return map;
  }, [warehouses]);

  const batchTotals = useMemo(() => {
    const totalQty = productBatches.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = productBatches.reduce(
      (sum, b) => sum + b.quantity * b.cost,
      0
    );
    return { totalQty, totalValue };
  }, [productBatches]);

  function handleViewDetails(product: ProductWithStock) {
    setSelectedProduct(product);
    setSelectedImageIndex(0);
    setDetailOpen(true);
  }

  const categoryName =
    selectedCategoryId === "all"
      ? "All Products"
      : categories.find((c) => c.id === selectedCategoryId)?.name || "Products";

  const CategoryList = () => (
    <div className="space-y-0.5">
      <button
        onClick={() => {
          setSelectedCategoryId("all");
          setFilterOpen(false);
        }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          selectedCategoryId === "all"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span>All Products</span>
        <span className="text-xs tabular-nums">
          {products.filter((p) => p.current_stock > 0).length}
        </span>
      </button>
      {categories.map((cat) => {
        const count = products.filter(
          (p) => p.category_id === cat.id && p.current_stock > 0
        ).length;
        return (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategoryId(cat.id);
              setFilterOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategoryId === cat.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="truncate mr-2">{cat.name}</span>
            <span className="text-xs tabular-nums shrink-0">{count}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ─── STICKY TOOLBAR ─────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          {/* Mobile: filter button */}
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden shrink-0 h-9 w-9"
            onClick={() => setFilterOpen(true)}
          >
            <FilterIcon className="h-4 w-4" />
          </Button>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Cancel01Icon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`h-9 w-9 flex items-center justify-center transition-colors ${
                viewMode === "grid"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`h-9 w-9 flex items-center justify-center transition-colors ${
                viewMode === "list"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <ListViewIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── BODY ───────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* ─── SIDEBAR (desktop only) ─────────────────────── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-[80px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">
              Categories
            </p>
            <CategoryList />
          </div>
        </aside>

        {/* ─── MAIN CONTENT ───────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Breadcrumb / Path */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{categoryName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? "Loading..." : `${filteredProducts.length} items in stock`}
              </p>
            </div>
          </div>

          {/* ─── LOADING ─────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Loading01Icon className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed text-muted-foreground gap-3">
              <Package01Icon className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No products matched your criteria</p>
              {(searchQuery || selectedCategoryId !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoryId("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ─── GRID VIEW ───────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="group bg-card border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
                  onClick={() => handleViewDetails(p)}
                >
                  {/* Image */}
                  <div className="bg-muted/30 aspect-[4/3] relative flex items-center justify-center overflow-hidden">
                    {p.thumbnails?.[0] ? (
                      <Image
                        src={getOptimizedImageUrl(p.thumbnails[0])}
                        alt={p.name}
                        fill
                        className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Package01Icon className="h-14 w-14 text-muted-foreground/20" />
                    )}
                    {/* Stock badge overlay */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-md ${
                          p.current_stock > 10
                            ? "bg-background border text-foreground"
                            : p.current_stock > 0
                            ? "bg-background border border-amber-300 text-amber-700"
                            : "bg-background border border-red-300 text-red-600"
                        }`}
                      >
                        {p.current_stock} in stock
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                        {categories.find((c) => c.id === p.category_id)?.name || "Uncategorized"}
                      </p>
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-foreground">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {p.barcode}
                      </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold tabular-nums">${p.price.toFixed(2)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(p);
                        }}
                      >
                        <ViewIcon className="h-3.5 w-3.5" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ─── LIST VIEW ───────────────────────────────── */
            <div className="rounded-xl border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 bg-muted/40 border-b text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <span className="w-12">Image</span>
                <span>Product</span>
                <span className="text-right w-20">Price</span>
                <span className="text-right w-20 hidden sm:block">Stock</span>
                <span className="w-20 text-center">Action</span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => handleViewDetails(p)}
                  >
                    {/* Thumbnail */}
                    <div className="h-12 w-12 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                      {p.thumbnails?.[0] ? (
                        <Image
                          src={getOptimizedImageUrl(p.thumbnails[0], 100)}
                          alt={p.name}
                          width={48}
                          height={48}
                          className="object-contain h-full w-full p-1"
                        />
                      ) : (
                        <Package01Icon className="h-5 w-5 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Name + barcode */}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {p.barcode}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right w-20">
                      <p className="text-sm font-semibold tabular-nums">${p.price.toFixed(2)}</p>
                    </div>

                    {/* Stock */}
                    <div className="text-right w-20 hidden sm:block">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          p.current_stock > 10
                            ? "bg-muted text-foreground"
                            : p.current_stock > 0
                            ? "bg-amber-50 border border-amber-200 text-amber-700"
                            : "bg-red-50 border border-red-200 text-red-600"
                        }`}
                      >
                        {p.current_stock}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="w-20 flex justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(p);
                        }}
                      >
                        <ViewIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── MOBILE FILTER SHEET ─────────────────────────── */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b">
            <SheetTitle className="text-base font-semibold">Categories</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
            <div className="p-4">
              <CategoryList />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ─── PRODUCT DETAIL DIALOG ──────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[1000px] p-0 overflow-hidden rounded-2xl gap-0 w-[96vw] h-[92vh] md:h-[88vh] flex flex-col md:flex-row shadow-2xl border-none">
          {selectedProduct && (
            <>
              {/* Sidebar: Visual & Key Data (Left) */}
              <div className="w-full md:w-[360px] bg-muted/20 border-r flex flex-col shrink-0 overflow-hidden">
                <div className="p-5 sm:p-6 flex flex-col h-full overflow-hidden">
                  {/* Hero Image Section */}
                  <div className="aspect-square relative rounded-xl border bg-background overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                    {selectedProduct.images?.[selectedImageIndex] || selectedProduct.thumbnails?.[0] ? (
                      <Image
                        src={getOptimizedImageUrl(selectedProduct.images?.[selectedImageIndex] || selectedProduct.thumbnails[0], 600)}
                        alt={selectedProduct.name}
                        fill
                        className="object-contain p-4"
                        sizes="(max-width: 768px) 100vw, 360px"
                        priority
                      />
                    ) : (
                      <Package01Icon className="h-12 w-12 text-muted-foreground/20" />
                    )}
                  </div>

                  {/* Thumbnail Scroll (Compact) */}
                  {((selectedProduct.images?.length || 0) > 1 || (selectedProduct.thumbnails?.length || 0) > 1) && (
                    <div className="mt-4 shrink-0">
                      <ScrollArea orientation="horizontal" className="w-full">
                        <div className="flex gap-2 pb-2">
                          {(selectedProduct.images || selectedProduct.thumbnails || []).map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImageIndex(idx)}
                              className={`relative h-12 w-12 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                                selectedImageIndex === idx
                                  ? "border-foreground shadow-sm"
                                  : "border-transparent opacity-40 hover:opacity-100"
                              }`}
                            >
                              <Image src={getOptimizedImageUrl(img, 150)} alt="Thumb" fill className="object-cover" />
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* High-Level Stats Cards */}
                  <div className="mt-6 space-y-3 overflow-y-auto pr-1 -mr-1 scrollbar-hide">
                    <div className="p-4 rounded-xl bg-background border shadow-sm space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Unit Price</p>
                      <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-black text-foreground">${selectedProduct.price.toFixed(2)}</span>
                         <span className="text-[10px] font-bold text-muted-foreground">USD</span>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-background border shadow-sm flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60">Global Stock</p>
                        <p className={`text-xl font-black ${selectedProduct.current_stock > 10 ? "text-emerald-600" : "text-amber-600"}`}>
                          {selectedProduct.current_stock} <span className="text-[10px] font-bold opacity-40">UNITS</span>
                        </p>
                      </div>
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedProduct.current_stock > 10 ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"
                      }`}>
                        <Package01Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content: Inventory Details (Right) */}
              <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
                {/* Header Section (Fixed) */}
                <div className="px-6 py-6 sm:px-8 border-b shrink-0 bg-background/80 backdrop-blur-md">
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-4 bg-foreground/40 rounded-full" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">
                           {categories.find((c) => c.id === selectedProduct.category_id)?.name || "Classified"}
                        </span>
                      </div>
                      <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-black leading-tight text-foreground tracking-tight break-words">
                          {selectedProduct.name}
                        </DialogTitle>
                        <DialogDescription className="hidden">Batch-level inventory breakdown</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <code className="text-[10px] font-black font-mono bg-muted px-2 py-0.5 rounded border text-muted-foreground">
                          SKU: {selectedProduct.barcode}
                        </code>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">
                           Ref: {format(new Date(), "dd-MM-yy")}
                        </span>
                      </div>
                   </div>
                </div>

                {/* Body Content - Batch List */}
                <div className="flex-1 flex flex-col overflow-hidden">
                   <div className="px-6 py-3 sm:px-8 border-b bg-muted/5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                         <Location01Icon className="h-3.5 w-3.5" /> stock distribution
                      </div>
                      <Badge variant="secondary" className="font-bold text-[9px] h-5 tabular-nums">
                         {productBatches.length} BATCHES
                      </Badge>
                   </div>

                   {/* Scroll Area for Table Content */}
                   <div className="flex-1 overflow-hidden relative">
                      <ScrollArea className="h-full w-full">
                         <div className="px-6 sm:px-8 py-4">
                            {productBatches.length === 0 ? (
                               <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/20 border-2 border-dashed rounded-3xl bg-muted/5">
                                  <Package01Icon className="h-10 w-10 opacity-10 mb-2" />
                                  <p className="text-sm font-black text-foreground/30">Zero Stock</p>
                               </div>
                            ) : (
                               <div className="space-y-2">
                                  {/* Custom Table Header */}
                                  <div className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr] gap-4 pb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 border-b">
                                     <span>Location</span>
                                     <span className="hidden sm:block">Arrival</span>
                                     <span className="text-right">Cost</span>
                                     <span className="text-right">Qty</span>
                                     <span className="text-right">Sum</span>
                                  </div>

                                  {/* List Items */}
                                  {productBatches.map((batch) => (
                                     <div
                                       key={batch.id}
                                       className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr] sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr] gap-4 px-3 py-3 rounded-xl bg-muted/5 hover:bg-muted/10 border border-transparent hover:border-black/5 transition-all text-[12px] group items-center"
                                     >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                           <div className="h-8 w-8 rounded-lg bg-background border flex items-center justify-center shrink-0">
                                              <Location01Icon className="h-4 w-4 text-muted-foreground/40" />
                                           </div>
                                           <span className="font-bold truncate text-foreground/80 uppercase tracking-tighter">
                                              {warehouseMap[batch.warehouse_id] || "Warehouse"}
                                           </span>
                                        </div>
                                        <div className="hidden sm:block text-[10px] font-bold text-muted-foreground/50">
                                           {format(new Date(batch.date), "dd/MM/yy")}
                                        </div>
                                        <div className="text-right font-medium text-foreground/60 tabular-nums">
                                           ${batch.cost.toFixed(2)}
                                        </div>
                                        <div className="text-right font-black tabular-nums">
                                           <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                                              batch.quantity > 5 ? "bg-foreground/5" : "bg-red-50 text-red-600"
                                           }`}>
                                              {batch.quantity}
                                           </span>
                                        </div>
                                        <div className="text-right font-black text-foreground tabular-nums text-xs">
                                           ${(batch.cost * batch.quantity).toFixed(2)}
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      </ScrollArea>
                   </div>
                </div>

                {/* Footer Section (Fixed) */}
                <div className="p-6 sm:p-8 bg-foreground text-background shrink-0">
                   <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-xl bg-background/10 flex items-center justify-center shrink-0">
                            <Package01Icon className="h-5 w-5" />
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Total Stock</p>
                            <p className="text-lg font-black leading-none">{batchTotals.totalQty} Units</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Value</p>
                         <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tighter leading-none">
                            ${batchTotals.totalValue.toFixed(2)}
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
