"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Archive02Icon,
  Loading01Icon,
  Search01Icon,
  Package01Icon,
  Alert02Icon,
  Cancel01Icon,
  DollarCircleIcon,
  ChartIncreaseIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
  FilterIcon,
  Recycle01Icon,
  ShoppingCart01Icon,
  Settings01Icon,
  ViewIcon,
  BarcodeScanIcon,
  Image01Icon,
} from "hugeicons-react";
import Image from "next/image";
import { getProducts } from "@/lib/firebase/actions";
import { getStocks, getStockMovements } from "@/lib/firebase/stock-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, Stock, StockMovement, StockMovementType, Warehouse } from "@/types";
import { format } from "date-fns";
import { getOptimizedImageUrl } from "@/lib/utils";

// Constants
const LOW_STOCK_THRESHOLD = 5;

// Movement type configuration
const movementTypeConfig: Record<
  StockMovementType,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  stock_in: {
    label: "Purchase",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    icon: <ArrowDown01Icon className="size-3.5" />,
  },
  stock_out: {
    label: "Sale",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: <ShoppingCart01Icon className="size-3.5" />,
  },
  adjustment: {
    label: "Adjustment",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: <Settings01Icon className="size-3.5" />,
  },
  return: {
    label: "Return",
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    icon: <Recycle01Icon className="size-3.5" />,
  },
  transfer: {
    label: "Transfer",
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    icon: <ArrowRight01Icon className="size-3.5" />,
  },
};

function getStockStatus(stock: number) {
  if (stock <= 0)
    return {
      label: "Out of Stock",
      variant: "destructive" as const,
      dotColor: "bg-red-500",
    };
  if (stock <= LOW_STOCK_THRESHOLD)
    return {
      label: "Low Stock",
      variant: "outline" as const,
      dotColor: "bg-amber-500",
    };
  return {
    label: "In Stock",
    variant: "outline" as const,
    dotColor: "bg-emerald-500",
  };
}

// ─── Merged Inventory Type ──────────────────────────────
interface MergedInventoryItem {
  id: string; // Master ID (first one found)
  product_ids: string[];
  name: string;
  barcode: string;
  price: number;
  avg_cost: number;
  current_stock: number;
  total_value: number;
  thumbnails?: string[];
  images?: string[];
  category_id?: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");

  // Filter states - Inventory
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filter states - Movements
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [movementDateSort, setMovementDateSort] = useState<"asc" | "desc">(
    "desc"
  );

