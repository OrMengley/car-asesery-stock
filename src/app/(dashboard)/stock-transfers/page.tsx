"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Sorting01Icon, 
  Add01Icon, 
  Loading01Icon,
  Package01Icon,
  Home01Icon,
  Calendar01Icon
} from "hugeicons-react";
import { getStockMovements } from "@/lib/firebase/stock-transfer-actions";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockTransferForm } from "@/components/forms/StockTransferForm";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockMovement[] | any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach(p => map[p.id] = p);
    return map;
  }, [products]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, Warehouse> = {};
    warehouses.forEach(w => map[w.id] = w);
    return map;
  }, [warehouses]);

  async function fetchData() {
    try {
      setLoading(true);
      const [transferData, productData, warehouseData] = await Promise.all([
        getStockMovements(),
        getProducts(),
        getWarehouses()
      ]);
      setTransfers(transferData);
      setProducts(productData);
      setWarehouses(warehouseData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load transfer data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sorting01Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Transfers</h1>
            <p className="text-sm text-muted-foreground">Move inventory between warehouses</p>
          </div>
        </div>
        <Button 
          size="sm" 
          className="lg:hidden bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          onClick={() => setSheetOpen(true)}
        >
          <Add01Icon className="mr-2 size-4" />
          New Transfer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* Left Column: Quick Transfer Form */}
        <Card className="hidden lg:flex flex-col shadow-sm border-primary/10 max-h-[calc(100vh-160px)] overflow-hidden">
          <CardHeader className="shrink-0 bg-muted/30 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Add01Icon className="size-5 text-primary" />
              Quick Transfer
            </CardTitle>
            <CardDescription>
              Record a stock movement between storage locations.
            </CardDescription>
          </CardHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto">
            <CardContent className="pt-6">
              <StockTransferForm onSuccess={fetchData} />
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right Column: Data Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Product</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">From</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">To</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Qty</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Date</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loading01Icon className="animate-spin size-6 text-primary" />
                      <span className="text-sm font-medium">Fetching transfers...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package01Icon className="size-8 opacity-20" />
                      <p>No transfers recorded yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((transfer) => (
                  <TableRow key={transfer.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight">{productMap[transfer.product_id]?.name || "Unknown Product"}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{productMap[transfer.product_id]?.barcode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {warehouseMap[transfer.from_warehouse_id!]?.name || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {warehouseMap[transfer.to_warehouse_id!]?.name || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <span className="font-black text-primary">{transfer.quantity}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {transfer.date
                        ? format(transfer.date, "dd MMM yyyy, HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate italic">
                      {transfer.note || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-[500px] p-0 flex flex-col overflow-hidden">
          <SheetHeader className="p-6 bg-muted/20 border-b">
            <SheetTitle>New Stock Transfer</SheetTitle>
            <SheetDescription>Move stock between locations.</SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <StockTransferForm onSuccess={() => {
              setSheetOpen(false);
              fetchData();
            }} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
