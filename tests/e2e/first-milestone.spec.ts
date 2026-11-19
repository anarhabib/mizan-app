import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const { Pool } = createRequire(resolve("packages/database/package.json"))("pg");

const password = "Mizan-test-12-Strong!";
const run = randomUUID().slice(0, 8);
const origin = process.env.MIZAN_WEB_ORIGIN ?? "http://127.0.0.1:3000";
const mail = process.env.MIZAN_TEST_MAILPIT_URL ?? "http://127.0.0.1:54324";

test.beforeAll(() => {
  for (const value of [
    origin,
    mail,
    process.env.MIZAN_API_URL,
    process.env.SUPABASE_URL,
    process.env.MIZAN_TEST_DATABASE_URL,
  ]) {
    if (
      !value ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)
    ) {
      throw new Error(
        "Milestone acceptance requires configured loopback-only test services. See docs/LOCAL_SETUP.md.",
      );
    }
  }
});

async function english(page: Page) {
  await page
    .context()
    .addCookies([{ name: "mizan-language", value: "en", url: origin }]);
}

async function credentials(page: Page, email: string, register = false) {
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page
    .getByRole("button", {
      name: register ? "Register" : "Sign in",
      exact: true,
    })
    .click();
}

async function addProduct(page: Page, scope: string, code: string) {
  await page.goto(`/products/new?${scope}`);
  for (const [name, value] of Object.entries({
    code,
    name: "Milestone ring",
    category: "Ring",
    weight: "2.500",
    acquisitionCost: "75.00",
  })) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.locator('[name="purity"]').selectOption("585");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+\?/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function invitation(page: Page, scope: string, email: string) {
  await page.goto(`/settings/users?${scope}`);
  await page.locator('[name="email"]').fill(email);
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Invitation sent");
  let link = "";
  await expect
    .poll(async () => {
      const response = await page.request.get(`${mail}/api/v1/messages`);
      const messages = await response.json();
      for (const message of messages.messages ?? []) {
        if (
          !message.To?.some((to: { Address: string }) => to.Address === email)
        )
          continue;
        const detail = await (
          await page.request.get(`${mail}/api/v1/message/${message.ID}`)
        ).json();
        link =
          (detail.Text ?? "").match(
            /https?:\/\/[^\s]+\/invitations\/[A-Za-z0-9_-]+/,
          )?.[0] ?? "";
        if (link) return true;
      }
      return false;
    })
    .toBe(true);
  return link;
}

test("owner, invited salespeople, inventory, settlements and persisted history", async ({
  page,
  browser,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  const recordHydrationError = (message: string) => {
    if (/hydration|Minified React error #(418|423|425)\b/i.test(message))
      hydrationErrors.push(message);
  };
  page.on("pageerror", (error) => recordHydrationError(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") recordHydrationError(message.text());
  });
  await page.addInitScript(() => {
    const supportedValuesOf = Intl.supportedValuesOf.bind(Intl);
    Intl.supportedValuesOf = (key) =>
      key === "currency"
        ? [...supportedValuesOf(key).filter((code) => code !== "AZN"), "ZZZ"]
        : supportedValuesOf(key);
  });
  const owner = `owner-${run}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("combobox")).toHaveCSS("width", "44px");
  await expect(page.getByRole("combobox").locator("option")).toHaveText([
    "Azərbaycanca",
    "English",
  ]);
  await page.getByRole("combobox").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("combobox")).toHaveValue("en");
  await page.goto("/register");
  await expect(page.locator("header").getByRole("combobox")).toHaveValue("en");
  await credentials(page, owner, true);
  await expect(page.locator('[name="organizationName"]')).toBeVisible();
  await expect(page.locator('select[name="defaultCurrency"]')).toHaveValue(
    "AZN",
  );
  await page.locator('[name="organizationName"]').fill(`Milestone ${run}`);
  await page.locator('[name="storeName"]').fill("Baku acceptance store");
  await page.getByRole("button", { name: "Create store", exact: true }).click();
  await expect(page).toHaveURL(/organizationId=/);
  const scope = new URL(page.url()).searchParams.toString();

  await page.goto(`/settings?${scope}`);
  await expect(
    page.getByRole("main").locator('select[name="language"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[name="salespersonCanViewAcquisitionCost"]'),
  ).toBeVisible();
  await expect(page.getByRole("main").locator("details")).toHaveCount(0);
  await page.locator('[name="salespersonCanViewAcquisitionCost"]').uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("Change saved.");
  const rateForm = page
    .locator("form")
    .filter({ has: page.locator('[name="amountPerGram"]') });
  await expect(rateForm.locator('select[name="currency"]')).toHaveValue("AZN");
  await expect(rateForm.locator('option[value="ZZZ"]')).toHaveCount(0);
  await rateForm.locator('[name="purity"]').selectOption("585");
  await rateForm.locator('[name="amountPerGram"]').fill("100.0000");
  await rateForm.getByRole("button", { name: "Save rate" }).click();
  await expect(rateForm.getByRole("status")).toHaveText("Change saved.");
  await expect(page.getByText(/585 ‰ · 100\.00 AZN$/)).toBeVisible();
  const grade = page.getByRole("listitem").filter({ hasText: "375 ‰" });
  await grade.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(grade.getByText("Inactive", { exact: false })).toBeVisible();
  await expect(rateForm.locator('option[value="375"]')).toHaveCount(0);
  await expect(
    grade.getByRole("button", { name: "Reactivate", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("settings-inactive-grade.png"),
  });
  await page
    .context()
    .addCookies([{ name: "mizan-language", value: "az", url: origin }]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Qızıl əyarları" }),
  ).toBeVisible();
  await grade.getByRole("button", { name: "Aktiv et", exact: true }).click();
  await expect(
    grade.getByRole("button", { name: "Deaktiv et", exact: true }),
  ).toBeVisible();
  await english(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(rateForm.locator('option[value="375"]')).toHaveCount(1);

  const first = await addProduct(page, scope, `R-${run}`);
  await page.reload();
  await expect(page.getByText(`R-${run}`, { exact: true })).toBeVisible();
  const second = await addProduct(page, scope, `T-${run}`);

  // A malformed weight and an existing code must preserve the rejected form.
  await page.goto(`/products/new?${scope}`);
  for (const [name, value] of Object.entries({
    code: `R-${run}`,
    name: "Rejected ring",
    category: "Ring",
    weight: "1.0001",
    acquisitionCost: "75.00",
  })) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.locator('[name="purity"]').selectOption("585");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByText("Check this value.", { exact: true }),
  ).toBeVisible();
  await page.locator('[name="weight"]').fill("1.000");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByText("This product code already exists", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[name="name"]')).toHaveValue("Rejected ring");

  for (const existing of [false, true]) {
    const email = `seller-${existing}-${run}@example.test`;
    const sellerContext = await browser.newContext();
    const seller = await sellerContext.newPage();
    await english(seller);
    if (existing) {
      await seller.goto("/register");
      await credentials(seller, email, true);
      await expect(seller.locator('[name="organizationName"]')).toBeVisible();
    }
    const link = await invitation(page, scope, email);
    await seller.goto(link);
    if (!existing) await credentials(seller, email, true);
    await seller
      .getByRole("button", { name: "Accept invitation", exact: true })
      .click();
    await expect(seller).toHaveURL(/organizationId=/);
    await seller.goto(`/products/${first}?${scope}`);
    await expect(
      seller.getByRole("heading", { name: "Milestone ring" }),
    ).toBeVisible();
    await expect(
      seller.getByText("Acquisition cost", { exact: true }),
    ).toHaveCount(0);
    const language = seller.getByRole("banner").getByRole("combobox");
    await language.selectOption("az");
    await expect(seller.locator("html")).toHaveAttribute("lang", "az");
    await expect(language).toHaveValue("az");
    await language.selectOption("en");
    await expect(seller.locator("html")).toHaveAttribute("lang", "en");
    // Removing the assignment must invalidate this already authenticated session.
    await page.goto(`/settings/users?${scope}`);
    const member = page
      .locator("li")
      .filter({ has: page.getByText(email, { exact: true }) })
      .filter({
        has: page.getByRole("button", { name: "Remove store access" }),
      });
    await member.getByRole("button", { name: "Remove store access" }).click();
    await expect(
      page
        .locator("li")
        .filter({ has: page.getByText(email, { exact: true }) })
        .getByText("No store access.", { exact: true }),
    ).toBeVisible();
    await seller.reload();
    await expect(
      seller.getByText("Could not load products", { exact: true }),
    ).toBeVisible();
    await sellerContext.close();
  }

  // Product lookup and an ordinary cash sale through the normal browser entry point.
  await page.goto(`/sales/new?${scope}`);
  await page
    .getByRole("textbox", { name: "Find an in-stock item" })
    .fill(`R-${run}`);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: `R-${run}` })
    .getByRole("button")
    .click();
  await page.locator("#sale-amount").fill("150.00");
  await page.getByRole("checkbox", { name: "Enter cash tender" }).check();
  await expect(page.locator("#sale-cash-currency")).toHaveValue("AZN");
  await expect(
    page.locator("#sale-cash-currency option").filter({ hasText: /^ZZZ$/ }),
  ).toHaveCount(0);
  await page.locator("#cash-received").fill("150.00");
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Complete sale", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm and complete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+\?/);
  await expect(
    page.getByRole("heading", { name: "Sale recorded" }),
  ).toBeVisible();
  const ordinaryUrl = page.url();
  await expect(page.getByRole("main")).toContainText("150.00 AZN");

  await page.goto(`/sales/new?${scope}&productId=${second}`);
  await page.locator("#sale-amount").fill("100.00");
  await page.getByRole("button", { name: "Add old gold", exact: true }).click();
  await page.locator('input[id$="-weight"]').fill("2.000");
  await page
    .getByRole("button", { name: "Complete sale", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Cash payout");
  await page
    .getByRole("button", { name: "Confirm and complete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sales\/[0-9a-f-]+\?/);
  await expect(page.getByText("Cash payout", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cash payout", { exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("100.00 AZN");
  await expect(page.getByRole("main")).toContainText("200.00 AZN");
  const payoutId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ordinaryId = new URL(ordinaryUrl).pathname.split("/").at(-1)!;
  const db = new Pool({
    connectionString: process.env.MIZAN_TEST_DATABASE_URL!,
  });
  try {
    const ordinary = await db.query(
      'SELECT "currency", "saleAmount", "settlement" FROM mizan."Sale" WHERE id=$1',
      [ordinaryId],
    );
    expect(ordinary.rows).toEqual([
      { currency: "AZN", saleAmount: "150.0000", settlement: "150.0000" },
    ]);
    const payout = await db.query(
      'SELECT "currency", "saleAmount", "acceptedTradeInTotal", "settlement" FROM mizan."Sale" WHERE id=$1',
      [payoutId],
    );
    expect(payout.rows).toEqual([
      {
        currency: "AZN",
        saleAmount: "100.0000",
        acceptedTradeInTotal: "200.000000000000000",
        settlement: "-100.0000",
      },
    ]);
    const trade = await db.query(
      'SELECT "purity", "weight", "appliedRate", "calculatedValue", "acceptedValue", "overridden" FROM mizan."TradeIn" WHERE "saleId"=$1',
      [payoutId],
    );
    expect(trade.rows).toEqual([
      {
        purity: 585,
        weight: "2.000",
        appliedRate: "100.0000",
        calculatedValue: "200.000000000000000",
        acceptedValue: "200.000000000000000",
        overridden: false,
      },
    ]);
  } finally {
    await db.end();
  }

  await page.goto(`/sales/new?${scope}&productId=${first}`);
  await expect(
    page.getByText("This item is no longer available. Select another item.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/sales?${scope}`);
  await expect(
    page.getByRole("row").filter({ hasText: `R-${run}` }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("row").filter({ hasText: `T-${run}` }),
  ).toHaveCount(1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/settings?${scope}`);
    const header = page.getByRole("banner");
    await expect
      .poll(() =>
        page.locator("main h2").evaluateAll(([permissions, , rates]) => {
          const first = permissions.getBoundingClientRect();
          const second = rates.getBoundingClientRect();
          return (
            Math.abs(first.top - second.top) < 1 && first.left < second.left
          );
        }),
      )
      .toBe(width === 1440);
    await expect(
      page.getByRole("heading", { name: "Rate history" }),
    ).toBeVisible();
    const height = width === 320 ? "54px" : "60px";
    await expect(header).toHaveCSS("height", height);
    await expect(header).toHaveCSS(
      "backdrop-filter",
      "blur(12px) saturate(1.75)",
    );
    await expect(header).toHaveCSS(
      "background-color",
      "rgba(251, 253, 251, 0.44)",
    );
    await expect
      .poll(() =>
        page.getByRole("main").evaluate((main) => {
          main.style.minHeight = "200vh";
          window.scrollTo(0, 200);
          return window.scrollY;
        }),
      )
      .toBe(200);
    await expect(header).toHaveCSS("height", height);
    await expect(header).toHaveCSS(
      "background-color",
      "rgba(251, 253, 251, 0.64)",
    );
    if (width === 320) {
      const dock = page.getByRole("navigation", {
        name: "Navigation",
        exact: true,
      });
      await expect(dock).toHaveCSS(
        "background-color",
        "rgba(251, 253, 251, 0.64)",
      );
      await header
        .getByRole("button", { name: "Navigation", exact: true })
        .click();
      const drawer = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
      });
      await expect(drawer).toHaveCSS(
        "backdrop-filter",
        "blur(12px) saturate(1.75)",
      );
      await expect(drawer).toHaveCSS(
        "background-color",
        "rgba(251, 253, 251, 0.64)",
      );
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    }
    await page.screenshot({
      path: testInfo.outputPath(`${width}-header-scrolled.png`),
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveCSS(
      "background-color",
      "rgba(251, 253, 251, 0.44)",
    );
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/products", "/sales", "/sales/new", "/settings"]) {
      await page.goto(`${route}?${scope}`);
      await expect(page.getByRole("main")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${width}-${route.replaceAll("/", "_")}.png`),
        fullPage: true,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/sales?${scope}`);
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  const historySearch = page.getByRole("searchbox", {
    name: "Search by sale reference, product name or code",
  });
  await historySearch.focus();
  await page.keyboard.type(`R-${run}`);
  await expect(historySearch).toHaveValue(`R-${run}`);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("row").filter({ hasText: `R-${run}` }),
  ).toHaveCount(1);
  await page
    .context()
    .addCookies([{ name: "mizan-language", value: "az", url: origin }]);
  await page.goto(`/products?${scope}`);
  await expect(
    page.getByRole("heading", { name: "Məhsullar", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("320-products-az-reduced-motion.png"),
    fullPage: true,
  });
  await page.context().clearCookies();
  await english(page);
  await page.goto("/sign-in");
  await credentials(page, owner);
  await expect(page).toHaveURL(/\/workspace(?:\?|$)/);
  await expect(
    page.getByRole("heading", { name: "Baku acceptance store", exact: true }),
  ).toBeVisible();
  await page.goto(ordinaryUrl);
  await expect(
    page.getByRole("heading", { name: "Sale recorded" }),
  ).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test("expired invitations, duplicate sale submissions and already-sold products", async ({
  request,
}) => {
  const auth = process.env.SUPABASE_URL!;
  const api = process.env.MIZAN_API_URL!;
  const db = new Pool({
    connectionString: process.env.MIZAN_TEST_DATABASE_URL!,
  });
  const email = `negative-${run}@example.test`;
  const signup = await request.post(`${auth}/auth/v1/signup`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
    data: { email, password },
  });
  expect(signup.ok()).toBe(true);
  const session = await signup.json();
  expect(session.access_token).toBeTruthy();
  const headers = { authorization: `Bearer ${session.access_token}` };
  try {
    const setup = await request.post(`${api}/api/v1/onboarding`, {
      headers,
      data: {
        organizationName: `Negative ${run}`,
        storeName: "Negative test store",
        defaultCurrency: "AZN",
      },
    });
    expect(setup.ok()).toBe(true);
    const scope = await setup.json();
    const query = new URLSearchParams({
      organizationId: scope.organizationId,
      storeId: scope.storeId,
    });
    const products = `${api}/api/v1/products?${query}`;
    const product = await request.post(products, {
      headers,
      data: {
        code: `N-${run}`,
        name: "Concurrent ring",
        category: "Ring",
        purity: 585,
        weight: "1.000",
        acquisitionCost: { amount: "25.00", currency: "AZN" },
      },
    });
    expect(product.status()).toBe(201);
    const item = await product.json();
    const sales = `${api}/api/v1/sales?${query}`;
    const key = randomUUID();
    const input = { productId: item.id, saleAmount: "50.00" };
    const results = await Promise.all(
      [0, 1].map(() =>
        request.post(sales, {
          headers: { ...headers, "Idempotency-Key": key },
          data: input,
        }),
      ),
    );
    for (const response of results) expect(response.ok()).toBe(true);
    expect((await results[0].json()).id).toBe((await results[1].json()).id);
    const sold = await request.post(sales, {
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      data: input,
    });
    expect(sold.status()).toBe(409);
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM mizan."Sale" WHERE "productId"=$1',
          [item.id],
        )
      ).rows[0].count,
    ).toBe(1);
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM mizan."InventoryMovement" WHERE "productId"=$1 AND kind=\'PRODUCT_SOLD\'',
          [item.id],
        )
      ).rows[0].count,
    ).toBe(1);

    const expiredEmail = `expired-${run}@example.test`;
    const invitedSignup = await request.post(`${auth}/auth/v1/signup`, {
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
      data: { email: expiredEmail, password },
    });
    expect(invitedSignup.ok()).toBe(true);
    const invitedSession = await invitedSignup.json();
    expect(invitedSession.access_token).toBeTruthy();
    const invite = await request.post(
      `${api}/api/v1/organizations/${scope.organizationId}/invitations`,
      {
        headers,
        data: { email: expiredEmail, storeId: scope.storeId },
      },
    );
    expect(invite.ok()).toBe(true);
    const messages = await (
      await request.get(`${mail}/api/v1/messages`)
    ).json();
    const message = messages.messages.find(
      (entry: { To: { Address: string }[] }) =>
        entry.To.some((to) => to.Address === expiredEmail),
    );
    expect(message).toBeTruthy();
    const detail = await (
      await request.get(`${mail}/api/v1/message/${message.ID}`)
    ).json();
    const token = detail.Text.match(/\/invitations\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    await db.query(
      'UPDATE mizan."Invitation" SET "expiresAt"=$1 WHERE "organizationId"=$2 AND email=$3',
      [new Date(0), scope.organizationId, expiredEmail],
    );
    const expired = await request.post(`${api}/api/v1/invitations/accept`, {
      headers: { authorization: `Bearer ${invitedSession.access_token}` },
      data: { token },
    });
    expect(expired.status()).toBe(409);
    expect(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM mizan."OrganizationMembership" WHERE "organizationId"=$1',
          [scope.organizationId],
        )
      ).rows[0].count,
    ).toBe(1);
  } finally {
    await db.end();
  }
});
