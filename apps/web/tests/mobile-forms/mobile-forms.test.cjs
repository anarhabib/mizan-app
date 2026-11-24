/* eslint @typescript-eslint/no-require-imports: "off" -- Node loads the local Playwright installation through NODE_PATH. */
/* global require, process, URL, URLSearchParams, document, getComputedStyle, scrollY, window, Event */
const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { chromium } = require("playwright");

const origin = process.env.MIZAN_FORM_TEST_ORIGIN ?? "http://127.0.0.1:5191";
let browser;
before(async () => {
  browser = await chromium.launch(
    process.env.MIZAN_FORM_BROWSER_CHANNEL
      ? { channel: process.env.MIZAN_FORM_BROWSER_CHANNEL }
      : undefined,
  );
});
after(async () => browser?.close());

async function openFixture(width, run, search = "") {
  const mobile = width < 1024;
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: "reduce",
  });
  try {
    const repair = new URLSearchParams(search).has("repair");
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.route("**/api/v1/**", (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith("/suppliers")) return route.abort();
      return route.fulfill({
        json: {
          items:
            url.searchParams.get("q") === "Atlas"
              ? [
                  {
                    id: "00000000-0000-4000-8000-000000000002",
                    name: "Atlas Gold",
                  },
                ]
              : [],
        },
      });
    });
    await page.goto(new URL(`/tests/mobile-forms/${search}`, origin).href, {
      timeout: 15000,
    });
    const opener = page.getByRole("button", {
      name: repair ? "Open repair" : "Open intake",
    });
    await opener.click();
    const dialog = page.getByRole("dialog", {
      name: repair ? "Repair form" : "Intake",
    });
    await dialog.waitFor();
    await run({ page, dialog, opener, mobile });
  } finally {
    await context.close();
  }
}

for (const width of [320, 390, 1280]) {
  test(`return review, refund and retry at ${width}px`, async () => {
    const mobile = width < 1024;
    const page = await browser.newPage({
      viewport: { width, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
      reducedMotion: "reduce",
    });
    try {
      page.setDefaultTimeout(7000);
      const writes = [];
      await page.route("**/api/v1/sales/*/returns**", async (route) => {
        const request = route.request();
        const input = request.postDataJSON();
        if (new URL(request.url()).pathname.endsWith("/preview")) {
          const allocated = input.debtCanceled === "300";
          return route.fulfill({
            json: {
              currency: "AZN",
              returnedValue: "400",
              collected: "400",
              minDebtCanceled: "0",
              maxDebtCanceled: "400",
              debtCanceled: allocated ? "300" : null,
              remainingDebt: allocated ? "300" : null,
              refundableValue: allocated ? "100" : null,
              refundAmount: input.refund?.amount ?? "0",
              refundLimit: allocated ? "100" : null,
              remainingRefundable: allocated
                ? input.refund
                  ? "50"
                  : "100"
                : null,
              remainingProductIds: ["other-ring"],
              confirmation: allocated ? "reviewed" : undefined,
            },
          });
        }
        writes.push({ key: request.headers()["idempotency-key"], input });
        if (writes.length === 1) return route.abort("failed");
        return route.fulfill({ status: 201, json: { id: "saved-return" } });
      });
      await page.goto(
        new URL(
          `/tests/mobile-forms/?return${width === 390 ? "&dark" : ""}`,
          origin,
        ).href,
        { timeout: 20000 },
      );
      const opener = page.getByRole("button", { name: "Open return" });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Return", exact: true });
      await dialog.getByRole("checkbox", { name: /Ring · R1/ }).click();
      await dialog
        .getByRole("checkbox", { name: "Return to available stock" })
        .click();
      const date = dialog.getByLabel("Return date", { exact: true });
      await date.fill("2000-01-01");
      assert.equal(
        await date.evaluate((node) => node.validity.rangeUnderflow),
        true,
      );
      await date.fill(await date.getAttribute("max"));
      await dialog
        .getByLabel("Reason", { exact: true })
        .fill("Customer request");
      await dialog.getByRole("button", { name: "Review", exact: true }).click();
      await dialog.getByLabel("Debt canceled", { exact: true }).fill("300");
      await dialog.getByRole("button", { name: "Review", exact: true }).click();
      await dialog
        .getByRole("button", { name: "Record a refund now", exact: true })
        .click();
      await dialog.getByLabel("Refund amount (AZN)").fill("50");
      await dialog.getByLabel("Payment method").click();
      await page.getByRole("option", { name: "Card", exact: true }).click();
      await dialog.getByRole("button", { name: "Review", exact: true }).click();
      await dialog.getByText("Remaining sale items (1)").waitFor();
      const confirm = dialog.getByRole("button", {
        name: "Confirm",
        exact: true,
      });
      const action = await confirm.boundingBox();
      assert.ok(action && action.y + action.height <= 800);
      assert.equal(
        await dialog.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
        true,
      );
      await confirm.click();
      await dialog
        .getByRole("alert")
        .getByText(/result is unknown/i)
        .waitFor();
      await dialog.getByRole("button", { name: "Retry submission" }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.equal(writes.length, 2);
      assert.deepEqual(writes[0], writes[1]);
      assert.match(writes[0].key, /^[a-f0-9-]{36}$/);
      assert.equal(writes[0].input.refund.method, "CARD");
      assert.equal(writes[0].input.items[0].resellable, true);
      assert.equal(
        await opener.evaluate((node) => node === document.activeElement),
        true,
      );
    } finally {
      await page.close();
    }
  });
}

test("a later refund reviews its date and method before submitting", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  try {
    const requests = [];
    await page.route("**/api/v1/sales/*/returns/*/refunds**", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: "recorded-refund" } });
    });
    await page.goto(
      new URL("/tests/mobile-forms/?return=refund", origin).href,
      { timeout: 20000 },
    );
    await page.getByRole("button", { name: "Open return" }).click();
    const dialog = page.getByRole("dialog", { name: "Record refund" });
    const date = dialog.getByLabel("Refund date", { exact: true });
    assert.equal(await date.getAttribute("min"), "2026-01-02");
    await dialog.getByLabel("Refund amount (AZN)").fill("75");
    await dialog.getByRole("button", { name: "Review", exact: true }).click();
    assert.deepEqual(requests, []);
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "CASH");
    assert.equal(requests[0].amount, "75");
  } finally {
    await page.close();
  }
});