  // Pagination
  const [invPage, setInvPage] = useState(0);
  const [movPage, setMovPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Detail sheet
  const [detailProduct, setDetailProduct] = useState<MergedInventoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Alert panel
  const [showAlerts, setShowAlerts] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [prods, stks, mvts, whs] = await Promise.all([
        getProducts(),
        getStocks(),
        getStockMovements(),
        getWarehouses(),
      ]);
      setProducts(prods);
      setStocks(stks);
      setMovements(mvts);
      setWarehouses(whs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => (map[p.id] = p));
    return map;
  }, [products]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, Warehouse> = {};
    warehouses.forEach((w) => (map[w.id] = w));
    return map;
  }, [warehouses]);

  // ─── Merged Inventory Logic ─────────────────────────────
  const mergedInventory = useMemo(() => {
    const groups = new Map<string, MergedInventoryItem>();

    // 1. Initialize groups with product data
    products.forEach((p) => {
      const key = `${p.name.trim().toLowerCase()}_${(p.barcode || "").trim().toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: p.id,
          product_ids: [p.id],
          name: p.name,
          barcode: p.barcode,
          price: p.price,
          avg_cost: p.cost_recommand || 0,
          current_stock: 0, // Reset to calculate from stocks
          total_value: 0,
          thumbnails: p.thumbnails,
          images: p.images,
          category_id: p.category_id,
        });
      } else {
        const item = groups.get(key)!;
        item.product_ids.push(p.id);
        if (p.price > item.price) item.price = p.price;
        if (!item.thumbnails?.[0] && p.thumbnails?.[0]) {
          item.thumbnails = p.thumbnails;
        }
      }
    });

    // 2. Aggregate from stocks collection
    stocks.forEach((s) => {
      const p = productMap[s.product_id];
      if (!p) return;
      
      const key = `${p.name.trim().toLowerCase()}_${(p.barcode || "").trim().toLowerCase()}`;
      const item = groups.get(key);
      if (item && !s.is_archived) {
        item.current_stock += s.quantity;
        item.total_value += (s.cost * s.quantity);
      }
    });

    // 3. Calculate Average Cost
    groups.forEach((item) => {
      if (item.current_stock > 0) {
        item.avg_cost = item.total_value / item.current_stock;
      }
    });

    return Array.from(groups.values());
  }, [products, stocks, productMap]);

  // Dashboard statistics
  const stats = useMemo(() => {
    const totalItems = mergedInventory.length;
    const outOfStock = mergedInventory.filter((p) => p.current_stock <= 0).length;
    const nearlyOutOfStock = mergedInventory.filter(
      (p) => p.current_stock > 0 && p.current_stock <= LOW_STOCK_THRESHOLD
    ).length;
    const totalCost = mergedInventory.reduce((sum, p) => sum + p.total_value, 0);
    const totalStockUnits = mergedInventory.reduce(
      (sum, p) => sum + p.current_stock,
      0
    );

    return { totalItems, outOfStock, nearlyOutOfStock, totalCost, totalStockUnits };
  }, [mergedInventory]);

  // Alert items
  const alertItems = useMemo(() => {
    const outOfStockItems = mergedInventory.filter((p) => p.current_stock <= 0);
    const lowStockItems = mergedInventory.filter(
      (p) => p.current_stock > 0 && p.current_stock <= LOW_STOCK_THRESHOLD
    );
    return { outOfStockItems, lowStockItems };
  }, [mergedInventory]);

  // Filtered & sorted inventory data
  const filteredProducts = useMemo(() => {
    let result = [...mergedInventory];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      );
    }

    // Stock status filter
    if (stockFilter === "in_stock")
      result = result.filter((p) => p.current_stock > LOW_STOCK_THRESHOLD);
    else if (stockFilter === "low_stock")
      result = result.filter(
        (p) => p.current_stock > 0 && p.current_stock <= LOW_STOCK_THRESHOLD
      );
    else if (stockFilter === "out_of_stock")
      result = result.filter((p) => p.current_stock <= 0);

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "stock") cmp = a.current_stock - b.current_stock;
      else if (sortBy === "price") cmp = a.price - b.price;
      else if (sortBy === "cost")
        cmp = a.avg_cost - b.avg_cost;
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [mergedInventory, searchQuery, stockFilter, sortBy, sortOrder]);

  // Paginated inventory
  const paginatedProducts = useMemo(() => {
    const start = invPage * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, invPage, pageSize]);

  const invTotalPages = Math.ceil(filteredProducts.length / pageSize);

  // Filtered & sorted movements
  const filteredMovements = useMemo(() => {
    let result = [...movements];

    if (movementSearch) {
      const q = movementSearch.toLowerCase();
      result = result.filter((m) => {
        const prod = productMap[m.product_id];
        return (
          prod?.name.toLowerCase().includes(q) ||
          m.reference?.toLowerCase().includes(q) ||
          m.note?.toLowerCase().includes(q)
        );
      });
    }

    if (movementTypeFilter !== "all") {
      result = result.filter((m) => m.type === movementTypeFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return movementDateSort === "desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [movements, movementSearch, movementTypeFilter, movementDateSort, productMap]);

  // Paginated movements
  const paginatedMovements = useMemo(() => {
    const start = movPage * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, movPage, pageSize]);

  const movTotalPages = Math.ceil(filteredMovements.length / pageSize);

  // Reset page on filter change
  useEffect(() => {
    setInvPage(0);
  }, [searchQuery, stockFilter, sortBy, sortOrder]);

  useEffect(() => {
    setMovPage(0);
  }, [movementSearch, movementTypeFilter, movementDateSort]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10">
            <Archive02Icon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Inventory & Stock
            </h1>
            <p className="text-xs text-muted-foreground hidden md:block">
              Manage your stock levels and track all movements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="relative"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            <Alert02Icon className="size-4" />
            <span className="hidden sm:inline">Alerts</span>
            {(stats.outOfStock > 0 || stats.nearlyOutOfStock > 0) && (
              <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {stats.outOfStock + stats.nearlyOutOfStock}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="relative overflow-hidden border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Cost
              </span>
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarCircleIcon className="size-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-black text-primary tabular-nums">
              ${stats.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Across {stats.totalStockUnits} units
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-blue-500/10 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Items
              </span>
              <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Package01Icon className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {stats.totalItems}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Products in catalog
            </p>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-amber-500/10 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => {
            setStockFilter("low_stock");
            setActiveTab("inventory");
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Low Stock
              </span>
              <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Alert02Icon className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.nearlyOutOfStock}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Below {LOW_STOCK_THRESHOLD} units
            </p>
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden border-red-500/10 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => {
            setStockFilter("out_of_stock");
            setActiveTab("inventory");
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Out of Stock
              </span>
              <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Cancel01Icon className="size-4 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums">
              {stats.outOfStock}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Need immediate restock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Alert Panel */}
      {showAlerts && (alertItems.outOfStockItems.length > 0 || alertItems.lowStockItems.length > 0) && (
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-red-500/5 to-transparent shadow-sm animate-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Alert02Icon className="size-5 text-amber-500" />
                Stock Alerts
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setShowAlerts(false)}
              >
                <Cancel01Icon className="size-3.5" />
              </Button>
            </div>
            <CardDescription>
              Items that need your attention
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Out of stock alerts */}
              {alertItems.outOfStockItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                      Out of Stock ({alertItems.outOfStockItems.length})
                    </span>
                  </div>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1.5 pr-3">
                      {alertItems.outOfStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors cursor-pointer"
                          onClick={() => {
                            setDetailProduct(item);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="relative h-8 w-8 rounded-md overflow-hidden border bg-muted flex items-center justify-center shrink-0">
                            {item.thumbnails && item.thumbnails.length > 0 ? (
                              <Image
                                src={getOptimizedImageUrl(item.thumbnails[0], 64)}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            ) : (
                              <Image01Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item.barcode}</p>
                          </div>
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                            0
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Low stock alerts */}
              {alertItems.lowStockItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Low Stock ({alertItems.lowStockItems.length})
                    </span>
                  </div>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1.5 pr-3">
                      {alertItems.lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          onClick={() => {
                            setDetailProduct(item);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="relative h-8 w-8 rounded-md overflow-hidden border bg-muted flex items-center justify-center shrink-0">
                            {item.thumbnails && item.thumbnails.length > 0 ? (
                              <Image
                                src={getOptimizedImageUrl(item.thumbnails[0], 64)}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            ) : (
                              <Image01Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item.barcode}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {item.current_stock}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Inventory & Stock Movements */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <TabsList className="w-fit">
            <TabsTrigger value="inventory" className="gap-1.5">
              <Package01Icon className="size-3.5" />
              <span>Inventory</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {products.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="movements" className="gap-1.5">
              <ChartIncreaseIcon className="size-3.5" />
              <span>Stock Movement</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {movements.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-1.5">
              <Archive02Icon className="size-3.5" />
              <span>Stock Batches</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {stocks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== INVENTORY TAB ===== */}
        <TabsContent value="inventory" className="space-y-3 mt-0">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
                id="inventory-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[140px] h-9" id="stock-filter">
                  <FilterIcon className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Stock Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[120px] h-9" id="sort-by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="stock">Stock Qty</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                id="sort-order-toggle"
              >
                {sortOrder === "asc" ? (
                  <ArrowUp01Icon className="size-4" />
                ) : (
                  <ArrowDown01Icon className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[56px] font-bold">#</TableHead>
                  <TableHead className="w-[60px] font-bold">Image</TableHead>
                  <TableHead className="font-bold">Product</TableHead>
                  <TableHead className="font-bold hidden md:table-cell">
                    Barcode
                  </TableHead>
                  <TableHead className="font-bold text-right">
                    Cost
                  </TableHead>
                  <TableHead className="font-bold text-right">
                    Price
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    Stock
                  </TableHead>
                  <TableHead className="font-bold text-right hidden md:table-cell">
                    Total Value
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-48">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loading01Icon className="animate-spin size-6" />
                        <span>Loading inventory...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center h-48 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package01Icon className="size-10 text-muted-foreground/30" />
                        <span>No products match your filters.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                    paginatedProducts.map((product, index) => {
                      const status = getStockStatus(product.current_stock);
                      const unitCost = product.avg_cost;
                      const totalValue = product.total_value;

                      return (
                        <TableRow
                          key={`${product.name}-${product.barcode}`}
                          className="cursor-pointer hover:bg-muted/30 transition-colors group"
                          onClick={() => {
                            setDetailProduct(product);
                            setDetailOpen(true);
                          }}
                        >
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {invPage * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="relative h-10 w-10 rounded-lg overflow-hidden border bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                            {product.thumbnails &&
                            product.thumbnails.length > 0 ? (
                              <Image
                                src={getOptimizedImageUrl(
                                  product.thumbnails[0],
                                  80
                                )}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <Image01Icon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-sm truncate max-w-[180px]">
                            {product.name}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {product.barcode}
                          </code>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          ${unitCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold text-primary">
                          ${product.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[36px] tabular-nums text-sm font-bold ${
                              product.current_stock <= 0
                                ? "text-red-600 dark:text-red-400"
                                : product.current_stock <= LOW_STOCK_THRESHOLD
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                            }`}
                          >
                            {product.current_stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm hidden md:table-cell">
                          ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={status.variant}
                            className={`text-[10px] px-2 py-0.5 gap-1 ${
                              product.current_stock <= 0
                                ? ""
                                : product.current_stock <= LOW_STOCK_THRESHOLD
                                ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                                : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${status.dotColor}`}
                            />
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Inventory Pagination */}
          {!loading && filteredProducts.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground hidden sm:block">
                Showing {invPage * pageSize + 1} -{" "}
                {Math.min((invPage + 1) * pageSize, filteredProducts.length)} of{" "}
                {filteredProducts.length} products
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={`${pageSize}`}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setInvPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 50].map((s) => (
                      <SelectItem key={s} value={`${s}`}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Page {invPage + 1} of {invTotalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setInvPage(0)}
                    disabled={invPage === 0}
                  >
                    <ArrowLeftDoubleIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setInvPage((p) => Math.max(0, p - 1))}
                    disabled={invPage === 0}
                  >
                    <ArrowLeft01Icon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      setInvPage((p) => Math.min(invTotalPages - 1, p + 1))
                    }
                    disabled={invPage >= invTotalPages - 1}
                  >
                    <ArrowRight01Icon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setInvPage(invTotalPages - 1)}
                    disabled={invPage >= invTotalPages - 1}
                  >
                    <ArrowRightDoubleIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== STOCK MOVEMENT TAB ===== */}
        <TabsContent value="movements" className="space-y-3 mt-0">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search product, reference..."
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                className="pl-9 h-9"
                id="movement-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={movementTypeFilter}
                onValueChange={setMovementTypeFilter}
              >
                <SelectTrigger className="w-[150px] h-9" id="movement-type-filter">
                  <FilterIcon className="size-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Movement Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="stock_in">Purchase (In)</SelectItem>
                  <SelectItem value="stock_out">Sale (Out)</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={() =>
                  setMovementDateSort((prev) =>
                    prev === "desc" ? "asc" : "desc"
                  )
                }
                id="movement-date-sort"
              >
                {movementDateSort === "desc" ? (
                  <ArrowDown01Icon className="size-3.5" />
                ) : (
                  <ArrowUp01Icon className="size-3.5" />
                )}
                Date
              </Button>
            </div>
          </div>

          {/* Movement Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(
              [
                "stock_in",
                "stock_out",
                "adjustment",
                "return",
              ] as StockMovementType[]
            ).map((type) => {
              const config = movementTypeConfig[type];
              const count = movements.filter((m) => m.type === type).length;
              return (
                <button
                  key={type}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border ${config.bgColor} hover:opacity-80 transition-opacity text-left ${
                    movementTypeFilter === type
                      ? "ring-2 ring-primary/30"
                      : ""
                  }`}
                  onClick={() =>
                    setMovementTypeFilter(
                      movementTypeFilter === type ? "all" : type
                    )
                  }
                >
                  <div className={`${config.color}`}>{config.icon}</div>
                  <div>
                    <p className={`text-xs font-bold ${config.color}`}>
                      {config.label}
                    </p>
                    <p className="text-lg font-black tabular-nums">{count}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Movements Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[56px] font-bold">#</TableHead>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Product</TableHead>
                  <TableHead className="font-bold text-center">Qty</TableHead>
                  <TableHead className="font-bold text-right hidden md:table-cell">
                    Unit Cost
                  </TableHead>
                  <TableHead className="font-bold text-center hidden lg:table-cell">
                    Stock Change
                  </TableHead>
                  <TableHead className="font-bold hidden md:table-cell">
                    Reference
                  </TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-48">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loading01Icon className="animate-spin size-6" />
                        <span>Loading movements...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedMovements.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center h-48 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ChartIncreaseIcon className="size-10 text-muted-foreground/30" />
                        <span>No stock movements found.</span>
                        <p className="text-xs">
                          Movements will appear here when stock changes are recorded.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMovements.map((movement, index) => {
                    const config = movementTypeConfig[movement.type];
                    const prod = productMap[movement.product_id];

                    return (
                      <TableRow
                        key={movement.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {movPage * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[10px] px-2 py-0.5 font-semibold ${config.color} ${config.bgColor}`}
                          >
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-semibold truncate max-w-[180px]">
                            {prod?.name || movement.product_id}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-bold tabular-nums text-sm ${
                              movement.type === "stock_in" ||
                              movement.type === "return"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : movement.type === "stock_out"
                                ? "text-red-600 dark:text-red-400"
                                : ""
                            }`}
                          >
                            {movement.type === "stock_in" ||
                            movement.type === "return"
                              ? "+"
                              : movement.type === "stock_out"
                              ? "-"
                              : ""}
                            {movement.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm hidden md:table-cell">
                          {movement.unit_cost
                            ? `$${movement.unit_cost.toFixed(2)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {movement.previous_stock_level} →{" "}
                            <span className="font-bold text-foreground">
                              {movement.new_stock_level}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {movement.reference ? (
                            <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px] inline-block">
                              {movement.reference}
                            </code>
                          ) : movement.note ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[120px] inline-block">
                              {movement.note}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(movement.date), "dd MMM yyyy")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Movement Pagination */}
          {!loading && filteredMovements.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground hidden sm:block">
                Showing {movPage * pageSize + 1} -{" "}
                {Math.min((movPage + 1) * pageSize, filteredMovements.length)}{" "}
                of {filteredMovements.length} movements
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={`${pageSize}`}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setMovPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 50].map((s) => (
                      <SelectItem key={s} value={`${s}`}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Page {movPage + 1} of {movTotalPages || 1}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setMovPage(0)}
                    disabled={movPage === 0}
                  >
                    <ArrowLeftDoubleIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setMovPage((p) => Math.max(0, p - 1))}
                    disabled={movPage === 0}
                  >
                    <ArrowLeft01Icon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      setMovPage((p) =>
                        Math.min((movTotalPages || 1) - 1, p + 1)
                      )
                    }
                    disabled={movPage >= (movTotalPages || 1) - 1}
                  >
                    <ArrowRight01Icon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setMovPage((movTotalPages || 1) - 1)}
                    disabled={movPage >= (movTotalPages || 1) - 1}
                  >
                    <ArrowRightDoubleIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== BATCHES TAB ===== */}
        <TabsContent value="batches" className="space-y-3 mt-0">
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[56px] font-bold">#</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider">Product</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider">Warehouse</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Cost</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Qty</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Value</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Created At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stocks.filter(s => s.quantity > 0).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-48 text-muted-foreground">
                                    No active stock batches found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            stocks.filter(s => s.quantity > 0).map((stock, idx) => {
                                const product = productMap[stock.product_id];
                                return (
                                    <TableRow key={stock.id} className="hover:bg-muted/30">
                                        <TableCell className="text-xs text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{product?.name || stock.product_id}</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">{product?.barcode}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] bg-blue-50/50 text-blue-700 border-blue-200">
                                                {warehouseMap[stock.warehouse_id]?.name || "Main"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm font-bold">${stock.cost.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-black tabular-nums">{stock.quantity}</span>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm font-semibold">${(stock.cost * stock.quantity).toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            {format(new Date(stock.created_at), "dd MMM yyyy")}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </TabsContent>
      </Tabs>

      {/* Product Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="sm:max-w-[480px] p-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="p-5 pb-3 border-b bg-primary/5 shrink-0">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <ViewIcon className="size-5 text-primary" />
              Stock Detail
            </SheetTitle>
            <SheetDescription>Inventory details for this item</SheetDescription>
          </SheetHeader>

          {detailProduct && (
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Product Header */}
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 rounded-xl overflow-hidden border-2 border-primary/10 bg-muted flex items-center justify-center shrink-0">
                    {detailProduct.thumbnails &&
                    detailProduct.thumbnails.length > 0 ? (
                      <Image
                        src={getOptimizedImageUrl(
                          detailProduct.thumbnails[0],
                          200
                        )}
                        alt={detailProduct.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <Image01Icon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate">
                      {detailProduct.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <BarcodeScanIcon className="size-3 text-muted-foreground" />
                      <code className="text-xs text-muted-foreground">
                        {detailProduct.barcode}
                      </code>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Stock Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/50 border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Current Stock
                    </p>
                    <p
                      className={`text-2xl font-black tabular-nums ${
                        detailProduct.current_stock <= 0
                          ? "text-red-600 dark:text-red-400"
                          : detailProduct.current_stock <= LOW_STOCK_THRESHOLD
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {detailProduct.current_stock}
                    </p>
                    <Badge
                      variant={
                        getStockStatus(detailProduct.current_stock).variant
                      }
                      className={`mt-1 text-[9px] px-1.5 py-0 h-4 gap-1 ${
                        detailProduct.current_stock <= 0
                          ? ""
                          : detailProduct.current_stock <= LOW_STOCK_THRESHOLD
                          ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                          : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      <span
                        className={`size-1 rounded-full ${
                          getStockStatus(detailProduct.current_stock).dotColor
                        }`}
                      />
                      {getStockStatus(detailProduct.current_stock).label}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Unit Cost
                    </p>
                    <p className="text-2xl font-black tabular-nums text-primary">
                      ${(detailProduct.avg_cost || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Avg. unit cost
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/50 border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Selling Price
                    </p>
                    <p className="text-xl font-black tabular-nums">
                      ${detailProduct.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                      Total Value
                    </p>
                    <p className="text-xl font-black tabular-nums text-primary">
                      $
                      {detailProduct.total_value.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Specific Stock Records (Lots/Batches) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Current Stock Breakdown (By Cost & Warehouse)
                  </h4>
                  <div className="space-y-2">
                    {stocks
                      .filter((s) => s.product_id === detailProduct.id && s.quantity > 0)
                      .length === 0 ? (
                      <div className="text-center py-4 bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-[10px] text-muted-foreground">No active batches for this product</p>
                      </div>
                    ) : (
                      stocks
                        .filter((s) => detailProduct.product_ids.includes(s.product_id) && s.quantity > 0)
                        .map((s) => (
                          <div key={s.id} className="p-3 rounded-xl border bg-background flex items-center justify-between shadow-sm">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                <Archive02Icon className="size-3" />
                                {warehouseMap[s.warehouse_id]?.name || "Main Warehouse"}
                              </p>
                              <p className="text-sm font-black tabular-nums">
                                ${s.cost.toFixed(2)} <span className="text-[10px] text-muted-foreground font-normal">cost</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-foreground tabular-nums">
                                {s.quantity}
                              </p>
                              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                                Available Qty
                              </p>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <Separator />

                {/* Recent movements for this product */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Movements
                  </h4>
                  {movements
                    .filter((m) => detailProduct.product_ids.includes(m.product_id))
                    .slice(0, 5).length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      <ChartIncreaseIcon className="size-8 mx-auto mb-2 text-muted-foreground/20" />
                      No movements recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {movements
                        .filter((m) => detailProduct.product_ids.includes(m.product_id))
                        .slice(0, 5)
                        .map((m) => {
                          const cfg = movementTypeConfig[m.type];
                          return (
                            <div
                              key={m.id}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border ${cfg.bgColor}`}
                            >
                              <div className={cfg.color}>{cfg.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs font-bold ${cfg.color}`}
                                >
                                  {cfg.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(m.date), "dd MMM yyyy")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-sm font-bold tabular-nums ${
                                    m.type === "stock_in" ||
                                    m.type === "return"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : m.type === "stock_out"
                                      ? "text-red-600 dark:text-red-400"
                                      : ""
                                  }`}
                                >
                                  {m.type === "stock_in" ||
                                  m.type === "return"
                                    ? "+"
                                    : m.type === "stock_out"
                                    ? "-"
                                    : ""}
                                  {m.quantity}
                                </p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                  {m.previous_stock_level} →{" "}
                                  {m.new_stock_level}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
