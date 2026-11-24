import { randomUUID } from "node:crypto";
import type {
  JewelrySetDetail,
  SaleCreateInput,
  SaleJewelrySetSelection,
  SaleResult,
} from "@mizan/contracts";
import { createDatabase } from "@mizan/database";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
const actors = new Map<string, { userId: string }>();
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  if (!db) return;
  app = await buildApp({
    access: { db, verifyToken: async (token) => actors.get(token) ?? null },
    onboardingDb: db,
    products: { db },
    salesDb: db,
    goldMarketEnabled: false,
  });
});

afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
});

type Scope = { organizationId: string; storeId: string };
const storePath = ({ organizationId, storeId }: Scope) =>
  `/organizations/${organizationId}/stores/${storeId}`;
const actor = () => {
  const userId = randomUUID();
  actors.set(userId, { userId });
  return userId;
};

function send(
  userId: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  payload?: object,
  key = randomUUID(),
  token?: string,
) {
  return app.inject({
    method,
    url: "/api/v1" + path,
    payload,
    headers: {
      authorization: `Bearer ${userId}`,
      "Idempotency-Key": key,
      ...(token && { "Sale-Confirmation": token }),
    },
  });
}

async function read<T>(response: ReturnType<typeof send>, status: number) {
  const result = await response;
  expect(result.statusCode, result.body).toBe(status);
  return result.json<T>();
}

async function onboard(owner: string) {
  const { organizationId, storeId } = await read<Scope>(
    send(owner, "POST", "/onboarding", {
      fullName: "Set sale owner",
      organizationName: "Set sales test",
      storeName: "Main",
      defaultCurrency: "AZN",
    }),
    200,
  );
  return { organizationId, storeId };
}

async function fixture() {
  const owner = actor();
  const scope = await onboard(owner);
  const root = storePath(scope);
  const sets = root + "/jewelry-sets";
  const query = new URLSearchParams(scope);
  const product = (
    code: string,
    acquisitionCost = "30",
    acquisitionCurrency = "AZN",
    location = scope,
  ) =>
    db!.product.create({
      data: {
        ...location,
        code,
        name: code,
        category: "Ring",
        purity: 585,
        weight: "2.5",
        acquisitionCost,
        acquisitionCurrency,
      },
    });
  const createSet = (productIds: string[]) =>
    read<JewelrySetDetail>(
      send(owner, "POST", sets, { name: "Wedding set", productIds }),
      201,
    );
  const preview = (
    jewelrySet: SaleJewelrySetSelection,
    items: NonNullable<SaleCreateInput["items"]>,
    terms: object = {},
  ) =>
    send(owner, "POST", `/sales/preview?${query}`, {
      tradeIns: [],
      ...terms,
      jewelrySet,
      items,
    });
  const sale = (
    payload: SaleCreateInput,
    key?: string,
    token?: string,
    user = owner,
  ) => send(user, "POST", `/sales?${query}`, payload, key, token);
  return { owner, scope, root, sets, query, product, createSet, preview, sale };
}

function selection(
  set: JewelrySetDetail,
  mode: SaleJewelrySetSelection["mode"] = "complete",
) {
  return { id: set.id, revision: set.revision, mode };
}

