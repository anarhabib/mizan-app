-- CreateEnum
CREATE TYPE "mizan"."RepairStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "mizan"."RepairEventKind" AS ENUM ('SENT', 'PROGRESS', 'COMPLETED', 'CANCELED', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "mizan"."MovementKind" ADD VALUE 'REPAIR_SENT';
ALTER TYPE "mizan"."MovementKind" ADD VALUE 'REPAIR_COMPLETED';
ALTER TYPE "mizan"."MovementKind" ADD VALUE 'REPAIR_CANCELED';

-- AlterEnum
ALTER TYPE "mizan"."ProductStatus" ADD VALUE 'IN_REPAIR';

-- AlterTable
ALTER TABLE "mizan"."InventoryMovement" ADD COLUMN     "repairId" UUID;

-- CreateTable
CREATE TABLE "mizan"."Repair" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierId" UUID,
    "repairerName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "mizan"."RepairStatus" NOT NULL DEFAULT 'ACTIVE',
    "sentDate" DATE NOT NULL,
    "expectedReturnDate" DATE,
    "completedDate" DATE,
    "beforeWeight" DECIMAL(15,3) NOT NULL,
    "beforeNetWeight" DECIMAL(15,3),
    "beforeGemstones" JSONB NOT NULL,
    "afterWeight" DECIMAL(15,3),
    "afterNetWeight" DECIMAL(15,3),
    "afterGemstones" JSONB,
    "estimatedCost" DECIMAL(20,4),
    "estimatedCurrency" CHAR(3),
    "actualCost" DECIMAL(20,4),
    "actualCurrency" CHAR(3),
    "paidDate" DATE,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."RepairEvent" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "repairId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "id" SERIAL NOT NULL,
    "kind" "mizan"."RepairEventKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,

    CONSTRAINT "RepairEvent_pkey" PRIMARY KEY ("organizationId","storeId","repairId","id")
);

-- CreateIndex
CREATE INDEX "Repair_organizationId_storeId_productId_createdAt_id_idx" ON "mizan"."Repair"("organizationId", "storeId", "productId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Repair_organizationId_storeId_supplierId_idx" ON "mizan"."Repair"("organizationId", "storeId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairEvent_organizationId_storeId_actorId_idempotencyKey_key" ON "mizan"."RepairEvent"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_organizationId_storeId_repairId_idx" ON "mizan"."InventoryMovement"("organizationId", "storeId", "repairId");

-- AddForeignKey
ALTER TABLE "mizan"."Repair" ADD CONSTRAINT "Repair_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Repair" ADD CONSTRAINT "Repair_organizationId_storeId_supplierId_fkey" FOREIGN KEY ("organizationId", "storeId", "supplierId") REFERENCES "mizan"."Supplier"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."RepairEvent" ADD CONSTRAINT "RepairEvent_organizationId_storeId_repairId_fkey" FOREIGN KEY ("organizationId", "storeId", "repairId") REFERENCES "mizan"."Repair"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."RepairEvent" ADD CONSTRAINT "RepairEvent_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_repairId_fkey" FOREIGN KEY ("organizationId", "storeId", "repairId") REFERENCES "mizan"."Repair"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Repair_one_active_product_idx"
    ON "mizan"."Repair" ("organizationId", "storeId", "productId") WHERE status = 'ACTIVE';

ALTER TABLE "mizan"."Repair" ADD CONSTRAINT "Repair_measurements_check" CHECK (
    "beforeWeight" > 0
    AND ("beforeNetWeight" IS NULL OR ("beforeNetWeight" > 0 AND "beforeNetWeight" <= "beforeWeight"))
    AND jsonb_typeof("beforeGemstones") = 'array'
    AND (
        (status = 'COMPLETED'
          AND "completedDate" IS NOT NULL AND "completedDate" >= "sentDate"
          AND "afterWeight" IS NOT NULL AND "afterWeight" > 0
          AND "afterNetWeight" IS NOT NULL AND "afterNetWeight" > 0 AND "afterNetWeight" <= "afterWeight"
          AND "afterGemstones" IS NOT NULL AND jsonb_typeof("afterGemstones") = 'array'
          AND "actualCost" IS NOT NULL)
        OR (status <> 'COMPLETED'
          AND "completedDate" IS NULL AND "afterWeight" IS NULL AND "afterNetWeight" IS NULL
          AND "afterGemstones" IS NULL AND "actualCost" IS NULL)
    )
    AND ("expectedReturnDate" IS NULL OR "expectedReturnDate" >= "sentDate")
);

ALTER TABLE "mizan"."Repair" ADD CONSTRAINT "Repair_cost_and_payment_check" CHECK (
    ("estimatedCost" IS NULL) = ("estimatedCurrency" IS NULL)
    AND ("actualCost" IS NULL) = ("actualCurrency" IS NULL)
    AND ("estimatedCost" IS NULL OR "estimatedCost" >= 0)
    AND ("actualCost" IS NULL OR "actualCost" >= 0)
    AND (
        ("paidDate" IS NULL AND "paymentMethod" IS NULL)
        OR ("paidDate" IS NOT NULL AND "paidDate" >= "sentDate" AND "paymentMethod" IS NOT NULL
            AND "paymentMethod" IN ('CASH', 'CARD', 'TRANSFER') AND "actualCost" IS NOT NULL AND "actualCost" > 0)
    )
);
