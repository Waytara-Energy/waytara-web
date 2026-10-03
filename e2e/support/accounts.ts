/** Test accounts created by global-setup in the LOCAL Supabase only (see
 *  local-supabase.ts, which refuses any non-local URL). These credentials mean
 *  nothing anywhere else. */
export const ACCOUNTS = {
  customer: {
    id: "c0000000-0000-4000-8000-000000000001",
    email: "e2e.customer@waytara.test",
    password: "E2e-Local-Only-Customer-1",
    role: "customer",
    fullName: "E2E Customer",
  },
  admin: {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "e2e.admin@waytara.test",
    password: "E2e-Local-Only-Admin-1",
    role: "admin",
    fullName: "E2E Admin",
  },
  employee: {
    id: "e0000000-0000-4000-8000-000000000001",
    email: "e2e.employee@waytara.test",
    password: "E2e-Local-Only-Employee-1",
    role: "employee",
    fullName: "E2E Employee",
  },
} as const;

export const WEB_URL = "http://localhost:3200";
export const ADMIN_URL = "http://localhost:3201";
