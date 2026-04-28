import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartProps = {
  labels: string[];
  values: number[];
  secondaryValues?: Array<number | null>;
  lowerBand?: number[];
  upperBand?: number[];
  title: string;
  variant: "line" | "bar";
  color?: string;
  xAxisTickFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (value: string) => string;
  showLegend?: boolean;
};

const formatMonthYearLabel = (value: string) => {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  }
  return value;
};

export default function Chart({
  labels,
  values,
  secondaryValues,
  lowerBand,
  upperBand,
  title,
  variant,
  color = "#2563eb",
  xAxisTickFormatter,
  tooltipLabelFormatter,
  showLegend = true,
}: ChartProps) {
  const defaultTickFormatter = xAxisTickFormatter ?? formatMonthYearLabel;
  const defaultTooltipLabelFormatter = tooltipLabelFormatter ?? formatMonthYearLabel;
  const useCenteredTick = Boolean(xAxisTickFormatter);
  const data = labels.map((label, index) => ({
    label,
    value: values[index] ?? 0,
    secondary: secondaryValues?.[index] ?? null,
    lower: lowerBand?.[index] ?? null,
    upper: upperBand?.[index] ?? null,
  }));
  const hasSecondary = Array.isArray(secondaryValues) && secondaryValues.some((value) => value !== null && value !== undefined);
  const hasRange = Array.isArray(lowerBand) && lowerBand.length > 0 && Array.isArray(upperBand) && upperBand.length > 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {showLegend && (hasSecondary || hasRange) ? (
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Forecast
            </span>
            {hasSecondary ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Actual
              </span>
            ) : null}
            {hasRange ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-1 ring-slate-300" />Confidence range
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {variant === "bar" ? (
            <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                angle={useCenteredTick ? 0 : -30}
                textAnchor={useCenteredTick ? "middle" : "end"}
                height={40}
                tickFormatter={defaultTickFormatter}
              />
              <YAxis tickFormatter={(value) => value.toString()} />
              <Tooltip
                labelFormatter={(label) => defaultTooltipLabelFormatter(label as string)}
                formatter={(value: number) => [`${value}`, "Sales"]}
              />
              {showLegend ? <Legend verticalAlign="top" height={32} /> : null}
              <Bar dataKey="value" name="Sales" fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                angle={useCenteredTick ? 0 : -30}
                textAnchor={useCenteredTick ? "middle" : "end"}
                height={40}
                tickFormatter={defaultTickFormatter}
                label={{ value: "Date", position: "insideBottomRight", offset: 0 }}
              />
              <YAxis tickFormatter={(value) => value.toString()} label={{ value: "Units", angle: -90, position: "insideLeft", dy: 10 }} />
              <Tooltip
                labelFormatter={(label) => defaultTooltipLabelFormatter(label as string)}
                formatter={(value: number, name: string) => [`${value}`, name === "value" ? "Forecast" : "Actual"]}
              />
              {showLegend ? <Legend verticalAlign="top" height={32} /> : null}
              {hasRange ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="lower"
                    name="Lower bound"
                    stroke="rgba(37, 99, 235, 0.35)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="upper"
                    name="Upper bound"
                    stroke="rgba(37, 99, 235, 0.35)"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 4"
                  />
                </>
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                name="Forecast"
                stroke={color}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 1, fill: color }}
                activeDot={{ r: 6 }}
              />
              {hasSecondary ? (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  name="Actual"
                  stroke="#16a34a"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 1, fill: "#16a34a" }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              ) : null}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-3">
        {labels.slice(0, 6).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
