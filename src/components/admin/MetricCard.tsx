export function MetricCard({
  label, value, sublabel,
}: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="border border-white/[0.06] bg-[#111] p-4 sm:p-5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-white/40">{sublabel}</p>}
    </div>
  )
}
