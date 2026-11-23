BEGIN;

CREATE TABLE "mizan"."OfficialExchangeRateObservation" (
  "source" TEXT NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "usd" DECIMAL(20,8) NOT NULL,
  "eur" DECIMAL(20,8) NOT NULL,
  "try" DECIMAL(20,8) NOT NULL,
  CONSTRAINT "OfficialExchangeRateObservation_pkey" PRIMARY KEY ("source", "effectiveDate")
);

INSERT INTO "mizan"."OfficialExchangeRateObservation" ("source", "effectiveDate", "usd", "eur", "try")
SELECT "source", "effectiveDate", "usd", "eur", "try"
FROM "mizan"."OfficialExchangeRateSnapshot"
WHERE "effectiveDate" IS NOT NULL AND "retrievedAt" IS NOT NULL
  AND "usd" IS NOT NULL AND "eur" IS NOT NULL AND "try" IS NOT NULL;

CREATE INDEX "Sale_dashboard_date_idx" ON "mizan"."Sale" ("organizationId", "storeId", "createdAt", "id");
CREATE INDEX "SalePayment_dashboard_date_idx" ON "mizan"."SalePayment" ("organizationId", "storeId", "createdAt", "id");
CREATE INDEX "ReceivedOldGold_dashboard_date_idx" ON "mizan"."ReceivedOldGold" ("organizationId", "storeId", "receivedAt", "tradeInId");
CREATE INDEX "InventoryMovement_dashboard_date_idx" ON "mizan"."InventoryMovement" ("organizationId", "storeId", "kind", "createdAt", "id");

COMMIT;
