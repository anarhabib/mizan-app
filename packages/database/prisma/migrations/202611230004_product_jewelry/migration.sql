CREATE TYPE "mizan"."ProductMetal" AS ENUM ('GOLD');
CREATE TYPE "mizan"."GemstoneOrigin" AS ENUM ('NATURAL', 'LAB_GROWN', 'SIMULATED', 'UNKNOWN');

ALTER TABLE "mizan"."Product"
    ADD COLUMN "metalType" "mizan"."ProductMetal" NOT NULL DEFAULT 'GOLD',
    ADD COLUMN "acquisitionMetal" DECIMAL(20,4),
    ADD COLUMN "acquisitionGemstones" DECIMAL(20,4),
    ADD COLUMN "acquisitionWorkmanship" DECIMAL(20,4),
    ADD COLUMN "acquisitionOther" DECIMAL(20,4),
    ADD COLUMN "fixedSellingAmount" DECIMAL(20,4),
    ADD COLUMN "fixedSellingCurrency" CHAR(3),
    ADD CONSTRAINT "Product_acquisition_components_check" CHECK (
        num_nonnulls("acquisitionMetal", "acquisitionGemstones", "acquisitionWorkmanship", "acquisitionOther") = 0
        OR (
            "acquisitionCostPerGram" IS NULL
            AND COALESCE("acquisitionMetal", 0) >= 0
            AND COALESCE("acquisitionGemstones", 0) >= 0
            AND COALESCE("acquisitionWorkmanship", 0) >= 0
            AND COALESCE("acquisitionOther", 0) >= 0
            AND COALESCE("acquisitionMetal", 0) + COALESCE("acquisitionGemstones", 0)
                + COALESCE("acquisitionWorkmanship", 0) + COALESCE("acquisitionOther", 0) = "acquisitionCost"
        )
    ),
    ADD CONSTRAINT "Product_fixed_selling_check" CHECK (
        ("fixedSellingAmount" IS NULL) = ("fixedSellingCurrency" IS NULL)
        AND ("fixedSellingAmount" IS NULL OR "fixedSellingAmount" > 0)
    );

CREATE TABLE "mizan"."ProductGemstone" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "gemstoneType" TEXT NOT NULL,
    "stoneCount" INTEGER NOT NULL,
    "totalCarats" DECIMAL(15,5),
    "individualCarats" DECIMAL(15,5),
    "origin" "mizan"."GemstoneOrigin" NOT NULL DEFAULT 'UNKNOWN',
    "shape" TEXT,
    "color" TEXT,
    "clarity" TEXT,
    "cutGrade" TEXT,
    "treatment" TEXT,
    "laboratory" TEXT,
    "reportNumber" TEXT,
    "note" TEXT,
    CONSTRAINT "ProductGemstone_pkey" PRIMARY KEY ("organizationId", "storeId", "productId", "position"),
    CONSTRAINT "ProductGemstone_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId")
        REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductGemstone_values_check" CHECK (
        "position" >= 0 AND "stoneCount" > 0
        AND ("totalCarats" IS NULL OR "totalCarats" > 0)
        AND ("individualCarats" IS NULL OR "individualCarats" > 0)
        AND ("totalCarats" IS NULL OR "individualCarats" IS NULL OR "individualCarats" <= "totalCarats")
    )
);
