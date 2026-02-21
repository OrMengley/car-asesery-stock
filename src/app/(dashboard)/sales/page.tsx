"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
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
} from "hugeicons-react";
import Image from "next/image";
import { getProducts, getUsers } from "@/lib/firebase/actions";
import { getStocks } from "@/lib/firebase/stock-actions";
import {
  createSale,
  getSaleInvoices,
  deleteSaleInvoice,
} from "@/lib/firebase/sale-actions";
import { getCustomers, createCustomer } from "@/lib/firebase/customer-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, sale_invoice, Customer, Warehouse, Stock, User } from "@/types";
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
interface StockBatch {
  product: Product;
  cost: number;
  available: number;
  warehouseId: string;
}

interface SaleItemDraft {
  product_id: string;
  product_name: string;
  product_image?: string;
  cost: number;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

// ─── Main Page ───────────────────────────────────────────
export default function SalesPage() {
  // Data
  const [invoices, setInvoices] = useState<sale_invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const { user: authUser } = useAuth();

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Detail sheet
  const [viewingInvoice, setViewingInvoice] = useState<sale_invoice | null>(
    null
  );

  // Form fields
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [overallTax, setOverallTax] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "not paid">("paid");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "aba" | "aclida" | "wing">("cash");
  const [draftItems, setDraftItems] = useState<SaleItemDraft[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Quick-create customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // ─── Fetch data ─────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const [invoiceData, productData, customerData, warehouseData, stockData, userData] =
        await Promise.all([
          getSaleInvoices(),
          getProducts(),
          getCustomers(),
          getWarehouses(),
          getStocks(),
          getUsers(),
        ]);
      setInvoices(invoiceData);
      setProducts(productData);
      setCustomers(customerData);
      setWarehouses(warehouseData);
      setStocks(stockData);
      setUsers(userData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load sales data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Maps ──────────────────────────────────────────────
  const customerMap = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach((c) => (map[c.id] = c));
    return map;
  }, [customers]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, Warehouse> = {};
    warehouses.forEach((w) => (map[w.id] = w));
    return map;
  }, [warehouses]);

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => (map[u.id] = u));
    return map;
  }, [users]);

  // ─── Dashboard stats ───────────────────────────────────
  const stats = useMemo(() => {
    const totalSales = invoices.length;
    const totalRevenue = invoices.reduce((sum, i) => sum + i.total_price, 0);
    const totalItems = invoices.reduce(
      (sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity, 0),
      0
    );
    const thisMonth = invoices.filter((inv) => {
      const now = new Date();
      const d = new Date(inv.created_at);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });
    const thisMonthRevenue = thisMonth.reduce(
      (sum, i) => sum + i.total_price,
      0
    );
    return { totalSales, totalRevenue, totalItems, thisMonthRevenue };
  }, [invoices]);

  // ─── Draft calculations ─────────────────────────────────
  const draftSubTotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.total, 0),
    [draftItems]
  );
  const draftTotalPrice = useMemo(
    () => draftSubTotal - overallDiscount + overallTax,
    [draftSubTotal, overallDiscount, overallTax]
  );

  // ─── Filtering & pagination ─────────────────────────────
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.id.toLowerCase().includes(q) ||
          (customerMap[inv.customer_id]?.name || "Unknown")
            .toLowerCase()
            .includes(q)
      );
    }
    result.sort((a, b) =>
      sortOrder === "desc"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return result;
  }, [invoices, searchQuery, sortOrder, customerMap]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(
    () =>
      filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      ),
    [filteredInvoices, currentPage]
  );

  // ─── Product search → stock batches by cost ─────────────
  const filteredStockBatches = useMemo(() => {
    if (!productSearch || !selectedWarehouseId) return [];
    const q = productSearch.toLowerCase();

    // Find matching products
    const matchedProducts = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    );

    // For each matched product, get stock batches from selected warehouse
    const batches: StockBatch[] = [];
    for (const product of matchedProducts) {
      const productStocks = stocks
        .filter(
          (s) =>
            s.product_id === product.id &&
            s.warehouse_id === selectedWarehouseId &&
            !s.is_archived &&
            s.quantity > 0
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // FIFO order

      if (productStocks.length > 0) {
        for (const stock of productStocks) {
          batches.push({
            product,
            cost: stock.cost,
            available: stock.quantity,
            warehouseId: stock.warehouse_id,
          });
        }
      } else {
        // Product exists but no stock in this warehouse
        batches.push({
          product,
          cost: 0,
          available: 0,
          warehouseId: selectedWarehouseId,
        });
      }
    }

    return batches.slice(0, 12);
  }, [productSearch, products, stocks, selectedWarehouseId]);

  // ─── Add item to draft ──────────────────────────────────
  function addItemToDraft(batch: StockBatch) {
    if (batch.available <= 0) {
      toast.error(`No stock available for ${batch.product.name} at this cost`);
      return;
    }
    // Check for existing draft with same product + same cost
    const existingIdx = draftItems.findIndex(
      (d) => d.product_id === batch.product.id && d.cost === batch.cost
    );
    if (existingIdx >= 0) {
      setDraftItems(
        draftItems.map((d, i) =>
          i === existingIdx
            ? {
                ...d,
                quantity: d.quantity + 1,
                total: (d.quantity + 1) * d.price - (d.quantity + 1) * d.discount,
              }
            : d
        )
      );
    } else {
      setDraftItems([
        ...draftItems,
        {
          product_id: batch.product.id,
          product_name: batch.product.name,
          product_image: batch.product.thumbnails?.[0] || batch.product.images?.[0],
          cost: batch.cost,
          quantity: 1,
          price: batch.product.price || 0,
          discount: 0,
          total: batch.product.price || 0,
        },
      ]);
    }
    setProductSearch("");
    setShowProductDropdown(false);
    toast.success(`Added ${batch.product.name} (cost $${batch.cost.toFixed(2)})`);
  }

  function updateDraftItem(
    idx: number,
    field: "quantity" | "price" | "discount",
    value: number
  ) {
    setDraftItems(
      draftItems.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.price - updated.quantity * updated.discount;
        return updated;
      })
    );
  }

  function removeDraftItem(idx: number) {
    setDraftItems(draftItems.filter((_, i) => i !== idx));
  }

  // ─── Create sale ────────────────────────────────────────
  async function handleCreate() {
    if (draftItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    if (!authUser) {
      toast.error("You must be logged in to create a sale");
      return;
    }
    setCreating(true);
    try {
      await createSale({
        customer_id: selectedCustomerId,
        warehouse_id: selectedWarehouseId,
        items: draftItems.map((d) => ({
          product_id: d.product_id,
          quantity: d.quantity,
          price: d.price,
          discount: d.discount,
        })),
        discount: overallDiscount,
        tax: overallTax,
        status: paymentStatus,
        payment_method: paymentMethod,
        created_by: authUser.uid,
      });
      toast.success("Sale created successfully!");
      resetForm();
      setCreateOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to create sale");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setSelectedCustomerId("");
    setSelectedWarehouseId("");
    setOverallDiscount(0);
    setOverallTax(0);
    setPaymentStatus("paid");
    setPaymentMethod("cash");
    setDraftItems([]);
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
  }

  // ─── Quick-create customer ─────────────────────────────
  async function handleQuickCreateCustomer() {
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSavingCustomer(true);
    try {
      const id = await createCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
      } as any);
      toast.success(`Customer "${newCustomerName.trim()}" created!`);
      // Refresh customers list
      const updatedCustomers = await getCustomers();
      setCustomers(updatedCustomers);
      // Auto-select the new customer
      setSelectedCustomerId(id);
      // Reset inline form
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create customer");
    } finally {
      setSavingCustomer(false);
    }
  }

  // ─── Delete sale ────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await deleteSaleInvoice(id);
      toast.success("Sale invoice archived");
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
          <p className="text-muted-foreground font-medium">
            Loading sales...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-4">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <MoneyReceiveSquareIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Sales</h1>
            <p className="text-sm text-muted-foreground">
              Manage sales and invoices
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 gap-2"
        >
          <Add01Icon className="h-4 w-4" />
          New Sale
        </Button>
      </div>

      {/* ─── Dashboard Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200/50 dark:border-emerald-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Sales
              </p>
              <Invoice01Icon className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {stats.totalSales}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All-time invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-lime-50 dark:from-green-950/30 dark:to-lime-950/30 border-green-200/50 dark:border-green-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                Total Revenue
              </p>
              <MoneyAdd01Icon className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-black text-green-700 dark:text-green-300">
              ${stats.totalRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across all sales
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/30 border-blue-200/50 dark:border-blue-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Items Sold
              </p>
              <Package01Icon className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
              {stats.totalItems}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total units sold
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                This Month
              </p>
              <Calendar01Icon className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300">
              ${stats.thisMonthRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), "MMMM yyyy")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filters ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice ID or customer..."
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

      {/* ─── Sales Table ────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 font-semibold text-xs">#</TableHead>
              <TableHead className="font-semibold text-xs">
                Invoice
              </TableHead>
              <TableHead className="font-semibold text-xs">
                Customer
              </TableHead>
              <TableHead className="font-semibold text-xs text-center">
                Seller
              </TableHead>
              <TableHead className="font-semibold text-xs text-center">
                Items
              </TableHead>
              <TableHead className="font-semibold text-xs text-right">
                Sub Total
              </TableHead>
              <TableHead className="font-semibold text-xs text-right">
                Discount
              </TableHead>
              <TableHead className="font-semibold text-xs text-right">
                Tax
              </TableHead>
              <TableHead className="font-semibold text-xs text-right">
                Total
              </TableHead>
              <TableHead className="font-semibold text-xs text-center">
                Status
              </TableHead>
              <TableHead className="font-semibold text-xs text-center">
                Payment
              </TableHead>
              <TableHead className="font-semibold text-xs">Date</TableHead>
              <TableHead className="font-semibold text-xs text-center">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MoneyReceiveSquareIcon className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No sales found.</p>
                    <p className="text-sm">
                      Create a new sale to get started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedInvoices.map((inv, idx) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setViewingInvoice(inv)}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-mono text-xs"
                    >
                      {inv.id.slice(0, 8).toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {customerMap[inv.customer_id]?.name || inv.customer_id}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-xs font-medium">
                        {userMap[inv.created_by]?.name || inv.created_by || "Unknown"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {inv.items.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    ${inv.sub_total.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-orange-600 dark:text-orange-400">
                    {inv.discount > 0 ? `-$${inv.discount.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono text-blue-600 dark:text-blue-400">
                    {inv.tax > 0 ? `$${inv.tax.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-bold text-sm font-mono">
                    ${inv.total_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={inv.status === "paid" ? "default" : "destructive"}
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        inv.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400"
                      }`}
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                    >
                      {inv.payment_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(inv.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    <div
                      className="flex items-center justify-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50"
                        onClick={() => setViewingInvoice(inv)}
                      >
                        <ViewIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                        onClick={() => handleDelete(inv.id)}
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
              Showing {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(
                currentPage * itemsPerPage,
                filteredInvoices.length
              )}{" "}
              of {filteredInvoices.length}
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
              {Array.from(
                { length: Math.min(totalPages, 5) },
                (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={
                        currentPage === page ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-8 w-8 text-xs"
                    >
                      {page}
                    </Button>
                  );
                }
              )}
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

      {/* ─── CREATE SALE SHEET ──────────────────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!max-w-2xl p-0 flex flex-col"
        >
          <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <MoneyReceiveSquareIcon className="h-4 w-4 text-white" />
              </div>
              New Sale
            </SheetTitle>
            <SheetDescription>
              Select products and customer for this sale
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">
              {/* Sale Info */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Invoice01Icon className="h-4 w-4 text-emerald-500" />
                  Sale Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Customer
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowNewCustomer(!showNewCustomer)}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
                      >
                        {showNewCustomer ? (
                          <>
                            <Cancel01Icon className="h-3 w-3" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Add01Icon className="h-3 w-3" />
                            New Customer
                          </>
                        )}
                      </button>
                    </div>

                    {showNewCustomer ? (
                      <div className="space-y-2.5 p-3 rounded-lg border-2 border-dashed border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <Input
                          placeholder="Customer name *"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="h-9 text-sm bg-background"
                          autoFocus
                        />
                        <Input
                          placeholder="Phone (optional)"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="h-9 text-sm bg-background"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingCustomer || !newCustomerName.trim()}
                          onClick={handleQuickCreateCustomer}
                          className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {savingCustomer ? (
                            <Loading01Icon className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckmarkCircle01Icon className="h-3 w-3" />
                          )}
                          {savingCustomer ? "Creating..." : "Save & Select"}
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={selectedCustomerId}
                        onValueChange={setSelectedCustomerId}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground text-center space-y-2">
                              <p>No customers yet.</p>
                              <button
                                type="button"
                                onClick={() => setShowNewCustomer(true)}
                                className="text-xs font-semibold text-emerald-600 hover:underline"
                              >
                                + Create your first customer
                              </button>
                            </div>
                          ) : (
                            customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{c.name}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Warehouse (Stock Source)
                    </Label>
                    <Select
                      value={selectedWarehouseId}
                      onValueChange={setSelectedWarehouseId}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No warehouses found.
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
                  Sale Items
                  {draftItems.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {draftItems.length} items
                    </Badge>
                  )}
                </h3>

                {/* Product search */}
                {!selectedWarehouseId && (
                  <div className="rounded-lg border-2 border-dashed border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ⚠ Please select a warehouse first to see available stock
                    </p>
                  </div>
                )}
                <div className="relative">
                  <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={selectedWarehouseId ? "Search products by name or barcode..." : "Select warehouse first..."}
                    value={productSearch}
                    disabled={!selectedWarehouseId}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="pl-10 h-10"
                  />
                  {/* Dropdown — stock batches by cost */}
                  {showProductDropdown && productSearch && filteredStockBatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-popover shadow-xl max-h-72 overflow-auto">
                      {filteredStockBatches.map((batch, batchIdx) => (
                        <button
                          key={`${batch.product.id}-${batch.cost}-${batchIdx}`}
                          type="button"
                          disabled={batch.available <= 0}
                          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b last:border-b-0 ${
                            batch.available > 0
                              ? "hover:bg-muted/50 cursor-pointer"
                              : "opacity-50 cursor-not-allowed bg-muted/20"
                          }`}
                          onClick={() => addItemToDraft(batch)}
                        >
                          <div className="h-9 w-9 rounded-lg overflow-hidden bg-muted shrink-0 border">
                            {batch.product.thumbnails?.[0] ||
                            batch.product.images?.[0] ? (
                              <Image
                                src={getOptimizedImageUrl(
                                  batch.product.thumbnails?.[0] ||
                                    batch.product.images[0]
                                )}
                                alt={batch.product.name}
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
                            <p className="text-sm font-medium truncate">
                              {batch.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {batch.product.barcode}
                            </p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                                Cost: ${batch.cost.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-xs font-semibold">
                              Sell: ${batch.product.price?.toFixed(2) || "0.00"}
                            </p>
                            <p className={`text-[10px] font-medium ${
                              batch.available > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-500"
                            }`}>
                              {batch.available > 0
                                ? `Available: ${batch.available}`
                                : "Out of stock"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* No results message */}
                  {showProductDropdown && productSearch && selectedWarehouseId && filteredStockBatches.length === 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-popover shadow-xl p-4 text-center">
                      <p className="text-sm text-muted-foreground">No products found matching &quot;{productSearch}&quot;</p>
                    </div>
                  )}
                </div>

                {/* Draft items list */}
                {draftItems.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 p-8 text-center">
                    <Package01Icon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Search and add products above
                    </p>
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

                        {/* Name + cost */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.product_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                              Cost: ${item.cost.toFixed(2)}
                            </span>
                            {item.price > item.cost && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                +${(item.price - item.cost).toFixed(2)} margin
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">
                            QTY
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateDraftItem(
                                idx,
                                "quantity",
                                Math.max(1, Number(e.target.value))
                              )
                            }
                            className="h-8 w-16 text-center text-sm"
                          />
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">
                            $
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.price}
                            onChange={(e) =>
                              updateDraftItem(
                                idx,
                                "price",
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            className="h-8 w-20 text-center text-sm"
                          />
                        </div>

                        {/* Discount */}
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">
                            Disc
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.discount}
                            onChange={(e) =>
                              updateDraftItem(
                                idx,
                                "discount",
                                Math.max(0, Number(e.target.value))
                              )
                            }
                            className="h-8 w-16 text-center text-sm"
                          />
                        </div>

                        {/* Line total */}
                        <p className="text-sm font-bold w-20 text-right font-mono shrink-0">
                          ${item.total.toFixed(2)}
                        </p>

                        {/* Remove */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
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
                    <PercentSquareIcon className="h-4 w-4 text-amber-500" />
                    Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Overall Discount ($)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={overallDiscount}
                        onChange={(e) =>
                          setOverallDiscount(
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Tax ($)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={overallTax}
                        onChange={(e) =>
                          setOverallTax(
                            Math.max(0, Number(e.target.value))
                          )
                        }
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Payment Status
                      </Label>
                      <Select
                        value={paymentStatus}
                        onValueChange={(v: any) => setPaymentStatus(v)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="not paid">Not Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Payment Method
                      </Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={(v: any) => setPaymentMethod(v)}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="aba">ABA Bank</SelectItem>
                          <SelectItem value="aclida">ACLIDA Bank</SelectItem>
                          <SelectItem value="wing">Wing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span className="font-mono font-semibold">
                        ${draftSubTotal.toFixed(2)}
                      </span>
                    </div>
                    {overallDiscount > 0 && (
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>Discount</span>
                        <span className="font-mono">
                          -${overallDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {overallTax > 0 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>Tax</span>
                        <span className="font-mono">
                          +${overallTax.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-300">
                        ${draftTotalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Bottom actions */}
          <div className="p-6 border-t bg-muted/30 shrink-0">
            <Button
              onClick={handleCreate}
              disabled={
                creating || draftItems.length === 0 || !selectedCustomerId || !selectedWarehouseId
              }
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 gap-2 text-base"
            >
              {creating ? (
                <Loading01Icon className="h-5 w-5 animate-spin" />
              ) : (
                <CheckmarkCircle01Icon className="h-5 w-5" />
              )}
              <span className="font-semibold">
                {creating ? "Creating..." : "Create Sale"}
              </span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── VIEW INVOICE DETAIL SHEET ─────────────────── */}
      <Sheet
        open={!!viewingInvoice}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
      >
        <SheetContent
          side="right"
          className="!w-full sm:!max-w-lg p-0 flex flex-col"
        >
          {viewingInvoice && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shrink-0">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Invoice01Icon className="h-4 w-4 text-white" />
                  </div>
                  Invoice Details
                </SheetTitle>
                <SheetDescription>
                  {viewingInvoice.id.slice(0, 8).toUpperCase()} •{" "}
                  {format(
                    new Date(viewingInvoice.created_at),
                    "dd MMM yyyy, HH:mm"
                  )}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6 space-y-6">
                  {/* Customer info */}
                  <div className="rounded-xl bg-muted/40 p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Customer
                      </p>
                      <p className="text-sm font-semibold truncate">
                        {customerMap[viewingInvoice.customer_id]?.name ||
                          viewingInvoice.customer_id}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge
                        variant={viewingInvoice.status === "paid" ? "default" : "destructive"}
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          viewingInvoice.status === "paid"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        }`}
                      >
                        {viewingInvoice.status}
                      </Badge>
                      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                        VIA {viewingInvoice.payment_method}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed p-4 flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Created By
                        </p>
                        <p className="text-sm font-medium">
                          {userMap[viewingInvoice.created_by]?.name || viewingInvoice.created_by || "Unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Date
                        </p>
                        <p className="text-sm font-medium">
                          {format(new Date(viewingInvoice.created_at), "dd MMM yyyy")}
                        </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Items */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Items ({viewingInvoice.items.length})
                    </h4>
                    <div className="space-y-2">
                      {viewingInvoice.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                        >
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
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.product_barcode}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold font-mono">
                              ${item.total_price.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.quantity} × ${item.price.toFixed(2)}
                            </p>
                            {item.discount > 0 && (
                              <p className="text-[10px] text-orange-600">
                                Disc: ${item.discount.toFixed(2)}/ea
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span className="font-mono font-semibold">
                        ${viewingInvoice.sub_total.toFixed(2)}
                      </span>
                    </div>
                    {viewingInvoice.discount > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Discount</span>
                        <span className="font-mono">
                          -${viewingInvoice.discount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {viewingInvoice.tax > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Tax</span>
                        <span className="font-mono">
                          +${viewingInvoice.tax.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-300">
                        ${viewingInvoice.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Bottom actions */}
              <div className="p-6 border-t bg-muted/30 shrink-0 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-800 dark:hover:bg-red-950/50"
                  onClick={() => {
                    handleDelete(viewingInvoice.id);
                    setViewingInvoice(null);
                  }}
                >
                  <Delete01Icon className="h-4 w-4" />
                  Archive
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
