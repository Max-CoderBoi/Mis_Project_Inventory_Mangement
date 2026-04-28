import pandas as pd
import json
import os
import random
from datetime import date

random.seed(42)
print("Script started...")

# ── Load CSV ──────────────────────────────────────────────────────────────────
try:
    df = pd.read_csv("Superstore_India.csv", encoding="latin1")
    df.columns = df.columns.str.strip()
    print(f"CSV loaded: {len(df)} rows")
except Exception as e:
    print("Error:", e)
    exit()

# ── Fix dates ─────────────────────────────────────────────────────────────────
df["Order Date"] = pd.to_datetime(df["Order Date"], dayfirst=True, errors="coerce")
df["Month"] = df["Order Date"].dt.strftime("%Y-%m")
df["order_date_str"] = df["Order Date"].dt.strftime("%Y-%m-%d")

output = "my-next-app/public/data"
os.makedirs(output, exist_ok=True)

# ── 1. sales.json — every individual row ─────────────────────────────────────
sales = []
for i, r in df.iterrows():
    qty = int(r.get("Quantity", 1)) or 1
    total = float(r.get("Sales", 0))
    sales.append({
        "id": int(r.get("Row ID", i + 1)),
        "order_id": str(r.get("Order ID", "")),
        "order_date": r["order_date_str"],
        "order_month": int(r["Order Date"].month) if pd.notna(r["Order Date"]) else None,
        "order_year": int(r["Order Date"].year) if pd.notna(r["Order Date"]) else None,
        "customer_name": str(r.get("Customer Name", "")),
        "state": str(r.get("State", "")),
        "city": str(r.get("City", "")),
        "region": str(r.get("Region", "")),
        "segment": str(r.get("Segment", "")),
        "category": str(r.get("Category", "")),
        "sub_category": str(r.get("Sub-Category", "")),
        "product_id": str(r.get("Product ID", "")),
        "product_name": str(r.get("Product Name", "")),
        "quantity": qty,
        "unit_price": round(total / qty, 2),
        "total_sales": round(total, 2),
        "discount": float(r.get("Discount", 0)),
        "profit": round(float(r.get("Profit", 0)), 2)
    })

with open(f"{output}/sales.json", "w") as f:
    json.dump(sales, f, indent=2)
print(f"sales.json → {len(sales)} records")

# ── 2. inventory.json — one record per unique product ────────────────────────
products = df.drop_duplicates("Product ID")[
    ["Product ID", "Product Name", "Category", "Sub-Category"]
].copy()

inventory = []
for _, r in products.iterrows():
    reorder = random.randint(20, 80)
    safety  = random.randint(10, 30)
    stock   = random.randint(0, 500)
    inventory.append({
        "product_id":    str(r["Product ID"]),
        "product_name":  str(r["Product Name"]),
        "category":      str(r["Category"]),
        "sub_category":  str(r["Sub-Category"]),
        "current_stock": stock,
        "reorder_level": reorder,
        "lead_time_days": random.choice([3, 5, 7]),
        "safety_stock":  safety,
        "status": (
            "Out of Stock" if stock == 0 else
            "Critical"     if stock <= safety else
            "Low"          if stock <= reorder else
            "In Stock"
        )
    })

with open(f"{output}/inventory.json", "w") as f:
    json.dump(inventory, f, indent=2)
print(f"inventory.json → {len(inventory)} records")

# ── 3. transactions.json — one stock_out per sale row ────────────────────────
transactions = []
for i, r in df.iterrows():
    transactions.append({
        "id": f"txn_{i+1:04d}",
        "product_id":        str(r.get("Product ID", "")),
        "product_name":      str(r.get("Product Name", "")),
        "type":              "stock_out",
        "quantity":          int(r.get("Quantity", 1)),
        "date":              r["order_date_str"],
        "reference_order_id": str(r.get("Order ID", "")),
        "note":              "Sale order"
    })

with open(f"{output}/transactions.json", "w") as f:
    json.dump(transactions, f, indent=2)
print(f"transactions.json → {len(transactions)} records")

# ── 4. alerts.json — products where stock <= reorder_level ───────────────────
alerts = [
    {
        "id": f"alert_{i+1:03d}",
        "product_id":   p["product_id"],
        "product_name": p["product_name"],
        "category":     p["category"],
        "current_stock": p["current_stock"],
        "reorder_level": p["reorder_level"],
        "safety_stock":  p["safety_stock"],
        "status":        p["status"],
        "created_at":    str(date.today())
    }
    for i, p in enumerate(inventory)
    if p["current_stock"] <= p["reorder_level"]
]

with open(f"{output}/alerts.json", "w") as f:
    json.dump(alerts, f, indent=2)
print(f"alerts.json → {len(alerts)} alerts")

# ── 5. Keep your summary files too ───────────────────────────────────────────
# monthly_sales.json
monthly = df.groupby("Month")["Sales"].sum().reset_index().to_dict(orient="records")
with open(f"{output}/monthly_sales.json", "w") as f:
    json.dump(monthly, f, indent=2)

# profit.json
profit = df.groupby("Category")["Profit"].sum().reset_index().to_dict(orient="records")
with open(f"{output}/profit.json", "w") as f:
    json.dump(profit, f, indent=2)

# top_products.json
top = (df.groupby("Product Name")["Sales"].sum()
         .sort_values(ascending=False).head(10)
         .reset_index().to_dict(orient="records"))
with open(f"{output}/top_products.json", "w") as f:
    json.dump(top, f, indent=2)

print("✅ All 7 JSON files generated!")