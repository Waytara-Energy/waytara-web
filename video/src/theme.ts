import { loadFont } from "@remotion/google-fonts/Poppins";

// The site's own font and colours (apps/web: Poppins, the green gradient, the flow colours of the dashboard).
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const FPS = 30;
export const W = 1920;
export const H = 1080;

/** Scene lengths in frames, in the order they play. */
export const D = { hook: 105, logo: 90, connect: 165, monitor: 195, control: 195, optimise: 225, segments: 150, end: 165 } as const;
export const TOTAL = Object.values(D).reduce((a, b) => a + b, 0);

export const C = {
  bg: "#F6FAF7",
  ink: "#0F172A",
  sub: "#475569",
  muted: "#94A3B8",
  line: "#E2E8F0",
  soft: "#F1F5F9",
  card: "#FFFFFF",
  green: "#16A34A",
  emerald: "#10B981",
  mint: "#34D399",
  deep: "#15803D",
  amber: "#F59E0B",
  blue: "#3B82F6",
  sky: "#0EA5E9",
  violet: "#8B5CF6",
} as const;

/** The site's button gradient. */
export const GRAD = "linear-gradient(135deg, #34D399 0%, #16A34A 50%, #15803D 100%)";
/** The gradient of the coloured word in the site's headline. */
export const TEXT_GRAD = "linear-gradient(90deg, #059669 0%, #22C55E 55%, #84CC16 100%)";

export const SHADOW = "0 50px 120px -40px rgba(15,23,42,0.28), 0 18px 40px -18px rgba(22,163,74,0.18)";
export const SHADOW_SM = "0 18px 44px -18px rgba(15,23,42,0.22), 0 4px 12px -4px rgba(15,23,42,0.06)";
