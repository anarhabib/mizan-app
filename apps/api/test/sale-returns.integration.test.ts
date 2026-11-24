import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createDatabase } from "@mizan/database";
import type {
  SaleResult,
  SaleReturnInput,
  SaleReturnQuote,
} from "@mizan/contracts";
import type { FastifyInstance, HTTPMethods } from "fastify";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
const bakuDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Baku" });

describe.skipIf(!db)("sale returns", () => {
  let app: FastifyInstance;
  let scope: { organizationId: string; storeId: string };
  let otherStore: string;
  let customerId: string;
  let day: string;
  let yesterday: string;
  const owner = randomUUID();
  const staff = randomUUID();
  const outsider = randomUUID();
  const identities = new Set<string>([owner, staff, outsider]);

  beforeAll(async () => {
    app = await buildApp({
      access: {
        db: db!,
        verifyToken: async (userId) =>
          identities.has(userId) ? { userId } : null,
      },
      onboardingDb: db,
      salesDb: db,
      products: { db: db! },
    });
    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding",
      headers: { authorization: `Bearer ${owner}` },
      payload: {
        fullName: "Returns owner",
        organizationName: "Returns",
        storeName: "Main store",
        defaultCurrency: "AZN",
      },
    });
    expect(setup.statusCode, setup.body).toBe(200);
    const { organizationId, storeId } = setup.json();
    scope = { organizationId, storeId };
    day = bakuDay.format(new Date());
    yesterday = bakuDay.format(new Date(Date.now() - 86_400_000));
    otherStore = (
      await db!.store.create({ data: { organizationId, name: "Other store" } })
    ).id;
    await db!.storeAssignment.create({
      data: { organizationId, storeId: otherStore, userId: owner },
    });
    await db!.user.create({ data: { id: staff } });
    await db!.organizationMembership.create({
      data: { organizationId, userId: staff, role: "SALESPERSON" },
    });
    await db!.storeAssignment.create({ data: { ...scope, userId: staff } });
    customerId = (
      await db!.customer.create({
        data: {
          ...scope,
          name: "Return customer",
          phone: "0501234567",
          phoneDigits: "0501234567",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  function send(
    method: HTTPMethods,
    path: string,
    payload?: object,
    options: {
      key?: string;
      auth?: string;
      storeId?: string;
      confirmation?: string;
      query?: string;
    } = {},
  ) {
    const query = new URLSearchParams({
      ...scope,
      storeId: options.storeId ?? scope.storeId,
    });
    return app.inject({
      method,
      url: `/api/v1${path}?${query}${options.query ?? ""}`,
      headers: {
        authorization: `Bearer ${options.auth ?? owner}`,
        "idempotency-key": options.key ?? randomUUID(),
        ...(options.confirmation && {
          "sale-confirmation": options.confirmation,
        }),
      },
      payload,
    });
  }

  function product(code: string) {
    return db!.product.create({
      data: {
        ...scope,
        name: code,
        code,
        category: "Ring",
        purity: 585,
        weight: "2",
        acquisitionCost: "20",
        acquisitionCurrency: "AZN",
        movements: { create: { actorId: owner, kind: "PRODUCT_ADDED" } },
      },
    });
  }

  async function checkout(input: object) {
    const key = randomUUID();
    let response = await send("POST", "/sales", input, { key });
    if (response.statusCode === 409 && response.json().confirmation)
      response = await send("POST", "/sales", input, {
        key,
        confirmation: response.json().confirmation.token,
      });
    expect(response.statusCode, response.body).toBe(201);
    return response.json<SaleResult>();
  }

  function selection(
    ids: string[],
    resellable = true,
    returnDate = day,
  ): SaleReturnInput {
    return {
      items: ids.map((productId) => ({ productId, resellable })),
      reason: "Returned by customer",
      returnDate,
    };
  }

  async function quote(saleId: string, input: SaleReturnInput) {
    const response = await send(
      "POST",
      `/sales/${saleId}/returns/preview`,
      input,
    );
    expect(response.statusCode, response.body).toBe(200);
    return response.json<SaleReturnQuote>();
  }

  async function receipt(id: string, auth?: string) {
    const response = await send("GET", `/sales/${id}`, undefined, { auth });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<SaleResult>();
  }

  test("returns paid legacy inventory once, applies separate dated partial refunds and resells the original product", async () => {
    const item = await product("Paid legacy");
    const sale = await checkout({ productId: item.id, saleAmount: "100" });
    const saleWhere = { ...scope, id: sale.id };
    await db!.saleItem.deleteMany({ where: { ...scope, saleId: sale.id } });
    await db!.sale.updateMany({
      where: saleWhere,
      data: { createdAt: new Date(`${yesterday}T01:00:00Z`) },
    });
    await db!.salePayment.updateMany({
      where: { ...scope, saleId: sale.id },
      data: { createdAt: new Date(`${yesterday}T01:00:00Z`) },
    });
    const input = selection([item.id], true, yesterday);
    const preview = await quote(sale.id, input);
    expect(preview).toMatchObject({
      collected: "100",
      debtCanceled: "0",
      refundableValue: "100",
    });
    const returnUrl = `/sales/${sale.id}/returns`;
    expect((await send("POST", returnUrl, input)).statusCode).toBe(409);
    expect(
      (await send("POST", returnUrl, input, { storeId: otherStore }))
        .statusCode,
    ).toBe(404);
    expect(
      (await send("POST", returnUrl, input, { auth: outsider })).statusCode,
    ).toBe(403);
    const payload = { ...input, confirmation: preview.confirmation };
    const key = randomUUID();
    const competingKey = randomUUID();
    const submissions = await Promise.all([
      send("POST", returnUrl, payload, { key }),
      send("POST", returnUrl, payload, { key: competingKey }),
    ]);
    expect(submissions.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    const accepted = submissions.find(({ statusCode }) => statusCode === 201)!;
    expect(
      (
        await send("POST", returnUrl, payload, {
          key: submissions[0].statusCode === 201 ? key : competingKey,
        })
      ).json(),
    ).toEqual(accepted.json());
    const refundUrl = returnUrl + `/${accepted.json().id}/refunds`;
    const refund = { amount: "30", method: "CARD", refundDate: day };
    const refundKey = randomUUID();
    const paid = await send("POST", refundUrl, refund, { key: refundKey });
    expect(paid.statusCode, paid.body).toBe(201);
    expect(
      (await send("POST", refundUrl, refund, { key: refundKey })).json(),
    ).toEqual(paid.json());
    expect(
      (await send("POST", refundUrl, { ...refund, amount: "71" })).json().code,
    ).toBe("REFUND_EXCEEDS_BALANCE");
    const later = await send("POST", refundUrl, {
      ...refund,
      amount: "70",
      method: "TRANSFER",
    });
    expect(later.statusCode, later.body).toBe(201);
    const resale = await checkout({ productId: item.id, saleAmount: "130" });
    expect(resale.id).not.toBe(sale.id);
    expect(resale.profit?.acquisitionCost?.amount).toBe("20");
    expect(await receipt(sale.id)).toMatchObject({
      returnStatus: "RETURNED",
      saleAmount: "100",
      netSaleAmount: "0",
      paidAmount: "100",
      netPaidAmount: "0",
      netGrossProfit: "0",
      returns: [
        {
          remainingRefundable: "0",
          refunds: expect.arrayContaining([
            expect.objectContaining({ amount: "30", method: "CARD" }),
            expect.objectContaining({ amount: "70", method: "TRANSFER" }),
          ]),
        },
      ],
    });
    const restricted = await receipt(sale.id, staff);
    expect(restricted.profit).toBeUndefined();
    expect(restricted.netGrossProfit).toBeUndefined();
    const inventory = await send("GET", `/products/${item.id}`);
    expect(
      inventory.json().movements.map(({ kind }: { kind: string }) => kind),
    ).toEqual([
      "PRODUCT_ADDED",
      "PRODUCT_SOLD",
      "PRODUCT_RETURNED",
      "PRODUCT_SOLD",
    ]);
    expect(inventory.json().sale.id).toBe(resale.id);
    expect(
      (
        await send("GET", "/sales/overview", undefined, {
          query: `&dateFrom=${yesterday}&dateTo=${yesterday}`,
        })
      ).json(),
    ).toMatchObject({
      salesAmount: [{ amount: "100" }],
      returnedValue: [{ amount: "100" }],
      netSales: [{ amount: "0" }],
      amountReceived: [{ amount: "100" }],
      refunds: [{ amount: "100" }],
      netReceived: [{ amount: "0" }],
    });
    const dashboard = await send(
      "GET",
      `/organizations/${scope.organizationId}/stores/${scope.storeId}/dashboard`,
    );
    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json()).toMatchObject({
      returnedSales: [],
      payments: { refunds: [{ amount: "100" }] },
    });
    expect((await send("POST", returnUrl, payload)).statusCode).toBe(409);
  });

  test("cancels an unpaid balance without a refund and restores damaged inventory only after repair", async () => {
    const item = await product("Unpaid");
    const sale = await checkout({
      productId: item.id,
      saleAmount: "100",
      customerId,
      recordDebt: true,
    });
    const input = selection([item.id], false);
    const preview = await quote(sale.id, input);
    expect(preview).toMatchObject({
      debtCanceled: "100",
      refundLimit: "0",
      remainingDebt: "0",
    });
    const recorded = await send(
      "POST",
      `/sales/${sale.id}/returns`,
      { ...input, confirmation: preview.confirmation },
      { auth: staff },
    );
    expect(recorded.statusCode, recorded.body).toBe(409); // The quote belongs to the operator who reviewed it.
    const saved = await send("POST", `/sales/${sale.id}/returns`, {
      ...input,
      confirmation: preview.confirmation,
    });
    expect(saved.statusCode, saved.body).toBe(201);
    expect(await receipt(sale.id)).toMatchObject({
      outstandingDebt: "0",
      paidAmount: "0",
      returns: [{ refunds: [] }],
    });
    expect(
      (await send("POST", "/sales", { productId: item.id, saleAmount: "100" }))
        .statusCode,
    ).toBe(409);
    const base = `/organizations/${scope.organizationId}/stores/${scope.storeId}/products/${item.id}/repairs`;
    const sendRepair = () =>
      send("POST", base, {
        action: "send",
        repairerName: "Repairer",
        description: "Repair damage",
        sentDate: day,
      });
    const repair = await sendRepair();
    expect(repair.statusCode, repair.body).toBe(201);
    expect(
      (await send("POST", "/sales", { productId: item.id, saleAmount: "100" }))
        .statusCode,
    ).toBe(409);
    expect(
      (
        await send("POST", base, {
          action: "cancel",
          repairId: repair.json().id,
        })
      ).statusCode,
    ).toBe(200);
    expect((await send("GET", `/products/${item.id}`)).json().status).toBe(
      "UNAVAILABLE",
    );
    const repairAgain = await sendRepair();
    const complete = await send("POST", base, {
      action: "complete",
      repairId: repairAgain.json().id,
      completedDate: day,
      weight: "2",
      netGoldWeight: "2",
      gemstones: [],
      actualCost: { amount: "0", currency: "AZN" },
    });
    expect(complete.statusCode, complete.body).toBe(200);
    expect((await send("GET", `/products/${item.id}`)).json().status).toBe(
      "IN_STOCK",
    );
  });

  test("requires explicit partial allocation, rejects a stale review after repayment and caps mixed-currency refunds", async () => {
    const [first, second] = await Promise.all([
      product("Partial one"),
      product("Partial two"),
    ]);
    const sale = await checkout({
      items: [
        { productId: first.id, saleAmount: "400" },
        { productId: second.id, saleAmount: "600" },
      ],
      customerId,
      payments: [
        { currency: "AZN", amount: "230", method: "CASH" },
        { currency: "USD", amount: "100", exchangeRate: "1.7", method: "CARD" },
      ],
    });
    const input = selection([first.id]);
    expect(await quote(sale.id, input)).toMatchObject({
      minDebtCanceled: "0",
      maxDebtCanceled: "400",
      debtCanceled: null,
    });
    const explicit = { ...input, debtCanceled: "300" };
    const previous = await quote(sale.id, explicit);
    const paid = await send("POST", `/sales/${sale.id}/payments`, {
      currency: "AZN",
      amount: "50",
      method: "TRANSFER",
    });
    expect(paid.statusCode, paid.body).toBe(201);
    const path = `/sales/${sale.id}/returns`;
    expect(
      (
        await send("POST", path, {
          ...explicit,
          confirmation: previous.confirmation,
        })
      ).statusCode,
    ).toBe(409);
    const withRefund = {
      ...explicit,
      refund: { amount: "100", method: "CARD" as const, refundDate: day },
    };
    let current = await quote(sale.id, withRefund);
    const partial = await send("POST", path, {
      ...withRefund,
      confirmation: current.confirmation,
    });
    expect(partial.statusCode, partial.body).toBe(201);
    expect(await receipt(sale.id)).toMatchObject({
      returnStatus: "PARTIALLY_RETURNED",
      outstandingDebt: "250",
      netPaidAmount: "350",
      netGrossProfit: "580",
    });
    const final = selection([second.id]);
    current = await quote(sale.id, final);
    expect(current).toMatchObject({
      debtCanceled: "250",
      refundableValue: "350",
      refundLimit: "180",
    });
    const closed = await send("POST", path, {
      ...final,
      confirmation: current.confirmation,
    });
    expect(closed.statusCode, closed.body).toBe(201);
    const refundPath = path + `/${closed.json().id}/refunds`;
    const refund = { refundDate: day, method: "TRANSFER", amount: "110" };
    const competing = await Promise.all([
      send("POST", refundPath, refund),
      send("POST", refundPath, refund),
    ]);
    expect(competing.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    expect(await receipt(sale.id)).toMatchObject({
      returnStatus: "RETURNED",
      paidAmount: "450",
      netPaidAmount: "240",
      outstandingDebt: "0",
    });
  });

  test("fully returns a partially paid receipt and reports the reversal and customer balances independently", async () => {
    const item = await product("Partially paid");
    const sale = await checkout({
      productId: item.id,
      saleAmount: "1000",
      customerId,
      payments: [{ currency: "AZN", amount: "400", method: "CARD" }],
    });
    const input = {
      ...selection([item.id]),
      refund: { amount: "400", method: "CARD" as const, refundDate: day },
    };
    const preview = await quote(sale.id, input);
    expect(preview).toMatchObject({
      returnedValue: "1000",
      debtCanceled: "600",
      refundableValue: "400",
      remainingRefundable: "0",
    });
    const response = await send("POST", `/sales/${sale.id}/returns`, {
      ...input,
      confirmation: preview.confirmation,
    });
    expect(response.statusCode, response.body).toBe(201);
    const base = `/organizations/${scope.organizationId}/stores/${scope.storeId}`;
    const history = await send(
      "GET",
      `${base}/customers/${customerId}/purchases`,
    );
    expect(history.statusCode, history.body).toBe(200);
    expect(history.json().items).toContainEqual(
      expect.objectContaining({
        id: sale.id,
        returnStatus: "RETURNED",
        outstandingDebt: { amount: "0", currency: "AZN" },
        paidAmount: { amount: "400", currency: "AZN" },
        netPaidAmount: { amount: "0", currency: "AZN" },
      }),
    );
    const summary = await send("GET", `${base}/dashboard/owner`);
    expect(summary.statusCode, summary.body).toBe(200);
    expect(summary.json().netGrossProfit).toBeDefined();
    expect(
      (await send("GET", `${base}/dashboard/owner`, undefined, { auth: staff }))
        .statusCode,
    ).toBe(403);
  });

  test("retains trade-in receipts and never refunds tender given back as change", async () => {
    const legacy = await product("Tender and change");
    const sale = await checkout({
      productId: legacy.id,
      saleAmount: "100",
      payment: { currency: "AZN", amount: "200" },
    });
    expect(await quote(sale.id, selection([legacy.id]))).toMatchObject({
      collected: "100",
      refundLimit: "100",
    });
    const [first, second] = await Promise.all([
      product("Trade-in one"),
      product("Trade-in two"),
    ]);
    const rate = await db!.storeGoldPriceRule.create({
      data: {
        ...scope,
        actorId: owner,
        kind: "SCRAP_BUY",
        mode: "FIXED",
        purity: 585,
        value: "50",
      },
    });
    const traded = await checkout({
      items: [
        { productId: first.id, saleAmount: "50" },
        { productId: second.id, saleAmount: "100" },
      ],
      tradeIns: [{ purity: 585, rateId: rate.id, weight: "1" }],
    });
    const full = await send(
      "POST",
      `/sales/${traded.id}/returns/preview`,
      selection([first.id, second.id]),
    );
    expect(full.json().code).toBe("RETURN_TRADE_IN");
    const partial = selection([first.id]);
    const preview = await quote(traded.id, partial);
    const saved = await send("POST", `/sales/${traded.id}/returns`, {
      ...partial,
      confirmation: preview.confirmation,
    });
    expect(saved.statusCode, saved.body).toBe(201);
    expect(await receipt(traded.id)).toMatchObject({
      tradeInTotal: "50",
      returnStatus: "PARTIALLY_RETURNED",
    });
  });

  test("returns the original set items across membership changes and rejects missing multi-item snapshots", async () => {
    const [first, second] = await Promise.all([
      product("Set one"),
      product("Set two"),
    ]);
    const set = await db!.jewelrySet.create({
      data: {
        ...scope,
        name: "Original set",
        members: {
          create: [{ productId: first.id }, { productId: second.id }],
        },
      },
    });
    const sale = await checkout({
      items: [
        { productId: first.id, saleAmount: "50" },
        { productId: second.id, saleAmount: "70" },
      ],
      jewelrySet: { id: set.id, revision: 1, mode: "complete" },
    });
    const setPath = `/organizations/${scope.organizationId}/stores/${scope.storeId}/jewelry-sets/${set.id}`;
    const firstReturn = selection([first.id]);
    const preview = await quote(sale.id, firstReturn);
    const path = `/sales/${sale.id}/returns`;
    expect(
      (
        await send("POST", path, {
          ...firstReturn,
          confirmation: preview.confirmation,
        })
      ).statusCode,
    ).toBe(201);
    const active = await send("GET", setPath);
    expect(active.statusCode, active.body).toBe(200);
    expect(active.json()).toMatchObject({ totals: { unavailableCount: 1 } });
    await db!.jewelrySet.deleteMany({ where: { ...scope, id: set.id } });
    const secondReturn = selection([second.id]);
    const final = await quote(sale.id, secondReturn);
    expect(
      (
        await send("POST", path, {
          ...secondReturn,
          confirmation: final.confirmation,
        })
      ).statusCode,
    ).toBe(201);
    expect(await receipt(sale.id)).toMatchObject({
      jewelrySet: { id: set.id, name: set.name },
      returnStatus: "RETURNED",
    });
    const replacement = await db!.jewelrySet.create({
      data: {
        ...scope,
        name: "Replacement set",
        members: {
          create: [{ productId: first.id }, { productId: second.id }],
        },
      },
    });
    const replacementSale = await checkout({
      items: [
        { productId: first.id, saleAmount: "50" },
        { productId: second.id, saleAmount: "70" },
      ],
      jewelrySet: { id: replacement.id, revision: 1, mode: "complete" },
    });
    const full = selection([first.id, second.id]);
    const fullQuote = await quote(replacementSale.id, full);
    const entireSet = await send(
      "POST",
      `/sales/${replacementSale.id}/returns`,
      {
        ...full,
        confirmation: fullQuote.confirmation,
      },
    );
    expect(entireSet.statusCode, entireSet.body).toBe(201);
    const currentSet = await send(
      "GET",
      `/organizations/${scope.organizationId}/stores/${scope.storeId}/jewelry-sets/${replacement.id}`,
    );
    expect(currentSet.json()).toMatchObject({
      totals: { unavailableCount: 0 },
    });
    const next = await checkout({
      items: [
        { productId: first.id, saleAmount: "50" },
        { productId: second.id, saleAmount: "70" },
      ],
    });
    await db!.saleItem.deleteMany({ where: { ...scope, saleId: next.id } });
    expect(
      (await send("POST", `/sales/${next.id}/returns/preview`, firstReturn))
        .statusCode,
    ).toBe(409);
  });

  test("serializes return with checkout of the same product", async () => {
    const item = await product("Concurrent resale");
    const input = { productId: item.id, saleAmount: "100" };
    const sold = await checkout(input);
    const returnInput = selection([item.id]);
    const preview = await quote(sold.id, returnInput);
    const [returned, resale] = await Promise.all([
      send("POST", `/sales/${sold.id}/returns`, {
        ...returnInput,
        confirmation: preview.confirmation,
      }),
      send("POST", "/sales", input),
    ]);
    expect(returned.statusCode, returned.body).toBe(201);
    expect([201, 409]).toContain(resale.statusCode);
    const soldItems = await db!.saleItem.count({
      where: { ...scope, productId: item.id },
    });
    expect(soldItems).toBe(resale.statusCode === 201 ? 2 : 1);
    const current = (await send("GET", `/products/${item.id}`)).json();
    expect(current.status).toBe(
      resale.statusCode === 201 ? "SOLD" : "IN_STOCK",
    );
    expect(current.movements.map(({ kind }: { kind: string }) => kind)).toEqual(
      [
        "PRODUCT_ADDED",
        "PRODUCT_SOLD",
        "PRODUCT_RETURNED",
        ...(resale.statusCode === 201 ? ["PRODUCT_SOLD"] : []),
      ],
    );
  });
});