test.skipIf(!db)(
  "records a complete set once with item profits, split payments, trade-in and repayment",
  async () => {
    const {
      owner,
      scope,
      root,
      sets,
      query,
      product,
      createSet,
      preview,
      sale,
    } = await fixture();
    const ring = await product("Ring", "30");
    const earrings = await product("Earrings", "55");
    const set = await createSet([ring.id, earrings.id]);
    const staff = actor();
    await db!.user.create({ data: { id: staff } });
    await db!.organizationMembership.create({
      data: {
        organizationId: scope.organizationId,
        userId: staff,
        role: "SALESPERSON",
      },
    });
    await db!.storeAssignment.create({ data: { ...scope, userId: staff } });
    const customer = await read<{ id: string }>(
      send(owner, "POST", root + "/customers", {
        name: "Set customer",
        phone: "12345",
      }),
      201,
    );
    const rate = await db!.storeGoldPriceRule.create({
      data: {
        ...scope,
        actorId: owner,
        purity: 585,
        kind: "SCRAP_BUY",
        mode: "FIXED",
        value: "15",
      },
    });
    const payload = {
      jewelrySet: selection(set),
      items: [
        { productId: ring.id, saleAmount: "90" },
        { productId: earrings.id, saleAmount: "110.25" },
      ],
      customerId: customer.id,
      payments: [
        { method: "CASH", currency: "AZN", amount: "40" },
        { method: "CARD", currency: "USD", amount: "20", exchangeRate: "1.7" },
      ],
      tradeIns: [{ purity: 585, weight: "2", rateId: rate.id }],
    } satisfies SaleCreateInput;
    expect(
      await read(preview(payload.jewelrySet, payload.items, payload), 200),
    ).toMatchObject({
      saleAmount: "200.25",
      tradeInTotal: "30",
      paidAmount: "74",
      outstandingDebt: "96.25",
    });

    const key = randomUUID();
    const challenge = await read<{ confirmation: { token: string } }>(
      sale(payload, key, undefined, staff),
      409,
    );
    expect(await db!.sale.count({ where: scope })).toBe(0);
    const receipts = await Promise.all([
      read<SaleResult>(
        sale(payload, key, challenge.confirmation.token, staff),
        201,
      ),
      read<SaleResult>(
        sale(payload, key, challenge.confirmation.token, staff),
        201,
      ),
    ]);
    const [receipt] = receipts;
    expect(receipts[1]).toEqual(receipt);
    const snapshot = { id: set.id, name: set.name };
    expect(receipt).toMatchObject({
      jewelrySet: snapshot,
      saleAmount: "200.25",
      paidAmount: "74",
      outstandingDebt: "96.25",
      paymentStatus: "PARTIALLY_PAID",
      items: [
        { product: { id: ring.id, status: "SOLD" }, saleAmount: "90" },
        { product: { id: earrings.id, status: "SOLD" }, saleAmount: "110.25" },
      ],
    });
    expect(receipt.profit).toBeUndefined();
    expect(receipt.items.every(({ profit }) => profit === undefined)).toBe(
      true,
    );
    const receiptPath = `/sales/${receipt.id}`;
    const receiptDetails = () =>
      read<SaleResult>(send(owner, "GET", `${receiptPath}?${query}`), 200);
    const details = await receiptDetails();
    expect(details.profit).toMatchObject({
      acquisitionCost: { amount: "85", currency: "AZN" },
      grossProfit: "115.25",
    });
    expect(details.items.map(({ profit }) => profit?.grossProfit)).toEqual([
      "60",
      "55.25",
    ]);

    const repaymentKey = randomUUID();
    const repayment = () =>
      send(
        owner,
        "POST",
        `${receiptPath}/payments?${query}`,
        {
          method: "TRANSFER",
          currency: "AZN",
          amount: "96.25",
        },
        repaymentKey,
      );
    expect(await read(repayment(), 201)).toMatchObject({
      outstandingDebt: "0",
      paidAmount: "170.25",
    });
    await read(repayment(), 201);
    expect(await db!.salePayment.count({ where: scope })).toBe(3);
    expect(
      await db!.inventoryMovement.count({
        where: { ...scope, saleId: receipt.id, kind: "PRODUCT_SOLD" },
      }),
    ).toBe(2);
    expect(
      await db!.inventoryMovement.count({
        where: { ...scope, saleId: receipt.id, kind: "OLD_GOLD_RECEIVED" },
      }),
    ).toBe(1);
    expect(await db!.purchase.count({ where: scope })).toBe(0);
    expect(await db!.productRegistration.count({ where: scope })).toBe(0);

    const day = new Date(Date.parse(receipt.createdAt) + 4 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const period = `dateFrom=${day}&dateTo=${day}`;
    expect(
      await read(send(owner, "GET", `/sales/overview?${query}&${period}`), 200),
    ).toEqual({
      completedSales: 1,
      productsSold: 2,
      salesAmount: [{ amount: "200.25", currency: "AZN" }],
      amountReceived: [{ amount: "170.25", currency: "AZN" }],
      outstandingDebt: [{ amount: "0", currency: "AZN" }],
    });
    expect(
      await read(
        send(owner, "GET", `/sales/overview?${query}&dateTo=2000-01-01`),
        200,
      ),
    ).toMatchObject({
      completedSales: 0,
      productsSold: 0,
    });
    expect(
      await read(send(owner, "GET", `/sales?${query}&${period}`), 200),
    ).toMatchObject({
      items: [{ id: receipt.id, itemCount: 2 }],
    });
    expect(
      await read(
        send(owner, "GET", `${root}/customers/${customer.id}/purchases`),
        200,
      ),
    ).toMatchObject({
      items: [
        {
          id: receipt.id,
          itemCount: 2,
          total: { amount: "200.25", currency: "AZN" },
        },
      ],
    });
    expect(
      await read(send(owner, "GET", root + "/dashboard"), 200),
    ).toMatchObject({
      sales: {
        count: 1,
        products: 2,
        total: [{ amount: "200.25", currency: "AZN" }],
      },
    });

    const renamed = await read<JewelrySetDetail>(
      send(owner, "PATCH", `${sets}/${set.id}?revision=${set.revision}`, {
        name: "Renamed after purchase",
        productIds: [ring.id, earrings.id],
      }),
      200,
    );
    expect(
      (
        await send(
          owner,
          "DELETE",
          `${sets}/${set.id}?revision=${renamed.revision}`,
        )
      ).statusCode,
    ).toBe(204);
    expect((await receiptDetails()).jewelrySet).toEqual(snapshot);
    expect(await read(sale(payload, key, undefined, staff), 201)).toMatchObject(
      {
        id: receipt.id,
        jewelrySet: snapshot,
        outstandingDebt: "0",
      },
    );
    expect(
      await read(
        sale(
          { ...payload, jewelrySet: selection(set, "selected") },
          key,
          undefined,
          staff,
        ),
        409,
      ),
    ).toMatchObject({
      code: "SALE_CONFLICT",
      field: "idempotencyKey",
    });
  },
);

test.skipIf(!db)(
  "sells only selected components, keeps membership and preserves unknown or foreign costs",
  async () => {
    const { owner, scope, sets, query, product, createSet, preview, sale } =
      await fixture();
    const ring = await product("Ring", "0");
    const earrings = await product("Earrings", "15", "USD");
    const necklace = await product("Necklace", "25");
    const set = await createSet([ring.id, earrings.id, necklace.id]);
    const items = [
      { productId: ring.id, saleAmount: "40" },
      { productId: earrings.id, saleAmount: "65" },
    ];
    const partial = selection(set, "selected");
    expect(await read(preview(partial, items), 200)).toMatchObject({
      saleAmount: "105",
    });
    const receipt = await read<SaleResult>(
      sale({ items, jewelrySet: partial }),
      201,
    );
    expect(receipt.profit).toMatchObject({
      acquisitionCost: null,
      grossProfit: null,
    });
    expect(receipt.items.map(({ profit }) => profit)).toMatchObject([
      { acquisitionCost: null, grossProfit: null },
      { acquisitionCost: { amount: "15", currency: "USD" }, grossProfit: null },
    ]);
    expect(
      await read(send(owner, "GET", `${sets}/${set.id}`), 200),
    ).toMatchObject({
      revision: set.revision,
      totals: { itemCount: 3, unavailableCount: 2 },
      products: [
        { id: earrings.id, status: "SOLD" },
        { id: necklace.id, status: "IN_STOCK" },
        { id: ring.id, status: "SOLD" },
      ],
    });
    expect(
      await read(send(owner, "GET", sets + "?availability=available"), 200),
    ).toMatchObject({ items: [] });
    const completeItems = [
      ...items,
      { productId: necklace.id, saleAmount: "55" },
    ];
    expect(
      await read(preview(selection(set), completeItems), 409),
    ).toMatchObject({
      code: "JEWELRY_SET_PRODUCT_UNAVAILABLE",
    });
    expect(
      await read(
        sale({ jewelrySet: selection(set), items: completeItems }),
        409,
      ),
    ).toMatchObject({
      code: "JEWELRY_SET_PRODUCT_UNAVAILABLE",
    });
    expect(
      await db!.inventoryMovement.count({
        where: { ...scope, kind: "PRODUCT_SOLD" },
      }),
    ).toBe(2);
    expect(
      await read(send(owner, "GET", `/products/${necklace.id}?${query}`), 200),
    ).toMatchObject({ status: "IN_STOCK" });
    const single = await read<SaleResult>(
      sale({ productId: necklace.id, saleAmount: "60" }),
      201,
    );
    expect(single.jewelrySet).toBeUndefined();
    expect(
      await db!.jewelrySetMember.count({ where: { ...scope, setId: set.id } }),
    ).toBe(3);
  },
);

test.skipIf(!db)(
  "rejects stale, foreign and competing set sales without changing unsold components",
  async () => {
    const { owner, scope, sets, product, createSet, preview, sale } =
      await fixture();
    const ring = await product("Ring");
    const earrings = await product("Earrings");
    const necklace = await product("Necklace");
    const set = await createSet([ring.id, earrings.id]);
    const ringItem = { productId: ring.id, saleAmount: "50" };
    const earringsItem = { productId: earrings.id, saleAmount: "50" };
    const necklaceItem = { productId: necklace.id, saleAmount: "50" };
    const items = [ringItem, earringsItem];
    await read(preview(selection(set), items), 200);
    expect(
      await read(sale({ jewelrySet: selection(set), items: [ringItem] }), 409),
    ).toMatchObject({
      code: "JEWELRY_SET_CHANGED",
    });
    const requiresConfirmation = {
      jewelrySet: selection(set),
      items: [ringItem, { ...earringsItem, saleAmount: "10" }],
    };
    const key = randomUUID();
    const challenge = await read<{ confirmation: { token: string } }>(
      sale(requiresConfirmation, key),
      409,
    );
    const updated = await read<JewelrySetDetail>(
      send(owner, "PATCH", `${sets}/${set.id}?revision=${set.revision}`, {
        name: set.name,
        productIds: [ring.id, necklace.id],
      }),
      200,
    );
    expect(
      await read(sale({ jewelrySet: selection(set), items }), 409),
    ).toMatchObject({
      code: "JEWELRY_SET_CHANGED",
    });
    expect(
      await read(
        sale(requiresConfirmation, key, challenge.confirmation.token),
        409,
      ),
    ).toMatchObject({
      code: "JEWELRY_SET_CHANGED",
    });
    expect(
      await read(
        sale({ jewelrySet: selection(updated, "selected"), items }),
        409,
      ),
    ).toMatchObject({
      code: "JEWELRY_SET_CHANGED",
    });

    const branch = await db!.store.create({
      data: { organizationId: scope.organizationId, name: "Branch" },
    });
    const branchScope = { ...scope, storeId: branch.id };
    await db!.storeAssignment.create({
      data: { ...branchScope, userId: owner },
    });
    const otherOwner = actor();
    const otherScope = await onboard(otherOwner);
    const branchProduct = await product(
      "Branch product",
      "30",
      "AZN",
      branchScope,
    );
    const foreignProduct = await product(
      "Foreign product",
      "30",
      "AZN",
      otherScope,
    );
    for (const [location, component, account] of [
      [branchScope, branchProduct, owner],
      [otherScope, foreignProduct, otherOwner],
    ] as const) {
      const foreignSet = await read<JewelrySetDetail>(
        send(account, "POST", storePath(location) + "/jewelry-sets", {
          name: "Other set",
          productIds: [component.id],
        }),
        201,
      );
      const foreignItem = { productId: component.id, saleAmount: "40" };
      expect(
        await read(preview(selection(foreignSet), [foreignItem]), 404),
      ).toMatchObject({
        code: "JEWELRY_SET_NOT_FOUND",
      });
      expect(
        await read(
          sale({ jewelrySet: selection(foreignSet), items: [foreignItem] }),
          404,
        ),
      ).toMatchObject({
        code: "JEWELRY_SET_NOT_FOUND",
      });
      expect(
        await read(
          sale({
            jewelrySet: selection(updated, "selected"),
            items: [ringItem, foreignItem],
          }),
          409,
        ),
      ).toMatchObject({
        code: "JEWELRY_SET_CHANGED",
      });
    }
    expect(
      (
        await sale(
          { jewelrySet: selection(updated), items: [ringItem, necklaceItem] },
          undefined,
          undefined,
          otherOwner,
        )
      ).statusCode,
    ).toBe(403);
    expect(await db!.sale.count({ where: scope })).toBe(0);
    expect(
      await db!.product.count({ where: { ...scope, status: "IN_STOCK" } }),
    ).toBe(3);

    const results = await Promise.all([
      sale({ jewelrySet: selection(updated), items: [ringItem, necklaceItem] }),
      sale({ jewelrySet: selection(updated, "selected"), items: [ringItem] }),
    ]);
    expect(results.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    const winner = results
      .find(({ statusCode }) => statusCode === 201)!
      .json<SaleResult>();
    expect(await db!.sale.count({ where: scope })).toBe(1);
    expect(await db!.saleItem.count({ where: scope })).toBe(
      winner.items.length,
    );
    expect(
      await db!.inventoryMovement.count({
        where: { ...scope, kind: "PRODUCT_SOLD" },
      }),
    ).toBe(winner.items.length);
    expect(
      await db!.product.count({ where: { ...scope, status: "IN_STOCK" } }),
    ).toBe(3 - winner.items.length);
  },
);
