BEGIN;

CREATE TYPE "mizan"."GoldPriceKind" AS ENUM ('RETAIL_SELL', 'SCRAP_BUY', 'SCRAP_SELL');
CREATE TYPE "mizan"."GoldPriceMode" AS ENUM ('FIXED', 'PERCENTAGE', 'OFFSET');

ALTER TABLE "mizan"."TradeIn"
    DROP CONSTRAINT "TradeIn_price_source_check",
    DROP CONSTRAINT "TradeIn_organizationId_purity_rateId_fkey",
    DROP CONSTRAINT "TradeIn_storeGoldPriceRuleId_fkey",
    DROP COLUMN "rateId",
    ADD COLUMN "rateExchangeRate" DECIMAL(24,8),
    ALTER COLUMN "appliedRate" DROP NOT NULL,
    ALTER COLUMN "calculatedValue" DROP NOT NULL;

DROP TABLE "mizan"."OldGoldRate";

-- Preserve sale and received-gold snapshots even when a test rule cannot be retained.
UPDATE "mizan"."TradeIn" AS line
    SET "storeGoldPriceRuleId" = NULL, "goldMarketQuoteId" = NULL
    FROM "mizan"."RetailGoldPrice" AS rule
    WHERE line."storeGoldPriceRuleId" = rule."id"
      AND (rule."storeId" IS DISTINCT FROM line."storeId"
           OR rule."organizationId" <> line."organizationId");

DELETE FROM "mizan"."RetailGoldPrice"
    WHERE "storeId" IS NULL
       OR ("kind" = 'BUY' AND (("mode" = 'FIXED' AND "amountPerGram" = 0)
                              OR ("mode" = 'PERCENTAGE' AND "amountPerGram" = -100)));

-- Detach any remaining references to incompatible test rules.
UPDATE "mizan"."TradeIn" AS line
    SET "storeGoldPriceRuleId" = NULL, "goldMarketQuoteId" = NULL
    WHERE line."storeGoldPriceRuleId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "mizan"."RetailGoldPrice" AS rule
                      WHERE rule."id" = line."storeGoldPriceRuleId");

ALTER TABLE "mizan"."RetailGoldPrice" RENAME TO "StoreGoldPriceRule";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME COLUMN "amountPerGram" TO "value";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME CONSTRAINT "RetailGoldPrice_pkey" TO "StoreGoldPriceRule_pkey";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME CONSTRAINT "RetailGoldPrice_store_fkey" TO "StoreGoldPriceRule_organizationId_storeId_fkey";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME CONSTRAINT "RetailGoldPrice_organizationId_purity_fkey" TO "StoreGoldPriceRule_organizationId_purity_fkey";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME CONSTRAINT "RetailGoldPrice_organizationId_actorId_fkey" TO "StoreGoldPriceRule_organizationId_actorId_fkey";
ALTER TABLE "mizan"."StoreGoldPriceRule" RENAME CONSTRAINT "RetailGoldPrice_marketQuoteId_fkey" TO "StoreGoldPriceRule_marketQuoteId_fkey";
DROP INDEX "mizan"."RetailGoldPrice_organizationId_purity_currency_effectiveAt_idx";
DROP INDEX "mizan"."RetailGoldPrice_store_history_idx";

ALTER TABLE "mizan"."StoreGoldPriceRule"
    DROP CONSTRAINT "RetailGoldPrice_kind_check",
    DROP CONSTRAINT "RetailGoldPrice_mode_check",
    DROP CONSTRAINT "RetailGoldPrice_store_currency_check",
    DROP COLUMN "currency",
    ALTER COLUMN "kind" DROP DEFAULT,
    ALTER COLUMN "kind" TYPE "mizan"."GoldPriceKind" USING
        (CASE "kind" WHEN 'BUY' THEN 'SCRAP_BUY' ELSE 'RETAIL_SELL' END)::"mizan"."GoldPriceKind",
    ALTER COLUMN "mode" DROP DEFAULT,
    ALTER COLUMN "mode" TYPE "mizan"."GoldPriceMode" USING "mode"::"mizan"."GoldPriceMode",
    ALTER COLUMN "mode" DROP NOT NULL,
    ALTER COLUMN "value" DROP NOT NULL,
    ALTER COLUMN "purity" DROP NOT NULL,
    ALTER COLUMN "storeId" SET NOT NULL,
    ADD COLUMN "previousId" UUID,
    ADD CONSTRAINT "StoreGoldPriceRule_configuration_check" CHECK (
        ("mode" IS NULL AND "value" IS NULL AND "purity" IS NOT NULL AND "marketQuoteId" IS NULL)
        OR ("mode" IS NOT NULL AND "value" IS NOT NULL AND "value" <> 'NaN' AND (
            ("mode" = 'FIXED' AND "marketQuoteId" IS NULL
                AND ("value" > 0 OR ("kind" = 'RETAIL_SELL' AND "value" = 0)))
            OR ("mode" = 'PERCENTAGE'
                AND ("value" > -100 OR ("kind" = 'RETAIL_SELL' AND "value" = -100)))
            OR "mode" = 'OFFSET'
        ))
    );

WITH versions AS (
    SELECT "id", lag("id") OVER (
        PARTITION BY "organizationId", "storeId", "kind", "purity"
        ORDER BY "effectiveAt", "id"
    ) AS previous_id
    FROM "mizan"."StoreGoldPriceRule"
)
UPDATE "mizan"."StoreGoldPriceRule" AS rule
    SET "previousId" = versions.previous_id FROM versions WHERE rule."id" = versions."id";

CREATE UNIQUE INDEX "StoreGoldPriceRule_organizationId_storeId_id_key"
    ON "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "id");
CREATE UNIQUE INDEX "StoreGoldPriceRule_version_key"
    ON "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "kind", "id");
CREATE INDEX "StoreGoldPriceRule_scope_idx"
    ON "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "kind", "purity", "effectiveAt");
CREATE INDEX "StoreGoldPriceRule_history_idx"
    ON "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "effectiveAt", "id");

ALTER TABLE "mizan"."StoreGoldPriceRule"
    ADD CONSTRAINT "StoreGoldPriceRule_organizationId_storeId_kind_previousId_fkey"
    FOREIGN KEY ("organizationId", "storeId", "kind", "previousId")
    REFERENCES "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "kind", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mizan"."TradeIn"
    ADD CONSTRAINT "TradeIn_organizationId_purity_fkey" FOREIGN KEY ("organizationId", "purity")
        REFERENCES "mizan"."PurityGrade" ("organizationId", "value") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TradeIn_organizationId_storeId_storeGoldPriceRuleId_fkey"
        FOREIGN KEY ("organizationId", "storeId", "storeGoldPriceRuleId")
        REFERENCES "mizan"."StoreGoldPriceRule" ("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TradeIn_price_snapshot_check" CHECK (
        (("appliedRate" IS NOT NULL AND "calculatedValue" IS NOT NULL)
         OR ("appliedRate" IS NULL AND "calculatedValue" IS NULL AND "overridden" AND "storeGoldPriceRuleId" IS NULL))
        AND ("goldMarketQuoteId" IS NULL OR "storeGoldPriceRuleId" IS NOT NULL)
        AND ("rateExchangeRate" IS NULL OR ("rateExchangeRate" > 0 AND "rateExchangeRate" <> 'NaN' AND "storeGoldPriceRuleId" IS NOT NULL))
    );

COMMIT;
