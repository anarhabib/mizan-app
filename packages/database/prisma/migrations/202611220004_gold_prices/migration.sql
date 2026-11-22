CREATE TABLE "mizan"."GoldMarketQuote" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "usdPerTroyOunce" DECIMAL(26,12) NOT NULL,
    "usdAzn" DECIMAL(20,8) NOT NULL,
    "exchangeDate" DATE NOT NULL,
    "aznPerGram" DECIMAL(22,8) NOT NULL,
    CONSTRAINT "GoldMarketQuote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GoldMarketQuote_positive_check" CHECK ("usdPerTroyOunce" > 0 AND "usdAzn" > 0 AND "aznPerGram" > 0)
);

CREATE UNIQUE INDEX "GoldMarketQuote_observation_key"
    ON "mizan"."GoldMarketQuote"("source", "effectiveAt", "usdPerTroyOunce", "usdAzn", "exchangeDate");

CREATE TABLE "mizan"."GoldMarketCache" (
    "source" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3),
    "quoteId" UUID,
    CONSTRAINT "GoldMarketCache_pkey" PRIMARY KEY ("source"),
    CONSTRAINT "GoldMarketCache_complete_check" CHECK (("retrievedAt" IS NULL) = ("quoteId" IS NULL)),
    CONSTRAINT "GoldMarketCache_quoteId_fkey" FOREIGN KEY ("quoteId")
        REFERENCES "mizan"."GoldMarketQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "mizan"."RetailGoldPrice" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "purity" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountPerGram" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketQuoteId" UUID,
    CONSTRAINT "RetailGoldPrice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RetailGoldPrice_positive_check" CHECK ("amountPerGram" > 0),
    CONSTRAINT "RetailGoldPrice_organizationId_purity_fkey" FOREIGN KEY ("organizationId", "purity")
        REFERENCES "mizan"."PurityGrade"("organizationId", "value") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RetailGoldPrice_organizationId_actorId_fkey" FOREIGN KEY ("organizationId", "actorId")
        REFERENCES "mizan"."OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RetailGoldPrice_marketQuoteId_fkey" FOREIGN KEY ("marketQuoteId")
        REFERENCES "mizan"."GoldMarketQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RetailGoldPrice_organizationId_purity_currency_effectiveAt_idx"
    ON "mizan"."RetailGoldPrice"("organizationId", "purity", "currency", "effectiveAt");
