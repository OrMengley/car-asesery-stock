"use client";

import { useEffect, useState } from "react";
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
  Cancel01Icon
} from "hugeicons-react";
import Image from "next/image";
import { getProducts, getCategories, archiveProduct } from "@/lib/firebase/actions";
import { Product, Category } from "@/types";
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
import { getOptimizedImageUrl } from "@/lib/utils";
import { toast } from "sonner";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  async function fetchData() {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(prods);
      
      const catMap: Record<string, string> = {};
      cats.forEach((c) => (catMap[c.id] = c.name));
      setCategories(catMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleRowClick = (product: Product) => {
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
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Catalogue Management</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Left Column: Create Form (Hidden on Mobile) */}
        <Card className="hidden lg:flex flex-col shadow-sm border-primary/10 max-h-[calc(100vh-180px)] overflow-y-auto">
          <CardHeader className="shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Add01Icon className="size-5 text-primary" />
              Quick Create
            </CardTitle>
            <CardDescription>
              Add a new product to your inventory catalog.
            </CardDescription>
          </CardHeader>
         
           
         <ScrollArea className="flex-1 min-h-0">
           <CardContent className="">
                <ProductForm 
                  onSuccess={() => {
                    fetchData();
                  }} 
                />
          </CardContent>
         </ScrollArea>
        </Card>

        {/* Right Column: Data Table */}
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
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
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
                      <Badge variant={product.current_stock > 0 ? "outline" : "destructive"} className="px-2">
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