for (const [language, title, reason] of [
  ["az", "Qaytar", "Səbəb"],
  ["ru", "Вернуть товар", "Причина"],
]) {
  test(`return form is localized in ${language}`, async () => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 800 },
    });
    try {
      await page.goto(
        new URL(`/tests/mobile-forms/?return&language=${language}`, origin)
          .href,
        { timeout: 20000 },
      );
      await page.getByRole("button", { name: "Open return" }).click();
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await dialog.getByLabel(reason, { exact: true }).fill("Test");
    } finally {
      await page.close();
    }
  });
}

test("repair dispatch at 320px keeps dates, supplier search and the footer usable", async () => {
  await openFixture(
    320,
    async ({ page, dialog, opener }) => {
      assert.match(
        await dialog.getByText("Before repair", { exact: true }).textContent(),
        /Before repair/,
      );
      const sent = dialog.getByLabel("Date sent");
      const expected = dialog.getByLabel("Expected return (optional)");
      assert.equal(await expected.getAttribute("min"), await sent.inputValue());
      await expected.fill("2000-01-01");
      assert.equal(
        await expected.evaluate((input) => input.validity.rangeUnderflow),
        true,
      );
      await expected.fill("");
      await dialog.getByLabel("Repair description").fill("Check the setting");
      await dialog.getByLabel("Supplier (optional)").click();
      await dialog.getByRole("searchbox").fill("Atlas");
      await dialog
        .getByRole("button", { name: "Atlas Gold", exact: true })
        .click();
      assert.equal(await dialog.getByLabel("Repairer name").count(), 0);
      const submit = dialog.getByRole("button", {
        name: "Send to repair",
        exact: true,
      });
      assert.equal(await submit.getAttribute("form"), "repair");
      await submit.click();
      const saved = JSON.parse(
        await page.getByLabel("Saved command").textContent(),
      );
      assert.equal(saved.action, "send");
      assert.equal(saved.supplierId, "00000000-0000-4000-8000-000000000002");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        await opener.evaluate((node) => node === document.activeElement),
        true,
      );
    },
    "?repair=send",
  );
});

