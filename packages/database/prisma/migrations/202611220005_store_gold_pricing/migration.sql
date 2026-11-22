ALTER TABLE "mizan"."GoldMarketQuote" ADD COLUMN "firstRetrievedAt" TIMESTAMP(3);

ALTER TABLE "mizan"."RetailGoldPrice"
    ADD COLUMN "storeId" UUID,
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SELL',
    ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'FIXED',
    DROP CONSTRAINT "RetailGoldPrice_positive_check",
    ADD CONSTRAINT "RetailGoldPrice_kind_check" CHECK ("kind" IN ('BUY', 'SELL')),
    ADD CONSTRAINT "RetailGoldPrice_mode_check" CHECK (
        ("mode" = 'FIXED' AND "amountPerGram" >= 0)
        OR ("mode" = 'PERCENTAGE' AND "amountPerGram" >= -100)
        OR "mode" = 'OFFSET'
    ),
    ADD CONSTRAINT "RetailGoldPrice_store_currency_check" CHECK ("storeId" IS NULL OR "currency" = 'AZN'),
    ADD CONSTRAINT "RetailGoldPrice_store_fkey" FOREIGN KEY ("organizationId", "storeId")
        REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RetailGoldPrice_store_history_idx"
    ON "mizan"."RetailGoldPrice"("organizationId", "storeId", "kind", "purity", "effectiveAt");

ALTER TABLE "mizan"."Product"
    ADD COLUMN "netGoldWeight" DECIMAL(15,3),
    ADD CONSTRAINT "Product_netGoldWeight_check" CHECK ("netGoldWeight" > 0 AND "netGoldWeight" <= "weight");

ALTER TABLE "mizan"."TradeIn"
    ALTER COLUMN "rateId" DROP NOT NULL,
    ADD COLUMN "storeGoldPriceRuleId" UUID,
    ADD COLUMN "goldMarketQuoteId" UUID,
    ADD CONSTRAINT "TradeIn_price_source_check" CHECK (
        (("rateId" IS NULL) <> ("storeGoldPriceRuleId" IS NULL))
        AND ("goldMarketQuoteId" IS NULL OR "storeGoldPriceRuleId" IS NOT NULL)
    ),
    ADD CONSTRAINT "TradeIn_storeGoldPriceRuleId_fkey" FOREIGN KEY ("storeGoldPriceRuleId")
        REFERENCES "mizan"."RetailGoldPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TradeIn_goldMarketQuoteId_fkey" FOREIGN KEY ("goldMarketQuoteId")
        REFERENCES "mizan"."GoldMarketQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
