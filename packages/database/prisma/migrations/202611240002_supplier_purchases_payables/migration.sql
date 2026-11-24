-- CreateEnum
CREATE TYPE "mizan"."SupplierActivityKind" AS ENUM ('CREATED', 'UPDATED', 'DEACTIVATED', 'REACTIVATED', 'PURCHASE_REGISTERED', 'PRODUCTS_RECEIVED', 'PAYMENT_RECORDED', 'PARTIALLY_PAID', 'PAID');

-- CreateTable
CREATE TABLE "mizan"."Supplier" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "phoneDigits" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."Purchase" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "documentNumber" TEXT,
    "purchaseDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."PurchaseItem" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "acquisitionCost" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("organizationId","storeId","productId")
);

-- CreateTable
CREATE TABLE "mizan"."SupplierPayment" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "referenceNumber" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."SupplierActivity" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" BIGSERIAL NOT NULL,
    "supplierId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "purchaseId" UUID,
    "kind" "mizan"."SupplierActivityKind" NOT NULL,
    "productCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierActivity_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateIndex
CREATE INDEX "Supplier_organizationId_storeId_createdAt_id_idx" ON "mizan"."Supplier"("organizationId", "storeId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Purchase_organizationId_storeId_purchaseDate_id_idx" ON "mizan"."Purchase"("organizationId", "storeId", "purchaseDate", "id");

-- CreateIndex
CREATE INDEX "Purchase_supplier_date_idx" ON "mizan"."Purchase"("organizationId", "storeId", "supplierId", "purchaseDate", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_organizationId_storeId_id_currency_key" ON "mizan"."Purchase"("organizationId", "storeId", "id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_organizationId_storeId_actorId_idempotencyKey_key" ON "mizan"."Purchase"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_organizationId_storeId_purchaseId_position_key" ON "mizan"."PurchaseItem"("organizationId", "storeId", "purchaseId", "position");

-- CreateIndex
CREATE INDEX "SupplierPayment_date_idx" ON "mizan"."SupplierPayment"("organizationId", "storeId", "paymentDate", "id");

-- CreateIndex
CREATE INDEX "SupplierPayment_purchase_date_idx" ON "mizan"."SupplierPayment"("organizationId", "storeId", "purchaseId", "paymentDate", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_organizationId_storeId_actorId_idempotencyK_key" ON "mizan"."SupplierPayment"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierActivity_supplier_idx" ON "mizan"."SupplierActivity"("organizationId", "storeId", "supplierId", "id");

-- AddForeignKey
ALTER TABLE "mizan"."Supplier" ADD CONSTRAINT "Supplier_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Purchase" ADD CONSTRAINT "Purchase_organizationId_storeId_supplierId_fkey" FOREIGN KEY ("organizationId", "storeId", "supplierId") REFERENCES "mizan"."Supplier"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Purchase" ADD CONSTRAINT "Purchase_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."PurchaseItem" ADD CONSTRAINT "PurchaseItem_organizationId_storeId_purchaseId_fkey" FOREIGN KEY ("organizationId", "storeId", "purchaseId") REFERENCES "mizan"."Purchase"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."PurchaseItem" ADD CONSTRAINT "PurchaseItem_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_organizationId_storeId_purchaseId_currency_fkey" FOREIGN KEY ("organizationId", "storeId", "purchaseId", "currency") REFERENCES "mizan"."Purchase"("organizationId", "storeId", "id", "currency") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SupplierActivity" ADD CONSTRAINT "SupplierActivity_organizationId_storeId_supplierId_fkey" FOREIGN KEY ("organizationId", "storeId", "supplierId") REFERENCES "mizan"."Supplier"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SupplierActivity" ADD CONSTRAINT "SupplierActivity_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."SupplierActivity" ADD CONSTRAINT "SupplierActivity_organizationId_storeId_purchaseId_fkey" FOREIGN KEY ("organizationId", "storeId", "purchaseId") REFERENCES "mizan"."Purchase"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve positive recorded values and the existing payment vocabulary at the database boundary.
ALTER TABLE "mizan"."Purchase" ADD CONSTRAINT "Purchase_total_positive" CHECK ("totalAmount" > 0);
ALTER TABLE "mizan"."PurchaseItem" ADD CONSTRAINT "PurchaseItem_valid_value" CHECK ("acquisitionCost" > 0 AND "position" >= 0);
ALTER TABLE "mizan"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_valid_value" CHECK ("amount" > 0 AND "method" IN ('CASH', 'CARD', 'TRANSFER'));

