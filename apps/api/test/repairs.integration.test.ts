import { randomUUID } from "node:crypto";
import type {
  JewelrySetDetail,
  ProductDetail,
  ProductList,
  PurchaseDetail,
  PurchaseReceipt,
  RepairCommand,
  RepairDetail,
  RepairHistory,
  SaleResult,
} from "@mizan/contracts";
import { createDatabase } from "@mizan/database";
import { afterAll, beforeAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url ? createDatabase(url) : undefined;
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Baku",
}).format(new Date());
const actors = new Map<string, { userId: string; salespersonDisplay?: true }>();
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

function send(
  actor: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  payload?: object,
  key: string | null = randomUUID(),
) {
  return app.inject({
    method,
    url: "/api/v1" + path,
    payload,
    headers: {
      authorization: `Bearer ${actor}`,
      ...(key && { "Idempotency-Key": key }),
    },
  });
}

async function read<T>(request: ReturnType<typeof send>, status: number) {
  const response = await request;
  expect(response.statusCode, response.body).toBe(status);
  return response.json<T>();
}

async function fixture() {
  const owner = randomUUID();
  actors.set(owner, { userId: owner });
  const { organizationId, storeId } = await read<Scope>(
    send(owner, "POST", "/onboarding", {
      fullName: "Repair owner",
      organizationName: "Repair test",
      storeName: "Main",
      defaultCurrency: "AZN",
    }),
    200,
  );
  const scope = { organizationId, storeId };
  const root = storePath(scope);
  const query = new URLSearchParams(scope);
  const product = (code: string) =>
    read<ProductDetail>(
      send(owner, "POST", `/products?${query}`, {
        code,
        name: code,
        category: "Ring",
        purity: 585,
        weight: "2.501",
        netGoldWeight: "2.100",
        acquisitionCost: { amount: "31.2345", currency: "AZN" },
        gemstones: [
          { gemstoneType: "Ruby", stoneCount: 2, totalCarats: "0.34567" },
        ],
      }),
      201,
    );
  const productPath = (id: string) => `/products/${id}?${query}`;
  const repairs = (productId: string) =>
    `${root}/products/${productId}/repairs`;
  const command = (
    productId: string,
    input: object,
    key?: string | null,
    actor = owner,
  ) => send(actor, "POST", repairs(productId), input, key);
  const repair = (productId: string, id: string, actor = owner) =>
    read<RepairDetail>(send(actor, "GET", `${repairs(productId)}/${id}`), 200);
  const sale = (
    items: { productId: string; saleAmount: string }[],
    jewelrySet?: object,
  ) =>
    send(owner, "POST", `/sales?${query}`, { items, tradeIns: [], jewelrySet });
  return {
    owner,
    scope,
    root,
    query,
    product,
    productPath,
    repairs,
    command,
    repair,
    sale,
  };
}

const sendDetails = {
  action: "send",
  description: "Replace loose stone and polish",
  sentDate: today,
  expectedReturnDate: "9999-12-31",
  note: "Check the setting",
} as const;
const start = {
  ...sendDetails,
  repairerName: "Bench jeweler",
} satisfies RepairCommand;

const complete = (repairId: string) =>
  ({
    action: "complete",
    repairId,
    completedDate: today,
    weight: "2.489",
    netGoldWeight: "2.005",
    gemstones: [
      { gemstoneType: "Sapphire", stoneCount: 1, individualCarats: "0.22223" },
    ],
    actualCost: { amount: "12.3456", currency: "USD" },
    note: "Replaced the setting",
  }) satisfies RepairCommand;

