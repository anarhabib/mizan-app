ALTER TABLE "mizan"."Organization"
    ADD COLUMN "paymentCurrencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
