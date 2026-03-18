// =============================================================================
// ENUMS & UNION TYPES
// =============================================================================

export type Role = 'admin' | 'sale' | 'logistic';

export type PaymentMethod = 'cash' | 'aba' | 'aclida' | 'wing';

export type StockMovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'return' | 'transfer';

export type InvoiceStatus = 'paid' | 'not paid';

// =============================================================================
// USER & AUTH
// =============================================================================

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  avatar_url?: string;
  created_at: Date;
  is_archived: boolean;
}

// =============================================================================
// CUSTOMER & ORDER
// =============================================================================

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location?: string;
  avatar_url?: string;
  created_at: Date;
  is_deleted: boolean;
}

export interface OrderHistory {
  id: string;
  sale_invoice_id: string;
  customer_id: string;
  price: number;
  total_price: number;
  date: Date;
  created_at: Date;
  is_archived: boolean;
}

// =============================================================================
// SALES INVOICE
// =============================================================================

export interface SaleInvoiceItem {
  stock_movement_id: string;
  product_id: string;
  product_name: string;
  product_barcode: string;
  product_image?: string;
  quantity: number;
  cost: number;
  price: number;
  discount: number;
  total_price: number;
}

export interface SaleInvoice {
  id: string;
  customer_id: string;
  warehouse_id: string;
  items: SaleInvoiceItem[];
  sub_total: number;
  discount: number;
  tax: number;
  total_price: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  created_by: string;
  created_at: Date;
  is_archived: boolean;
}

// =============================================================================
// PRODUCT & CATEGORY
// =============================================================================

export interface Category {
  id: string;
  name: string;
  created_at: Date;
  is_archived: boolean;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  images: string[];
  thumbnails: string[];
  category_id?: string;
  cost_recommand?: number;
  created_at: Date;
  is_archived: boolean;
}

export interface ProductWithStock extends Product {
  current_stock: number;
}

// =============================================================================
// WAREHOUSE & STOCK
// =============================================================================

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  created_at: Date;
  is_archived: boolean;
}

export interface Stock {
  id: string;
  product_id: string;
  product_barcode?: string;
  warehouse_id: string;
  product: Product;
  cost: number;
  quantity: number;
  date: Date;
  created_by: string;
  created_at: Date;
  is_archived: boolean;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  previous_stock_level: number;
  new_stock_level: number;
  note?: string;
  reference?: string;
  created_by: string;
  date: Date;
  created_at: Date;
}

// =============================================================================
// SUPPLIER & PURCHASE
// =============================================================================

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  created_by: string;
  created_at: Date;
  is_deleted: boolean;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  reference_no: string;
  warehouse_id: string;
  sub_total: number;
  discount: number;
  tax: number;
  total_price: number;
  date: Date;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
  is_deleted: boolean;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  cost: number;
  total: number;
  created_at: Date;
}

export interface PurchasePayment {
  id: string;
  purchase_id: string;
  payment_method: string;
  amount: number;
  transaction_ref: string;
  created_at: Date;
  is_deleted: boolean;
}