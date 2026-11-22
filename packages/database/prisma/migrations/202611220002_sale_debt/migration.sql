BEGIN;

ALTER TABLE "mizan"."Sale" ADD COLUMN "outstandingDebt" DECIMAL(32,4);

UPDATE "mizan"."Sale"
SET "outstandingDebt" = CASE
  WHEN "customerId" IS NULL THEN 0
  ELSE GREATEST("defaultSettlement" - COALESCE("convertedPayment", 0), 0)
END;

ALTER TABLE "mizan"."Sale"
  ALTER COLUMN "outstandingDebt" SET NOT NULL,
  DROP CONSTRAINT "Sale_customer_reporting_check",
  ADD CONSTRAINT "Sale_customer_reporting_check" CHECK (
    ("customerReportingRate" IS NULL AND "customerId" IS NULL)
    OR ("customerReportingRate" IS NOT NULL AND "customerReportingRate" > 0)
  ),
  ADD CONSTRAINT "Sale_outstandingDebt_check"
    CHECK ("outstandingDebt" BETWEEN 0 AND GREATEST("defaultSettlement", 0)
      AND ("outstandingDebt" = 0 OR "customerId" IS NOT NULL));

CREATE TABLE "mizan"."SalePayment" (
  "organizationId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "position" INTEGER,
  "idempotencyKey" TEXT,
  "requestDigest" TEXT,
  "method" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amount" DECIMAL(28,4) NOT NULL,
  "exchangeRate" DECIMAL(24,8) NOT NULL,
  "amountAzn" DECIMAL(32,2) NOT NULL,
  "convertedAmount" DECIMAL(32,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("organizationId", "storeId", "id"),
  CONSTRAINT "SalePayment_amounts_check" CHECK (
    "amount" > 0 AND "exchangeRate" > 0 AND "amountAzn" >= 0 AND "convertedAmount" > 0
  ),
  CONSTRAINT "SalePayment_method_check" CHECK ("method" IN ('CASH', 'CARD', 'TRANSFER')),
  CONSTRAINT "SalePayment_origin_check" CHECK (
    ("position" IS NOT NULL AND "position" >= 0 AND "idempotencyKey" IS NULL AND "requestDigest" IS NULL)
    OR ("position" IS NULL AND "idempotencyKey" IS NOT NULL AND "requestDigest" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "SalePayment_organizationId_storeId_saleId_position_key"
  ON "mizan"."SalePayment"("organizationId", "storeId", "saleId", "position");
CREATE UNIQUE INDEX "SalePayment_organizationId_storeId_saleId_actorId_idempoten_key"
  ON "mizan"."SalePayment"("organizationId", "storeId", "saleId", "actorId", "idempotencyKey");

ALTER TABLE "mizan"."SalePayment"
  ADD CONSTRAINT "SalePayment_organizationId_storeId_saleId_fkey"
    FOREIGN KEY ("organizationId", "storeId", "saleId")
    REFERENCES "mizan"."Sale"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SalePayment_organizationId_storeId_actorId_fkey"
    FOREIGN KEY ("organizationId", "storeId", "actorId")
    REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