for (const width of [390, 1280]) {
  test(`repair completion at ${width}px validates weights and submits changed gemstones`, async () => {
    await openFixture(
      width,
      async ({ page, dialog, mobile }) => {
        const gross = grossWeight(dialog);
        const net = dialog.getByLabel("Net gold alloy weight (g)", {
          exact: true,
        });
        assert.equal(await gross.inputValue(), "2.001");
        assert.equal(await net.inputValue(), "1.500");
        assert.equal(
          await dialog.getByLabel("Completion date").getAttribute("min"),
          "2026-01-01",
        );
        assert.equal(
          await dialog.getByLabel("Gemstone type").inputValue(),
          "Ruby",
        );
        await gross.fill("1.400");
        await dialog.getByLabel("Actual repair cost").fill("12.3456");
        const submit = dialog.getByRole("button", {
          name: "Complete repair",
          exact: true,
        });
        await submit.click();
        await dialog.getByText(/It must be at most the gross weight/).waitFor();
        assert.equal(
          await net.evaluate((node) => node === document.activeElement),
          true,
        );
        await net.fill("1.300");
        await dialog
          .getByRole("button", { name: "Remove gemstone group 1" })
          .click();
        await dialog
          .getByRole("button", { name: "Add gemstone group" })
          .click();
        await dialog.getByLabel("Gemstone type").fill("Sapphire");
        await dialog.getByLabel("Stone count").fill("1");
        const body = dialog.locator("[data-slot=form-panel-body]");
        assert.equal(
          await body.evaluate((node) => node.scrollWidth <= node.clientWidth),
          true,
        );
        assert.equal(
          await submit.evaluate((node) =>
            Boolean(node.closest("[data-slot=drawer-footer]")),
          ),
          mobile,
        );
        await submit.click();
        const saved = JSON.parse(
          await page.getByLabel("Saved command").textContent(),
        );
        assert.equal(saved.action, "complete");
        assert.deepEqual(saved.gemstones, [
          { gemstoneType: "Sapphire", stoneCount: 1, origin: "UNKNOWN" },
        ]);
        assert.equal(saved.actualCost.amount, "12.3456");
      },
      "?repair=complete&dark",
    );
  });
}

const grossWeight = (row) =>
  row.getByLabel("Gross weight (g)", { exact: true });
const netWeight = (row) =>
  row.getByLabel("Net gold alloy weight (g, optional)");

for (const width of [320, 390, 1280]) {
  test(`registration weight and acquisition preview at ${width}px`, async () => {
    await openFixture(
      width,
      async ({ dialog }) => {
        const first = dialog.getByRole("group", { name: "First product" });
        const summary = first.getByRole("status", {
          name: "Total acquisition cost",
        });
        assert.equal(await summary.textContent(), "—");
        await grossWeight(first).fill("2.001");
        assert.equal(await netWeight(first).inputValue(), "2.001");
        await grossWeight(first).fill("3.002");
        assert.equal(await netWeight(first).inputValue(), "3.002");
        await netWeight(first).fill("1.250");
        await grossWeight(first).fill("4.003");
        assert.equal(await netWeight(first).inputValue(), "1.250");
        await netWeight(first).fill("");
        await grossWeight(first).fill("5.004");
        assert.equal(await netWeight(first).inputValue(), "");
        await first.getByRole("button", { name: "Use gross weight" }).click();
        assert.equal(await netWeight(first).inputValue(), "5.004");
        await grossWeight(first).fill("6.005");
        assert.equal(await netWeight(first).inputValue(), "6.005");
        await first
          .getByLabel("Acquisition cost per gram", { exact: true })
          .fill("2");
        assert.match(await summary.textContent(), /^12\.01\s+AZN$/);
        if (width === 390) {
          const second = dialog.getByRole("group", { name: "Second product" });
          await netWeight(first).fill("1.300");
          await grossWeight(second).fill("7.150");
          assert.equal(await netWeight(second).inputValue(), "7.150");
          await second
            .getByLabel("Acquisition cost per gram", { exact: true })
            .fill("10");
          assert.match(
            await second
              .getByRole("status", { name: "Total acquisition cost" })
              .textContent(),
            /^71\.50\s+USD$/,
          );
          assert.equal(await netWeight(first).inputValue(), "1.300");
        }
      },
      width === 390 ? "?weights=bulk&short" : "?weights=single&short",
    );
  });
}

