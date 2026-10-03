import { pageMetadata } from "@/lib/seo";

// The contact page is a client component (form state), which cannot export
// metadata itself — a layout can.
export const metadata = pageMetadata({
  title: "Contact WayTara — Speak with a Power Systems Architect",
  description:
    "Rooftop solar sizing, whole-home battery backup or commercial fleet charging: talk to a WayTara engineer. Chennai office, response by phone or email.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