test.skipIf(!db)(
  "starts repair, logs progress, filters active stock and restores stock on cancellation",
  async () => {
    const {
      owner,
      scope,
      query,
      product,
      productPath,
      repairs,
      command,
      repair,
      sale,
    } = await fixture();
    const item = await product("R1");
    const { id } = await read<{ id: string }>(command(item.id, start), 201);
    await read(
      command(item.id, {
        action: "progress",
        repairId: id,
        note: "Parts ordered",
      }),
      200,
    );
    expect(await repair(item.id, id)).toMatchObject({
      status: "ACTIVE",
      repairerName: "Bench jeweler",
      before: {
        weight: "2.501",
        netGoldWeight: "2.100",
        gemstones: item.gemstones,
      },
      after: null,
      financial: { estimatedCost: null, actualCost: null, payment: null },
      events: [
        { kind: "SENT", note: "Check the setting" },
        { kind: "PROGRESS", note: "Parts ordered" },
      ],
    });
    expect(
      (
        await read<ProductList>(
          send(owner, "GET", `/products?${query}&status=IN_REPAIR`),
          200,
        )
      ).items,
    ).toMatchObject([{ id: item.id, status: "IN_REPAIR" }]);
    expect(
      (
        await read<ProductList>(
          send(owner, "GET", `/products?${query}&status=IN_STOCK`),
          200,
        )
      ).items,
    ).toEqual([]);
    expect(
      await read(sale([{ productId: item.id, saleAmount: "100" }]), 409),
    ).toMatchObject({ code: "SALE_CONFLICT" });
    expect(
      await read(
        send(owner, "PATCH", `/products/${item.id}/acquisition?${query}`, {
          weight: "2",
          acquisitionCost: item.acquisitionCost,
        }),
        409,
      ),
    ).toMatchObject({ code: "PRODUCT_EDIT_CONFLICT" });
    await read(
      command(item.id, {
        action: "cancel",
        repairId: id,
        note: "Returned as sent",
      }),
      200,
    );
    const after = await read<ProductDetail>(
      send(owner, "GET", productPath(item.id)),
      200,
    );
    expect(after).toMatchObject({
      status: "IN_STOCK",
      weight: item.weight,
      netGoldWeight: item.netGoldWeight,
      gemstones: item.gemstones,
      acquisitionCost: item.acquisitionCost,
      movements: [
        { kind: "PRODUCT_ADDED" },
        { kind: "REPAIR_SENT" },
        { kind: "REPAIR_CANCELED" },
      ],
    });
    expect(
      await read<RepairHistory>(send(owner, "GET", repairs(item.id)), 200),
    ).toMatchObject({ items: [{ id, status: "CANCELED" }] });
    expect(await repair(item.id, id)).toMatchObject({
      status: "CANCELED",
      after: null,
    });
    await read(command(item.id, complete(id)), 409);
    await read(command(item.id, { action: "cancel", repairId: id }), 409);
    await read(
      command(item.id, { action: "progress", repairId: id, note: "Too late" }),
      409,
    );
    expect(
      await db!.inventoryMovement.count({ where: { ...scope, repairId: id } }),
    ).toBe(2);
  },
);

test.skipIf(!db)(
  "validates completion, snapshots gemstones and historic purchase details, and records exact full payment separately",
  async () => {
    const {
      owner,
      scope,
      root,
      query,
      product,
      productPath,
      command,
      repair,
      sale,
    } = await fixture();
    const item = await product("R2");
    const supplier = await read<{ id: string }>(
      send(owner, "POST", root + "/suppliers", { name: "Shared supplier" }),
      201,
    );
    const purchase = await read<PurchaseReceipt>(
      send(owner, "POST", root + "/purchases", {
        supplierId: supplier.id,
        currency: "AZN",
        purchaseDate: today,
        items: [{ productId: item.id }],
      }),
      201,
    );
    const purchaseId = purchase.id;
    const purchasePath = `${root}/purchases/${purchaseId}`;
    const acquisitionBefore = await read<PurchaseDetail>(
      send(owner, "GET", purchasePath),
      200,
    );
    const { id } = await read<{ id: string }>(
      command(item.id, {
        ...sendDetails,
        supplierId: supplier.id,
        estimatedCost: { amount: "10.0001", currency: "USD" },
      }),
      201,
    );
    for (const invalid of [
      { ...complete(id), netGoldWeight: "2.490" },
      { ...complete(id), weight: "2.4891" },
      { ...complete(id), actualCost: { amount: "12.34561", currency: "USD" } },
      { ...complete(id), actualCost: { amount: "12.34", currency: "JPY" } },
      {
        ...complete(id),
        gemstones: [{ gemstoneType: "Sapphire", stoneCount: 0 }],
      },
      { ...complete(id), completedDate: "2000-01-01" },
    ])
      await read(command(item.id, invalid), 400);
    expect(
      await read<ProductDetail>(send(owner, "GET", productPath(item.id)), 200),
    ).toMatchObject({
      status: "IN_REPAIR",
      weight: item.weight,
      gemstones: item.gemstones,
    });
    const key = randomUUID();
    await read(command(item.id, complete(id), key), 200);
    await read(command(item.id, complete(id), key), 200);
    await read(command(item.id, complete(id)), 409);
    await read(command(item.id, { action: "cancel", repairId: id }), 409);
    const current = await read<ProductDetail>(
      send(owner, "GET", productPath(item.id)),
      200,
    );
    expect(current).toMatchObject({
      status: "IN_STOCK",
      weight: "2.489",
      netGoldWeight: "2.005",
      canEditAcquisition: false,
      acquisitionCost: item.acquisitionCost,
      gemstones: [
        expect.objectContaining({
          gemstoneType: "Sapphire",
          stoneCount: 1,
          individualCarats: "0.22223",
        }),
      ],
    });
    expect(await repair(item.id, id)).toMatchObject({
      status: "COMPLETED",
      repairerName: "Shared supplier",
      before: { gemstones: item.gemstones },
      after: {
        weight: current.weight,
        netGoldWeight: current.netGoldWeight,
        gemstones: current.gemstones,
      },
      financial: {
        estimatedCost: { amount: "10.0001", currency: "USD" },
        actualCost: { amount: "12.3456", currency: "USD" },
        payment: null,
      },
    });
    const pay = {
      action: "pay",
      repairId: id,
      paymentDate: today,
      method: "CARD",
    };
    await read(command(item.id, { ...pay, amount: "4.50" }), 400);
    const paymentKey = randomUUID();
    await Promise.all([
      read(command(item.id, pay, paymentKey), 200),
      read(command(item.id, pay, paymentKey), 200),
    ]);
    expect(await repair(item.id, id)).toMatchObject({
      financial: {
        actualCost: { amount: "12.3456", currency: "USD" },
        payment: { date: today, method: "CARD" },
      },
      events: [{ kind: "SENT" }, { kind: "COMPLETED" }, { kind: "PAID" }],
    });
    await read(command(item.id, pay), 409);
    expect(await db!.purchase.count({ where: scope })).toBe(1);
    expect(await db!.supplierPayment.count({ where: scope })).toBe(0);
    expect(
      await read<PurchaseDetail>(send(owner, "GET", purchasePath), 200),
    ).toEqual(acquisitionBefore);
    const receipt = await read<SaleResult>(
      sale([{ productId: item.id, saleAmount: "100" }]),
      201,
    );
    expect(receipt).toMatchObject({
      product: { weight: "2.489" },
      profit: { acquisitionCost: { amount: "31.2345", currency: "AZN" } },
    });
    const salePath = `/sales/${receipt.id}?${query}`;
    const saved = await read<SaleResult>(send(owner, "GET", salePath), 200);
    await read(command(item.id, start), 409);
    expect(await read<SaleResult>(send(owner, "GET", salePath), 200)).toEqual(
      saved,
    );
    expect(await repair(item.id, id)).toMatchObject({ status: "COMPLETED" });
  },
);

