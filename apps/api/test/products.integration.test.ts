import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { buildApp } from "../src/app.js";
import { createProductPhotoStorage } from "../src/modules/products/product.storage.js";

const url = process.env.MIZAN_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Use a disposable local database");
const db = url
  ? (await import("@mizan/database")).createDatabase(url)
  : undefined;
afterAll(async () => db?.$disconnect());

const storageOrigin = process.env.MIZAN_TEST_STORAGE_ORIGIN;
const storageKey = process.env.MIZAN_TEST_STORAGE_SERVICE_ROLE_KEY;

test.skipIf(!storageOrigin || !storageKey)(
  "Supabase stores a private, insert-only product image",
  async () => {
    if (!storageOrigin || !storageKey) throw new Error("Test Storage missing");
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(
        new URL(storageOrigin).hostname,
      )
    )
      throw new Error("Use local Supabase Storage");
    const storage = createProductPhotoStorage(storageOrigin, storageKey);
    const key = [randomUUID(), randomUUID(), randomUUID(), "photo"].join("/");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM2sAAAAASUVORK5CYII=",
      "base64",
    );
    const bucket = new URL("/storage/v1/object/product-photos", storageOrigin);
    try {
      expect(await storage.inspect(key)).toBeNull();
      const uploadUrl = await storage.signUpload(key);
      const upload = () =>
        fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/png", "x-upsert": "true" },
          body: png,
        });
      expect((await upload()).ok).toBe(true);
      expect((await upload()).ok).toBe(false);
      expect(await storage.inspect(key)).toEqual({
        contentType: "image/png",
        size: png.length,
      });
      const download = await fetch(await storage.signDownload(key));
      expect(download.ok).toBe(true);
      expect(Buffer.from(await download.arrayBuffer())).toEqual(png);
      const publicUrl = new URL(
        "/storage/v1/object/public/product-photos/" + key,
        storageOrigin,
      );
      expect((await fetch(publicUrl)).ok).toBe(false);
    } finally {
      const cleanup = await fetch(bucket, {
        method: "DELETE",
        headers: {
          apikey: storageKey,
          Authorization: "Bearer " + storageKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [key] }),
      });
      expect(cleanup.ok).toBe(true);
    }
  },
);

