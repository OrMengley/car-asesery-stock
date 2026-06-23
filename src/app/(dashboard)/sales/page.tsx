"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
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
  PrinterIcon,
} from "hugeicons-react";
import Image from "next/image";
import { getProducts, getUsers } from "@/lib/firebase/actions";
import { getStocks } from "@/lib/firebase/stock-actions";
import {
  createSale,
  getSaleInvoices,
  deleteSaleInvoice,
  updateSalePayment,
} from "@/lib/firebase/sale-actions";
import { getCustomers, createCustomer } from "@/lib/firebase/customer-actions";
import { getWarehouses } from "@/lib/firebase/warehouse-actions";
import { Product, SaleInvoice, Customer, Warehouse, Stock, User } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import JsBarcode from "jsbarcode";

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

type FlyingImage = {
  id: string;
  url: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function FlyingImageComponent({ img, onComplete }: { img: FlyingImage; onComplete: () => void }) {
  const [style, setStyle] = useState({
    transform: `translate(${img.startX - 40}px, ${img.startY - 40}px) scale(1)`,
    opacity: 1,
    transition: 'none'
  });

  useEffect(() => {
    // Force browser repaint to ensure initial position is registered
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        setStyle({
          transform: `translate(${img.endX - 20}px, ${img.endY - 20}px) scale(0.2)`,
          opacity: 0,
          transition: 'all 800ms cubic-bezier(0.25, 1, 0.5, 1)'
        });
      }, 50);
    });
    
    const removeTimer = setTimeout(onComplete, 900);
  


  return () => {
      clearTimeout(removeTimer);
    };
  }, [img, onComplete]);

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '80px',
        height: '80px',
        zIndex: 999999,
        ...style
      }}
    >
      <img src={img.url} className="w-full h-full object-cover rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-emerald-500" alt="" />
    </div>
  );
}

