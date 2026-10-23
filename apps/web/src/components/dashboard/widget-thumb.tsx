import { widgetMeta, type WidgetType } from "@/lib/overview-layout";

// A small picture of each kind of widget for the "Add a widget" list: the same layout as the real one (icon and title, figures, a chart), drawn
// with plain shapes, in the widget's own colour and in its own proportions (wide ones wide, tall ones tall).

const COLOR: Partial<Record<WidgetType, string>> = {
  solar: "#f59e0b",
  load: "#3b82f6",
  grid: "#0ea5e9",
  battery: "#22c55e",
  selfpowered: "#10b981",
  exported: "#06b6d4",
  imported: "#6366f1",
  flow: "#10b981",
  battery_level: "#22c55e",
  power_now: "#f59e0b",
  ev_power: "#10b981",
  ev_current: "#10b981",
  ev_temp: "#f59e0b",
  ev_energy: "#10b981",
  clock: "#ef4444",
};

const CURVE: Partial<Record<WidgetType, string>> = {
  solar: "M0 18 C8 18 14 6 24 3 S42 8 60 17",
  load: "M0 12 C10 4 16 14 26 8 S44 14 60 6",
  grid: "M0 10 C10 14 18 4 30 9 S48 16 60 8",
  battery: "M0 15 C12 15 18 5 30 6 S46 12 60 4",
  selfpowered: "M0 14 C12 10 20 12 30 6 S48 8 60 3",
  exported: "M0 17 C10 15 18 8 30 7 S48 5 60 9",
  imported: "M0 8 C10 6 20 14 30 12 S50 6 60 14",
};

function Header({ color, wide = 10 }: { color: string; wide?: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="size-2.5 shrink-0 rounded" style={{ background: color, opacity: 0.35 }} />
      <span className="h-1 rounded bg-foreground/55" style={{ width: `${wide * 3}px` }} />
    </div>
  );
}

function Bar({ w, h = 2, strong = false }: { w: number; h?: number; strong?: boolean }) {
  return <span className="block rounded-sm bg-foreground" style={{ width: `${w}px`, height: `${h}px`, opacity: strong ? 0.75 : 0.22 }} />;
}

function Inner({ type }: { type: WidgetType }) {
  const color = COLOR[type] ?? "#10b981";
  const curve = CURVE[type];
  if (curve) {
    return (
      <div className="flex h-full flex-col gap-1 p-1.5">
        <Header color={color} />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-0.5">
              <Bar w={i === 0 ? 14 : 11} h={3} strong />
              <Bar w={10} h={1.5} />
            </div>
          ))}
        </div>
        <svg viewBox="0 0 60 20" preserveAspectRatio="none" className="min-h-0 flex-1" aria-hidden>
          <path d={`${curve} L60 20 L0 20 Z`} fill={color} opacity="0.16" />
          <path d={curve} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  if (type === "flow") {
    return (
      <svg viewBox="0 0 80 60" className="size-full p-1" aria-hidden>
        {[[40, 8], [40, 52], [10, 30], [70, 30]].map(([x, y], i) => (
          <g key={i}>
            <line x1="40" y1="30" x2={x} y2={y} stroke={["#f59e0b", "#22c55e", "#3b82f6", "#0ea5e9"][i]} strokeWidth="1.6" strokeDasharray="2 2" />
            <circle cx={x} cy={y} r="5" fill="none" stroke={["#f59e0b", "#22c55e", "#3b82f6", "#0ea5e9"][i]} strokeWidth="1.6" />
          </g>
        ))}
        <circle cx="40" cy="30" r="8" fill={color} opacity="0.2" stroke={color} strokeWidth="1.6" />
      </svg>
    );
  }
  if (type === "battery_level") {
    return (
      <div className="flex h-full items-end justify-between gap-2 p-2">
        <div className="space-y-1 self-center">
          <span className="block text-[15px] font-semibold leading-none" style={{ color }}>
            57%
          </span>
          <Bar w={22} h={1.5} />
        </div>
        <div className="flex h-full items-end gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-[5px] rounded-sm" style={{ height: `${40 + i * 15}%`, background: i < 3 ? color : "currentColor", opacity: i < 3 ? 1 : 0.15 }} />
          ))}
        </div>
      </div>
    );
  }
  if (type === "power_now") {
    return (
      <div className="flex h-full flex-col justify-center gap-2 p-2">
        <div className="flex justify-between gap-1">
          {["#10b981", "#3b82f6", "#f59e0b", "#94a3b8"].map((c) => (
            <div key={c} className="space-y-0.5">
              <Bar w={13} h={3} strong />
              <span className="block h-1 w-3 rounded-full" style={{ background: c }} />
            </div>
          ))}
        </div>
        <div className="flex h-1 overflow-hidden rounded-full bg-muted">
          {[40, 25, 20, 15].map((w, i) => (
            <span key={w} style={{ width: `${w}%`, background: ["#10b981", "#3b82f6", "#f59e0b", "#94a3b8"][i] }} />
          ))}
        </div>
      </div>
    );
  }
  if (type === "clock") {
    return (
      <div className="flex h-full items-center gap-2 p-1.5">
        <svg viewBox="0 0 100 100" className="aspect-square h-full shrink-0" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="5" />
          <line x1="50" y1="50" x2="50" y2="28" stroke="currentColor" strokeWidth="7" strokeLinecap="round" transform="rotate(300 50 50)" />
          <line x1="50" y1="50" x2="50" y2="16" stroke="currentColor" strokeWidth="5" strokeLinecap="round" transform="rotate(60 50 50)" />
          <line x1="50" y1="54" x2="50" y2="14" stroke={color} strokeWidth="3" strokeLinecap="round" transform="rotate(150 50 50)" />
        </svg>
        <div className="space-y-1">
          <Bar w={26} h={4} strong />
          <Bar w={34} h={1.5} />
        </div>
      </div>
    );
  }
  // the EV charger tiles
  return (
    <div className="flex h-full flex-col justify-between p-1.5">
      <Header color={color} />
      <Bar w={26} h={5} strong />
      <span className="h-2 w-8 rounded-full" style={{ background: color, opacity: 0.25 }} />
    </div>
  );
}

/** The picture of one kind of widget, at its own proportions inside a soft box. */
export function WidgetThumb({ type }: { type: WidgetType }) {
  const meta = widgetMeta(type)!;
  const wide = meta.w / meta.h >= 1.6;
  return (
    <div className="grid h-20 w-32 shrink-0 place-items-center rounded-xl bg-muted/60 p-2" aria-hidden>
      <div className="overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-sm" style={{ aspectRatio: `${meta.w} / ${meta.h}`, ...(wide ? { width: "100%" } : { height: "100%" }), maxWidth: "100%", maxHeight: "100%" }}>
        <Inner type={type} />
      </div>
    </div>
  );
}
