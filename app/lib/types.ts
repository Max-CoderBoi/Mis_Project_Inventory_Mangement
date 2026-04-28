export type SaleRecord = {
  id: number;
  order_id: string;
  order_date: string;
  order_month: number | null;
  order_year: number | null;
  customer_name: string;
  state: string;
  city: string;
  region: string;
  segment: string;
  category: string;
  sub_category: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_sales: number;
  discount: number;
  profit: number;
};

export type InventoryRecord = {
  product_id: string;
  product_name: string;
  category: string;
  sub_category: string;
  current_stock: number;
  reorder_level: number;
  lead_time_days: number;
  safety_stock: number;
  status: "In Stock" | "Low" | "Critical" | "Out of Stock";
};

export type TransactionRecord = {
  id: string;
  product_id: string;
  product_name: string;
  type: "stock_in" | "stock_out";
  quantity: number;
  date: string;
  reference_order_id: string;
  note: string;
};

export type AlertRecord = {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  reorder_level: number;
  safety_stock: number;
  status: "In Stock" | "Low" | "Critical" | "Out of Stock";
  created_at: string;
};