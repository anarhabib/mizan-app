import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { createDatabase, Prisma } from "../src/index.js";

const url = process.env.DATABASE_URL;
if (
  !url ||
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
) {
  throw new Error("Schema integration tests require a loopback DATABASE_URL");
}

const db = createDatabase(url);
afterAll(() => db.$disconnect());

const rollback = new Error("Roll back integration fixtures");

async function withFixtures(
  run: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  await expect(
    db.$transaction(async (tx) => {
      await run(tx);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
}

async function createStore(tx: Prisma.TransactionClient) {
  const organization = await tx.organization.create({
    data: { name: "Test business", defaultCurrency: "AZN" },
  });
  const store = await tx.store.create({
    data: { name: "Test store", organizationId: organization.id },
  });
  await tx.purityGrade.create({
    data: { organizationId: organization.id, value: 585 },
  });
  return { organizationId: organization.id, storeId: store.id };
}

const item = {
  code: "TEST-001",
  name: "Test ring",
  category: "ring",
  purity: 585,
  weight: "4.185",
  acquisitionCost: "55.25",
  acquisitionCurrency: "AZN",
};

test("permits the same piece code in independent organizations", async () => {
  await withFixtures(async (tx) => {
    const first = await createStore(tx);
    const second = await createStore(tx);
    await tx.product.create({ data: { ...first, ...item } });
    const saved = await tx.product.create({ data: { ...second, ...item } });
    expect(saved.weight.toString()).toBe("4.185");
    expect(saved.acquisitionCost.toString()).toBe("55.25");
  });
});

test("rejects duplicate piece codes across stores in one organization", async () => {
  await withFixtures(async (tx) => {
    const first = await createStore(tx);
    const second = await tx.store.create({
      data: { name: "Second test store", organizationId: first.organizationId },
    });
    await tx.product.create({ data: { ...first, ...item } });
    await expect(
      tx.product.create({ data: { ...first, storeId: second.id, ...item } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

test("rejects association with another organization's category", async () => {
  await withFixtures(async (tx) => {
    const first = await createStore(tx);
    const second = await createStore(tx);
    const category = await tx.productCategory.create({
      data: {
        organizationId: second.organizationId,
        name: "Foreign category",
        sortOrder: 0,
      },
    });
    await expect(
      tx.product.create({
        data: { ...first, ...item, categoryId: category.id },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

test("rejects associating a tenant member with another tenant's store", async () => {
  await withFixtures(async (tx) => {
    const first = await createStore(tx);
    const second = await createStore(tx);
    const userId = randomUUID();
    await tx.user.create({ data: { id: userId } });
    await tx.organizationMembership.create({
      data: {
        organizationId: first.organizationId,
        userId,
        role: "SALESPERSON",
      },
    });
    await expect(
      tx.storeAssignment.create({
        data: {
          organizationId: first.organizationId,
          storeId: second.storeId,
          userId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
