BEGIN;

ALTER TABLE "mizan"."User" ADD COLUMN "fullName" TEXT;
ALTER TABLE "mizan"."Sale" ADD COLUMN "productCategoryCode" TEXT;
ALTER TABLE "mizan"."SaleItem" ADD COLUMN "productCategoryCode" TEXT;

CREATE TABLE "mizan"."ProductCategory" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("organizationId", "id"),
    CONSTRAINT "ProductCategory_organizationId_fkey" FOREIGN KEY ("organizationId")
        REFERENCES "mizan"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductCategory_organizationId_code_key"
    ON "mizan"."ProductCategory"("organizationId", "code");
CREATE UNIQUE INDEX "ProductCategory_organizationId_lower_name_key"
    ON "mizan"."ProductCategory"("organizationId", lower("name"));

ALTER TABLE "mizan"."Product"
    ADD COLUMN "categoryId" UUID,
    ADD CONSTRAINT "Product_organizationId_categoryId_fkey"
        FOREIGN KEY ("organizationId", "categoryId")
        REFERENCES "mizan"."ProductCategory"("organizationId", "id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Product_organizationId_categoryId_idx"
    ON "mizan"."Product"("organizationId", "categoryId");

WITH category_defaults(code, az, en, ru, position) AS (VALUES
    ('RING', 'Üzük', 'Ring', 'Кольцо', 0),
    ('EARRINGS', 'Sırğa', 'Earrings', 'Серьги', 1),
    ('NECKLACE', 'Boyunbağı', 'Necklace', 'Ожерелье', 2),
    ('BRACELET', 'Qolbaq', 'Bracelet', 'Браслет', 3),
    ('CHAIN', 'Zəncir', 'Chain', 'Цепочка', 4),
    ('PENDANT', 'Kulon', 'Pendant', 'Кулон', 5),
    ('MEDALLION', 'Medalyon', 'Medallion', 'Медальон', 6),
    ('BROOCH', 'Bros', 'Brooch', 'Брошь', 7),
    ('ANKLET', 'Ayaq bilərziyi', 'Anklet', 'Браслет на ногу', 8),
    ('SET', 'Komplekt', 'Set', 'Комплект', 9),
    ('OTHER', 'Digər', 'Other', 'Другое', 10)
), added_defaults AS (
    INSERT INTO "mizan"."ProductCategory" ("organizationId", "id", "code", "name", "sortOrder", "updatedAt")
    SELECT o.id, gen_random_uuid(), d.code, d.az, d.position, CURRENT_TIMESTAMP
    FROM "mizan"."Organization" o CROSS JOIN category_defaults d
    RETURNING "organizationId", id, code
)
UPDATE "mizan"."Product" p SET "categoryId" = c.id
FROM added_defaults c JOIN category_defaults d ON d.code = c.code
WHERE p."organizationId" = c."organizationId"
  AND lower(p.category) IN (lower(d.az), lower(d.en), lower(d.ru));

-- Case variants share a managed category. The original spelling stays on every product.
WITH legacy AS (
    SELECT "organizationId", lower(category) AS folded, min(category COLLATE "C") AS name
    FROM "mizan"."Product"
    WHERE "categoryId" IS NULL
    GROUP BY "organizationId", lower(category)
)
INSERT INTO "mizan"."ProductCategory" ("organizationId", "id", "name", "sortOrder", "updatedAt")
SELECT "organizationId", gen_random_uuid(), name,
       10 + row_number() OVER (PARTITION BY "organizationId" ORDER BY folded COLLATE "C"),
       CURRENT_TIMESTAMP
FROM legacy;

UPDATE "mizan"."Product" p SET "categoryId" = c.id
FROM "mizan"."ProductCategory" c
WHERE p."categoryId" IS NULL AND p."organizationId" = c."organizationId"
  AND lower(p.category) = lower(c.name);

COMMIT;
