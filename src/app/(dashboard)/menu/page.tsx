"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  getProducts, 
  getCategories 
} from "@/lib/firebase/actions";
import { getStocks } from "@/lib/firebase/stock-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, Category, Stock, Warehouse } from "@/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Search01Icon, 
  UserIcon,
  Package01Icon,
  ArrowRight01Icon,
  Menu01Icon,
  ViewIcon,
  DashboardSquare01Icon,
  Cancel01Icon,
  Calendar01Icon,
  Location01Icon,
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
import { toast } from "sonner";
import { format } from "date-fns";

export default function ProductMenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Product detail dialog
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [p, c, s, w] = await Promise.all([
        getProducts(), 
        getCategories(),
        getStocks(),
        getWarehouses(),
      ]);
      setProducts(p);
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

  const currentCategory = categories.find(c => c.id === selectedCategoryId);

  // Get stock batches for the selected product
  const productBatches = useMemo(() => {
    if (!selectedProduct) return [];
    return stocks
      .filter((s) => s.product_id === selectedProduct.id && s.quantity > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedProduct, stocks]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses.forEach((w) => { map[w.id] = w.name; });
    return map;
  }, [warehouses]);

  // Totals for selected product batches
  const batchTotals = useMemo(() => {
    const totalQty = productBatches.reduce((sum, b) => sum + b.quantity, 0);
    const totalValue = productBatches.reduce((sum, b) => sum + b.quantity * b.cost, 0);
    return { totalQty, totalValue };
  }, [productBatches]);

  function handleViewDetails(product: Product) {
    setSelectedProduct(product);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      {/* ─── TOP HEADER ────────────────────────────────────────── */}
      <header className="h-[72px] bg-white border-b flex items-center px-6 sticky top-0 z-50">
        <div className="flex-1 max-w-2xl mx-auto flex items-center gap-4">
          <div className="relative flex-1">
            <Search01Icon className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <Input 
              placeholder="Search in product menu..." 
              className="pl-12 h-11 bg-[#F1F3F5] border-none rounded-lg focus-visible:ring-1 focus-visible:ring-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-6 ml-6">
          <button className="flex flex-col items-center gap-1 group">
            <DashboardSquare01Icon className="size-6 text-gray-700 group-hover:text-primary transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Dashboard</span>
          </button>
          <button className="flex flex-col items-center gap-1 group">
            <UserIcon className="size-6 text-gray-700 group-hover:text-primary transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Account</span>
          </button>
        </div>
      </header>



      <div className="flex max-w-[1400px] mx-auto w-full px-6 py-10 gap-8">
        {/* ─── SIDEBAR (Brands/Categories) ──────────────────────── */}
        <aside className="w-[280px] shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-[192px]">
            <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-6">Brands / Categories</h3>
            <div className="space-y-1">
              <button 
                onClick={() => setSelectedCategoryId("all")}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all ${
                  selectedCategoryId === "all" ? "bg-[#F1F3F5] text-primary" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Show All
                {selectedCategoryId === "all" && <div className="size-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.6)]" />}
              </button>
              {categories.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all ${
                    selectedCategoryId === cat.id ? "bg-[#F1F3F5] text-primary" : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {cat.name}
                  {selectedCategoryId === cat.id && <div className="size-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.6)]" />}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─────────────────────────────────────── */}
        <main className="flex-1 space-y-8">
          {/* Results Summary & Sort */}
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm font-medium">
              Showing <span className="text-gray-900 font-bold">{filteredProducts.length}</span> items in stock
            </p>
            <div className="flex items-center gap-4">
               <button className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-100 rounded-full text-sm font-bold text-gray-700 shadow-sm hover:border-gray-300">
                  Default View
                  <Menu01Icon className="size-4 text-gray-400" />
               </button>
            </div>
          </div>

          {/* Banner */}
          <div className="h-[280px] w-full rounded-[24px] bg-gradient-to-r from-[#1A1C1E] to-[#2C3E50] relative overflow-hidden flex items-center px-16 shadow-lg">
             <div className="relative z-10 space-y-2">
                <h2 className="text-6xl font-black text-white italic tracking-tight">{currentCategory?.name || "Product Menu"}</h2>
                <p className="text-gray-400 font-medium text-lg">Detailed Stock & Pricing Information</p>
             </div>
             {/* Abstract background graphics */}
             <div className="absolute right-[-10%] top-0 h-full w-[60%] bg-gradient-to-b from-primary/20 to-transparent blur-[120px] rounded-full" />
             <div className="absolute right-[10%] bottom-[-20%] h-[300px] w-[300px] border border-white/5 rounded-full" />
          </div>

          {/* Products Grid */}
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white rounded-[32px] h-[550px] animate-pulse border border-gray-100" />
                ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-slate-900">
              {filteredProducts.map((p) => (
                <div key={p.id} className="bg-white rounded-[32px] overflow-hidden border border-gray-100 hover:border-gray-200 transition-all hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] flex flex-col group h-full cursor-pointer" onClick={() => handleViewDetails(p)}>
                   <div className="p-8 pb-0 relative bg-[#F8F9FA]/50">
                      <Badge className="absolute top-8 left-8 bg-white/80 backdrop-blur-md text-gray-900 border-none font-black text-[10px] tracking-widest px-3 py-1 shadow-sm">STOCK ITEM</Badge>
                      <div className="aspect-[4/3] relative mt-4">
                        {p.thumbnails?.[0] ? (
                           <Image src={getOptimizedImageUrl(p.thumbnails[0])} alt={p.name} fill className="object-contain transition-transform duration-500 group-hover:scale-110 p-2" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-white rounded-[20px] shadow-inner">
                             <Package01Icon className="size-16 text-gray-100" />
                          </div>
                        )}
                      </div>
                   </div>
                   
                   <div className="p-8 space-y-6 flex-1 flex flex-col">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1">
                           {categories.find(c => c.id === p.category_id)?.name || "CATEGORY"}
                        </p>
                        <h3 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-primary transition-colors">{p.name}</h3>
                        <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">{p.barcode}</p>
                      </div>
                      
                      <Separator className="bg-gray-100" />

                      <div className="space-y-4 flex-1">
                        {/* Pricing Info */}
                        <div>
                           <div className="space-y-1">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selling Price</span>
                              <div className="flex items-baseline gap-1">
                                 <span className="text-2xl font-black text-[#FF4B4B]">${p.price.toFixed(2)}</span>
                              </div>
                           </div>
                        </div>

                        {/* Stock Balance */}
                        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-colors group-hover:bg-white group-hover:border-primary/20">
                           <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Stock</span>
                                 <span className={`text-2xl font-black ${p.current_stock > 5 ? "text-emerald-500" : "text-amber-500"}`}>
                                    {p.current_stock} <span className="text-xs font-bold uppercase ml-1">Units</span>
                                 </span>
                              </div>
                              <div className={`p-2 rounded-xl ${p.current_stock > 5 ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
                                 <Package01Icon className="size-6" />
                              </div>
                           </div>
                           {/* Progress bar visual for stock */}
                           <div className="mt-3 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${p.current_stock > 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min((p.current_stock / 50) * 100, 100)}%` }}
                              />
                           </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button 
                          variant="outline"
                          className="w-full h-12 rounded-2xl font-bold gap-2 border-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-[0.98]"
                          onClick={(e) => { e.stopPropagation(); handleViewDetails(p); }}
                        >
                          <ViewIcon className="size-4" /> View Details
                        </Button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && !loading && (
            <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 space-y-4 bg-white rounded-[32px] border-2 border-dashed border-gray-100">
               <Package01Icon className="size-12 opacity-20" />
               <p className="font-medium text-lg italic">No products matched your criteria</p>
            </div>
          )}
        </main>
      </div>

      {/* ─── PRODUCT DETAIL DIALOG ─────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden rounded-[24px] border-none shadow-2xl gap-0">
          {selectedProduct && (
            <>
              {/* ─── Dialog Header with Product Image ─────────── */}
              <div className="relative bg-gradient-to-br from-[#1A1C1E] to-[#2C3E50] p-8 pb-6">
                {/* Abstract glow */}
                <div className="absolute right-0 top-0 h-full w-[50%] bg-gradient-to-b from-primary/15 to-transparent blur-[80px] rounded-full" />

                <div className="relative z-10 flex gap-6 items-start">
                  {/* Product Thumbnail */}
                  <div className="size-[100px] shrink-0 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 overflow-hidden flex items-center justify-center">
                    {selectedProduct.thumbnails?.[0] ? (
                      <Image 
                        src={getOptimizedImageUrl(selectedProduct.thumbnails[0], 200)} 
                        alt={selectedProduct.name} 
                        width={100} 
                        height={100} 
                        className="object-contain p-2" 
                      />
                    ) : (
                      <Package01Icon className="size-10 text-white/30" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                      {categories.find(c => c.id === selectedProduct.category_id)?.name || "PRODUCT"}
                    </p>
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black text-white leading-tight tracking-tight">
                        {selectedProduct.name}
                      </DialogTitle>
                      <DialogDescription className="text-white/50 font-mono text-xs tracking-widest mt-1">
                        {selectedProduct.barcode}
                      </DialogDescription>
                    </DialogHeader>

                    {/* Quick Stats Row */}
                    <div className="flex gap-6 mt-4">
                      <div>
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Price</span>
                        <span className="text-lg font-black text-[#FF6B6B]">${selectedProduct.price.toFixed(2)}</span>
                      </div>

                      <div className="border-l border-white/10 pl-6">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Total Stock</span>
                        <span className={`text-lg font-black ${selectedProduct.current_stock > 5 ? "text-emerald-400" : "text-amber-400"}`}>
                          {selectedProduct.current_stock}
                        </span>
                      </div>
                      {selectedProduct.cost_recommand !== undefined && selectedProduct.cost_recommand > 0 && (
                        <div className="border-l border-white/10 pl-6">
                          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Rec. Cost</span>
                          <span className="text-lg font-black text-sky-400">${selectedProduct.cost_recommand.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Stock Batches Section ─────────────────────── */}
              <div className="p-6 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-black text-gray-900 tracking-tight">Stock Batches</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {productBatches.length} batch{productBatches.length !== 1 ? "es" : ""} with available stock (FIFO order)
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-black tracking-wider border-gray-200 text-gray-500">
                    {batchTotals.totalQty} UNITS TOTAL
                  </Badge>
                </div>

                {productBatches.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl">
                    <Package01Icon className="size-10 mb-3 opacity-40" />
                    <p className="text-sm font-bold text-gray-400">No stock batches found</p>
                    <p className="text-xs text-gray-300 mt-1">This product has no available inventory</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[320px]">
                    <div className="space-y-2">
                      {/* Table Header */}
                      <div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Warehouse</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">Date</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] text-right">Cost</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] text-right">Qty</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] text-right">Total Value</span>
                      </div>

                      {/* Batch Rows */}
                      {productBatches.map((batch, idx) => (
                        <div
                          key={batch.id}
                          className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group"
                        >
                          {/* Warehouse */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Location01Icon className="size-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-gray-700 truncate">
                              {warehouseMap[batch.warehouse_id] || "Unknown"}
                            </span>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar01Icon className="size-3.5 text-gray-300 shrink-0" />
                            <span className="font-medium">{format(new Date(batch.date), "dd MMM yyyy")}</span>
                          </div>

                          {/* Cost */}
                          <div className="flex items-center justify-end">
                            <span className="text-sm font-black text-gray-700 tabular-nums">
                              ${batch.cost.toFixed(2)}
                            </span>
                          </div>

                          {/* Quantity */}
                          <div className="flex items-center justify-end">
                            <Badge 
                              variant="outline"
                              className={`text-xs font-black tabular-nums px-2.5 py-0.5 border-none ${
                                batch.quantity > 5 
                                  ? "bg-emerald-50 text-emerald-600" 
                                  : batch.quantity > 0 
                                    ? "bg-amber-50 text-amber-600" 
                                    : "bg-red-50 text-red-500"
                              }`}
                            >
                              {batch.quantity}
                            </Badge>
                          </div>

                          {/* Total Value */}
                          <div className="flex items-center justify-end">
                            <span className="text-sm font-black text-gray-900 tabular-nums">
                              ${(batch.cost * batch.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Summary Footer */}
                      <div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-3 mt-1 rounded-xl bg-gray-900 text-white">
                        <span className="text-[10px] font-black uppercase tracking-widest self-center">Total</span>
                        <span />
                        <span />
                        <div className="flex items-center justify-end">
                          <span className="text-sm font-black tabular-nums">{batchTotals.totalQty}</span>
                        </div>
                        <div className="flex items-center justify-end">
                          <span className="text-sm font-black tabular-nums">${batchTotals.totalValue.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
