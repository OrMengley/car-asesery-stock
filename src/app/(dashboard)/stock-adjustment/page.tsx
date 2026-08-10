"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Add01Icon,
  Loading01Icon,
  Package01Icon,
  Search01Icon,
  Cancel01Icon,
  Calendar01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Settings01Icon,
} from "hugeicons-react";
import { getAdjustmentMovements } from "@/lib/firebase/stock-actions";
import { getProducts } from "@/lib/firebase/actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { StockMovement, Product, Warehouse } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StockAdjustmentForm } from "@/components/forms/StockAdjustmentForm";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function StockAdjustmentPage() {
  const [adjustments, setAdjustments] = useState<StockMovement[] | any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");

  const { role } = useAuth();
  const router = useRouter();

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

  async function fetchData() {
    try {
      setLoading(true);
      const [adjData, productData, warehouseData] = await Promise.all([
        getAdjustmentMovements(),
        getProducts(),
        getWarehouses(),
      ]);
      setAdjustments(adjData);
      setProducts(productData);
      setWarehouses(warehouseData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load adjustment data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Redirect non-admin users
  useEffect(() => {
    if (role && role !== "admin") {
      router.push("/");
    }
  }, [role, router]);

  const filteredAdjustments = useMemo(() => {
    let result = [...adjustments];

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((a) => {
        const aDate = a.date ? new Date(a.date) : new Date();
        return aDate >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((a) => {
        const aDate = a.date ? new Date(a.date) : new Date();
        return aDate <= end;
      });
    }

    // Direction filter (Up = has to_warehouse_id, Down = has from_warehouse_id)
    if (directionFilter === "up") {
      result = result.filter((a) => a.to_warehouse_id && !a.from_warehouse_id);
    } else if (directionFilter === "down") {
      result = result.filter((a) => a.from_warehouse_id && !a.to_warehouse_id);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((a) => {
        const prod = productMap[a.product_id];
        const matchProdName = prod?.name?.toLowerCase().includes(q);
        const matchBarcode = prod?.barcode?.toLowerCase().includes(q);
        const matchFromW =
          a.from_warehouse_id &&
          warehouseMap[a.from_warehouse_id]?.name?.toLowerCase().includes(q);
        const matchToW =
          a.to_warehouse_id &&
          warehouseMap[a.to_warehouse_id]?.name?.toLowerCase().includes(q);
        const matchNote = a.note?.toLowerCase().includes(q);
        const matchCreatedBy = a.created_by?.toLowerCase().includes(q);
        return (
          matchProdName ||
          matchBarcode ||
          matchFromW ||
          matchToW ||
          matchNote ||
          matchCreatedBy
        );
      });
    }

    return result.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [
    adjustments,
    startDate,
    endDate,
    searchQuery,
    directionFilter,
    productMap,
    warehouseMap,
  ]);

  const hasActiveFilters = Boolean(
    startDate || endDate || searchQuery || directionFilter !== "all"
  );

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setDirectionFilter("all");
  };

  const getDirectionBadge = (movement: any) => {
    if (movement.to_warehouse_id && !movement.from_warehouse_id) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none font-semibold gap-1">
          <ArrowUp01Icon className="h-3 w-3" />
          Increase
        </Badge>
      );
    }
    return (
      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-none shadow-none font-semibold gap-1">
        <ArrowDown01Icon className="h-3 w-3" />
        Decrease
      </Badge>
    );
  };

  if (role && role !== "admin") return null;

  return (
    <div className="flex flex-col px-4 lg:px-6 py-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 pt-2 -mt-2 flex flex-col gap-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Settings01Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Stock Adjustment
              </h1>
              <p className="text-sm text-muted-foreground">
                Manually adjust inventory quantities
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            onClick={() => setSheetOpen(true)}
          >
            <Add01Icon className="mr-2 size-4" />
            New Adjustment
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="p-3.5 rounded-xl border bg-card shadow-2xs flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by product, barcode, warehouse..."
                className="pl-8 text-xs h-9 bg-background/50 border-slate-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Cancel01Icon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Direction Filter */}
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-9 w-[130px] text-xs bg-background/50 border-slate-200">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">
                  All Types
                </SelectItem>
                <SelectItem value="up" className="text-xs">
                  ↑ Increase
                </SelectItem>
                <SelectItem value="down" className="text-xs">
                  ↓ Decrease
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Start Date */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar01Icon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline font-medium text-[11px]">
                From:
              </span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 w-[130px] bg-background/50 border-slate-200"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden sm:inline font-medium text-[11px]">
                To:
              </span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 w-[130px] bg-background/50 border-slate-200"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
              >
                <Cancel01Icon className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <Badge
            variant="outline"
            className="text-[11px] font-semibold text-slate-600 border-slate-200 px-2.5 py-1 shrink-0"
          >
            Showing {filteredAdjustments.length} of {adjustments.length}
          </Badge>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
        <Table wrapperClassName="max-h-[calc(100vh-240px)]">
          <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-muted/70 shadow-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Date
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Product
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Type
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Warehouse
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-center">
                Qty
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-center">
                Stock Level
              </TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">
                Note / Reason
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-48">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loading01Icon className="animate-spin size-6 text-primary" />
                    <span className="text-sm font-medium">
                      Fetching adjustments...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAdjustments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-48 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Package01Icon className="size-8 opacity-20" />
                    <p>
                      {hasActiveFilters
                        ? "No adjustments match the selected filters."
                        : "No stock adjustments recorded yet."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                        className="text-xs mt-1"
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAdjustments.map((adj) => {
                const isIncrease =
                  adj.to_warehouse_id && !adj.from_warehouse_id;
                const warehouseId =
                  adj.to_warehouse_id || adj.from_warehouse_id;
                return (
                  <TableRow
                    key={adj.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {adj.date
                        ? format(adj.date, "dd MMM yyyy, HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight">
                          {productMap[adj.product_id]?.name ||
                            "Unknown Product"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {productMap[adj.product_id]?.barcode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getDirectionBadge(adj)}</TableCell>
                    <TableCell>
                      {warehouseId ? (
                        <Badge
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200 font-medium"
                        >
                          {warehouseMap[warehouseId]?.name || "Unknown"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-black text-sm ${
                          isIncrease ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isIncrease ? "+" : "-"}
                        {adj.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <span className="text-muted-foreground font-medium">
                          {adj.previous_stock_level}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-bold text-foreground">
                          {adj.new_stock_level}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate italic">
                      {adj.note || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* New Adjustment Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="sm:max-w-[550px] p-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="p-6 bg-muted/20 border-b">
            <SheetTitle>New Stock Adjustment</SheetTitle>
            <SheetDescription>
              Manually increase or decrease inventory.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6">
              <StockAdjustmentForm
                onSuccess={() => {
                  setSheetOpen(false);
                  fetchData();
                }}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
