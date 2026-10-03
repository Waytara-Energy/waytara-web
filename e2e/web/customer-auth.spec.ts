import { expect, test } from "@playwright/test";
import { ACCOUNTS, WEB_URL } from "../support/accounts";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto(`${WEB_URL}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("customer app sign-in", () => {
  test("rejects a wrong password and stays on the login page", async ({ page }) => {
    await signIn(page, ACCOUNTS.customer.email, "definitely-not-the-password");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("a customer can sign in and reach the dashboard", async ({ page }) => {
    await signIn(page, ACCOUNTS.customer.email, ACCOUNTS.customer.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/application error|something went wrong/i)).toHaveCount(0);
  });

  test("a staff account is refused by the customer app", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/customer accounts only/i)).toBeVisible();
  });

  test("a signed-in customer keeps a session across a reload", async ({ page }) => {
    await signIn(page, ACCOUNTS.customer.email, ACCOUNTS.customer.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
