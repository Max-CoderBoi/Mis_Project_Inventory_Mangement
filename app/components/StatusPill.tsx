type StatusPillProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  "In Stock": "bg-emerald-100 text-emerald-800",
  Low: "bg-amber-100 text-amber-800",
  Critical: "bg-orange-100 text-orange-900",
  "Out of Stock": "bg-red-100 text-red-900",
};

export default function StatusPill({ status }: StatusPillProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-slate-100 text-slate-800"}`}>
      {status}
    </span>
  );
}
