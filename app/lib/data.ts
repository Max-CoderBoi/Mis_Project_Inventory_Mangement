import { AlertRecord, InventoryRecord, SaleRecord, TransactionRecord } from "./types";

export const DATA_PATHS = {
  sales: "/data/sales.json",
  inventory: "/data/inventory.json",
  transactions: "/data/transactions.json",
  alerts: "/data/alerts.json",
  topProducts: "/data/top_products.json",
  monthlySales: "/data/monthly_sales.json",
};

export async function loadJson<T>(path: string): Promise<T> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return [] as unknown as T;
    }
    return response.json();
  } catch {
    return [] as unknown as T;
  }
}

export type DataBundle = {
  sales: SaleRecord[];
  inventory: InventoryRecord[];
  transactions: TransactionRecord[];
  alerts: AlertRecord[];
  topProducts: Array<{ "Product Name": string; Sales: number }>; // fallback for display
  monthlySales: Array<{ Month: string; Sales: number }>;
};