test.skipIf(!db)(
  "product inventory and photos are scoped and preserve exact values",
  async () => {
    if (!db) throw new Error("Test database missing");
    const users = {
      owner: randomUUID(),
      seller: randomUUID(),
      other: randomUUID(),
    };
    const uploads = new Map<string, { contentType: string; size: number }>();
    const app = await buildApp({
      access: {
        db,
        verifyToken: async (token) =>
          Object.hasOwn(users, token)
            ? { userId: users[token as keyof typeof users] }
            : null,
      },
      onboardingDb: db,
      settingsDb: db,
      products: {
        db,
        storage: {
          signUpload: async (key: string) =>
            "https://example.test/upload/" + key,
          inspect: async (key: string) => uploads.get(key) ?? null,
          signDownload: async (key: string) =>
            "https://example.test/download/" + key,
          signDownloads: async (keys) =>
            new Map(
              keys.map((key) => [key, "https://example.test/download/" + key]),
            ),
        },
      },
    });
    const send = (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      payload?: object,
      user = "owner",
    ) =>
      app.inject({
        method,
        url: "/api/v1" + path,
        payload,
        headers: { authorization: "Bearer " + user },
      });
    const onboard = async (user: string) =>
      (
        await send(
          "POST",
          "/onboarding",
          {
            fullName: "Inventory Test Owner",
            organizationName: "Jewelry",
            storeName: "Main store",
            defaultCurrency: "AZN",
          },
          user,
        )
      ).json<{ organizationId: string; storeId: string }>();
    const path = (
      scope: { organizationId: string; storeId: string },
      suffix = "",
      extra = "",
    ) =>
      "/products" +
      suffix +
      "?" +
      new URLSearchParams({ ...scope }).toString() +
      extra;

    try {
      const { organizationId, storeId } = await onboard("owner");
      const { organizationId: otherId, storeId: otherStoreId } =
        await onboard("other");
      const scope = { organizationId, storeId };
      const other = { organizationId: otherId, storeId: otherStoreId };
      const second = await db.store.create({
        data: { organizationId, name: "Second store" },
      });
      const secondScope = { organizationId, storeId: second.id };
      await db.storeAssignment.create({
        data: { ...secondScope, userId: users.owner },
      });
      await db.user.create({ data: { id: users.seller } });
      await db.organizationMembership.create({
        data: { organizationId, userId: users.seller, role: "SALESPERSON" },
      });
      await db.storeAssignment.create({
        data: { ...scope, userId: users.seller },
      });

      await db.purityGrade.update({
        where: { organizationId_value: { organizationId, value: 375 } },
        data: { active: false },
      });
      const sellerOptions = await send(
        "GET",
        path(scope, "/options"),
        undefined,
        "seller",
      );
      expect(sellerOptions.statusCode).toBe(200);
      expect(sellerOptions.json()).toEqual({
        defaultCurrency: "AZN",
        purities: [585, 750, 916, 999],
      });
      expect(
        (await send("GET", path(other, "/options"), undefined, "seller"))
          .statusCode,
      ).toBe(403);

      const input = {
        code: "RG-101",
        name: "Gold Ring",
        category: "Ring",
        purity: 585,
        weight: "1.234",
        acquisitionCostPerGram: { amount: "95.20", currency: "AZN" },
      };
      for (const invalid of [
        { weight: "1.2345" },
        { weight: "0.000" },
        { weight: "1000000000000" },
        {
          acquisitionCostPerGram: {
            amount: "95.20000000000000001",
            currency: "AZN",
          },
        },
        { acquisitionCostPerGram: { amount: "0", currency: "AZN" } },
      ])
        expect(
          (await send("POST", path(scope), { ...input, ...invalid }))
            .statusCode,
        ).toBe(400);
      expect(
        (await send("POST", path(scope), { ...input, purity: 123 })).statusCode,
      ).toBe(409);
      const attempts = await Promise.all([
        send("POST", path(scope), input),
        send("POST", path(scope), input),
      ]);
      expect(attempts.map((response) => response.statusCode).sort()).toEqual([
        201, 409,
      ]);
      const created = attempts.find((response) => response.statusCode === 201)!;
      const { id } = created.json<{ id: string }>();
      expect(created.json()).toMatchObject({
        weight: "1.234",
        status: "IN_STOCK",
        acquisitionCost: { amount: "117.4768", currency: "AZN" },
        acquisitionCostPerGram: input.acquisitionCostPerGram,
        canDelete: false,
        canEditAcquisition: true,
        movements: [{ kind: "PRODUCT_ADDED", actorId: users.owner }],
      });
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, productId: id },
        }),
      ).toBe(1);
      expect(
        (await send("POST", path(secondScope), input)).json(),
      ).toMatchObject({ code: "PRODUCT_CODE_CONFLICT", field: "code" });
      expect((await send("POST", path(other), input, "other")).statusCode).toBe(
        201,
      );
      expect(
        (
          await send(
            "POST",
            "/organizations/" + organizationId + "/purities/585/deactivate",
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await send("POST", path(scope), { ...input, code: "RG-102" }))
          .statusCode,
      ).toBe(409);

      const detail = "/" + id;
      expect((await send("GET", path(secondScope, detail))).statusCode).toBe(
        404,
      );
      expect(
        (await send("GET", path(other, detail), undefined, "other")).statusCode,
      ).toBe(404);
      expect(
        (
          await send(
            "GET",
            path({ organizationId: other.organizationId, storeId }, detail),
            undefined,
            "other",
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await send(
            "GET",
            path({ organizationId, storeId: other.storeId }, detail),
          )
        ).statusCode,
      ).toBe(403);
      for (const q of ["rg-101", "gold ring"]) {
        const list = await send(
          "GET",
          path(scope, "", "&q=" + encodeURIComponent(q)),
          undefined,
          "seller",
        );
        expect(list.json()).toMatchObject({ items: [{ id }] });
        expect(list.json().items[0]).not.toHaveProperty("acquisitionCost");
      }
      expect((await send("GET", path(secondScope))).json()).toEqual({
        items: [],
      });
      expect(
        (
          await send(
            "GET",
            path(
              scope,
              "",
              "&facets=1&" +
                new URLSearchParams({
                  category: input.category,
                  purity: String(input.purity),
                }),
            ),
            undefined,
            "seller",
          )
        ).json(),
      ).toMatchObject({
        items: [{ id }],
        filters: { categories: [input.category], purities: [input.purity] },
      });
      expect(
        (await send("GET", path(secondScope, "", "&facets=1"))).json(),
      ).toEqual({
        items: [],
        filters: { categories: [], purities: [] },
      });
      const hidden = (
        await send("GET", path(scope, detail), undefined, "seller")
      ).json();
      expect(hidden).not.toHaveProperty("acquisitionCost");
      expect(hidden).not.toHaveProperty("acquisitionCostPerGram");
      expect(hidden).not.toHaveProperty("canDelete");
      expect(hidden).not.toHaveProperty("canEditAcquisition");
      await send("POST", "/organizations/" + organizationId + "/settings", {
        salespersonCanViewAcquisitionCost: true,
      });
      expect(
        (await send("GET", path(scope, detail), undefined, "seller")).json(),
      ).toMatchObject({
        acquisitionCost: { amount: "117.4768", currency: "AZN" },
        acquisitionCostPerGram: input.acquisitionCostPerGram,
      });
      const patch = detail + "/acquisition";
      const update = {
        weight: "1.005",
        acquisitionCostPerGram: { amount: "12.345", currency: "EUR" },
      };
      expect(
        (await send("PATCH", path(scope, patch), update, "seller")).statusCode,
      ).toBe(403);
      expect(
        (await send("PATCH", path(secondScope, patch), update)).statusCode,
      ).toBe(404);
      expect((await send("PATCH", path(scope, patch), update)).statusCode).toBe(
        204,
      );
      expect((await send("GET", path(scope, detail))).json()).toMatchObject({
        weight: update.weight,
        acquisitionCostPerGram: update.acquisitionCostPerGram,
        acquisitionCost: { amount: "12.4067", currency: "EUR" },
      });
      expect(
        (await send("DELETE", path(scope, detail), undefined, "seller"))
          .statusCode,
      ).toBe(403);
      expect((await send("DELETE", path(secondScope, detail))).statusCode).toBe(
        404,
      );
      const protectedDelete = await send("DELETE", path(scope, detail));
      expect(protectedDelete.statusCode).toBe(409);
      expect(protectedDelete.json()).toHaveProperty(
        "code",
        "PRODUCT_DELETE_CONFLICT",
      );
      expect(
        await db.inventoryMovement.count({
          where: { ...scope, productId: id },
        }),
      ).toBe(1);

      const untracked = await db.product.create({
        data: {
          ...scope,
          code: "UNTRACKED",
          name: input.name,
          category: input.category,
          purity: input.purity,
          weight: input.weight,
          acquisitionCost: "117.4768",
          acquisitionCurrency: "AZN",
        },
      });
      const untrackedPath = path(scope, "/" + untracked.id);
      expect((await send("GET", untrackedPath)).json()).toMatchObject({
        canDelete: true,
      });
      expect(
        (await send("DELETE", untrackedPath, undefined, "seller")).statusCode,
      ).toBe(403);
      expect((await send("DELETE", untrackedPath)).statusCode).toBe(204);
      expect((await send("GET", untrackedPath)).statusCode).toBe(404);
      await db.product.updateMany({
        where: { ...scope, id },
        data: { status: "SOLD" },
      });
      expect(
        (await send("PATCH", path(scope, patch), update)).json(),
      ).toHaveProperty("code", "PRODUCT_EDIT_CONFLICT");
      expect((await send("GET", path(scope, detail))).json()).toMatchObject({
        status: "SOLD",
        canEditAcquisition: false,
        canDelete: false,
      });
      expect(
        (await send("GET", path(scope, "", "&status=SOLD"))).json(),
      ).toMatchObject({ items: [{ id, status: "SOLD" }] });

      const upload = detail + "/photo-upload";
      const confirm = detail + "/photo-confirm";
      expect(
        (await send("POST", path(other, upload), undefined, "other"))
          .statusCode,
      ).toBe(404);
      const first = (await send("POST", path(scope, upload))).json();
      const prefix = [organizationId, storeId, id, "photo"].join("/");
      expect(first.uploadUrl).toBe(
        "https://example.test/upload/" + prefix + "/" + first.uploadId,
      );
      const finalize = (uploadId: string, target = scope) =>
        send("POST", path(target, confirm), { uploadId });
      expect((await finalize(first.uploadId, secondScope)).statusCode).toBe(
        404,
      );
      expect((await finalize(first.uploadId)).statusCode).toBe(409);
      uploads.set(prefix + "/" + first.uploadId, {
        contentType: "image/png",
        size: 0,
      });
      expect((await finalize(first.uploadId)).statusCode).toBe(409);
      const secondUpload = (await send("POST", path(scope, upload))).json();
      expect(secondUpload.uploadId).not.toBe(first.uploadId);
      const key = prefix + "/" + secondUpload.uploadId;
      uploads.set(key, { contentType: "image/png", size: 743 });
      expect(
        (
          await send("POST", path(scope, confirm), {
            objectKey: "arbitrary/path",
          })
        ).statusCode,
      ).toBe(400);
      expect((await finalize(secondUpload.uploadId)).json()).toMatchObject({
        photo: {
          url: "https://example.test/download/" + key,
          contentType: "image/png",
          size: 743,
        },
      });
      expect((await finalize(secondUpload.uploadId)).statusCode).toBe(200);
      expect((await finalize(first.uploadId)).statusCode).toBe(409);
      expect((await send("POST", path(scope, upload))).statusCode).toBe(409);
    } finally {
      await app.close();
    }
  },
);