test.skipIf(!db)(
  "serializes repeated repair sends, competing keys and a racing sale",
  async () => {
    const { scope, product, command, repair, sale } = await fixture();
    const item = await product("R3");
    expect(await read(command(item.id, start, null), 400)).toMatchObject({
      field: "idempotencyKey",
    });
    const key = randomUUID();
    const results = await Promise.all([
      read<{ id: string }>(command(item.id, start, key), 201),
      read<{ id: string }>(command(item.id, start, key), 201),
    ]);
    expect(results[0]).toEqual(results[1]);
    const { id } = results[0];
    expect(
      await read(
        command(item.id, { ...start, description: "Different" }, key),
        409,
      ),
    ).toMatchObject({ code: "REPAIR_REQUEST_CONFLICT" });
    await read(command(item.id, start), 409);
    expect(await repair(item.id, id)).toMatchObject({
      events: [{ kind: "SENT" }],
    });
    await read(command(item.id, { action: "cancel", repairId: id }), 200);
    const racers = await Promise.all([
      command(item.id, start),
      sale([{ productId: item.id, saleAmount: "100" }]),
    ]);
    expect(racers.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    const stored = await db!.product.findUniqueOrThrow({
      where: { organizationId_storeId_id: { ...scope, id: item.id } },
    });
    expect(stored.status).toBe(
      racers[0].statusCode === 201 ? "IN_REPAIR" : "SOLD",
    );
    expect(
      await db!.repair.count({
        where: { ...scope, productId: item.id, status: "ACTIVE" },
      }),
    ).toBe(stored.status === "IN_REPAIR" ? 1 : 0);
    expect(
      await db!.saleItem.count({ where: { ...scope, productId: item.id } }),
    ).toBe(stored.status === "SOLD" ? 1 : 0);
    const second = await product("R3B");
    const competingSends = await Promise.all([
      command(second.id, start),
      command(second.id, start),
    ]);
    expect(competingSends.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    const active = competingSends
      .find(({ statusCode }) => statusCode === 201)
      ?.json<{ id: string }>();
    const finalize = await Promise.all([
      command(second.id, complete(active!.id)),
      command(second.id, { action: "cancel", repairId: active!.id }),
    ]);
    expect(finalize.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 409,
    ]);
    expect(
      await db!.inventoryMovement.count({
        where: { ...scope, repairId: active!.id },
      }),
    ).toBe(2);
  },
);

test.skipIf(!db)(
  "keeps set membership while an unavailable component blocks complete set sales",
  async () => {
    const { owner, scope, root, product, command, repair, sale } =
      await fixture();
    const [ring, earrings] = await Promise.all([
      product("Set ring"),
      product("Set earrings"),
    ]);
    const sets = root + "/jewelry-sets";
    const set = await read<JewelrySetDetail>(
      send(owner, "POST", sets, {
        name: "Wedding set",
        productIds: [ring.id, earrings.id],
      }),
      201,
    );
    const { id } = await read<{ id: string }>(command(ring.id, start), 201);
    const detail = () =>
      read<JewelrySetDetail>(send(owner, "GET", `${sets}/${set.id}`), 200);
    expect(await detail()).toMatchObject({
      revision: set.revision,
      totals: { unavailableCount: 1 },
      products: expect.arrayContaining([
        expect.objectContaining({ id: ring.id, status: "IN_REPAIR" }),
        expect.objectContaining({ id: earrings.id, status: "IN_STOCK" }),
      ]),
    });
    const selection = { id: set.id, revision: set.revision, mode: "complete" };
    const items = [ring, earrings].map((item) => ({
      productId: item.id,
      saleAmount: "100",
    }));
    expect(await read(sale(items, selection), 409)).toMatchObject({
      code: "JEWELRY_SET_PRODUCT_UNAVAILABLE",
    });
    await read(
      command(ring.id, {
        ...complete(id),
        actualCost: { amount: "0", currency: "AZN" },
        gemstones: [],
      }),
      200,
    );
    expect(await repair(ring.id, id)).toMatchObject({
      after: { gemstones: [] },
      financial: { actualCost: { amount: "0.00" } },
    });
    await read(
      command(ring.id, {
        action: "pay",
        repairId: id,
        paymentDate: today,
        method: "CASH",
      }),
      409,
    );
    expect(await detail()).toMatchObject({
      revision: set.revision,
      totals: { unavailableCount: 0, grossWeight: "4.990" },
    });
    expect(await read<SaleResult>(sale(items, selection), 201)).toMatchObject({
      jewelrySet: { id: set.id },
    });
    expect(
      await db!.jewelrySetMember.count({ where: { ...scope, setId: set.id } }),
    ).toBe(2);
  },
);

test.skipIf(!db)(
  "scopes repair records and suppliers and enforces owner-mode writes and financial visibility",
  async () => {
    const { owner, scope, root, product, repairs, command, repair } =
      await fixture();
    const other = await fixture();
    const [item, second] = await Promise.all([
      product("Scope ring"),
      product("Other ring"),
    ]);
    const staff = randomUUID();
    actors.set(staff, { userId: staff });
    const display = randomUUID();
    actors.set(display, { userId: owner, salespersonDisplay: true });
    await db!.user.create({ data: { id: staff } });
    await db!.organizationMembership.create({
      data: {
        organizationId: scope.organizationId,
        userId: staff,
        role: "SALESPERSON",
      },
    });
    await db!.storeAssignment.create({ data: { ...scope, userId: staff } });
    const { id: storeId } = await db!.store.create({
      data: { organizationId: scope.organizationId, name: "Second" },
    });
    await db!.storeAssignment.create({
      data: { organizationId: scope.organizationId, storeId, userId: owner },
    });
    const otherStore = storePath({
      organizationId: scope.organizationId,
      storeId,
    });
    const supplier = await read<{ id: string }>(
      send(owner, "POST", otherStore + "/suppliers", {
        name: "Other store supplier",
      }),
      201,
    );
    await read(
      command(item.id, { ...sendDetails, supplierId: supplier.id }),
      404,
    );
    await read(command(item.id, start, undefined, staff), 403);
    await read(command(item.id, start, undefined, display), 403);
    const { id } = await read<{ id: string }>(
      command(item.id, {
        ...start,
        estimatedCost: { amount: "15.0001", currency: "AZN" },
      }),
      201,
    );
    await read(command(second.id, { action: "cancel", repairId: id }), 404);
    await read(
      send(owner, "GET", `${otherStore}/products/${item.id}/repairs/${id}`),
      404,
    );
    await read(send(other.owner, "GET", repairs(item.id) + "/" + id), 403);
    await read(
      send(owner, "GET", `${root}/products/${second.id}/repairs?after=${id}`),
      400,
    );
    expect(await repair(item.id, id, staff)).not.toHaveProperty("financial");
    expect(await repair(item.id, id, display)).not.toHaveProperty("financial");
    expect(await repair(item.id, id)).toHaveProperty(
      "financial.estimatedCost.amount",
      "15.0001",
    );
    await read(command(item.id, complete(id), undefined, staff), 403);
    await read(
      command(item.id, { action: "cancel", repairId: id }, undefined, display),
      403,
    );
  },
);
