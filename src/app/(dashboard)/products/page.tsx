"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Image as ImageIcon, Pencil, Trash2, Package, Barcode, Sparkles } from "lucide-react";
import Image from "next/image";
import { getProducts, getCategories, archiveProduct } from "@/lib/firebase/actions";
import { Product, Category } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
    setOpen(true);
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Products</h1>
        <Sheet open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) setEditingProduct(null);
        }}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-md" onClick={() => setEditingProduct(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="right" 
            className="sm:max-w-[800px] p-0 flex flex-col overflow-hidden"
          >
            <SheetHeader className="p-6 pb-2 shrink-0">
              <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-600" />
                {editingProduct ? "Edit Product" : "Create New Product"}
              </SheetTitle>
              <SheetDescription>
                {editingProduct ? "Update product details." : "Add a new item to your inventory catalog."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ProductForm 
                initialData={editingProduct || undefined}
                onSuccess={() => {
                  setOpen(false);
                  setEditingProduct(null);
                  fetchData();
                }} 
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Product Detail Drawer */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right" className="sm:max-w-[800px] p-0 flex flex-col overflow-hidden">
            <SheetHeader className="p-6 pb-2">
              <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-600" />
                Product Details
              </SheetTitle>
              <SheetDescription>
                Reference information for this inventory item.
              </SheetDescription>
            </SheetHeader>
            
            {viewingProduct && (
              <ScrollArea className="flex-1 min-h-0 px-6">
                <div className="space-y-6 py-4">
                  {/* Image Gallery */}
                  {viewingProduct.images && viewingProduct.images.length > 0 && (
                    <div className="space-y-4">
                      <div className="relative aspect-video rounded-3xl overflow-hidden border bg-muted shadow-2xl ring-1 ring-black/5">
                        <Image
                          src={getOptimizedImageUrl(viewingProduct.images[selectedImageIndex] || viewingProduct.images[0], 1080)}
                          alt={viewingProduct.name}
                          fill
                          className="object-cover transition-all duration-300"
                        />
                      </div>
                      
                      {/* Horizontal Scroll for Thumbnails */}
                      <ScrollArea orientation="horizontal" className="w-full whitespace-nowrap pb-2">
                        <div className="flex gap-3">
                          {viewingProduct.thumbnails.map((thumb, i) => (
                            <div 
                              key={i} 
                              onClick={() => setSelectedImageIndex(i)}
                              className={`relative h-20 w-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 shadow-sm cursor-pointer bg-white ${
                                selectedImageIndex === i 
                                  ? "border-blue-600 ring-2 ring-blue-600/20 scale-105" 
                                  : "border-muted hover:border-blue-400"
                              }`}
                            >
                               <Image 
                                 src={getOptimizedImageUrl(thumb, 200)} 
                                 alt="" 
                                 fill 
                                 className="object-cover" 
                               />
                             </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Product Name</h3>
                      <p className="text-lg font-semibold">{viewingProduct.name}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Barcode</h3>
                        <div className="flex items-center gap-2">
                          <Barcode className="h-4 w-4 text-blue-600" />
                          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{viewingProduct.barcode}</code>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Selling Price</h3>
                        <p className="text-lg font-bold text-green-600">${viewingProduct.price.toFixed(2)}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Stock Level</h3>
                        <Badge className="px-3 py-1" variant={viewingProduct.current_stock > 0 ? "outline" : "destructive"}>
                          {viewingProduct.current_stock} units available
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Category</h3>
                        <p className="text-base">{categories[viewingProduct.category_id || ""] || "Uncategorized"}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Average Unit Cost</h3>
                        <p className="text-xl font-bold text-blue-900">${viewingProduct.average_cost.toFixed(2)}</p>
                      </div>
                      <Sparkles className="h-8 w-8 text-blue-200" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}

            <SheetFooter className="p-6 border-t bg-muted/30">
              <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>
                Close Details
              </Button>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={(e) => {
                setDetailOpen(false);
                if (viewingProduct) handleEdit(e as any, viewingProduct);
              }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Product
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow 
                  key={product.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(product)}
                >
                  <TableCell>
                    <div className="relative h-12 w-12 rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                      {product.thumbnails && product.thumbnails.length > 0 ? (
                        <Image
                          src={getOptimizedImageUrl(product.thumbnails[0], 100)}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                      {product.images && product.images.length > 1 && (
                        <div className="absolute bottom-0 right-0 bg-black/60 text-[8px] text-white px-1 font-bold">
                          +{product.images.length - 1}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.barcode}</div>
                  </TableCell>
                  <TableCell>
                    {categories[product.category_id || ""] || "Uncategorized"}
                  </TableCell>
                  <TableCell>${product.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={product.current_stock > 0 ? "outline" : "destructive"}>
                      {product.current_stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button size="sm" variant="ghost" onClick={(e) => handleEdit(e, product)}>
                         <Pencil className="h-4 w-4 text-blue-600" />
                       </Button>
                       <Button size="sm" variant="ghost" onClick={(e) => handleDelete(e, product.id)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
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
  );
}
