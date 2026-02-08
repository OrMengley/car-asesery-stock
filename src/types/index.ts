
export type Role = 'admin' | 'sale' | 'logistic';

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  created_at: Date;
  is_archived: boolean;
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
  average_cost: number;
  last_purchase_cost?: number;
  created_at: Date;
  is_archived: boolean;
}

export type StockMovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'return' | 'transfer';

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  unit_cost?: number; // Only for stock_in usually
  total_cost?: number; // Optional
  previous_stock_level: number;
  new_stock_level: number;
  note?: string;
  reference?: string; // e.g. PO number
  created_by: string; // user id
  created_at: Date;
}
