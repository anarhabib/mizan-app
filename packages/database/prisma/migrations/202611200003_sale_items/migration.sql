ALTER TABLE "mizan"."Sale" ALTER COLUMN "saleAmount" TYPE DECIMAL(28,4);
ALTER TABLE "mizan"."Sale" ALTER COLUMN "paymentAmount" TYPE DECIMAL(28,4);

CREATE TABLE "mizan"."SaleItem" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productPurity" INTEGER NOT NULL,
    "productWeight" DECIMAL(15,3) NOT NULL,
    "saleAmount" DECIMAL(20,4) NOT NULL,
    "acquisitionCost" DECIMAL(20,4),
    "acquisitionCostPerGram" DECIMAL(35,16),
    "acquisitionCurrency" CHAR(3),
    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("organizationId", "storeId", "productId")
);

CREATE UNIQUE INDEX "SaleItem_organizationId_storeId_saleId_position_key"
    ON "mizan"."SaleItem"("organizationId", "storeId", "saleId", "position");

ALTER TABLE "mizan"."SaleItem" ADD CONSTRAINT "SaleItem_organizationId_storeId_saleId_fkey"
    FOREIGN KEY ("organizationId", "storeId", "saleId")
    REFERENCES "mizan"."Sale"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mizan"."SaleItem" ADD CONSTRAINT "SaleItem_organizationId_storeId_productId_fkey"
    FOREIGN KEY ("organizationId", "storeId", "productId")
    REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
