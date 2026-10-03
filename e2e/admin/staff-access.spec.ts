import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, ADMIN_URL } from "../support/accounts";

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("admin app access control", () => {
  test("anonymous visitors are sent to the login page for any protected path", async ({ page }) => {
    for (const path of ["/dashboard", "/employees", "/leads", "/audit", "/some/brand-new-route"]) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("static assets used by the login page stay reachable while logged out", async ({ request }) => {
    // Regression: the secure-by-default proxy once also gated /images/*, which
    // broke the login page's hero image for every logged-out visitor.
    for (const path of ["/images/login-light.webp", "/images/login-dark.webp", "/icon.png"]) {
      const res = await request.get(`${ADMIN_URL}${path}`, { maxRedirects: 0 });
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toMatch(/^image\//);
    }
  });

  test("the staff-only quotation PDF route is protected like everything else", async ({ request }) => {
    const res = await request.get(`${ADMIN_URL}/quotations/00000000-0000-4000-8000-000000000000/pdf`, { maxRedirects: 0 });
    // Redirect to login (proxy) — never a 200 and never a PDF.
    expect([302, 307, 401]).toContain(res.status());
  });

  test("a customer account is refused by the admin app", async ({ page }) => {
    await signIn(page, ACCOUNTS.customer.email, ACCOUNTS.customer.password);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/staff accounts only/i)).toBeVisible();
  });

  test("an admin can sign in and open the Employees page", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto(`${ADMIN_URL}/employees`);
    await expect(page).toHaveURL(/\/employees/);
    await expect(page.getByText(/application error/i)).toHaveCount(0);
  });

  test("an employee (non-admin) is blocked from admin-only pages", async ({ page }) => {
    await signIn(page, ACCOUNTS.employee.email, ACCOUNTS.employee.password);
    await expect(page).toHaveURL(/\/dashboard/);
    for (const path of ["/employees", "/devices", "/plans", "/audit"]) {
      await page.goto(`${ADMIN_URL}${path}`);
      await expect(page, path).toHaveURL(/\/unauthorized/);
    }
  });

  test("a quotation id that does not exist returns 404 to a signed-in admin", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);
    const res = await page.request.get(`${ADMIN_URL}/quotations/00000000-0000-4000-8000-000000000000/pdf`, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });
});
