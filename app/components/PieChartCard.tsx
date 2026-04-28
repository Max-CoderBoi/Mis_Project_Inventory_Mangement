import { Cell, Legend, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip } from "recharts";

type PieChartCardProps = {
  title: string;
  data: Array<{ name: string; value: number }>;
  colors?: string[];
};

const defaultColors = ["#2563eb", "#f97316", "#16a34a", "#ec4899"];

export default function PieChartCard({ title, data, colors = defaultColors }: PieChartCardProps) {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{totalValue} units</span>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RePieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={96}
              paddingAngle={4}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${entry.name}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value} units`, "Stock"]} />
            <Legend verticalAlign="bottom" height={32} />
          </RePieChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        {totalValue > 0
          ? "This chart shows how stock is split between current inventory and the additional amount needed to meet reorder targets."
          : "No stock data available for this product."}
      </p>
    </div>
  );
}
