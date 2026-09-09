import { Poppins } from "next/font/google";

// Scoped to the auth flow only (login, invite, forgot/reset password) —
// matches apps/web's brand font on its equivalent pages, without changing
// the font for the rest of the admin dashboard (still Inter, set in the
// root layout).
const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.className}>{children}</div>;
}
