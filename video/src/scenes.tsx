import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  BatteryCharging,
  Bell,
  CalendarClock,
  Car,
  Check,
  ChevronsUpDown,
  Cloud,
  CloudSun,
  EvCharger,
  Gauge,
  Home,
  MailCheck,
  Power,
  ReceiptIndianRupee,
  Server,
  Sun,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { C, D, GRAD, SHADOW, SHADOW_SM } from "./theme";
import { Card, Chapter, Cursor, Enter, Num, Pill, Scene, Words, clampBoth, inOut, lerp, p } from "./ui";

type Pt = [number, number];

const ICON = staticFile("images/icon.png");
const LOGO = staticFile("images/logo.png");

/** A square tile with an icon in a tint of its colour. */
const IconTile: React.FC<{ icon: LucideIcon; color: string; size?: number; style?: React.CSSProperties }> = ({ icon: Icon, color, size = 150, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: C.card,
      border: `1px solid ${C.line}`,
      boxShadow: SHADOW_SM,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    <div style={{ width: size * 0.64, height: size * 0.64, borderRadius: size * 0.2, background: `${color}1F`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={size * 0.4} color={color} strokeWidth={1.8} />
    </div>
  </div>
);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 1. The question: three devices, three apps.

const HOOK = [
  { icon: Sun, color: C.amber, word: "Solar.", x: 520, tilt: -7, lift: -16 },
  { icon: BatteryCharging, color: C.emerald, word: "Battery.", x: 960, tilt: 5, lift: 14 },
  { icon: EvCharger, color: C.blue, word: "EV charging.", x: 1400, tilt: -4, lift: -8 },
];

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const scatter = p(f, 56, 30, inOut);
  const gather = p(f, 86, 19, inOut);
  return (
    <Scene dur={D.hook} exit={10}>
      {HOOK.map((item, i) => {
        const at = 4 + i * 16;
        const x = lerp(item.x, 960, gather);
        const y = lerp(380 + item.lift * scatter, 500, gather);
        return (
          <React.Fragment key={item.word}>
            <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${item.tilt * scatter * (1 - gather)}deg) scale(${lerp(1, 0.25, gather)})`, opacity: 1 - gather }}>
              <Enter at={at} y={40} scale={0.7}>
                <IconTile icon={item.icon} color={item.color} size={190} />
              </Enter>
            </div>
            <div style={{ position: "absolute", left: item.x, top: 548 + item.lift * scatter, transform: "translateX(-50%)", opacity: 1 - gather }}>
              <Words text={item.word} at={at + 5} size={62} weight={600} />
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 730, display: "flex", justifyContent: "center", opacity: 1 - gather }}>
        <Words text="Each in its own app?" at={58} stagger={4} size={96} weight={700} accent={[3, 4]} />
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 2. The name.

const LogoWipe: React.FC<{ at: number; width: number }> = ({ at, width }) => {
  const f = useCurrentFrame();
  const t = p(f, at, 34, inOut);
  return <Img src={LOGO} style={{ width, height: (width * 458) / 2172, clipPath: `inset(-5% ${(1 - t) * 100}% -5% 0)` }} />;
};

export const LogoReveal: React.FC = () => {
  const f = useCurrentFrame();
  const ring = p(f, 0, 40);
  return (
    <Scene dur={D.logo}>
      <div
        style={{
          position: "absolute",
          left: 960 - 500,
          top: 500 - 500,
          width: 1000,
          height: 1000,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(52,211,153,0.38) 0%, rgba(255,255,255,0) 62%)",
          opacity: ring,
          transform: `scale(${0.3 + ring * 0.9})`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingBottom: 60 }}>
        <LogoWipe at={4} width={860} />
        <Enter at={40} y={30} style={{ marginTop: 70 }}>
          <div style={{ padding: "22px 44px", borderRadius: 999, background: "rgba(255,255,255,0.86)", border: `1px solid ${C.line}`, boxShadow: SHADOW_SM }}>
            <Words text="One platform for your entire energy ecosystem" at={44} stagger={3} size={40} weight={500} color={C.ink} accent={[0, 1]} />
          </div>
        </Enter>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 3. Connect: the equipment at the site, the gateway, the platform.

const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const Wire: React.FC<{ from: Pt; to: Pt; at: number; color: string }> = ({ from, to, at, color }) => {
  const f = useCurrentFrame();
  const mx = (from[0] + to[0]) / 2;
  const draw = p(f, at, 26, inOut);
  const since = f - at - 26;
  return (
    <>
      <path d={`M ${from[0]} ${from[1]} C ${mx} ${from[1]}, ${mx} ${to[1]}, ${to[0]} ${to[1]}`} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      {since > 0 &&
        [0, 0.5].map((phase) => {
          const t = (since / 48 + phase) % 1;
          return (
            <circle key={phase} cx={bez(from[0], mx, mx, to[0], t)} cy={bez(from[1], from[1], to[1], to[1], t)} r={8} fill={color} opacity={Math.sin(Math.PI * t)} />
          );
        })}
    </>
  );
};

const DEVICES: { icon: LucideIcon; color: string; label: string; at: Pt; port: Pt; plug: Pt }[] = [
  { icon: Sun, color: C.amber, label: "Solar inverter", at: [400, 430], port: [478, 430], plug: [838, 560] },
  { icon: BatteryCharging, color: C.emerald, label: "Battery", at: [400, 760], port: [478, 760], plug: [838, 640] },
  { icon: EvCharger, color: C.blue, label: "EV charger", at: [1520, 430], port: [1442, 430], plug: [1082, 560] },
  { icon: Gauge, color: C.violet, label: "Energy meter", at: [1520, 760], port: [1442, 760], plug: [1082, 640] },
];

export const Connect: React.FC = () => {
  const f = useCurrentFrame();
  const up = p(f, 104, 22, inOut);
  const upSince = f - 126;
  return (
    <Scene dur={D.connect}>
      <Chapter word="Connect" index={0} caption="New or existing equipment, through one gateway." accent={[0, 1, 2]} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {DEVICES.map((d, i) => (
          <Wire key={d.label} from={d.port} to={d.plug} at={62 + i * 7} color={d.color} />
        ))}
        <line x1={960} y1={476} x2={960} y2={348} stroke={C.green} strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 14" pathLength={undefined} opacity={up} />
        {upSince > 0 &&
          [0, 0.5].map((phase) => {
            const t = (upSince / 36 + phase) % 1;
            return <circle key={phase} cx={960} cy={lerp(470, 352, t)} r={8} fill={C.green} opacity={Math.sin(Math.PI * t)} />;
          })}
      </svg>

      {DEVICES.map((d, i) => (
        <div key={d.label} style={{ position: "absolute", left: d.at[0], top: d.at[1], transform: "translate(-50%, -50%)" }}>
          <Enter at={46 + i * 6} y={30} scale={0.8}>
            <IconTile icon={d.icon} color={d.color} size={156} />
            <div style={{ position: "absolute", left: "50%", top: 172, transform: "translateX(-50%)", fontSize: 26, fontWeight: 500, color: C.sub, whiteSpace: "nowrap" }}>{d.label}</div>
          </Enter>
        </div>
      ))}

      {/* The gateway. (When the 3D model of the hardware arrives, it takes the place of this tile.) */}
      <div style={{ position: "absolute", left: 960, top: 600, transform: "translate(-50%, -50%)" }}>
        <Enter at={38} y={0} scale={0.6} dur={24}>
          <div style={{ width: 248, height: 248, borderRadius: 60, background: C.card, border: `1px solid ${C.line}`, boxShadow: SHADOW, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", inset: 14, borderRadius: 48, border: `2px solid ${C.mint}`, opacity: 0.25 + 0.3 * Math.abs(Math.sin(f / 14)) }} />
            <Img src={ICON} style={{ width: 150, height: 150 }} />
          </div>
          <div style={{ position: "absolute", left: "50%", top: 266, transform: "translateX(-50%)", fontSize: 30, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>WayTara gateway</div>
        </Enter>
      </div>

      <div style={{ position: "absolute", left: 960, top: 300, transform: "translate(-50%, -50%)" }}>
        <Enter at={100} y={-24} scale={0.9}>
          <Card style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 34px", borderRadius: 999 }}>
            <Cloud size={38} color={C.green} strokeWidth={1.8} />
            <span style={{ fontSize: 30, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>WayTara platform</span>
            <Pill color={C.green} pulse size={18}>
              Live
            </Pill>
          </Card>
        </Enter>
      </div>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The dashboard window (drawn for the film, in the customer dashboard's own style).

const TABS = [
  { label: "Main Hub", icon: Server, color: C.green },
  { label: "Solar Array", icon: Sun, color: C.amber },
  { label: "Battery Pack", icon: BatteryCharging, color: C.emerald },
  { label: "Load", icon: Home, color: C.sky },
  { label: "Grid Interface", icon: Zap, color: C.violet },
  { label: "EV Charger", icon: EvCharger, color: C.emerald },
];

const Window: React.FC<{ width: number; height: number; tab: number; children: React.ReactNode }> = ({ width, height, tab, children }) => (
  <div style={{ width, height, borderRadius: 32, background: "#FBFDFC", border: `1px solid ${C.line}`, boxShadow: SHADOW, overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <div style={{ height: 78, flexShrink: 0, display: "flex", alignItems: "center", gap: 16, padding: "0 32px", background: C.card, borderBottom: `1px solid ${C.line}` }}>
      <Img src={ICON} style={{ width: 44, height: 44 }} />
      <span style={{ fontSize: 23, fontWeight: 600, color: C.ink }}>Home</span>
      <ChevronsUpDown size={20} color={C.muted} />
      <div style={{ flex: 1 }} />
      <Pill color={C.green} pulse size={17}>
        Live
      </Pill>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 21, fontWeight: 500, color: C.sub, marginLeft: 10 }}>
        <Sun size={24} color={C.amber} />
        31°
      </div>
      <Bell size={24} color={C.sub} style={{ marginLeft: 10 }} />
      <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.soft, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
        <UserRound size={22} color={C.sub} />
      </div>
    </div>
    <div style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "stretch", gap: 6, padding: "0 24px", background: C.card, borderBottom: `1px solid ${C.line}` }}>
      {TABS.map((t, i) => (
        <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontSize: 18.5, fontWeight: i === tab ? 600 : 500, color: i === tab ? t.color : C.sub, borderBottom: `3px solid ${i === tab ? t.color : "transparent"}` }}>
          <t.icon size={20} />
          {t.label}
        </div>
      ))}
    </div>
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>{children}</div>
  </div>
);

const Stat: React.FC<{ label: string; unit: string; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, unit, color = C.ink, children, style }) => (
  <Card style={{ flex: 1, padding: "22px 28px", display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: "none", ...style }}>
    <div style={{ fontSize: 19, fontWeight: 500, color: C.sub }}>{label}</div>
    <div style={{ marginTop: 6, fontSize: 58, fontWeight: 600, color, letterSpacing: -1.5, lineHeight: 1.1 }}>
      {children}
      <span style={{ fontSize: 24, fontWeight: 500, color: C.muted, marginLeft: 8, letterSpacing: 0 }}>{unit}</span>
    </div>
  </Card>
);

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 4. Monitor: the solar of a home, through the day.

const PEAK_KW = 5.2;
const NOW_X = 0.56;
/** The shape of a day of solar (0 at 6 am, 1 at 6 pm), with a passing cloud in the morning. */
const solarShape = (x: number) => Math.exp(-Math.pow((x - 0.5) / 0.21, 2)) * (1 - 0.22 * Math.exp(-Math.pow((x - 0.36) / 0.022, 2)));

const CHART_W = 850;
const CHART_H = 360;
const chartY = (x: number) => CHART_H - 8 - solarShape(x) * (CHART_H - 50);
const CURVE = Array.from({ length: 141 }, (_, i) => i / 140)
  .map((x, i) => `${i === 0 ? "M" : "L"} ${(x * CHART_W).toFixed(1)} ${chartY(x).toFixed(1)}`)
  .join(" ");

const SolarChart: React.FC<{ reveal: number; showTip: number }> = ({ reveal, showTip }) => (
  <div style={{ position: "relative", width: CHART_W, height: CHART_H + 44 }}>
    <svg width={CHART_W} height={CHART_H} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.emerald} stopOpacity={0.42} />
          <stop offset="100%" stopColor={C.emerald} stopOpacity={0.02} />
        </linearGradient>
        <clipPath id="solarClip">
          <rect x={0} y={-20} width={reveal * CHART_W} height={CHART_H + 40} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={0} x2={CHART_W} y1={CHART_H - 8 - g * (CHART_H - 50)} y2={CHART_H - 8 - g * (CHART_H - 50)} stroke={C.line} strokeDasharray="4 8" />
      ))}
      <line x1={0} x2={CHART_W} y1={CHART_H - 8} y2={CHART_H - 8} stroke={C.line} strokeWidth={2} />
      <g clipPath="url(#solarClip)">
        <path d={`${CURVE} L ${CHART_W} ${CHART_H - 8} L 0 ${CHART_H - 8} Z`} fill="url(#solarFill)" />
        <path d={CURVE} fill="none" stroke={C.emerald} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      </g>
      {reveal > 0.02 && (
        <>
          <circle cx={reveal * CHART_W} cy={chartY(reveal)} r={18} fill={C.emerald} opacity={0.2} />
          <circle cx={reveal * CHART_W} cy={chartY(reveal)} r={9} fill="#fff" stroke={C.emerald} strokeWidth={5} />
        </>
      )}
    </svg>
    <div
      style={{
        position: "absolute",
        left: NOW_X * CHART_W,
        top: chartY(NOW_X) - 74,
        transform: `translateX(-50%) translateY(${(1 - showTip) * 14}px) scale(${lerp(0.85, 1, showTip)})`,
        opacity: showTip,
        padding: "10px 20px",
        borderRadius: 14,
        background: C.ink,
        color: "#fff",
        fontSize: 21,
        fontWeight: 500,
        whiteSpace: "nowrap",
        boxShadow: SHADOW_SM,
      }}
    >
      12:40 pm · <span style={{ fontWeight: 700, color: C.mint }}>{(PEAK_KW * solarShape(NOW_X)).toFixed(1)} kW</span>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: CHART_H + 8, display: "flex", justifyContent: "space-between", fontSize: 18, color: C.muted, fontWeight: 500 }}>
      {["6 am", "9 am", "12 pm", "3 pm", "6 pm"].map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  </div>
);

export const Monitor: React.FC = () => {
  const f = useCurrentFrame();
  const arrive = p(f, 40, 44);
  const push = p(f, 110, 85, inOut);
  const reveal = lerp(0, NOW_X, p(f, 66, 84, inOut));
  const tip = p(f, 150, 14);
  const month = p(f, 70, 60);
  return (
    <Scene dur={D.monitor}>
      <Chapter word="Monitor" index={1} caption="Every unit your roof makes, as it happens." accent={[5, 6, 7]} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: 280,
            top: 222,
            opacity: p(f, 40, 16),
            transformOrigin: "60% 50%",
            transform: `translate(${lerp(120, 0, arrive) - push * 60}px, ${lerp(90, 0, arrive) - push * 10}px) rotateX(${lerp(16, 2.5, arrive) - push * 2.5}deg) rotateY(${lerp(-26, -5, arrive) + push * 5}deg) scale(${lerp(0.86, 1, arrive) + push * 0.07})`,
          }}
        >
          <Window width={1360} height={780} tab={1}>
            <div style={{ flex: 1, display: "flex", gap: 26, padding: 28 }}>
              <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 20 }}>
                <Stat label="Solar power now" unit="kW" color={C.green}>
                  <Num value={PEAK_KW * solarShape(reveal) * (reveal > 0.01 ? 1 : 0)} />
                </Stat>
                <Stat label="Generated today" unit="kWh">
                  <Num value={14.2 * Math.pow(reveal / NOW_X, 1.7)} />
                </Stat>
                <Stat label="This month" unit="kWh">
                  <Num value={412 * month} digits={0} />
                </Stat>
              </div>
              <Card style={{ flex: 1, padding: "26px 30px", boxShadow: "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
                  <div>
                    <div style={{ fontSize: 25, fontWeight: 600, color: C.ink }}>Solar production</div>
                    <div style={{ fontSize: 18, color: C.sub, marginTop: 2 }}>Today, in kW</div>
                  </div>
                  <Pill color={C.green} pulse size={17}>
                    Go Live
                  </Pill>
                </div>
                <SolarChart reveal={reveal} showTip={tip} />
              </Card>
            </div>
          </Window>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 5. Control: start a charging session.

const POWER_W = 430;
const POWER_H = 150;
const powerShape = (x: number) => (1 - Math.exp(-x * 9)) * (0.93 + 0.04 * Math.sin(x * 21));
const POWER_CURVE = Array.from({ length: 81 }, (_, i) => i / 80)
  .map((x, i) => `${i === 0 ? "M" : "L"} ${(x * POWER_W).toFixed(1)} ${(POWER_H - 6 - powerShape(x) * (POWER_H - 26)).toFixed(1)}`)
  .join(" ");

export const Control: React.FC = () => {
  const f = useCurrentFrame();
  const CLICK = 100;
  const arrive = p(f, 40, 36);
  const on = f >= CLICK + 2;
  const run = p(f, CLICK + 2, 88, (n) => n);
  const ramp = p(f, CLICK + 2, 30);
  const toast = p(f, CLICK + 16, 18);
  const flick = p(f, CLICK, 10);
  const minutes = Math.floor(run * 28);
  const seconds = Math.floor((run * 28 * 60) % 60);
  return (
    <Scene dur={D.control}>
      <Chapter word="Control" index={2} caption="Start, stop and follow every charging session." accent={[0, 1]} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: 370,
            top: 280,
            opacity: p(f, 40, 14),
            transform: `translateY(${lerp(80, 0, arrive)}px) rotateX(${lerp(14, 0, arrive)}deg) rotateY(${lerp(22, 0, arrive)}deg) scale(${lerp(0.88, 1, arrive)})`,
          }}
        >
          <Card style={{ width: 1180, height: 660, borderRadius: 36, padding: 44, boxShadow: SHADOW, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, height: 80 }}>
              <div style={{ width: 76, height: 76, borderRadius: 22, background: `${C.emerald}1F`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EvCharger size={38} color={C.emerald} strokeWidth={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>EV charger</div>
                <div style={{ fontSize: 20, color: C.sub }}>Parking bay 1</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ transform: `scale(${1 + 0.12 * Math.sin(Math.PI * flick)})` }}>
                {on ? (
                  <Pill color={C.emerald} pulse size={22}>
                    Charging
                  </Pill>
                ) : (
                  <Pill color={C.sub} size={22}>
                    Ready
                  </Pill>
                )}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", gap: 30, marginTop: 30, marginBottom: 30 }}>
              {/* The charger, the cable and the car. */}
              <div style={{ flex: 1, borderRadius: 26, background: C.soft, position: "relative", overflow: "hidden" }}>
                <svg width={560} height={300} style={{ position: "absolute", left: 0, top: 0 }}>
                  <path d="M 150 190 C 220 250, 260 250, 330 205" fill="none" stroke={on ? C.emerald : C.muted} strokeWidth={7} strokeLinecap="round" strokeDasharray={on ? "4 20" : undefined} strokeDashoffset={on ? -f * 2.4 : 0} />
                </svg>
                <div style={{ position: "absolute", left: 60, top: 78, width: 110, height: 150, borderRadius: 24, background: C.card, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOW_SM }}>
                  <EvCharger size={58} color={on ? C.emerald : C.sub} strokeWidth={1.6} />
                </div>
                <Car size={230} color={C.ink} strokeWidth={1.1} style={{ position: "absolute", left: 300, top: 40 }} />
                <div style={{ position: "absolute", left: 318, top: 228, width: 196, height: 12, borderRadius: 6, background: "#E2E8F0", overflow: "hidden" }}>
                  <div style={{ width: `${run * 100}%`, height: "100%", background: GRAD }} />
                </div>
              </div>
              {/* The power of the session. */}
              <div style={{ width: 490, borderRadius: 26, border: `1px solid ${C.line}`, padding: "22px 30px" }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: C.sub }}>Charging power</div>
                <div style={{ fontSize: 60, fontWeight: 600, color: on ? C.green : C.ink, letterSpacing: -1.5, lineHeight: 1.15 }}>
                  <Num value={7.2 * ramp} />
                  <span style={{ fontSize: 24, fontWeight: 500, color: C.muted, marginLeft: 8, letterSpacing: 0 }}>kW</span>
                </div>
                <svg width={POWER_W} height={POWER_H} style={{ marginTop: 6 }}>
                  <defs>
                    <clipPath id="powerClip">
                      <rect x={0} y={0} width={run * POWER_W} height={POWER_H} />
                    </clipPath>
                    <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.emerald} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <line x1={0} x2={POWER_W} y1={POWER_H - 6} y2={POWER_H - 6} stroke={C.line} strokeWidth={2} />
                  <g clipPath="url(#powerClip)">
                    <path d={`${POWER_CURVE} L ${POWER_W} ${POWER_H - 6} L 0 ${POWER_H - 6} Z`} fill="url(#powerFill)" />
                    <path d={POWER_CURVE} fill="none" stroke={C.emerald} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 22, height: 130 }}>
              <Stat label="Energy this session" unit="kWh" style={{ height: 130, padding: "14px 26px" }}>
                <Num value={3.4 * run} style={{ fontSize: 46 }} />
              </Stat>
              <Stat label="Session time" unit="" style={{ height: 130, padding: "14px 26px" }}>
                <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 46 }}>
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </Stat>
              <div
                style={{
                  width: 330,
                  height: 92,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  fontSize: 27,
                  fontWeight: 600,
                  background: on ? C.card : GRAD,
                  color: on ? C.ink : "#fff",
                  border: on ? `2px solid ${C.line}` : "2px solid transparent",
                  boxShadow: on ? "none" : "0 18px 36px -14px rgba(22,163,74,0.6)",
                  transform: `scale(${interpolate(f, [CLICK - 2, CLICK, CLICK + 6], [1, 0.95, 1], clampBoth)})`,
                }}
              >
                <Power size={28} strokeWidth={2.4} color={on ? "#EF4444" : "#fff"} />
                {on ? "Stop charging" : "Start charging"}
              </div>
            </div>
          </Card>
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", right: 120, top: 232, opacity: toast, transform: `translateX(${(1 - toast) * 80}px)` }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 28px 18px 20px", borderRadius: 22 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={26} color="#fff" strokeWidth={3} />
          </div>
          <span style={{ fontSize: 25, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>Charging started</span>
        </Card>
      </div>

      <Cursor from={[1640, 1090]} to={[1356, 850]} start={72} arrive={96} click={CLICK} leave={CLICK + 14} />
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 6. Optimise: everything as one system.

const HUB: Pt = [500, 335];
const NODES: { icon: LucideIcon; color: string; label: string; value: string; at: Pt; toHub: boolean }[] = [
  { icon: Sun, color: C.amber, label: "Solar", value: "5.4 kW", at: [500, 62], toHub: true },
  { icon: BatteryCharging, color: C.emerald, label: "Battery · 86%", value: "1.2 kW", at: [150, 240], toHub: false },
  { icon: Home, color: C.sky, label: "Home", value: "2.1 kW", at: [850, 240], toHub: false },
  { icon: Zap, color: C.violet, label: "Grid · exporting", value: "0.3 kW", at: [190, 560], toHub: false },
  { icon: EvCharger, color: C.blue, label: "EV charger", value: "1.8 kW", at: [810, 560], toHub: false },
];

const FEATURES: { icon: LucideIcon; title: string; body: string; at: Pt }[] = [
  { icon: CalendarClock, title: "Schedules", body: "Time-of-use, by weekday and time slot", at: [96, 350] },
  { icon: ReceiptIndianRupee, title: "Savings", body: "Worked out from your real tariff", at: [96, 630] },
  { icon: MailCheck, title: "Reports", body: "E-mailed daily, weekly or monthly", at: [1484, 350] },
  { icon: CloudSun, title: "Weather", body: "For each of your sites", at: [1484, 630] },
];

export const Optimise: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene dur={D.optimise}>
      <Chapter word="Optimise" index={3} caption="Solar, battery, grid and EV, run as one system." accent={[6, 7, 8, 9]} />
      <div style={{ position: "absolute", left: 460, top: 290, width: 1000, height: 640 }}>
        <svg width={1000} height={640} style={{ position: "absolute", inset: 0 }}>
          {NODES.map((n, i) => {
            const draw = p(f, 56 + i * 6, 24, inOut);
            const since = f - (80 + i * 6);
            const [a, b] = n.toHub ? [n.at, HUB] : [HUB, n.at];
            return (
              <React.Fragment key={n.label}>
                <line x1={HUB[0]} y1={HUB[1]} x2={lerp(HUB[0], n.at[0], draw)} y2={lerp(HUB[1], n.at[1], draw)} stroke={n.color} strokeOpacity={0.35} strokeWidth={5} strokeLinecap="round" />
                {since > 0 &&
                  [0, 1 / 3, 2 / 3].map((phase) => {
                    const t = (since / 44 + phase) % 1;
                    return <circle key={phase} cx={lerp(a[0], b[0], t)} cy={lerp(a[1], b[1], t)} r={8} fill={n.color} opacity={Math.sin(Math.PI * t)} />;
                  })}
              </React.Fragment>
            );
          })}
        </svg>

        <div style={{ position: "absolute", left: HUB[0], top: HUB[1], transform: "translate(-50%, -50%)" }}>
          <Enter at={40} y={0} scale={0.5} dur={24}>
            <div style={{ width: 176, height: 176, borderRadius: "50%", background: C.card, border: `1px solid ${C.line}`, boxShadow: SHADOW, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <div style={{ position: "absolute", inset: -14, borderRadius: "50%", border: `2px solid ${C.mint}`, opacity: 0.2 + 0.35 * Math.abs(Math.sin(f / 13)) }} />
              <Img src={ICON} style={{ width: 118, height: 118 }} />
            </div>
          </Enter>
        </div>

        {NODES.map((n, i) => (
          <div key={n.label} style={{ position: "absolute", left: n.at[0], top: n.at[1], transform: "translate(-50%, -50%)" }}>
            <Enter at={50 + i * 6} y={20} scale={0.85}>
              <Card style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 26px 14px 14px", borderRadius: 999 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${n.color}1F`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <n.icon size={34} color={n.color} strokeWidth={1.9} />
                </div>
                <div style={{ whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 21, fontWeight: 500, color: C.sub, lineHeight: 1.2 }}>{n.label}</div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: C.ink, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{n.value}</div>
                </div>
              </Card>
            </Enter>
          </div>
        ))}
      </div>

      {FEATURES.map((feat, i) => (
        <div key={feat.title} style={{ position: "absolute", left: feat.at[0], top: feat.at[1] }}>
          <Enter at={104 + i * 16} x={i < 2 ? -50 : 50} y={0} scale={0.92}>
            <Card style={{ width: 340, padding: "24px 26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 16, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <feat.icon size={28} color="#fff" strokeWidth={1.9} />
                </div>
                <span style={{ fontSize: 30, fontWeight: 600, color: C.ink }}>{feat.title}</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 21, lineHeight: 1.4, color: C.sub }}>{feat.body}</div>
            </Card>
          </Enter>
        </div>
      ))}
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 7. Who it is for: the six kinds of property, as on the site.

const SEGMENTS = [
  { label: "Homes & Villas", blurb: "Solar, battery backup and EV charging", img: "home.jpg" },
  { label: "Apartments & RWAs", blurb: "Common areas, backup and shared charging", img: "apartment.jpg" },
  { label: "Commercial & Workspaces", blurb: "Offices, hospitals, retail and hotels", img: "commercial.jpg" },
  { label: "Factory & Industrial", blurb: "Solar, storage and monitoring for plants", img: "factory.jpg" },
  { label: "EV Fleets & Charging", blurb: "Charging sites and the software to run them", img: "ev-fleet.jpg" },
  { label: "IT Parks & Campuses", blurb: "One connected view across a campus", img: "it-park.jpg" },
];

export const Segments: React.FC = () => {
  const f = useCurrentFrame();
  const slide = interpolate(f, [0, D.segments], [0, 1], clampBoth);
  return (
    <Scene dur={D.segments}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Words text="From homes to campuses," at={2} stagger={4} size={88} weight={700} />
        <Words text="built around the site." at={20} stagger={4} size={88} weight={700} accent={[0, 1, 2, 3]} />
      </div>
      <AbsoluteFill style={{ perspective: 2000, top: 60 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 400,
            display: "flex",
            gap: 44,
            transformOrigin: "960px 250px",
            transform: `rotateX(9deg) rotateY(-15deg) rotateZ(2.5deg) translateX(${lerp(380, -1480, slide)}px)`,
          }}
        >
          {SEGMENTS.map((s, i) => (
            <Enter key={s.label} at={16 + i * 5} y={90} scale={0.9} dur={22}>
              <Card style={{ width: 470, borderRadius: 32, overflow: "hidden", boxShadow: SHADOW }}>
                <Img src={staticFile(`images/segments/${s.img}`)} style={{ width: 470, height: 330, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "22px 26px 26px" }}>
                  <div style={{ fontSize: 30, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{s.label}</div>
                  <div style={{ marginTop: 6, fontSize: 21, lineHeight: 1.35, color: C.sub, height: 58 }}>{s.blurb}</div>
                </div>
              </Card>
            </Enter>
          ))}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// 8. The close.

export const End: React.FC = () => {
  const f = useCurrentFrame();
  const leave = p(f, 62, 14, inOut);
  return (
    <Scene dur={D.end} exit={16}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - leave, transform: `scale(${1 + leave * 0.04})`, filter: leave > 0 ? `blur(${leave * 12}px)` : undefined }}>
        <Words text="Build it. Charge it. Manage it." at={4} stagger={5} size={124} weight={700} accent={[4, 5]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingBottom: 40 }}>
        <LogoWipe at={74} width={800} />
        <Enter at={104} y={24} style={{ marginTop: 64 }}>
          <div style={{ padding: "18px 40px", borderRadius: 999, background: C.ink, color: "#fff", fontSize: 30, fontWeight: 500, letterSpacing: 0.3, boxShadow: "0 18px 40px -16px rgba(22,163,74,0.55)" }}>waytaraenergy.com</div>
        </Enter>
      </AbsoluteFill>
    </Scene>
  );
};
