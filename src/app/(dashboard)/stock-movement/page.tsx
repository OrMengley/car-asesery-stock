"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { 
  BarChartIcon, 
  Loading01Icon,
  Package01Icon,
} from "hugeicons-react";
import { getAllStockMovements } from "@/lib/firebase/stock-transfer-actions";
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

export default function StockMovementPage() {
  const [movements, setMovements] = useState<StockMovement[] | any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [movementData, productData, warehouseData] = await Promise.all([
        getAllStockMovements(),
        getProducts(),
        getWarehouses()
      ]);
      let role = null;
      let wId = null;
      try {
        const authStr = localStorage.getItem("user_auth");
        if (authStr) {
          const authData = JSON.parse(authStr);
          role = authData?.user_info?.role;
          wId = authData?.user_info?.warehouse_id;
        }
      } catch (e) {
        console.error("Failed to parse user_auth", e);
      }

      let filteredMovements = movementData;
      if (role !== "admin") {
        if (wId) {
          filteredMovements = movementData.filter((m: any) => 
            m.from_warehouse_id === wId || m.to_warehouse_id === wId
          );
        } else {
          filteredMovements = [];
        }
      }

      setMovements(filteredMovements);
      setProducts(productData);
      setWarehouses(warehouseData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load movement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "stock_in":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none font-semibold">Stock In</Badge>;
      case "stock_out":
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-none shadow-none font-semibold">Stock Out</Badge>;
      case "transfer":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-none shadow-none font-semibold">Transfer</Badge>;
      case "return":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none shadow-none font-semibold">Return</Badge>;
      case "adjustment":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-none shadow-none font-semibold">Adjustment</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{type.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BarChartIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Movement Tracking</h1>
            <p className="text-sm text-muted-foreground">Monitor all inventory flow across warehouses</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Product</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Type</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Qty</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">From</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">To</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-48">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loading01Icon className="animate-spin size-6 text-primary" />
                    <span className="text-sm font-medium">Fetching movements...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-48 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Package01Icon className="size-8 opacity-20" />
                    <p>No stock movements recorded yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {movement.date ? format(movement.date, "dd MMM yyyy, HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm tracking-tight">{productMap[movement.product_id]?.name || "Unknown Product"}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{productMap[movement.product_id]?.barcode}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(movement.type)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-primary">{movement.quantity}</span>
                  </TableCell>
                  <TableCell>
                    {movement.from_warehouse_id ? (
                      <span className="text-sm font-medium">{warehouseMap[movement.from_warehouse_id]?.name || "Unknown"}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {movement.to_warehouse_id ? (
                      <span className="text-sm font-medium">{warehouseMap[movement.to_warehouse_id]?.name || "Unknown"}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate italic">
                    {movement.note || movement.reference || "—"}
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
