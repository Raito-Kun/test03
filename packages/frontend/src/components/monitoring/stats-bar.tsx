import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Zap, Radio, Moon, ZapOff, Gauge } from 'lucide-react';

interface StatsBarProps {
  ready: number;
  onCall: number;
  onBreak: number;
  offline: number;
  total: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: 'easeOut' });
    return controls.stop;
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

function ProgressRing({ value, size = 64 }: { value: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);
  useEffect(() => {
    const pct = Math.max(0, Math.min(1, value));
    setOffset(circumference * (1 - pct));
  }, [value, circumference]);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={6}
        className="fill-none stroke-border" />
      <motion.circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={6}
        className="fill-none stroke-emerald-500"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: offset }}
        initial={{ strokeDashoffset: circumference }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </svg>
  );
}

function Tile({
  icon: Icon, label, value, accent, iconFill,
}: { icon: typeof Zap; label: string; value: number; accent: string; iconFill?: string }) {
  return (
    <div className="relative flex items-center gap-4 rounded-md bg-card p-5 shadow-sm ring-1 ring-border">
      <div className={`flex h-12 w-12 items-center justify-center rounded-md ${accent}`}>
        <Icon className={`h-6 w-6 ${iconFill || ''}`} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold text-foreground">
          <AnimatedNumber value={value} />
        </p>
      </div>
    </div>
  );
}

export function StatsBar({ ready, onCall, onBreak, offline, total }: StatsBarProps) {
  const online = ready + onCall + onBreak;
  const ratio = total > 0 ? online / total : 0;
  const pct = Math.round(ratio * 100);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5 mb-6">
      <Tile
        icon={Zap}
        label="Sẵn sàng"
        value={ready}
        accent="bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15),0_0_12px_rgba(16,185,129,0.2)]"
        iconFill="fill-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]"
      />
      <Tile
        icon={Radio}
        label="Đang gọi"
        value={onCall}
        accent="bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600"
        iconFill="animate-pulse"
      />
      <Tile
        icon={Moon}
        label="Nghỉ"
        value={onBreak}
        accent="bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600"
        iconFill="fill-amber-400"
      />
      <Tile
        icon={ZapOff}
        label="Ngoại tuyến"
        value={offline}
        accent="bg-muted text-muted-foreground"
      />
      <div className="relative flex items-center gap-4 rounded-md bg-card p-5 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900/40">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <ProgressRing value={ratio} />
          <span className="absolute text-sm font-bold text-emerald-700 dark:text-emerald-400">{pct}%</span>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Tỷ lệ online</p>
          <p className="text-lg font-semibold text-foreground flex items-center gap-1">
            <Gauge className="h-4 w-4 text-emerald-600" />
            <AnimatedNumber value={online} /> / {total}
          </p>
        </div>
      </div>
    </div>
  );
}
