type KpiCardProps = {
  title: string;
  value: string;
  details?: string;
  accent?: "blue" | "green" | "amber" | "indigo";
};

const accentClasses: Record<string, string> = {
  blue: "border-blue-500 bg-blue-50 text-blue-900",
  green: "border-emerald-500 bg-emerald-50 text-emerald-900",
  amber: "border-amber-500 bg-amber-50 text-amber-900",
  indigo: "border-indigo-500 bg-indigo-50 text-indigo-900",
};

export default function KpiCard({ title, value, details, accent = "indigo" }: KpiCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${accentClasses[accent]}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600">{title}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      {details ? <p className="mt-2 text-sm text-slate-600">{details}</p> : null}
    </div>
  );
}
