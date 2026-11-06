import Image from "next/image";

/**
 * The gateway picture with the equipment drawn on its pads: solar, inverter, battery, layers, schedule and plug around, and the gateway chip in the
 * middle. The icons are solid shapes (with their details cut out): blue-grey (#b8c2cb) on the light picture and black on the dark one. They are engraved
 * into the pads rather than printed on them: a soft shadow just inside the top edge and a thin light edge just under the bottom (no glow), so they read as
 * part of the same moulded surface as the picture. They sit over the two pictures, placed by percentages of the picture and sized in container units, so
 * they stay on their pads at every width.
 */
const COLOR = "text-[#b8c2cb] dark:text-[#07090a] [filter:url(#gp-engrave-light)] dark:[filter:url(#gp-engrave-dark)]";

/** The two engraving filters (sizes are fractions of each icon, so the effect scales with the icon). */
function EngraveFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {/* Light pads: a white edge under the icon, a soft grey shadow inside its top edge. */}
        <filter id="gp-engrave-light" x="-20%" y="-20%" width="140%" height="140%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feOffset in="SourceAlpha" dx="0" dy="0.035" result="down" />
          <feGaussianBlur in="down" stdDeviation="0.01" result="downBlur" />
          <feFlood floodColor="#ffffff" floodOpacity="0.95" />
          <feComposite in2="downBlur" operator="in" result="edge" />
          <feComponentTransfer in="SourceAlpha" result="outside">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feOffset in="outside" dx="0" dy="0.04" result="outsideDown" />
          <feGaussianBlur in="outsideDown" stdDeviation="0.014" result="outsideBlur" />
          <feFlood floodColor="#5d6b79" floodOpacity="0.6" />
          <feComposite in2="outsideBlur" operator="in" result="shadowAll" />
          <feComposite in="shadowAll" in2="SourceAlpha" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadow" />
          </feMerge>
        </filter>
        {/* Dark pads: a faint light edge under the icon, a soft lift inside its top edge. */}
        <filter id="gp-engrave-dark" x="-20%" y="-20%" width="140%" height="140%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feOffset in="SourceAlpha" dx="0" dy="0.035" result="down" />
          <feGaussianBlur in="down" stdDeviation="0.01" result="downBlur" />
          <feFlood floodColor="#ffffff" floodOpacity="0.2" />
          <feComposite in2="downBlur" operator="in" result="edge" />
          <feComponentTransfer in="SourceAlpha" result="outside">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feOffset in="outside" dx="0" dy="0.04" result="outsideDown" />
          <feGaussianBlur in="outsideDown" stdDeviation="0.014" result="outsideBlur" />
          <feFlood floodColor="#2c3338" floodOpacity="0.9" />
          <feComposite in2="outsideBlur" operator="in" result="shadowAll" />
          <feComposite in="shadowAll" in2="SourceAlpha" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadow" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

type IconProps = { style: React.CSSProperties };
const Svg = ({ style, children }: IconProps & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" stroke="none" style={style} aria-hidden="true">
    {children}
  </svg>
);
const Lines = ({ d, width = 1.7 }: { d: string; width?: number }) => <path d={d} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;

