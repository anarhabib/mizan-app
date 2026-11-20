ALTER TABLE "mizan"."Product"
ADD COLUMN "acquisitionCostPerGram" DECIMAL(35,16);

-- Round the rate to 16 places using integer division. With at most 12
-- integer weight digits, multiplying it back recovers the stored 4-place total.
UPDATE "mizan"."Product"
SET "acquisitionCostPerGram" =
    div(2 * "acquisitionCost" * 10000000000000000 + "weight", 2 * "weight")
    * 0.0000000000000001
WHERE "weight" > 0 AND "acquisitionCost" > 0;
