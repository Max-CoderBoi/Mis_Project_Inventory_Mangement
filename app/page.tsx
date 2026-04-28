"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import KpiCard from "./components/KpiCard";
import StatusPill from "./components/StatusPill";
import Chart from "./components/Chart";
import PieChartCard from "./components/PieChartCard";
import { loadJson, DATA_PATHS } from "./lib/data";
import { SaleRecord, InventoryRecord, TransactionRecord, AlertRecord } from "./lib/types";
import {
  calculateMovingAverage,
  calculateWeightedMovingAverage,
  calculateExponentialSmoothing,
  calculateTrendForecast,
  calculateWeeklySeasonalityFactors,
  calculateForecastConfidenceBand,
  calculateReorderLevel,
  calculateStatus,
} from "./lib/forecast";
import { downloadCsvFile, downloadExcelFile, printReport } from "./lib/export";

const tabItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Sales" },
  { id: "inventory", label: "Inventory" },
  { id: "forecast", label: "Forecast" },
  { id: "alerts", label: "Alerts" },
  { id: "reports", label: "Reports" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

type SaleFormState = Omit<SaleRecord, "id" | "total_sales" | "order_month" | "order_year">;

type InventoryFormState = Omit<InventoryRecord, "product_id" | "status">;

type TransactionFormState = {
  product_id: string;
  type: "stock_in" | "stock_out";
  quantity: number;
  note: string;
};

const defaultSaleForm: SaleFormState = {
  order_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  customer_name: "",
  state: "",
  city: "",
  region: "",
  segment: "",
  category: "",
  sub_category: "",
  product_id: "",
  product_name: "",
  quantity: 1,
  unit_price: 0,
  discount: 0,
  profit: 0,
};

const defaultInventoryForm: InventoryFormState = {
  product_name: "",
  category: "General",
  sub_category: "Misc",
  current_stock: 0,
  reorder_level: 20,
  lead_time_days: 7,
  safety_stock: 10,
};

const defaultTransactionForm: TransactionFormState = {
  product_id: "",
  type: "stock_in",
  quantity: 1,
  note: "Stock adjustment",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [topProducts, setTopProducts] = useState<Array<{ "Product Name": string; Sales: number }>>([]);
  const [monthlySales, setMonthlySales] = useState<Array<{ Month: string; Sales: number }>>([]);

  const [searchTerm, setSearchTerm] = useState(""
  );
  const [salesSortKey, setSalesSortKey] = useState<keyof SaleRecord>("order_date");
  const [salesSortDirection, setSalesSortDirection] = useState<"asc" | "desc">("desc");
  const [salesPage, setSalesPage] = useState(0);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [saleForm, setSaleForm] = useState<SaleFormState>(defaultSaleForm);
  const [editSaleId, setEditSaleId] = useState<number | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(defaultInventoryForm);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(defaultTransactionForm);
  const [forecastProductId, setForecastProductId] = useState("FUR-CH-10000454");
  const [forecastMethod, setForecastMethod] = useState<"moving" | "trend" | "exp">("moving");
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    async function fetchData() {
      const [salesData, inventoryData, transactionData, alertsData, topProductData, monthlySalesData] = await Promise.all([
        loadJson<SaleRecord[]>(DATA_PATHS.sales),
        loadJson<InventoryRecord[]>(DATA_PATHS.inventory),
        loadJson<TransactionRecord[]>(DATA_PATHS.transactions),
        loadJson<AlertRecord[]>(DATA_PATHS.alerts),
        loadJson<Array<{ "Product Name": string; Sales: number }>>(DATA_PATHS.topProducts),
        loadJson<Array<{ Month: string; Sales: number }>>(DATA_PATHS.monthlySales),
      ]);

      setSales(salesData ?? []);
      setInventory(inventoryData ?? []);
      setTransactions(transactionData ?? []);
      setAlerts(alertsData ?? []);
      setTopProducts(topProductData ?? []);
      setMonthlySales(monthlySalesData ?? []);
      const defaultForecastProductId = inventoryData?.some((item) => item.product_id === "FUR-CH-10000454")
        ? "FUR-CH-10000454"
        : inventoryData?.[0]?.product_id ?? "";
      setForecastProductId(defaultForecastProductId);
      setTransactionForm((current) => ({ ...current, product_id: defaultForecastProductId }));
    }

    fetchData().catch(() => {
      setSales([]);
      setInventory([]);
      setTransactions([]);
      setAlerts([]);
      setTopProducts([]);
      setMonthlySales([]);
    });
  }, []);

  const normalizedFilteredSales = useMemo(() => {
    const filtered = sales.filter((sale) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        [sale.order_id, sale.product_name, sale.customer_name, sale.category, sale.sub_category].some((field) =>
          field.toLowerCase().includes(term),
        );

      if (!matchesSearch) return false;

      const saleDate = new Date(sale.order_date);
      if (dateRange.from && saleDate < new Date(`${dateRange.from}T00:00:00`)) return false;
      if (dateRange.to && saleDate > new Date(`${dateRange.to}T23:59:59`)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aValue = a[salesSortKey];
      const bValue = b[salesSortKey];
      if (typeof aValue === "number" && typeof bValue === "number") {
        return salesSortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      const aText = String(aValue).toLowerCase();
      const bText = String(bValue).toLowerCase();
      return salesSortDirection === "asc" ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });

    return sorted;
  }, [sales, searchTerm, dateRange, salesSortDirection, salesSortKey]);

  const pageSize = 10;
  const currentSalesPage = normalizedFilteredSales.slice(salesPage * pageSize, salesPage * pageSize + pageSize);
  const totalSalesPages = Math.max(1, Math.ceil(normalizedFilteredSales.length / pageSize));

  const productPrices = useMemo(() => {
    const map = new Map<string, { revenue: number; quantity: number }>();
    sales.forEach((sale) => {
      const current = map.get(sale.product_id) ?? { revenue: 0, quantity: 0 };
      current.revenue += sale.total_sales;
      current.quantity += sale.quantity;
      map.set(sale.product_id, current);
    });
    return map;
  }, [sales]);

  const totalRevenue = useMemo(() => sales.reduce((sum, sale) => sum + sale.total_sales, 0), [sales]);
  const totalSalesCount = sales.length;
  const currentStockValue = useMemo(() => {
    return inventory.reduce((sum, item) => {
      const record = productPrices.get(item.product_id);
      const averagePrice = record ? record.revenue / Math.max(record.quantity, 1) : 12;
      return sum + item.current_stock * averagePrice;
    }, 0);
  }, [inventory, productPrices]);

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.current_stock <= item.reorder_level),
    [inventory],
  );

  const salesTrendLabels = useMemo(() => {
    if (monthlySales.length) {
      return monthlySales.map((item) => item.Month);
    }
    const months = new Map<string, number>();
    sales.forEach((sale) => {
      const month = sale.order_date.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + sale.total_sales);
    });
    return Array.from(months.keys()).sort();
  }, [monthlySales, sales]);

  const salesTrendValues = useMemo(() => {
    if (monthlySales.length) return monthlySales.map((item) => item.Sales);
    const monthMap = new Map<string, number>();
    sales.forEach((sale) => {
      const month = sale.order_date.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + sale.total_sales);
    });
    return salesTrendLabels.map((month) => monthMap.get(month) ?? 0);
  }, [monthlySales, sales, salesTrendLabels]);

  const topProductLabels = useMemo(() => {
    if (topProducts.length) return topProducts.slice(0, 6).map((row) => row["Product Name"]);
    return Array.from(productPrices.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([productId]) => inventory.find((item) => item.product_id === productId)?.product_name ?? productId);
  }, [topProducts, productPrices, inventory]);

  const topProductValues = useMemo(() => {
    if (topProducts.length) return topProducts.slice(0, 6).map((row) => row.Sales);
    return Array.from(productPrices.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([_, value]) => value.revenue);
  }, [topProducts, productPrices]);

  const averageDemandPerDay = useMemo(() => {
    if (!sales.length) return 0;

    const quantitiesByDate = sales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.order_date] = (acc[sale.order_date] ?? 0) + sale.quantity;
      return acc;
    }, {});

    const saleDates = Object.keys(quantitiesByDate).map((date) => new Date(date));
    const minDate = Math.min(...saleDates.map((date) => date.getTime()));
    const maxDate = Math.max(...saleDates.map((date) => date.getTime()));
    const spanDays = Math.max(1, Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1);
    const totalQuantity = Object.values(quantitiesByDate).reduce((sum, value) => sum + value, 0);

    return Math.round(totalQuantity / spanDays);
  }, [sales]);

  const forecastProduct = inventory.find((item) => item.product_id === forecastProductId) ?? inventory[0];

  const forecastData = useMemo(() => {
    if (!forecastProduct)
      return {
        forecastRows: [],
        actualValues: [],
        forecastValues: [],
        rangeLower: [],
        rangeUpper: [],
        labels: [],
        reorderLevel: 0,
        summary: { average: 0, max: 0, min: 0 },
      };

    const productSales = sales.filter((sale) => sale.product_id === forecastProduct.product_id);
    const aggregated = new Map<string, number>();
    productSales.forEach((sale) => {
      aggregated.set(sale.order_date, (aggregated.get(sale.order_date) ?? 0) + sale.quantity);
    });

    const actualDates = Array.from(aggregated.keys()).sort();
    const actualValues = actualDates.map((date) => aggregated.get(date) ?? 0);
    const dailyAverage = actualValues.length
      ? actualValues.reduce((sum, value) => sum + value, 0) / Math.max(actualValues.length, 1)
      : 0;
    const seasonalityFactors = calculateWeeklySeasonalityFactors(actualDates, actualValues);

    const forecastDates = Array.from({ length: forecastHorizon }, (_, index) => {
      const rowDate = new Date();
      rowDate.setDate(rowDate.getDate() + index + 1);
      return rowDate.toISOString().slice(0, 10);
    });

    const getSeasonalForecast = (baseValues: number[]) =>
      baseValues.map((value, index) => {
        const weekday = new Date(forecastDates[index]).getDay();
        const factor = seasonalityFactors[weekday] ?? 1;
        return Math.max(0, Math.round(value * factor));
      });

    const weightedMovingAverage = calculateWeightedMovingAverage(actualValues.slice(-14), 7).slice(-1)[0] ?? dailyAverage;
    const exponentialBaseline = calculateExponentialSmoothing(actualValues.slice(-30), 0.35).slice(-1)[0] ?? dailyAverage;
    const trendForecast = calculateTrendForecast(actualValues.slice(-30), forecastHorizon);

    const forecastValues =
      forecastMethod === "moving"
        ? getSeasonalForecast(Array(forecastHorizon).fill(Math.max(0, Math.round(weightedMovingAverage))))
        : forecastMethod === "trend"
        ? getSeasonalForecast(trendForecast.map((value) => Math.max(0, Math.round(value))))
        : getSeasonalForecast(Array(forecastHorizon).fill(Math.max(0, Math.round(exponentialBaseline))));

    const confidenceBand = calculateForecastConfidenceBand(forecastValues, actualValues.slice(-30), 1.25);

    const forecastRows = Array.from({ length: forecastHorizon }, (_, index) => {
      const date = forecastDates[index];
      const actual = aggregated.has(date) ? aggregated.get(date) ?? 0 : null;
      const forecast = forecastValues[index] || 0;
      const variance = actual !== null ? actual - forecast : 0;
      return {
        date,
        forecast,
        actual,
        variance: actual !== null ? variance : null,
        note:
          actual !== null
            ? variance === 0
              ? "Actual demand exactly matched forecast — maintain current stocking levels."
              : variance > 0
              ? `Actual demand is ${variance} units higher than forecast — consider increasing reorder volume.`
              : `Actual demand is ${Math.abs(variance)} units lower than forecast — inventory is ahead of demand.`
            : forecast >= forecastProduct.reorder_level
            ? "No actuals yet; forecast is at or above reorder level so plan replenishment early."
            : "No actuals yet; forecast is within normal coverage for now.",
      };
    });

    const actualSeries = forecastRows.map((row) => row.actual);

    const forecastAverage = forecastValues.length
      ? Math.round(forecastValues.reduce((sum, value) => sum + value, 0) / forecastValues.length)
      : 0;
    const forecastMax = forecastValues.length ? Math.max(...forecastValues) : 0;
    const forecastMin = forecastValues.length ? Math.min(...forecastValues) : 0;

    return {
      forecastRows,
      actualValues: actualSeries,
      forecastValues,
      rangeLower: confidenceBand.lower,
      rangeUpper: confidenceBand.upper,
      labels: forecastRows.map((row) => row.date.slice(5)),
      reorderLevel: calculateReorderLevel(dailyAverage, forecastProduct.lead_time_days, forecastProduct.safety_stock),
      summary: {
        average: forecastAverage,
        max: forecastMax,
        min: forecastMin,
      },
    };
  }, [forecastProduct, forecastMethod, forecastHorizon, sales]);

  const currentStock = forecastProduct?.current_stock ?? 0;
  const requiredStock = forecastData.reorderLevel;
  const stockGap = Math.max(requiredStock - currentStock, 0);
  const stockSurplus = Math.max(currentStock - requiredStock, 0);
  const stockPieData = currentStock >= requiredStock
    ? [
        { name: "Required stock", value: requiredStock },
        { name: "Stock surplus", value: stockSurplus },
      ]
    : [
        { name: "Current stock", value: currentStock },
        { name: "Additional required", value: stockGap },
      ];
  const stockBarLabels = ["Current stock", "Required stock"];
  const stockBarValues = [currentStock, requiredStock];
  const forecastCoverageDays = forecastData.summary?.average ? Math.floor(currentStock / forecastData.summary.average) : 0;

  const handleSaleFormChange = (field: keyof SaleFormState, value: string | number) => {
    setSaleForm((current) => ({ ...current, [field]: value }));
  };

  const handleInventoryFormChange = (field: keyof InventoryFormState, value: string | number) => {
    setInventoryForm((current) => ({ ...current, [field]: value }));
  };

  const handleTransactionFormChange = (field: keyof TransactionFormState, value: string | number) => {
    setTransactionForm((current) => ({ ...current, [field]: value }));
  };

  const resetSaleForm = () => {
    setSaleForm(defaultSaleForm);
    setEditSaleId(null);
  };

  const saveSale = () => {
    const orderDate = new Date(saleForm.order_date);
    const totalSales = Number((saleForm.quantity * saleForm.unit_price).toFixed(2));
    const record: SaleRecord = {
      id: editSaleId ?? Date.now(),
      ...saleForm,
      total_sales: totalSales,
      order_month: orderDate.getMonth() + 1,
      order_year: orderDate.getFullYear(),
    };
    if (editSaleId) {
      setSales((current) => current.map((item) => (item.id === editSaleId ? record : item)));
    } else {
      setSales((current) => [record, ...current]);
      setTransactions((current) => [
        {
          id: `txn_${Date.now()}`,
          product_id: record.product_id,
          product_name: record.product_name,
          type: "stock_out",
          quantity: record.quantity,
          date: record.order_date,
          reference_order_id: record.order_id,
          note: "Sale order",
        },
        ...current,
      ]);
    }
    resetSaleForm();
  };

  const startEditingSale = (sale: SaleRecord) => {
    setEditSaleId(sale.id);
    setSaleForm({
      order_id: sale.order_id,
      order_date: sale.order_date,
      customer_name: sale.customer_name,
      state: sale.state,
      city: sale.city,
      region: sale.region,
      segment: sale.segment,
      category: sale.category,
      sub_category: sale.sub_category,
      product_id: sale.product_id,
      product_name: sale.product_name,
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      discount: sale.discount,
      profit: sale.profit,
    });
  };

  const removeSale = (id: number) => {
    setSales((current) => current.filter((sale) => sale.id !== id));
  };

  const importSalesCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = rows.shift()?.split(/,|\t/).map((value) => value.trim().toLowerCase()) ?? [];
    const parsed = rows.map((row) => {
      const columns = row.split(/,|\t/).map((value) => value.trim());
      const data = Object.fromEntries(header.map((key, index) => [key, columns[index] ?? ""]));
      const quantity = Number(data["quantity"] || data["qty"] || 1);
      const unitPrice = Number(data["unit price"] || data["price"] || 0);
      const orderDate = data["date"] || new Date().toISOString().slice(0, 10);
      const productName = data["product"] || data["product name"] || "Unknown";
      return {
        id: Date.now() + Math.random(),
        order_id: String(data["order id"] || `ORD-${Date.now()}`),
        order_date: orderDate,
        order_month: new Date(orderDate).getMonth() + 1,
        order_year: new Date(orderDate).getFullYear(),
        customer_name: String(data["customer"] || "Unknown"),
        state: String(data["state"] || ""),
        city: String(data["city"] || ""),
        region: String(data["region"] || ""),
        segment: String(data["segment"] || "Retail"),
        category: String(data["category"] || "General"),
        sub_category: String(data["sub category"] || String(data["subcategory"] || "Misc")),
        product_id: String(data["product id"] || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `prod-${Date.now()}`),
        product_name: productName,
        quantity: Math.max(1, quantity),
        unit_price: Number(unitPrice.toFixed(2)),
        total_sales: Number((quantity * unitPrice).toFixed(2)),
        discount: Number(data["discount"] || 0),
        profit: Number(data["profit"] || 0),
      } as SaleRecord;
    });
    setSales((current) => [...parsed, ...current]);
    event.target.value = "";
  };

  const addInventoryProduct = () => {
    const id = `prod_${Date.now()}`;
    const status = calculateStatus(inventoryForm.current_stock, inventoryForm.reorder_level, inventoryForm.safety_stock);
    const newProduct: InventoryRecord = {
      product_id: id,
      product_name: inventoryForm.product_name || `New Product ${Date.now()}`,
      category: inventoryForm.category,
      sub_category: inventoryForm.sub_category,
      current_stock: inventoryForm.current_stock,
      reorder_level: inventoryForm.reorder_level,
      lead_time_days: inventoryForm.lead_time_days,
      safety_stock: inventoryForm.safety_stock,
      status,
    };
    setInventory((current) => [newProduct, ...current]);
    if (status !== "In Stock") {
      setAlerts((current) => [
        {
          id: `alert_${Date.now()}`,
          product_id: newProduct.product_id,
          product_name: newProduct.product_name,
          category: newProduct.category,
          current_stock: newProduct.current_stock,
          reorder_level: newProduct.reorder_level,
          safety_stock: newProduct.safety_stock,
          status: newProduct.status,
          created_at: new Date().toISOString().slice(0, 10),
        },
        ...current,
      ]);
    }
    setInventoryForm(defaultInventoryForm);
  };

  const moveStockTransaction = () => {
    const product = inventory.find((item) => item.product_id === transactionForm.product_id);
    if (!product) return;
    const delta = transactionForm.type === "stock_in" ? transactionForm.quantity : -transactionForm.quantity;
    const updatedStock = Math.max(0, product.current_stock + delta);
    const nextStatus = calculateStatus(updatedStock, product.reorder_level, product.safety_stock);
    setInventory((current) =>
      current.map((item) =>
        item.product_id === product.product_id ? { ...item, current_stock: updatedStock, status: nextStatus } : item,
      ),
    );
    setTransactions((current) => [
      {
        id: `txn_${Date.now()}`,
        product_id: product.product_id,
        product_name: product.product_name,
        type: transactionForm.type,
        quantity: transactionForm.quantity,
        date: new Date().toISOString().slice(0, 10),
        reference_order_id: "manual",
        note: transactionForm.note,
      },
      ...current,
    ]);
    setTransactionForm(defaultTransactionForm);
  };

  const inventoryValue = Math.round(currentStockValue);
  const forecastedDemand = Math.round(averageDemandPerDay * 30);
  const activeAlerts = inventory.filter((item) => item.current_stock <= item.reorder_level);
  const reportSalesTrend = salesTrendLabels.map((label, index) => [label, salesTrendValues[index] ?? 0]);
  const reportInventoryTurnover = [
    ["Metric", "Value"],
    ["Total Revenue", totalRevenue.toFixed(2)],
    ["Average Stock Value", inventoryValue.toFixed(2)],
    ["Turnover Ratio", inventoryValue ? (totalRevenue / inventoryValue).toFixed(2) : "0"],
  ];
  const reportStockOut = [
    ["Product", "Current Stock", "Status"],
    ...inventory.filter((item) => item.current_stock === 0).map((item) => [item.product_name, item.current_stock, item.status]),
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-360 pb-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Inventory Management System</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">MIS Inventory Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Unified dashboard for sales, inventory, forecasting, alerts, and export-ready reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {activeTab === "dashboard" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="grid gap-6 lg:grid-cols-4">
            <KpiCard title="Total Sales" value={`${totalSalesCount}`} accent="blue" details="Sales records in the selected range." />
            <KpiCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} accent="green" details="Revenue from all transactions." />
            <KpiCard title="Current Stock Value" value={`₹${inventoryValue.toLocaleString()}`} accent="amber" details="Inventory value estimated from average sale price." />
            <KpiCard title="Forecasted Demand" value={`${forecastedDemand}`} accent="indigo" details="Projected 30-day demand." />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="grid gap-6">
              <Chart
                title="Sales Trend"
                variant="line"
                labels={salesTrendLabels}
                values={salesTrendValues}
                xAxisTickFormatter={(label) => label.slice(0, 4)}
              />
              <Chart title="Product-wise Sales" variant="bar" labels={topProductLabels} values={topProductValues} showLegend={false} />
            </div>
            <div className="grid gap-6">
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Low stock alerts</h2>
                    <p className="mt-1 text-sm text-slate-500">Tracking items below reorder level.</p>
                  </div>
                  <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                    {lowStockItems.length} items
                  </span>
                </div>
                <div className="space-y-3">
                  {lowStockItems.slice(0, 4).map((item) => (
                    <div key={item.product_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.product_name}</p>
                          <p className="text-sm text-slate-500">{item.category} • Reorder at {item.reorder_level}</p>
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                        <span>Stock: {item.current_stock}</span>
                        <span>Lead time: {item.lead_time_days}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeTab === "sales" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Sale record</h2>
              <div className="mt-6 grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Product name
                    <input
                      value={saleForm.product_name}
                      onChange={(event) => handleSaleFormChange("product_name", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Order date
                    <input
                      type="date"
                      value={saleForm.order_date}
                      onChange={(event) => handleSaleFormChange("order_date", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={saleForm.quantity}
                      onChange={(event) => handleSaleFormChange("quantity", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Unit price
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={saleForm.unit_price}
                      onChange={(event) => handleSaleFormChange("unit_price", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Order ID
                    <input
                      value={saleForm.order_id}
                      onChange={(event) => handleSaleFormChange("order_id", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Discount (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={saleForm.discount}
                      onChange={(event) => handleSaleFormChange("discount", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Customer
                    <input
                      value={saleForm.customer_name}
                      onChange={(event) => handleSaleFormChange("customer_name", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Profit
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={saleForm.profit}
                      onChange={(event) => handleSaleFormChange("profit", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">Total amount: ₹{(saleForm.quantity * saleForm.unit_price).toFixed(2)}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveSale}
                      className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {editSaleId ? "Update sale" : "Add sale"}
                    </button>
                    <button
                      type="button"
                      onClick={resetSaleForm}
                      className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">Search, sort & import</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Search sales
                    <input
                      placeholder="Product, customer, category"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Sort by
                    <select
                      value={salesSortKey}
                      onChange={(event) => setSalesSortKey(event.target.value as keyof SaleRecord)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="order_date">Date</option>
                      <option value="product_name">Product</option>
                      <option value="quantity">Quantity</option>
                      <option value="total_sales">Total</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Direction
                    <select
                      value={salesSortDirection}
                      onChange={(event) => setSalesSortDirection(event.target.value as "asc" | "desc")}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="desc">Newest first</option>
                      <option value="asc">Oldest first</option>
                    </select>
                  </label>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Bulk import CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={importSalesCsv}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-white"
                    />
                  </label>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">Sales analytics</h2>
                <p className="mt-1 text-sm text-slate-500">Trends and top products to help you understand sales performance quickly.</p>
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <Chart
                    title="Recent sales trend"
                    variant="line"
                    labels={salesTrendLabels.slice(-12)}
                    values={salesTrendValues.slice(-12)}
                    xAxisTickFormatter={(label) => label.slice(0, 4)}
                  />
                  <Chart title="Top products" variant="bar" labels={topProductLabels} values={topProductValues} showLegend={false} />
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Avg daily demand</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{averageDemandPerDay}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Average order value</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">₹{(normalizedFilteredSales.length ? totalRevenue / normalizedFilteredSales.length : 0).toFixed(0)}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Total transactions</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{normalizedFilteredSales.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">Sales overview</h2>
                <div className="mt-4 text-sm text-slate-600">Showing {normalizedFilteredSales.length} records over {totalSalesPages} pages.</div>
                <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Product</th>
                        <th className="px-4 py-4">Qty</th>
                        <th className="px-4 py-4">Unit price</th>
                        <th className="px-4 py-4">Total</th>
                        <th className="px-4 py-4">Customer</th>
                        <th className="px-4 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSalesPage.map((sale) => (
                        <tr key={sale.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                          <td className="px-4 py-4">{sale.order_date}</td>
                          <td className="px-4 py-4">{sale.product_name}</td>
                          <td className="px-4 py-4">{sale.quantity}</td>
                          <td className="px-4 py-4">₹{sale.unit_price.toFixed(2)}</td>
                          <td className="px-4 py-4">₹{sale.total_sales.toFixed(2)}</td>
                          <td className="px-4 py-4">{sale.customer_name}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditingSale(sale)}
                                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSale(sale.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-slate-600">Page {salesPage + 1} of {totalSalesPages}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSalesPage((current) => Math.max(0, current - 1))}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesPage((current) => Math.min(totalSalesPages - 1, current + 1))}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeTab === "inventory" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="grid gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Add inventory product</h2>
              <div className="mt-6 grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Product name
                    <input
                      value={inventoryForm.product_name}
                      onChange={(event) => handleInventoryFormChange("product_name", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Category
                    <input
                      value={inventoryForm.category}
                      onChange={(event) => handleInventoryFormChange("category", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Current stock
                    <input
                      type="number"
                      min={0}
                      value={inventoryForm.current_stock}
                      onChange={(event) => handleInventoryFormChange("current_stock", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Reorder level
                    <input
                      type="number"
                      min={0}
                      value={inventoryForm.reorder_level}
                      onChange={(event) => handleInventoryFormChange("reorder_level", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Lead time (days)
                    <input
                      type="number"
                      min={1}
                      value={inventoryForm.lead_time_days}
                      onChange={(event) => handleInventoryFormChange("lead_time_days", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Safety stock
                    <input
                      type="number"
                      min={0}
                      value={inventoryForm.safety_stock}
                      onChange={(event) => handleInventoryFormChange("safety_stock", Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Sub-category
                    <input
                      value={inventoryForm.sub_category}
                      onChange={(event) => handleInventoryFormChange("sub_category", event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addInventoryProduct}
                  className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add product
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Live inventory</h2>
                <p className="mt-1 text-sm text-slate-500">Current stock levels and reorder status for all products.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">In Stock</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">Low</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900">Critical</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-900">Out of Stock</span>
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-4">Product</th>
                    <th className="px-4 py-4">Stock</th>
                    <th className="px-4 py-4">Reorder</th>
                    <th className="px-4 py-4">Lead time</th>
                    <th className="px-4 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.product_id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-4">{item.product_name}</td>
                      <td className="px-4 py-4">{item.current_stock}</td>
                      <td className="px-4 py-4">{item.reorder_level}</td>
                      <td className="px-4 py-4">{item.lead_time_days}d</td>
                      <td className="px-4 py-4"><StatusPill status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Transaction log</h2>
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Product</th>
                    <th className="px-4 py-4">Type</th>
                    <th className="px-4 py-4">Qty</th>
                    <th className="px-4 py-4">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 12).map((txn) => (
                    <tr key={txn.id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-4">{txn.date}</td>
                      <td className="px-4 py-4">{txn.product_name}</td>
                      <td className="px-4 py-4 capitalize">{txn.type.replace("_", " ")}</td>
                      <td className="px-4 py-4">{txn.quantity}</td>
                      <td className="px-4 py-4">{txn.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {activeTab === "forecast" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="grid gap-4">
                <h2 className="text-xl font-semibold text-slate-950">Forecasting</h2>
                <label className="grid gap-2 text-sm text-slate-600">
                  Product
                  <select
                    value={forecastProductId}
                    onChange={(event) => setForecastProductId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    {inventory.map((product) => (
                      <option key={product.product_id} value={product.product_id}>
                        {product.product_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-slate-600">
                  Method
                  <select
                    value={forecastMethod}
                    onChange={(event) => setForecastMethod(event.target.value as "moving" | "trend" | "exp")}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="moving">Weighted Moving Average</option>
                    <option value="trend">Trend Analysis</option>
                    <option value="exp">Exponential Smoothing</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-slate-600">
                  Period
                  <select
                    value={forecastHorizon}
                    onChange={(event) => setForecastHorizon(Number(event.target.value) as 30 | 60 | 90)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </label>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Reorder level</p>
                  <p className="mt-2">Avg daily demand × Lead time + Safety stock</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{forecastData.reorderLevel}</p>
                </div>
              </div>
              <div className="grid gap-6">
                <Chart
                  title="Forecast vs Actual"
                  variant="line"
                  labels={forecastData.labels}
                  values={forecastData.forecastValues}
                  secondaryValues={forecastData.actualValues}
                  lowerBand={forecastData.rangeLower}
                  upperBand={forecastData.rangeUpper}
                />
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Average forecast</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{forecastData.summary?.average ?? 0}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Highest forecast</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{forecastData.summary?.max ?? 0}</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Lowest forecast</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{forecastData.summary?.min ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Lead time</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{forecastProduct?.lead_time_days ?? 0} days</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Demand coverage</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{forecastCoverageDays} days</p>
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm text-slate-500">Stock gap</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{stockGap}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">
                    {currentStock >= requiredStock
                      ? "Current stock is above the reorder level, which provides additional coverage for the product."
                      : "Current stock is below the reorder level, so additional stock should be ordered to meet demand."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <PieChartCard title="Stock position" data={stockPieData} />
            <Chart title="Stock required vs current" variant="bar" labels={stockBarLabels} values={stockBarValues} showLegend={false} />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                <p className="text-sm text-slate-500">Forecast horizon</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{forecastHorizon} days</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                <p className="text-sm text-slate-500">Reorder level</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{forecastData.reorderLevel}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
                <p className="text-sm text-slate-500">Forecast method</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{forecastMethod === "moving" ? "Moving Average" : "Trend Analysis"}</p>
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              <h2 className="text-xl font-semibold text-slate-950">Forecast insights</h2>
              <p className="mt-3 text-sm text-slate-600">
                The chart above separates predicted demand (blue) from actual demand (green). This makes it easier to compare forecasted units against real sales over time.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-500">Current stock</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{currentStock}</p>
                </div>
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-500">Stock gap</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{stockGap}</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeTab === "alerts" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Alerts center</h2>
                <p className="mt-1 text-sm text-slate-500">Automatic notifications for low, critical, and out-of-stock products.</p>
              </div>
              <span className="inline-flex rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-900">{activeAlerts.length} active alerts</span>
            </div>
            <div className="mt-6 space-y-4">
              {activeAlerts.map((item) => (
                <div key={item.product_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{item.product_name}</p>
                      <p className="text-sm text-slate-600">{item.category} • Reorder level {item.reorder_level}</p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>Stock: {item.current_stock}</span>
                    <span>Safety: {item.safety_stock}</span>
                    <span className="font-medium text-slate-700">Below reorder threshold</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {activeTab === "reports" && (
        <main className="mx-auto grid max-w-360 gap-6">
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Sales trend report</h2>
              <p className="mt-2 text-sm text-slate-600">Monthly revenue performance for the selected data set.</p>
              <div className="mt-6">
                <Chart title="Sales trend" variant="line" labels={salesTrendLabels} values={salesTrendValues} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadExcelFile("sales-trend.xls", [["Month", "Revenue"], ...reportSalesTrend])}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={printReport}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  Print PDF
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">Inventory turnover</h2>
              <p className="mt-2 text-sm text-slate-600">Performance metrics for stock utilization and revenue conversion.</p>
              <div className="mt-6 grid gap-4 rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <span className="text-sm text-slate-600">Total revenue</span>
                  <span className="font-semibold text-slate-950">₹{totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <span className="text-sm text-slate-600">Inventory value</span>
                  <span className="font-semibold text-slate-950">₹{inventoryValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <span className="text-sm text-slate-600">Turnover ratio</span>
                  <span className="font-semibold text-slate-950">{inventoryValue ? (totalRevenue / inventoryValue).toFixed(2) : "0.00"}</span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => downloadExcelFile("inventory-turnover.xls", reportInventoryTurnover)}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={printReport}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  Print PDF
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Stock-out analysis</h2>
                <p className="mt-1 text-sm text-slate-500">Products that are currently out of stock and require priority restock.</p>
              </div>
              <button
                type="button"
                onClick={() => downloadExcelFile("stock-out-analysis.xls", reportStockOut)}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Export Excel
              </button>
            </div>
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-4">Product</th>
                    <th className="px-4 py-4">Stock</th>
                    <th className="px-4 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.filter((item) => item.current_stock === 0).map((item) => (
                    <tr key={item.product_id} className="border-t border-slate-200 bg-white hover:bg-slate-50">
                      <td className="px-4 py-4">{item.product_name}</td>
                      <td className="px-4 py-4">{item.current_stock}</td>
                      <td className="px-4 py-4"><StatusPill status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
