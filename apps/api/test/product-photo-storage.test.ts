import { afterEach, expect, test, vi } from "vitest";
import {
  createProductPhotoStorage,
  pagePhotoUrls,
  photoDirectory,
} from "../src/modules/products/product.storage.js";

const scope = { organizationId: "organization", storeId: "store" };
const id = "26733033-65c1-4ddc-b856-bb4521d81eeb";
const otherId = "bcabdd42-f27c-45ab-9b6d-95b83717ae49";
const uploadId = "49723f1d-63b3-4181-ac18-953ce48da061";
const key = photoDirectory(scope, id) + uploadId;
const wrongStoreKey =
  photoDirectory({ ...scope, storeId: "other" }, otherId) + uploadId;
const storage = createProductPhotoStorage(
  "https://storage.example.test",
  "fixture-key",
);

afterEach(() => vi.unstubAllGlobals());

test("signs one batch of scoped product keys and ignores foreign Storage results", async () => {
  const signedURL = "/object/sign/product-photos/" + key + "?token=fixture";
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json([
      { path: key, signedURL },
      {
        path: wrongStoreKey,
        signedURL:
          "/object/sign/product-photos/" + wrongStoreKey + "?token=other",
      },
    ]),
  );
  vi.stubGlobal("fetch", fetchMock);

  const urls = await pagePhotoUrls(storage, scope, [
    { id, photoObjectKey: key },
    { id, photoObjectKey: key },
    { id: otherId, photoObjectKey: wrongStoreKey },
    { id: otherId, photoObjectKey: key },
    { id: otherId, photoObjectKey: null },
  ]);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "https://storage.example.test/storage/v1/object/sign/product-photos",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    paths: [key],
    expiresIn: 300,
  });
  expect([...urls]).toEqual([
    [id, "https://storage.example.test/storage/v1" + signedURL],
  ]);
});

test("leaves list rows usable when Storage cannot sign photos", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);

  expect(
    await pagePhotoUrls(storage, scope, [{ id, photoObjectKey: key }]),
  ).toEqual(new Map());
  expect(
    await pagePhotoUrls(storage, scope, [{ id, photoObjectKey: null }]),
  ).toEqual(new Map());
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
