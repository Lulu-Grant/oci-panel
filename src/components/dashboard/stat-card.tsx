import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "emerald" | "blue" | "amber" | "rose";
}

const accentMap = {
  emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-200 text-emerald-700",
  blue: "from-blue-500/15 to-blue-500/5 border-blue-200 text-blue-700",
  amber: "from-amber-500/15 to-amber-500/5 border-amber-200 text-amber-700",
  rose: "from-rose-500/15 to-rose-500/5 border-rose-200 text-rose-700",
};

export function StatCard({ label, value, hint, accent = "emerald" }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-5 shadow-sm", accentMap[accent])}>
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
