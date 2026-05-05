import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'online' | 'on_call' | 'break' | 'offline';

interface PillFiltersProps {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

const OPTIONS: { key: StatusFilter; label: string; gradient: string }[] = [
  { key: 'all', label: 'Tất cả', gradient: 'from-slate-600 to-slate-800' },
  { key: 'online', label: 'Sẵn sàng', gradient: 'from-emerald-500 to-emerald-600' },
  { key: 'on_call', label: 'Đang gọi', gradient: 'from-rose-500 to-rose-600' },
  { key: 'break', label: 'Nghỉ', gradient: 'from-amber-500 to-amber-600' },
  { key: 'offline', label: 'Ngoại tuyến', gradient: 'from-slate-400 to-slate-500' },
];

export function PillFilters({ value, onChange, counts }: PillFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'group relative flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              active
                ? `border-transparent bg-gradient-to-r ${opt.gradient} text-white shadow-md hover:shadow-lg`
                : 'border-border bg-white text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                'inline-flex min-w-[24px] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                active ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground group-hover:bg-slate-200',
              )}
            >
              {counts[opt.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
