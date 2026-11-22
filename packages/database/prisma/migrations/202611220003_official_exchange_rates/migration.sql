CREATE TABLE "mizan"."OfficialExchangeRateSnapshot" (
    "source" TEXT NOT NULL,
    "effectiveDate" DATE,
    "retrievedAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "usd" DECIMAL(20,8),
    "eur" DECIMAL(20,8),
    "try" DECIMAL(20,8),

    CONSTRAINT "OfficialExchangeRateSnapshot_pkey" PRIMARY KEY ("source"),
    CONSTRAINT "OfficialExchangeRateSnapshot_complete_check" CHECK (
        ("effectiveDate" IS NULL AND "retrievedAt" IS NULL AND
         "usd" IS NULL AND "eur" IS NULL AND "try" IS NULL)
        OR
        ("effectiveDate" IS NOT NULL AND "retrievedAt" IS NOT NULL AND
         "usd" IS NOT NULL AND "eur" IS NOT NULL AND "try" IS NOT NULL AND
         "usd" > 0 AND "eur" > 0 AND "try" > 0)
    )
);