export default function SalesPage() {

  // Data
  const [invoices, setInvoices] = useState<SaleInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const { user: authUser, userInfo } = useAuth();

  // Create sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Detail sheet
  const [viewingInvoice, setViewingInvoice] = useState<SaleInvoice | null>(
    null
  );

  // Form fields
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  // Auto-set warehouse from user_auth local storage
  useEffect(() => {
    if (userInfo?.warehouse_id) {
      setSelectedWarehouseId(userInfo.warehouse_id);
    }
  }, [userInfo]);
  
  // Auto-open product dropdown when warehouse is selected and sheet is open
  useEffect(() => {
    if (createOpen && selectedWarehouseId) {
      setShowProductDropdown(true);
    }
  }, [createOpen, selectedWarehouseId]);
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
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "not paid">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Quick-create customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Pay state
  const [payingInvoice, setPayingInvoice] = useState<SaleInvoice | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "aba" | "aclida" | "wing">("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [paying, setPaying] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [addingBatch, setAddingBatch] = useState<StockBatch | null>(null);

  const [flyingImages, setFlyingImages] = useState<FlyingImage[]>([]);

  function triggerFlyAnimation(sourceId: string, targetId: string, imageUrl: string) {
    const sourceEl = document.getElementById(sourceId);
    const targetEl = document.getElementById(targetId);
    
    if (!sourceEl) toast.error(`Missing source: ${sourceId}`);
    if (!targetEl) toast.error(`Missing target: ${targetId}`);
    
    if (sourceEl && targetEl) {
      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      
      const newImage: FlyingImage = {
        id: Math.random().toString(36).substr(2, 9),
        url: imageUrl,
        startX: sourceRect.left + sourceRect.width / 2,
        startY: sourceRect.top + sourceRect.height / 2,
        endX: targetRect.left + targetRect.width / 2,
        endY: targetRect.top + targetRect.height / 2,
      };
      
      setFlyingImages(prev => [...prev, newImage]);
    }
  }


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
    const relevantInvoices = userInfo?.warehouse_id 
      ? invoices.filter(inv => inv.warehouse_id === userInfo.warehouse_id)
      : invoices;

    const totalSales = relevantInvoices.length;
    const totalRevenue = relevantInvoices.reduce((sum, i) => sum + i.total_price, 0);
    const totalItems = relevantInvoices.reduce(
      (sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity, 0),
      0
    );
    const thisMonth = relevantInvoices.filter((inv) => {
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
  }, [invoices, userInfo]);

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

    // Filter by warehouse if user is restricted
    if (userInfo?.warehouse_id) {
      result = result.filter((inv) => inv.warehouse_id === userInfo.warehouse_id);
    }

    // Only show sales created by the currently logged-in user
    if (authUser?.uid) {
      result = result.filter((inv) => inv.created_by === authUser.uid);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((inv) => new Date(inv.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((inv) => new Date(inv.created_at) <= to);
    }

    // Text search
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
  }, [invoices, searchQuery, sortOrder, customerMap, authUser, statusFilter, dateFrom, dateTo]);

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
    if (!selectedWarehouseId) return [];
    const q = productSearch.toLowerCase();

    // Find matching products
    const matchedProducts = q 
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        )
      : products; // Show all products if no search query

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

    return q ? batches.slice(0, 12) : batches.filter(b => b.available > 0).slice(0, 15);
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
    const item = draftItems[idx];
    if (item) {
       const imgUrl = item.product_image ? getOptimizedImageUrl(item.product_image) : "";
       if (imgUrl) {
         triggerFlyAnimation(`cart-item-${idx}`, `product-card-${item.product_id}`, imgUrl);
       }
    }
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
    setSelectedWarehouseId(userInfo?.warehouse_id || "");
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

  // ─── Mark as paid ─────────────────────────────────
  async function handlePay() {
    if (!payingInvoice) return;
    const amt = parseFloat(amountReceived);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount received");
      return;
    }
    if (amt < payingInvoice.total_price) {
      toast.error(`Amount must be at least $${payingInvoice.total_price.toFixed(2)}`);
      return;
    }
    setPaying(true);
    try {
      await updateSalePayment(payingInvoice.id, {
        payment_method: payMethod,
        amount_received: amt,
      });
      toast.success("Payment recorded successfully!");
      setPayingInvoice(null);
      setAmountReceived("");
      setPayMethod("cash");
      // Refresh data and update viewingInvoice to reflect paid status
      await fetchData();
      setViewingInvoice(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  // ─── Delete sale ─────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await deleteSaleInvoice(id);
      toast.success("Sale invoice archived");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  }


  // ─── Print cost invoice (A4 size) ───────────────
  function handlePrintCostInvoice(inv: SaleInvoice) {
    const customer = customerMap[inv.customer_id];
    const seller = userMap[inv.created_by];
    const warehouse = warehouseMap[inv.warehouse_id];
    const invoiceNo = inv.id.slice(0, 8).toUpperCase();
    const dateStr = format(new Date(inv.created_at), "dd MMM yyyy, HH:mm");

    const itemsHtml = inv.items
      .map((item) => {
        const totalCost = item.cost * item.quantity;
        return `
          <tr>
            <td style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">${item.product_name}</td>
            <td style="text-align:center;padding:8px;border-bottom:1px solid #ddd;">${item.quantity}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">$${item.cost.toFixed(2)}</td>
            <td style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">$${totalCost.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    const grandTotalCost = inv.items.reduce((acc, item) => acc + item.cost * item.quantity, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Cost Record #${invoiceNo}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
          }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; color: #111; letter-spacing: 1px; }
          .header p { margin: 0; font-size: 16px; color: #555; }
          
          .info-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .info-box {
            width: 48%;
          }
          .info-box p { margin: 5px 0; font-size: 14px; }
          .info-box strong { color: #111; display: inline-block; width: 90px; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f8f9fa;
            color: #111;
            font-weight: bold;
            text-align: left;
            padding: 12px 8px;
            border-bottom: 2px solid #dee2e6;
            font-size: 14px;
            text-transform: uppercase;
          }
          .total-row td {
            font-weight: bold;
            font-size: 16px;
            color: #111;
            padding: 15px 8px;
            border-top: 2px solid #dee2e6;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #777;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SALE COST RECORD</h1>
          <p>Invoice #${invoiceNo}</p>
        </div>
        
        <div class="info-container">
          <div class="info-box">
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Seller:</strong> ${seller?.name || "Unknown"}</p>
          </div>
          <div class="info-box" style="text-align: right;">
            <p><strong>Customer:</strong> ${customer?.name || "Walk-in"}</p>
            <p><strong>Warehouse:</strong> ${warehouse?.name || "Unknown"}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Cost</th>
              <th style="text-align:right;">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align:right; padding-right: 20px;">Grand Total Cost</td>
              <td style="text-align:right;">$${grandTotalCost.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>This is an internal cost record document. Not a customer receipt.</p>
          <p>Generated on ${format(new Date(), "dd MMM yyyy, HH:mm")}</p>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=800,height=800");
    if (!printWin) return;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 500);
  }

  // ─── Print invoice (58mm thermal receipt) ───────────────
  function handlePrintInvoice(inv: SaleInvoice) {
    const customer = customerMap[inv.customer_id];
    const seller = userMap[inv.created_by];
    const warehouse = warehouseMap[inv.warehouse_id];
    const invoiceNo = inv.id.slice(0, 8).toUpperCase();
    const dateStr = format(new Date(inv.created_at), "dd MMM yyyy, HH:mm");

    // Generate barcode SVG locally using JsBarcode
    let barcodeSvg = "";
    try {
      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svgNode, invoiceNo, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 0,
        textMargin: 2,
      });
      barcodeSvg = svgNode.outerHTML;
    } catch (err) {
      console.error("Barcode generation failed:", err);
    }

    const itemsHtml = inv.items
      .map(
        (item) => `
        <tr>
          <td style="text-align:left;padding:2px 0;font-size:11px;">${item.product_name}</td>
          <td style="text-align:center;padding:2px 0;font-size:11px;">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0;font-size:11px;">$${item.price.toFixed(2)}</td>
          <td style="text-align:right;padding:2px 0;font-size:11px;">$${item.total_price.toFixed(2)}</td>
        </tr>
        ${item.discount > 0 ? `<tr><td colspan="4" style="text-align:right;font-size:9px;color:#888;padding:0 0 2px 0;">disc: -$${item.discount.toFixed(2)}/ea</td></tr>` : ""}
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${invoiceNo}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 80mm;
            padding: 1mm;
            font-size: 12px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .double-divider {
            border: none;
            border-top: 2px double #000;
            margin: 6px 0;
          }
          .header-title {
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .header-sub {
            font-size: 10px;
            color: #555;
            margin-top: 2px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 1px 0;
          }
          .info-label {
            color: #555;
          }
          .info-value {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead th {
            text-align: left;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 3px 0;
            border-bottom: 1px solid #000;
          }
          .total-section .row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 2px 0;
          }
          .total-section .grand-total {
            display: flex;
            justify-content: space-between;
            font-size: 15px;
            font-weight: bold;
            padding: 4px 0;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            color: #555;
            margin-top: 8px;
          }
          .footer .thanks {
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid #000;
            border-radius: 3px;
            margin-top: 4px;
          }
          @media print {
            body {
              width: 58mm;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="center">
          <div class="header-title">CAR ACCESSORIES</div>
          ${seller?.avatar_url ? `
          <div>
            <img src="${seller.avatar_url}" alt="" style="width: 50px; height: 50px; border-radius: 50%;" />
          </div>` : ""}
          <div class="header-sub">${seller?.name || "Unknown"}</div>
          ${warehouse ? `<div class="header-sub">${warehouse.name}</div>` : ""}
        </div>

        <hr class="double-divider">

        <!-- Invoice Info -->
        <div class="info-row">
          <span class="info-label">Invoice:</span>
          <span class="info-value">#${invoiceNo}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span class="info-value">${dateStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Customer:</span>
          <span class="info-value">${customer?.name || "Walk-in"}</span>
        </div>
        ${customer?.phone ? `<div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${customer.phone}</span></div>` : ""}
        <div class="info-row">
          <span class="info-label">Seller:</span>
          <span class="info-value">${seller?.name || "Unknown"}</span>
        </div>

        <hr class="divider">

        <!-- Items -->
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <hr class="divider">

        <!-- Totals -->
        <div class="total-section">
          <div class="row">
            <span>Sub Total</span>
            <span class="bold">$${inv.sub_total.toFixed(2)}</span>
          </div>
          ${inv.discount > 0 ? `<div class="row"><span>Discount</span><span class="bold">-$${inv.discount.toFixed(2)}</span></div>` : ""}
          ${inv.tax > 0 ? `<div class="row"><span>Tax</span><span class="bold">+$${inv.tax.toFixed(2)}</span></div>` : ""}
        </div>

        <hr class="double-divider">

        <div class="total-section">
          <div class="grand-total">
            <span>TOTAL</span>
            <span>$${inv.total_price.toFixed(2)}</span>
          </div>
        </div>

        <hr class="divider">

        <!-- Payment Info -->
        <div class="info-row">
          <span class="info-label">Payment:</span>
          <span class="info-value" style="text-transform:uppercase;">${inv.payment_method}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="info-value" style="text-transform:uppercase;">${inv.status}</span>
        </div>

        <hr class="divider">

        <!-- Barcode -->
        <div class="center" style="margin:8px 0;">
          ${barcodeSvg}
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="thanks">Thank You!</div>
          <div>Please keep this receipt for your records</div>
          
          <div class="double-divider"></div>
          <div class="info-row">
            <span class="info-label">Tech By :</span>
            <span class="info-value">Dambang Tech Stack</span>
          </div>
          <div class="info-row">
            <span class="info-label">Telegram contact :</span>
            <span class="info-value">+855 98943324</span>
            
          </div>
          <div class="info-row">
            <span class="info-label">another line:</span>
            <span class="info-value">+855 187166671</span>
            
          </div>
          <div style="margin-top:6px;">
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent("https://t.me/ORMengley")}" 
              alt="QR Code" 
              style="width:60px;height:60px;" 
            />
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      toast.error("Please allow pop-ups to print the invoice");
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
      <div className="space-y-3">
        {/* Row 1: search + sort */}
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

        {/* Row 2: status pills + date range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center border rounded-lg overflow-hidden h-9 shrink-0">
            {(["all", "paid", "not paid"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                className={`px-3 h-full text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? s === "paid"
                      ? "bg-emerald-600 text-white"
                      : s === "not paid"
                      ? "bg-red-500 text-white"
                      : "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "all" ? "All" : s === "paid" ? "✓ Paid" : "✗ Not Paid"}
              </button>
            ))}
          </div>

          {/* Date From */}
          <div className="flex items-center gap-1.5 border rounded-lg h-9 px-3 bg-background">
            <Calendar01Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="h-full text-xs bg-transparent outline-none text-foreground w-28 cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5 border rounded-lg h-9 px-3 bg-background">
            <Calendar01Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="h-full text-xs bg-transparent outline-none text-foreground w-28 cursor-pointer"
            />
          </div>

          {/* Clear active filters */}
          {(statusFilter !== "all" || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter("all"); setDateFrom(""); setDateTo(""); setCurrentPage(1); }}
              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 px-2 h-9 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Cancel01Icon className="h-3.5 w-3.5" />
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">
            {filteredInvoices.length} result{filteredInvoices.length !== 1 ? "s" : ""}
          </span>
        </div>
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
                        className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50"
                        onClick={() => handlePrintInvoice(inv)}
                        title="Print Invoice"
                      >
                        <PrinterIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/50"
                        onClick={() => handlePrintCostInvoice(inv)}
                        title="Print Cost Record (A4)"
                      >
                        <Invoice01Icon className="h-4 w-4" />
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
          className="!w-screen !max-w-none p-0 flex flex-col h-screen border-none bg-background [&>button]:hidden"
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <MoneyReceiveSquareIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold tracking-tight">New Sale (POS)</SheetTitle>
                <SheetDescription className="text-xs">Search products and process checkout</SheetDescription>
              </div>
            </div>
            <button 
              onClick={() => setCreateOpen(false)} 
              className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Cancel01Icon className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
            {/* ─── LEFT COLUMN: Products ─── */}
            <div className="flex-1 flex flex-col bg-muted/10 md:border-r min-h-0">
              {/* Search Bar */}
              <div className="p-4 border-b bg-background shrink-0">
                <div className="relative">
                  <Search01Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={selectedWarehouseId ? "Search products by name or barcode..." : "Select warehouse on the right first..."}
                    value={productSearch}
                    disabled={!selectedWarehouseId}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-12 h-14 bg-background shadow-sm text-lg rounded-xl"
                  />
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {!selectedWarehouseId ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                    <Package01Icon className="h-16 w-16 opacity-20 mb-4" />
                    <p className="text-lg font-medium">No Warehouse Selected</p>
                    <p className="text-sm">Please select a warehouse from the cart panel to load products.</p>
                  </div>
                ) : filteredStockBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                    <Search01Icon className="h-12 w-12 opacity-20 mb-4" />
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm">Try adjusting your search query.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredStockBatches.map((batch, batchIdx) => (
                      <div
                        key={`${batch.product.id}-${batch.cost}-${batchIdx}`}
                        onClick={() => {
                          if (batch.available > 0) {
                            const imgUrl = batch.product.thumbnails?.[0] || batch.product.images?.[0] ? getOptimizedImageUrl(batch.product.thumbnails?.[0] || batch.product.images[0]) : "";
                            if (imgUrl) {
                              triggerFlyAnimation(`product-card-${batch.product.id}`, `cart-header`, imgUrl);
                            }
                            addItemToDraft(batch);
                          }
                        }}
                        id={`product-card-${batch.product.id}`}
                        className={`group flex flex-col border rounded-xl overflow-hidden bg-card transition-all ${
                          batch.available > 0
                            ? "cursor-pointer hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-600 hover:-translate-y-1"
                            : "opacity-50 grayscale cursor-not-allowed"
                        }`}
                      >
                        {/* Image area */}
                        <div className="aspect-square bg-muted relative border-b flex items-center justify-center">
                          {batch.product.thumbnails?.[0] || batch.product.images?.[0] ? (
                            <Image
                              src={getOptimizedImageUrl(batch.product.thumbnails?.[0] || batch.product.images[0])}
                              alt={batch.product.name}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <Package01Icon className="h-12 w-12 text-muted-foreground/30" />
                          )}
                          {/* Stock badge */}
                          <div className="absolute top-2 right-2">
                            <Badge variant={batch.available > 0 ? "default" : "destructive"} className="text-[10px] px-2 py-0.5 shadow-sm">
                              {batch.available} in stock
                            </Badge>
                          </div>
                        </div>

                        {/* Details area */}
                        <div className="p-3 flex flex-col flex-1">
                          <h4 className="font-bold text-sm line-clamp-2 leading-tight mb-1" title={batch.product.name}>
                            {batch.product.name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {batch.product.barcode || "No Barcode"}
                          </p>
                          
                          <div className="mt-auto pt-3 flex items-end justify-between">
                            <div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-0.5">
                                Cost: ${batch.cost.toFixed(2)}
                              </p>
                              <p className="font-black text-emerald-600 dark:text-emerald-400 text-lg leading-none">
                                ${batch.product.price?.toFixed(2) || "0.00"}
                              </p>
                            </div>
                            <Button 
                              size="icon" 
                              disabled={batch.available <= 0}
                              className={`h-8 w-8 rounded-full ${batch.available > 0 ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400' : ''}`}
                              variant={batch.available > 0 ? "ghost" : "outline"}
                            >
                              <Add01Icon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─── RIGHT COLUMN: Cart & Checkout ─── */}
            <div className="w-full md:w-[400px] xl:w-[450px] flex flex-col bg-background shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 min-h-0">
              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-6">
                  {/* Customer & Warehouse */}
                  <div className="space-y-4 bg-muted/30 p-4 rounded-xl border">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Invoice01Icon className="h-4 w-4 text-emerald-500" />
                      Sale Settings
                    </h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground">Customer</Label>
                          <button
                            type="button"
                            onClick={() => setShowNewCustomer(!showNewCustomer)}
                            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                          >
                            {showNewCustomer ? (
                              <><Cancel01Icon className="h-3 w-3" />Cancel</>
                            ) : (
                              <><Add01Icon className="h-3 w-3" />New Customer</>
                            )}
                          </button>
                        </div>
                        {showNewCustomer ? (
                          <div className="space-y-2 p-3 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20">
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
                              {savingCustomer ? <Loading01Icon className="h-3 w-3 animate-spin" /> : <CheckmarkCircle01Icon className="h-3 w-3" />}
                              {savingCustomer ? "Creating..." : "Save & Select"}
                            </Button>
                          </div>
                        ) : (
                          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                            <SelectTrigger className="h-10 text-sm bg-background">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.length === 0 ? (
                                <div className="p-3 text-sm text-center text-muted-foreground">No customers</div>
                              ) : (
                                customers.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Warehouse (Stock Source)</Label>
                        <Select
                          value={selectedWarehouseId}
                          onValueChange={setSelectedWarehouseId}
                          disabled={!!userInfo?.warehouse_id}
                        >
                          <SelectTrigger className="h-10 text-sm bg-background">
                            <SelectValue placeholder="Select warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.length === 0 ? (
                              <div className="p-2 text-sm text-center">No warehouses</div>
                            ) : (
                              warehouses
                                .filter(w => !userInfo?.warehouse_id || w.id === userInfo.warehouse_id)
                                .map((w) => (
                                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <ShoppingCart01Icon className="h-4 w-4 text-blue-500" />
                        Cart Items
                      </h3>
                      {draftItems.length > 0 && (
                        <Badge variant="secondary" className="font-mono">{draftItems.length} items</Badge>
                      )}
                    </div>

                    {draftItems.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center bg-muted/10">
                        <Package01Icon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium">Your cart is empty</p>
                        <p className="text-xs text-muted-foreground mt-1">Select products from the left to add</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {draftItems.map((item, idx) => (
                          <div key={idx} className="flex gap-3 p-3 rounded-xl border bg-card shadow-sm relative group">
                            <button
                              type="button"
                              onClick={() => removeDraftItem(idx)}
                              className="absolute -top-2 -right-2 h-6 w-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 border border-red-200"
                            >
                              <Cancel01Icon className="h-3 w-3" />
                            </button>

                            <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0 border relative">
                              {item.product_image ? (
                                <Image
                                  src={getOptimizedImageUrl(item.product_image)}
                                  alt={item.product_name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Package01Icon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <p className="text-sm font-bold line-clamp-1" title={item.product_name}>
                                {item.product_name}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex items-center border rounded-md h-7 overflow-hidden w-24">
                                  <button 
                                    className="px-2 h-full bg-muted/50 hover:bg-muted text-muted-foreground"
                                    onClick={() => updateDraftItem(idx, "quantity", Math.max(1, item.quantity - 1))}
                                  >-</button>
                                  <input 
                                    type="number" 
                                    min={1} 
                                    value={item.quantity}
                                    onChange={(e) => updateDraftItem(idx, "quantity", Math.max(1, Number(e.target.value)))}
                                    className="flex-1 h-full w-full text-center text-xs font-bold focus:outline-none"
                                  />
                                  <button 
                                    className="px-2 h-full bg-muted/50 hover:bg-muted text-muted-foreground"
                                    onClick={() => updateDraftItem(idx, "quantity", item.quantity + 1)}
                                  >+</button>
                                </div>

                                <div className="flex items-center gap-1 flex-1">
                                  <span className="text-xs text-muted-foreground font-semibold">$</span>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={item.price}
                                    onChange={(e) => updateDraftItem(idx, "price", Math.max(0, Number(e.target.value)))}
                                    className="h-7 text-xs font-bold px-2 py-0 border-transparent hover:border-input focus:border-input bg-transparent hover:bg-background transition-colors"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right shrink-0 flex flex-col justify-between items-end">
                               <p className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                                 ${item.total.toFixed(2)}
                               </p>
                               <div className="flex items-center gap-1 mt-1">
                                 <Label className="text-[10px] text-muted-foreground">Disc</Label>
                                 <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={item.discount}
                                    onChange={(e) => updateDraftItem(idx, "discount", Math.max(0, Number(e.target.value)))}
                                    className="h-6 w-14 text-[10px] text-right px-1.5 border-dashed"
                                 />
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Footer */}
              <div className="p-5 border-t bg-card shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] relative z-20">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Subtotal</span>
                    <span className="font-mono font-medium">${draftSubTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Discount</span>
                    <span className="font-mono text-orange-500 font-medium">-${overallDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">Tax ($)</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={overallTax}
                        onChange={(e) => setOverallTax(Number(e.target.value))}
                        className="h-6 w-16 text-xs text-right"
                      />
                    </div>
                    <span className="font-mono text-blue-500 font-medium">+${overallTax.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t flex justify-between items-center">
                    <span className="font-bold text-lg">Total</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      ${draftTotalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {(["cash", "aba", "aclida", "wing"] ).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={paymentMethod === m ? "default" : "outline"}
                        onClick={() => setPaymentMethod(m as any)}
                        className={`h-9 text-xs uppercase font-bold tracking-wider ${
                          paymentMethod === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>

                  <Button
                    onClick={handleCreate}
                    disabled={draftItems.length === 0 || creating}
                    className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/25 border-none transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {creating ? (
                      <><Loading01Icon className="mr-2 h-5 w-5 animate-spin" />Processing...</>
                    ) : (
                      <>Charge ${draftTotalPrice.toFixed(2)}</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {/* ─── FLYING IMAGES OVERLAY ─── */}
          {flyingImages.map(img => (
            <FlyingImageComponent key={img.id} img={img} onComplete={() => setFlyingImages(prev => prev.filter(i => i.id !== img.id))} />
          ))}
        </SheetContent>

        
      </Sheet>

      {/* ─── VIEW INVOICE DETAIL SHEET ─────────────────── */}
      <Sheet
        open={!!viewingInvoice}
        onOpenChange={(open) => !open && setViewingInvoice(null)}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="
            p-0 flex flex-col shadow-2xl border-none
            !inset-0 !w-full !h-full !max-w-none rounded-none
            md:!inset-y-4 md:!right-4 md:!left-auto
            md:!h-[calc(100vh-2rem)] md:!w-[min(95vw,960px)]
            md:rounded-2xl overflow-hidden
          "
        >
          {viewingInvoice && (
            <>
              <SheetHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                      <Invoice01Icon className="h-4 w-4 text-white" />
                    </div>
                    Invoice Details
                  </SheetTitle>
                  <button
                    onClick={() => setViewingInvoice(null)}
                    className="h-8 w-8 rounded-lg border border-emerald-200 bg-white/70 flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-white transition-all shrink-0"
                  >
                    <Cancel01Icon className="h-4 w-4" />
                  </button>
                </div>
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
              <div className="p-6 border-t bg-muted/30 shrink-0 space-y-3">

                {/* ─── PAY PANEL: only for not-paid invoices ─── */}
                {viewingInvoice.status === "not paid" && (
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <MoneyReceiveSquareIcon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Record Payment</p>
                      <span className="ml-auto text-xs font-bold text-amber-600 dark:text-amber-400">
                        Due: ${viewingInvoice.total_price.toFixed(2)}
                      </span>
                    </div>

                    {payingInvoice?.id === viewingInvoice.id ? (
                      <div className="space-y-2.5">
                        {/* Payment method */}
                        <Select
                          value={payMethod}
                          onValueChange={(v: any) => setPayMethod(v)}
                        >
                          <SelectTrigger className="h-10 bg-white dark:bg-background border-amber-200 dark:border-amber-700">
                            <SelectValue placeholder="Payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">💵 Cash</SelectItem>
                            <SelectItem value="aba">🏦 ABA Bank</SelectItem>
                            <SelectItem value="aclida">🏦 ACLIDA Bank</SelectItem>
                            <SelectItem value="wing">📱 Wing</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Amount received */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500">$</span>
                          <Input
                            type="number"
                            min={viewingInvoice.total_price}
                            step={0.01}
                            placeholder={`Min $${viewingInvoice.total_price.toFixed(2)}`}
                            value={amountReceived}
                            onChange={(e) => setAmountReceived(e.target.value)}
                            className="pl-7 h-10 bg-white dark:bg-background border-amber-200 dark:border-amber-700 font-mono"
                            autoFocus
                          />
                        </div>

                        {/* Change */}
                        {parseFloat(amountReceived) > viewingInvoice.total_price && (
                          <div className="flex justify-between items-center text-xs font-semibold px-1">
                            <span className="text-muted-foreground">Change</span>
                            <span className="text-emerald-600 font-bold">
                              ${(parseFloat(amountReceived) - viewingInvoice.total_price).toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 h-10 text-sm border-amber-200"
                            onClick={() => { setPayingInvoice(null); setAmountReceived(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1 h-10 text-sm bg-amber-500 hover:bg-amber-600 text-white gap-2"
                            disabled={paying || !amountReceived || parseFloat(amountReceived) < viewingInvoice.total_price}
                            onClick={handlePay}
                          >
                            {paying ? <Loading01Icon className="h-4 w-4 animate-spin" /> : <CheckmarkCircle01Icon className="h-4 w-4" />}
                            {paying ? "Recording..." : "Confirm Payment"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full h-10 text-sm bg-amber-500 hover:bg-amber-600 text-white gap-2"
                        onClick={() => {
                          setPayingInvoice(viewingInvoice);
                          setAmountReceived(viewingInvoice.total_price.toFixed(2));
                          setPayMethod("cash");
                        }}
                      >
                        <MoneyReceiveSquareIcon className="h-4 w-4" />
                        Mark as Paid
                      </Button>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
                  onClick={() => handlePrintInvoice(viewingInvoice)}
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print Invoice
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
