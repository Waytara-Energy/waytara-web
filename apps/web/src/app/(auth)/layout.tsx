import { NO_INDEX } from "@/lib/seo";

// Sign-in, password reset, invite and quote-response pages are per-user or
// one-time-link pages — keep every one of them out of search results.
export const metadata = NO_INDEX;

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
