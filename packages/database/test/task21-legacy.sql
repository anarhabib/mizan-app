\set ON_ERROR_STOP on
\if :seed
-- Run against a fresh disposable database after migration 202611230004.
INSERT INTO "mizan"."User" (id) VALUES ('21000000-0000-0000-0000-000000000001');
INSERT INTO "mizan"."Organization" (id, name, "defaultCurrency") VALUES
  ('21000000-0000-0000-0000-000000000002', 'Legacy shop', 'AZN'),
  ('21000000-0000-0000-0000-000000000003', 'Second legacy shop', 'AZN');
INSERT INTO "mizan"."Store" ("organizationId", id, name) VALUES
  ('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000004', 'Legacy store');
INSERT INTO "mizan"."OrganizationMembership" ("organizationId", "userId", role) VALUES
  ('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 'OWNER');
INSERT INTO "mizan"."StoreAssignment" ("organizationId", "storeId", "userId") VALUES
  ('21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-000000000001');
INSERT INTO "mizan"."PurityGrade" ("organizationId", value) VALUES
  ('21000000-0000-0000-0000-000000000002', 585);
INSERT INTO "mizan"."Product" ("organizationId", "storeId", id, code, name, category, purity, weight, status, "acquisitionCost", "acquisitionCurrency")
SELECT '21000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000004',
  id::uuid, code, code, category, 585, 1.234, status::"mizan"."ProductStatus", 59.50, 'AZN'
FROM (VALUES
  ('21000000-0000-0000-0000-000000000005', 'LEGACY-1', U&'\041A\043E\043B\044C\0446\043E', 'IN_STOCK'),
  ('21000000-0000-0000-0000-000000000006', 'LEGACY-2', 'Vintage', 'SOLD'),
  ('21000000-0000-0000-0000-000000000007', 'LEGACY-3', 'vintage', 'IN_STOCK')
) AS items(id, code, category, status);
INSERT INTO "mizan"."Sale" ("organizationId", "storeId", id, "productId", "actorId", "idempotencyKey",
  "requestDigest", currency, "defaultCurrency", "exchangeRate", "saleAmount", "defaultSaleAmount",
  "acceptedTradeInTotal", "defaultAcceptedTradeInTotal", settlement, "defaultSettlement",
  "outstandingDebt", "productCode", "productName", "productCategory", "productPurity", "productWeight")
SELECT "organizationId", "storeId", '21000000-0000-0000-0000-000000000008', id,
  '21000000-0000-0000-0000-000000000001', 'migration-fixture', 'migration-fixture', 'AZN',
  'AZN', 1, 99.95, 99.95, 0, 0, 99.95, 99.95, 0, code, name, category, purity, weight
FROM "mizan"."Product" WHERE code = 'LEGACY-2';
INSERT INTO "mizan"."SaleItem" ("organizationId", "storeId", "saleId", "productId", position,
  "productCode", "productName", "productCategory", "productPurity", "productWeight", "saleAmount")
SELECT "organizationId", "storeId", id, "productId", 0, "productCode", "productName",
  "productCategory", "productPurity", "productWeight", "saleAmount" FROM "mizan"."Sale"
WHERE id = '21000000-0000-0000-0000-000000000008';
\else
-- Run after migrate deploy applies Task 21.
DO $$
BEGIN
  IF (SELECT "fullName" IS NOT NULL FROM "mizan"."User" WHERE id = '21000000-0000-0000-0000-000000000001')
    OR (SELECT count(*) FROM "mizan"."ProductCategory" WHERE "organizationId" = '21000000-0000-0000-0000-000000000002') <> 12
    OR (SELECT count(*) FROM "mizan"."ProductCategory" WHERE "organizationId" = '21000000-0000-0000-0000-000000000003') <> 11
    OR (SELECT array_agg(p.category ORDER BY p.code)
        FROM "mizan"."Product" p JOIN "mizan"."ProductCategory" c
          ON (p."organizationId", p."categoryId") = (c."organizationId", c.id)
        WHERE p."organizationId" = '21000000-0000-0000-0000-000000000002'
          AND ((p.code = 'LEGACY-1' AND c.code = 'RING') OR (c.code IS NULL AND c.name = 'Vintage')))
        IS DISTINCT FROM ARRAY[U&'\041A\043E\043B\044C\0446\043E', 'Vintage', 'vintage']
    OR (SELECT count(*) FROM "mizan"."Sale" s JOIN "mizan"."SaleItem" i
        ON (s."organizationId", s."storeId", s.id) = (i."organizationId", i."storeId", i."saleId")
        WHERE s.id = '21000000-0000-0000-0000-000000000008'
          AND s."productCategory" = 'Vintage' AND i."productCategory" = 'Vintage'
          AND s."productCategoryCode" IS NULL AND i."productCategoryCode" IS NULL
          AND s."saleAmount" = 99.95 AND i."saleAmount" = 99.95) <> 1
  THEN
    RAISE EXCEPTION 'Task 21 legacy data verification failed';
  END IF;
END $$;
\endif
