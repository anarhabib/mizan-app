BEGIN;

-- AlterEnum
ALTER TYPE "mizan"."ProductStatus" ADD VALUE 'UNAVAILABLE';

-- AlterEnum
ALTER TYPE "mizan"."MovementKind" ADD VALUE 'PRODUCT_RETURNED';

-- DropIndex
DROP INDEX "mizan"."Sale_organizationId_storeId_productId_key";

-- AlterTable
ALTER TABLE "mizan"."SaleItem" DROP CONSTRAINT "SaleItem_pkey",
ADD CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("organizationId", "storeId", "saleId", "productId");

-- AlterTable
ALTER TABLE "mizan"."Repair" ADD COLUMN     "wasUnavailable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mizan"."InventoryMovement" ADD COLUMN     "returnSaleId" UUID;

-- CreateTable
CREATE TABLE "mizan"."SaleReturn" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "returnDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" CHAR(3) NOT NULL,
    "returnedValue" DECIMAL(32,4) NOT NULL,
    "refundableValue" DECIMAL(32,4) NOT NULL,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."SaleReturnItem" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "snapshotProductId" UUID,
    "resellable" BOOLEAN NOT NULL,

    CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("organizationId","storeId","saleId","productId")
);

-- CreateTable
CREATE TABLE "mizan"."SaleReturnDebt" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "amount" DECIMAL(32,4) NOT NULL,

    CONSTRAINT "SaleReturnDebt_pkey" PRIMARY KEY ("organizationId","storeId","returnId")
);

-- CreateTable
CREATE TABLE "mizan"."SaleRefund" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "refundDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(32,4) NOT NULL,

    CONSTRAINT "SaleRefund_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateIndex
CREATE INDEX "SaleReturn_organizationId_storeId_returnDate_idx" ON "mizan"."SaleReturn"("organizationId", "storeId", "returnDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_organizationId_storeId_saleId_id_key" ON "mizan"."SaleReturn"("organizationId", "storeId", "saleId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_organizationId_storeId_actorId_idempotencyKey_key" ON "mizan"."SaleReturn"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SaleReturnItem_organizationId_storeId_saleId_returnId_idx" ON "mizan"."SaleReturnItem"("organizationId", "storeId", "saleId", "returnId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturnItem_organizationId_storeId_saleId_snapshotProduc_key" ON "mizan"."SaleReturnItem"("organizationId", "storeId", "saleId", "snapshotProductId");

-- CreateIndex
CREATE INDEX "SaleRefund_organizationId_storeId_returnId_idx" ON "mizan"."SaleRefund"("organizationId", "storeId", "returnId");

-- CreateIndex
CREATE INDEX "SaleRefund_organizationId_storeId_refundDate_idx" ON "mizan"."SaleRefund"("organizationId", "storeId", "refundDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRefund_organizationId_storeId_actorId_idempotencyKey_key" ON "mizan"."SaleRefund"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Sale_organizationId_storeId_productId_idx" ON "mizan"."Sale"("organizationId", "storeId", "productId");

-- CreateIndex
CREATE INDEX "SaleItem_organizationId_storeId_productId_idx" ON "mizan"."SaleItem"("organizationId", "storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_organizationId_storeId_returnSaleId_produ_key" ON "mizan"."InventoryMovement"("organizationId", "storeId", "returnSaleId", "productId");

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturn" ADD CONSTRAINT "SaleReturn_organizationId_storeId_saleId_fkey" FOREIGN KEY ("organizationId", "storeId", "saleId") REFERENCES "mizan"."Sale"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturn" ADD CONSTRAINT "SaleReturn_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_organizationId_storeId_saleId_returnId_fkey" FOREIGN KEY ("organizationId", "storeId", "saleId", "returnId") REFERENCES "mizan"."SaleReturn"("organizationId", "storeId", "saleId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_organizationId_storeId_saleId_snapshotProdu_fkey" FOREIGN KEY ("organizationId", "storeId", "saleId", "snapshotProductId") REFERENCES "mizan"."SaleItem"("organizationId", "storeId", "saleId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleReturnDebt" ADD CONSTRAINT "SaleReturnDebt_organizationId_storeId_returnId_fkey" FOREIGN KEY ("organizationId", "storeId", "returnId") REFERENCES "mizan"."SaleReturn"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleRefund" ADD CONSTRAINT "SaleRefund_organizationId_storeId_returnId_fkey" FOREIGN KEY ("organizationId", "storeId", "returnId") REFERENCES "mizan"."SaleReturn"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SaleRefund" ADD CONSTRAINT "SaleRefund_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_returnSaleId_prod_fkey" FOREIGN KEY ("organizationId", "storeId", "returnSaleId", "productId") REFERENCES "mizan"."SaleReturnItem"("organizationId", "storeId", "saleId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mizan"."SaleReturn" ADD CONSTRAINT "SaleReturn_amounts_check"
CHECK ("returnedValue" >= 0 AND "refundableValue" BETWEEN 0 AND "returnedValue");

ALTER TABLE "mizan"."SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_snapshot_check"
CHECK ("snapshotProductId" IS NULL OR "snapshotProductId" = "productId");

ALTER TABLE "mizan"."SaleReturnDebt" ADD CONSTRAINT "SaleReturnDebt_amount_check"
CHECK (amount > 0);

ALTER TABLE "mizan"."SaleRefund" ADD CONSTRAINT "SaleRefund_amount_method_check"
CHECK (amount > 0 AND method IN ('CASH', 'CARD', 'TRANSFER'));

ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_return_check"
CHECK (CASE WHEN kind::text = 'PRODUCT_RETURNED'
  THEN "returnSaleId" IS NOT NULL AND "saleId" IS NOT NULL AND "returnSaleId" = "saleId" AND "productId" IS NOT NULL
  ELSE "returnSaleId" IS NULL END);

COMMIT;
