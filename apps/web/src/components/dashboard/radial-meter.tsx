import type { MeterTone } from "./meter";

const TONE_STROKE: Record<MeterTone, string> = {
  accent: "var(--primary)",
  good: "#10b981",
  warn: "#f59e0b",
  bad: "var(--destructive)",
  neutral: "var(--muted-foreground)",
};

const STROKE_WIDTH = 7;

/** A ring meter for the one shape of field that has a genuinely natural
 *  0–100 ceiling — a percent reading (state of charge and the like).
 *  Reserved for percent-kind fields
 *  specifically (see isPercentField) rather than offered generically: most
 *  readings have no real maximum to ring against (see live-readings-card's
 *  own note on why it uses stat tiles, not meters, for those), so a ring
 *  everywhere would be decoration, not data. */
export function RadialMeter({
  label,
  valueText,
  fraction,
  tone = "accent",
  size = 76,
}: {
  label: string;
  valueText: string;
  fraction: number;
  tone?: MeterTone;
  size?: number;
}) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--muted)" strokeWidth={STROKE_WIDTH} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${clamped * circumference} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold tabular-nums text-foreground">{valueText}</span>
        </div>
      </div>
      <span className="max-w-[6.5rem] truncate text-center text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