test("editing saved weight keeps the existing net amount until explicitly edited", async () => {
  await openFixture(
    390,
    async ({ dialog }) => {
      assert.equal(await grossWeight(dialog).inputValue(), "2.001");
      assert.equal(await netWeight(dialog).inputValue(), "1.500");
      await grossWeight(dialog).fill("3.001");
      assert.equal(await netWeight(dialog).inputValue(), "1.500");
      await netWeight(dialog).fill("1.750");
      assert.equal(await netWeight(dialog).inputValue(), "1.750");
    },
    "?weights=edit&short",
  );
});

test("only the mobile form body owns scrolling as row content changes", async () => {
  await openFixture(
    390,
    async ({ page, dialog, opener }) => {
      const body = dialog.locator("[data-slot=form-panel-body]");
      const save = dialog.getByRole("button", { name: "Save intake" });
      await save.click({ trial: true });
      assert.equal(
        await dialog.evaluate((node) => getComputedStyle(node).overflowY),
        "clip",
      );
      assert.equal(
        await body.evaluate(
          (node) => getComputedStyle(node).overscrollBehaviorY,
        ),
        "none",
      );
      const range = () =>
        body.evaluate((node) => node.scrollHeight - node.clientHeight);
      assert.equal(await range(), 0);

      const add = dialog.getByRole("button", { name: "Add row" });
      for (let i = 0; i < 9; i++) await add.click();
      const expandedRange = await range();
      assert.ok(expandedRange > 0);
      await dialog.getByRole("button", { name: "Toggle error" }).click();
      assert.ok((await range()) > expandedRange);

      await body.hover();
      await page.mouse.wheel(0, 4000);
      await page.waitForFunction(() => {
        const node = document.querySelector("[data-slot=form-panel-body]");
        return (
          Math.abs(node.scrollTop - (node.scrollHeight - node.clientHeight)) <=
          1
        );
      });
      const touch = await page.context().newCDPSession(page);
      const bounds = await body.boundingBox();
      const x = Math.round(bounds.x + bounds.width / 2);
      const y = Math.round(bounds.y + bounds.height * 0.8);
      for (let swipe = 0; swipe < 3; swipe++) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let step = 1; step <= 5; step++) {
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - step * 35 }],
          });
        }
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      }
      assert.ok(
        await body.evaluate(
          (node) =>
            Math.abs(
              node.scrollTop - (node.scrollHeight - node.clientHeight),
            ) <= 1,
        ),
      );
      assert.equal(await dialog.evaluate((node) => node.scrollTop), 0);
      assert.equal(await page.evaluate(() => scrollY), 0);
      assert.ok(
        await body.evaluate((node) => {
          const end = node.querySelector("form").getBoundingClientRect().bottom;
          return Math.abs(node.getBoundingClientRect().bottom - end) <= 16;
        }),
      );
      await save.click({ trial: true });
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await opener.click();
      assert.equal(await body.evaluate((node) => node.scrollTop), 0);

      await dialog.getByRole("button", { name: "Toggle fields" }).click();
      assert.ok((await range()) < expandedRange);
      const remove = dialog.getByRole("button", { name: "Remove row" });
      for (let i = 0; i < 9; i++) await remove.click();
      assert.equal(await range(), 0);
      assert.equal(await body.evaluate((node) => node.scrollTop), 0);
    },
    "?short",
  );
});

