"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  Add01Icon, 
  Image01Icon, 
  PencilEdit01Icon, 
  Delete01Icon, 
  Package01Icon, 
  BarcodeScanIcon, 
  MagicWand01Icon,
  Loading01Icon,
  ViewIcon,
  Cancel01Icon,
  Search01Icon,
  FilterIcon,
  TagsIcon,
} from "hugeicons-react";
import Image from "next/image";
import { getProducts, getCategories, archiveProduct } from "@/lib/firebase/actions";
import { getStocks } from "@/lib/firebase/stock-actions";
import { Product, Category, ProductWithStock } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductForm } from "@/components/forms/ProductForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOptimizedImageUrl } from "@/lib/utils";
import { toast } from "sonner";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductWithStock | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  async function fetchData() {
    try {
      setLoading(true);
      const [prods, cats, allStocks] = await Promise.all([getProducts(), getCategories(), getStocks()]);
      
      const catMap: Record<string, string> = {};
      cats.forEach((c) => (catMap[c.id] = c.name));
      setCategories(catMap);
      setCategoriesList(cats);

      // Dynamically compute current_stock from stocks records
      const stockMap: Record<string, number> = {};
      allStocks.forEach(s => {
          stockMap[s.product_id] = (stockMap[s.product_id] || 0) + s.quantity;
      });

      const productsWithStock = prods.map(p => ({
          ...p,
          current_stock: stockMap[p.id] || 0
      }));

      setProducts(productsWithStock);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length, uncategorized: 0 };
    products.forEach((p) => {
      if (!p.category_id) {
        counts.uncategorized = (counts.uncategorized || 0) + 1;
      } else {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category Filter
      if (selectedCategoryId !== "all") {
        if (selectedCategoryId === "uncategorized") {
          if (product.category_id && product.category_id !== "") return false;
        } else if (product.category_id !== selectedCategoryId) {
          return false;
        }
      }

      // Stock Filter
      if (stockFilter === "in_stock" && product.current_stock <= 0) return false;
      if (stockFilter === "low_stock" && (product.current_stock <= 0 || product.current_stock > 5)) return false;
      if (stockFilter === "out_of_stock" && product.current_stock > 0) return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = product.name?.toLowerCase().includes(q);
        const matchBarcode = product.barcode?.toLowerCase().includes(q);
        const catName = (categories[product.category_id || ""] || "Uncategorized").toLowerCase();
        const matchCat = catName.includes(q);

        if (!matchName && !matchBarcode && !matchCat) return false;
      }

      return true;
    });
  }, [products, selectedCategoryId, stockFilter, searchQuery, categories]);

  const hasActiveFilters = selectedCategoryId !== "all" || stockFilter !== "all" || searchQuery.trim() !== "";

  const resetFilters = () => {
    setSelectedCategoryId("all");
    setStockFilter("all");
    setSearchQuery("");
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingProduct(product);
    setSheetOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to archive this product?")) {
      try {
        await archiveProduct(id);
        toast.success("Product archived");
        fetchData();
      } catch (error) {
        toast.error("Failed to archive product");
      }
    }
  };

  const handleRowClick = (product: ProductWithStock) => {
    setViewingProduct(product);
    setSelectedImageIndex(0);
    setDetailOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package01Icon className="size-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Catalogue Management</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Manage automotive accessory products, barcode inventory, categories, and pricing.
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          className="lg:hidden bg-primary hover:bg-primary/90 shadow-md"
          onClick={() => {
            setEditingProduct(null);
            setSheetOpen(true);
          }}
        >
          <Add01Icon className="mr-2 size-4" />
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left Column: Create Form (Hidden on Mobile) */}
        <Card className="hidden lg:flex flex-col shadow-sm border-primary/10 max-h-[calc(100vh-180px)] overflow-y-auto sticky top-4">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Add01Icon className="size-5 text-primary" />
              Quick Create
            </CardTitle>
            <CardDescription>
              Add a new product to your inventory catalog.
            </CardDescription>
          </CardHeader>
         
          <ScrollArea className="flex-1 min-h-0">
            <CardContent>
              <ProductForm 
                onSuccess={() => {
                  fetchData();
                }} 
              />
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right Column: Data Table & Filters */}
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
            {/* Search & Select dropdowns */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by product name, barcode, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm w-full bg-background"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <Cancel01Icon className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {/* Category Select Dropdown */}
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="h-9 w-[170px] sm:w-[190px] text-xs sm:text-sm bg-background">
                    <div className="flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-[150px]">
                      <TagsIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <SelectValue placeholder="All Categories" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">
                      All Categories ({products.length})
                    </SelectItem>
                    {categoriesList.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} ({categoryCounts[cat.id] || 0})
                      </SelectItem>
                    ))}
                    {(categoryCounts.uncategorized || 0) > 0 && (
                      <SelectItem value="uncategorized">
                        Uncategorized ({categoryCounts.uncategorized})
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {/* Stock Status Select */}
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="h-9 w-[120px] sm:w-[130px] text-xs sm:text-sm bg-background">
                    <SelectValue placeholder="All Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="in_stock">In Stock ({products.filter(p => p.current_stock > 0).length})</SelectItem>
                    <SelectItem value="low_stock">Low Stock ≤5 ({products.filter(p => p.current_stock > 0 && p.current_stock <= 5).length})</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock ({products.filter(p => p.current_stock <= 0).length})</SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset Filters button */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 border-dashed"
                    title="Reset all filters"
                  >
                    <Cancel01Icon className="size-3.5 mr-1 text-destructive" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Category Chips / Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
              <Button
                type="button"
                size="sm"
                variant={selectedCategoryId === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategoryId("all")}
                className="h-7 text-xs rounded-full px-3 shrink-0"
              >
                All ({products.length})
              </Button>
              {categoriesList.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <Button
                    key={cat.id}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setSelectedCategoryId(isSelected ? "all" : cat.id)}
                    className="h-7 text-xs rounded-full px-3 shrink-0 gap-1.5"
                  >
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {count}
                    </span>
                  </Button>
                );
              })}
              {(categoryCounts.uncategorized || 0) > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={selectedCategoryId === "uncategorized" ? "default" : "outline"}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === "uncategorized" ? "all" : "uncategorized")}
                  className="h-7 text-xs rounded-full px-3 shrink-0 gap-1.5"
                >
                  <span>Uncategorized</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryId === "uncategorized" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {categoryCounts.uncategorized}
                  </span>
                </Button>
              )}
            </div>

            {/* Filter Summary Count */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
              <span>
                Showing <strong className="text-foreground">{filteredProducts.length}</strong> of{" "}
                <strong className="text-foreground">{products.length}</strong> products
              </span>
              {selectedCategoryId !== "all" && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  Category: {selectedCategoryId === "uncategorized" ? "Uncategorized" : (categories[selectedCategoryId] || selectedCategoryId)}
                </Badge>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px] font-bold">Image</TableHead>
                  <TableHead className="font-bold">Product Info</TableHead>
                  <TableHead className="font-bold">Category</TableHead>
                  <TableHead className="font-bold">Price</TableHead>
                  <TableHead className="font-bold">Stock</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-48">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loading01Icon className="animate-spin size-6" />
                        <span>Loading products...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <Package01Icon className="size-8 text-muted-foreground/50" />
                        <p className="font-semibold text-sm">No products match your criteria</p>
                        <p className="text-xs text-muted-foreground">
                          {hasActiveFilters ? "Try clearing your filters or search query." : "Add your first product using the form."}
                        </p>
                        {hasActiveFilters && (
                          <Button size="sm" variant="outline" onClick={resetFilters} className="mt-2 text-xs">
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="cursor-pointer hover:bg-muted/30 transition-colors group"
                      onClick={() => handleRowClick(product)}
                    >
                      <TableCell>
                        <div className="relative h-12 w-12 rounded-lg overflow-hidden border bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                          {product.thumbnails && product.thumbnails.length > 0 ? (
                            <Image
                              src={getOptimizedImageUrl(product.thumbnails[0], 100)}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <Image01Icon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-base">{product.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                          <BarcodeScanIcon className="size-3" />
                          {product.barcode}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium bg-primary/5 text-primary border-primary/10">
                          {categories[product.category_id || ""] || "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-primary">${product.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.current_stock > 5 ? "outline" : product.current_stock > 0 ? "outline" : "destructive"} 
                          className={`px-2 font-bold ${
                            product.current_stock <= 0
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : product.current_stock <= 5
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "text-foreground"
                          }`}
                        >
                          {product.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                           <Button size="icon" variant="ghost" className="size-8 text-primary hover:text-primary hover:bg-primary/10" onClick={(e) => handleEdit(e, product)}>
                             <PencilEdit01Icon className="size-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, product.id)}>
                             <Delete01Icon className="size-4" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Edit/Create Sheet for Mobile or Editing */}
      <Sheet open={sheetOpen} onOpenChange={(val) => {
        setSheetOpen(val);
        if (!val) setEditingProduct(null);
      }}>
        <SheetContent 
          side="right" 
          className="sm:max-w-[600px] p-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="p-6 pb-2 shrink-0">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              {editingProduct ? (
                <PencilEdit01Icon className="size-6 text-primary" />
              ) : (
                <Add01Icon className="size-6 text-primary" />
              )}
              {editingProduct ? "Edit Product" : "Create New Product"}
            </SheetTitle>
            <SheetDescription>
              {editingProduct ? "Update product details." : "Add a new item to the catalogue."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ProductForm 
              initialData={editingProduct || undefined}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingProduct(null);
                fetchData();
              }} 
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Product Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="sm:max-w-[600px] p-0 flex flex-col overflow-y-scroll">
          <SheetHeader className="p-6 border-b shrink-0 bg-primary/5">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <ViewIcon className="size-6 text-primary" />
              Product Insights
            </SheetTitle>
            <SheetDescription>
              In-depth view of the selected inventory item.
            </SheetDescription>
          </SheetHeader>
          
          {viewingProduct && (
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Image Gallery */}
                {viewingProduct.images && viewingProduct.images.length > 0 && (
                  <div className="space-y-4">
                    <div className="relative rounded-3xl overflow-hidden border-2 border-primary/10 bg-muted shadow-xl ring-1 ring-black/5 flex items-center justify-center">
                      <Image
                        src={getOptimizedImageUrl(viewingProduct.images[selectedImageIndex] || viewingProduct.images[0], 1080)}
                        alt={viewingProduct.name}
                        width={1000}
                        height={1000}
                        className="w-full h-auto max-h-[600px] object-contain transition-all duration-300"
                        sizes="(max-width: 768px) 100vw, 600px"
                      />
                    </div>
                    
                    <ScrollArea orientation="horizontal" className="w-full whitespace-nowrap pb-2">
                      <div className="flex gap-3 flex-wrap">
                        {viewingProduct.thumbnails.map((thumb, i) => (
                          <div 
                            key={i} 
                            onClick={() => setSelectedImageIndex(i)}
                            className={`relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 shadow-sm cursor-pointer bg-white ${
                              selectedImageIndex === i 
                                ? "border-primary ring-2 ring-primary/20 scale-105" 
                                : "border-muted hover:border-primary/40"
                            }`}
                          >
                             <Image 
                               src={getOptimizedImageUrl(thumb, 200)} 
                               alt="" 
                               fill 
                               className="object-contain p-1.5 transition-transform hover:scale-110" 
                               sizes="64px"
                             />
                           </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="grid gap-6">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Item Name</h3>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{viewingProduct.name}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Barcode</h3>
                      <div className="flex items-center gap-2">
                        <BarcodeScanIcon className="size-5 text-primary/70" />
                        <code className="bg-primary/5 px-2 py-1 rounded text-sm font-bold text-primary border border-primary/10">
                          {viewingProduct.barcode}
                        </code>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Selling Price</h3>
                      <p className="text-2xl font-black text-primary">${viewingProduct.price.toFixed(2)}</p>
                    </div>
                  </div>

                  <Separator className="bg-primary/10" />

                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Stock Level</h3>
                      <Badge className="px-3 py-1 text-sm font-bold" variant={viewingProduct.current_stock > 0 ? "outline" : "destructive"}>
                        {viewingProduct.current_stock} Units In Stock
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Category</h3>
                      <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                        {categories[viewingProduct.category_id || ""] || "Uncategorized"}
                      </Badge>
                    </div>
                  </div>

                  <Separator className="bg-primary/10" />

                  <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 flex items-center justify-between shadow-inner">
                    <div>
                      <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Average Unit Cost</h3>
                      <p className="text-3xl font-black text-primary">${(viewingProduct.cost_recommand || 0).toFixed(2)}</p>
                    </div>
                    <MagicWand01Icon className="size-12 text-primary/10" />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <SheetFooter className="p-6 border-t bg-muted/50 gap-2 shrink-0">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setDetailOpen(false)}>
              <Cancel01Icon className="mr-2 size-4" />
              Dismiss
            </Button>
            <Button className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" onClick={(e) => {
              setDetailOpen(false);
              if (viewingProduct) handleEdit(e as any, viewingProduct);
            }}>
              <PencilEdit01Icon className="mr-2 size-4" />
              Update Item
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
