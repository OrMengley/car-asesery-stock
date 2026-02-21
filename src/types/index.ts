
export type Role = 'admin' | 'sale' | 'logistic';

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  created_at: Date;
  is_archived: boolean;
}

export interface sale_invoice {
  id: string;
  customer_id: string;
  items: [
    {
      stock_movement_id: string;
      cost: number;
      price: number;
      product_id: string;
      product_name: string;
      product_barcode: string;
      product_image?: string;
      quantity: number;
      discount: number;
      total_price: number;
    }
  ]
  sub_total: number;
  discount: number;
  tax: number;
  total_price: number;
  status: 'paid' | 'not paid';
  payment_method: 'cash' | 'aba' | 'aclida' | 'wing';
  warehouse_id: string;
  created_by: string;
  created_at: Date;
  is_archived: boolean;
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

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location?: string;
  avatar_url?: string;
  is_deleted: boolean;
  created_at: Date;
}

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
  current_stock: number;
  cost_recommand?: number;
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
  date: Date;
  quantity: number;
  is_archived: boolean;
  created_by: string;
  created_at: Date;
}

export type StockMovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'return' | 'transfer';

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  unit_cost?: number; // Only for stock_in usually
  total_cost?: number; // Optional
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  previous_stock_level: number;
  new_stock_level: number;
  note?: string;
  reference?: string; // e.g. PO number
  created_by: string; // user id
  date: Date; // date of stock movement
  created_at: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  created_at: Date;
  is_archived: boolean;
}


export interface supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  created_by: string;
  created_at: Date;
  is_deleted: boolean;
}

export interface purchase_payment {
  id: string;
  purchase_id: string;
  payment_method: string; //Cash , ABA Bank, ACLIDA BANK,
  amount: number;
  transaction_ref: string;
  is_deleted: boolean;
  created_at: Date;
}
export interface purchase {
  id: string;
  supplier_id: string;
  reference_no: string;
  warehouse_id: string;
  created_by: string;
  date: Date;
  sub_total: number;
  discount: number;
  tax: number;
  total_price: number;
  is_deleted: boolean;
  updated_by: string;
  updated_at: Date;
  created_at: Date;
}
export interface purchase_item {
  id: string,
  purchase_id: string,
  product_id: string,
  quantity: number,
  cost: number,
  total: number,
  created_at: Date,
}