/** Sun: a disc with eight short rays. */
const Solar = ({ style }: IconProps) => (
  <Svg style={style}>
    <circle cx="12" cy="12" r="4.6" />
    <Lines d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6M5.1 5.1l1.9 1.9M17 17l1.9 1.9M5.1 18.9L7 17M17 7l1.9-1.9" width={1.9} />
  </Svg>
);
/** Inverter: a lightning bolt. */
const Inverter = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M13.6 1.8 4.5 13.4a.7.7 0 0 0 .55 1.1H10l-1.3 7.1a.5.5 0 0 0 .9.4l9-11.6a.7.7 0 0 0-.55-1.1H13l1.2-7.1a.5.5 0 0 0-.6-.6Z" />
  </Svg>
);
/** Battery: a body and terminal with a bolt cut out of it. */
const Battery = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M4.5 6h12A2.5 2.5 0 0 1 19 8.5V10h1.2a.8.8 0 0 1 .8.8v2.4a.8.8 0 0 1-.8.8H19v1.5a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 2 15.5v-7A2.5 2.5 0 0 1 4.5 6Z M11.2 8.2 7.6 12.6h2.6l-.9 3.2 3.6-4.4h-2.6Z" />
  </Svg>
);
/** Layers (instead of the fuel pump): the top sheet solid, two lines under it. */
const Layers = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <Lines d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" width={2} />
  </Svg>
);
/** Calendar with a clock (instead of the meter dial): a solid calendar with the clock cut into its corner. */
const CalendarClock = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M4.5 4h15A2 2 0 0 1 21.5 6v14a2 2 0 0 1-2 2h-15A2 2 0 0 1 2.5 20V6a2 2 0 0 1 2-2Z M3.9 7.6h16.2v1.2H3.9Z M15.5 9.2a6.3 6.3 0 1 0 0 12.6 6.3 6.3 0 0 0 0-12.6Z M15.5 11a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z M14.9 12.6h1.2v3.1l1.8 1.1-.6 1-2.4-1.4Z" />
    <Lines d="M8 2v3.2M16 2v3.2" width={1.9} />
  </Svg>
);
/** Plug with a bolt (instead of the EV charger): a solid plug body, its prongs, the cable and a bolt. */
const PlugZap = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
    <Lines d="M2 22l3-3M7.5 13.5 10 11M10.5 16.5 13 14M18 3l-4 4h6l-4 4" width={1.9} />
  </Svg>
);
/** Chip: a body with its core cut out, and pins on every side. */
const Chip = ({ style }: IconProps) => (
  <Svg style={style}>
    <path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M9.6 9.6h4.8v4.8H9.6Z" />
    <Lines d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" width={1.6} />
  </Svg>
);

const PADS: { Icon: (p: IconProps) => React.ReactElement; label: string; x: number; y: number; size: number }[] = [
  { Icon: Solar, label: "Solar", x: 19.6, y: 23.4, size: 5 },
  { Icon: Inverter, label: "Inverter", x: 14.6, y: 64.7, size: 5 },
  { Icon: Battery, label: "Battery", x: 80.4, y: 23.4, size: 5 },
  { Icon: PlugZap, label: "Plug", x: 85.4, y: 64.7, size: 5 },
  { Icon: Layers, label: "Layers", x: 9.0, y: 42.3, size: 3.1 },
  { Icon: CalendarClock, label: "Schedule", x: 91.3, y: 42.2, size: 3.1 },
];

export function GatewayPicture() {
  return (
    <div
      role="img"
      aria-label="The WayTara gateway in the middle, connected to solar, an inverter, a battery and the other parts of a site: its systems, its schedules and its charging."
      className="overflow-hidden rounded-3xl bg-theme-surface [container-type:inline-size]"
    >
      <div className="relative aspect-[2752/1536]">
        <EngraveFilters />
        <Image src="/images/platform/gateway-light.webp" alt="" fill sizes="(min-width: 1280px) 1300px, 100vw" className="object-cover dark:hidden" />
        <Image src="/images/platform/gateway-dark.webp" alt="" fill sizes="(min-width: 1280px) 1300px, 100vw" className="hidden object-cover dark:block" />

        {PADS.map(({ Icon, label, x, y, size }) => (
          <span key={label} aria-hidden="true" className={`absolute -translate-x-1/2 -translate-y-1/2 ${COLOR}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <Icon style={{ width: `${size}cqw`, height: `${size}cqw`, display: "block" }} />
          </span>
        ))}

        {/* The gateway itself, on the chip in the middle. */}
        <span aria-hidden="true" className={`absolute -translate-x-1/2 -translate-y-1/2 ${COLOR}`} style={{ left: "50.2%", top: "48.8%" }}>
          <Chip style={{ width: "11cqw", height: "11cqw", display: "block" }} />
        </span>
      </div>
    </div>
  );
}