test("mobile forms without a footer keep inline actions reachable", async () => {
  await openFixture(
    320,
    async ({ dialog }) => {
      const save = dialog.getByRole("button", { name: "Save intake" });
      await dialog.getByLabel("Reference").fill("Inline action");
      await save.click();
      assert.equal(
        await dialog.getByRole("status").textContent(),
        "Submissions: 1",
      );
      assert.equal(await dialog.evaluate((node) => node.scrollTop), 0);
    },
    "?inline",
  );
});

async function assertDateBounds(dialog) {
  for (const name of ["From", "To"]) {
    const input = dialog.getByLabel(name, { exact: true });
    assert.equal(
      await input.evaluate((element) => {
        const field = element.getBoundingClientRect();
        const column = element.parentElement.getBoundingClientRect();
        return (
          field.width > 0 &&
          field.left >= column.left - 1 &&
          field.right <= column.right + 1
        );
      }),
      true,
      `${name} date input must fit its column`,
    );
  }
}

for (const width of [320, 390, 1280]) {
  test(`form panel contracts at ${width}px`, async () => {
    await openFixture(width, async ({ page, dialog, opener, mobile }) => {
      const body = dialog.locator("[data-slot=form-panel-body]");
      const save = dialog.getByRole("button", { name: "Save intake" });
      const reference = dialog.getByLabel("Reference");
      assert.equal(
        await dialog.getAttribute("data-slot"),
        mobile ? "drawer-content" : "sheet-content",
      );
      assert.equal(await save.evaluate((button) => button.form.id), "intake");
      assert.equal(
        await save.evaluate((button) =>
          Boolean(button.closest("[data-slot=form-panel-body]")),
        ),
        !mobile,
      );

      if (mobile) {
        await save.click({ trial: true });
        const beforeScroll = await save.boundingBox();
        await body.hover();
        await page.mouse.wheel(0, 480);
        await page.waitForFunction(
          () =>
            document.querySelector("[data-slot=form-panel-body]").scrollTop > 0,
        );
        assert.deepEqual(await save.boundingBox(), beforeScroll);
        await save.click();
        assert.equal(
          await reference.evaluate((input) => input.validity.valueMissing),
          true,
        );
        assert.equal(
          await dialog.getByRole("status").textContent(),
          "Submissions: 0",
        );
      }
      await reference.fill("Intake reference");
      const picker = dialog.getByRole("button", {
        name: "Supplier",
        exact: true,
      });
      await picker.click();
      const search = dialog.getByRole("searchbox", {
        name: "Search suppliers",
      });
      assert.equal(
        await search.evaluate((input) => document.activeElement === input),
        true,
      );
      await search.press("Escape");
      await search.waitFor({ state: "hidden" });
      assert.equal(
        await picker.evaluate((button) => document.activeElement === button),
        true,
      );
      await picker.click();
      await search.fill("Atlas");
      await search.press("Enter");
      const option = dialog.getByRole("button", {
        name: "Atlas Gold",
        exact: true,
      });
      await option.waitFor();
      if (mobile) {
        await page.evaluate(() => {
          const viewport = window.visualViewport;
          Object.defineProperty(viewport, "height", {
            configurable: true,
            value: 400,
          });
          viewport.dispatchEvent(new Event("resize"));
        });
        await page.waitForFunction(
          () =>
            document
              .querySelector("[data-slot=drawer-content]")
              .getBoundingClientRect().bottom <= 401,
        );
        assert.ok(
          (await save.boundingBox()).y + (await save.boundingBox()).height <=
            401,
        );
        await option.tap();
        await page.evaluate(() => {
          const viewport = window.visualViewport;
          Reflect.deleteProperty(viewport, "height");
          viewport.dispatchEvent(new Event("resize"));
        });
      } else {
        await option.click();
      }
      await search.waitFor({ state: "hidden" });
      assert.match(await picker.textContent(), /Atlas Gold/);
      assert.equal(
        await picker.evaluate((button) => document.activeElement === button),
        true,
      );
      assert.equal(
        await dialog.getByRole("status").textContent(),
        "Submissions: 0",
      );
      await assertDateBounds(dialog);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      await save.click();
      assert.equal(
        await dialog.getByRole("status").textContent(),
        "Submissions: 1",
      );
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await opener.and(page.locator(":focus")).waitFor();
    });
  });
}
