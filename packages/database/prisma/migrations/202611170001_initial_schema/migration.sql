-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "mizan";

-- CreateEnum
CREATE TYPE "mizan"."Role" AS ENUM ('OWNER', 'SALESPERSON');

-- CreateEnum
CREATE TYPE "mizan"."ProductStatus" AS ENUM ('IN_STOCK', 'SOLD');

-- CreateEnum
CREATE TYPE "mizan"."MovementKind" AS ENUM ('PRODUCT_ADDED', 'PRODUCT_SOLD', 'OLD_GOLD_RECEIVED');

-- CreateTable
CREATE TABLE "mizan"."User" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mizan"."Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrency" CHAR(3) NOT NULL,
    "salespersonCanViewAcquisitionCost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mizan"."Store" (
    "organizationId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("organizationId","id")
);

-- CreateTable
CREATE TABLE "mizan"."OrganizationMembership" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "mizan"."Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "mizan"."StoreAssignment" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StoreAssignment_pkey" PRIMARY KEY ("organizationId","storeId","userId")
);

-- CreateTable
CREATE TABLE "mizan"."Invitation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mizan"."PurityGrade" (
    "organizationId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PurityGrade_pkey" PRIMARY KEY ("organizationId","value")
);

-- CreateTable
CREATE TABLE "mizan"."OldGoldRate" (
    "organizationId" UUID NOT NULL,
    "purity" INTEGER NOT NULL,
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountPerGram" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OldGoldRate_pkey" PRIMARY KEY ("organizationId","purity","id")
);

-- CreateTable
CREATE TABLE "mizan"."Product" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purity" INTEGER NOT NULL,
    "weight" DECIMAL(15,3) NOT NULL,
    "acquisitionCost" DECIMAL(20,4) NOT NULL,
    "acquisitionCurrency" CHAR(3) NOT NULL,
    "photoObjectKey" TEXT,
    "note" TEXT,
    "status" "mizan"."ProductStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."Sale" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "defaultCurrency" CHAR(3) NOT NULL,
    "exchangeRate" DECIMAL(24,8) NOT NULL,
    "saleAmount" DECIMAL(20,4) NOT NULL,
    "defaultSaleAmount" DECIMAL(28,4) NOT NULL,
    "acceptedTradeInTotal" DECIMAL(32,15) NOT NULL,
    "defaultAcceptedTradeInTotal" DECIMAL(32,4) NOT NULL,
    "settlement" DECIMAL(32,4) NOT NULL,
    "defaultSettlement" DECIMAL(32,4) NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productPurity" INTEGER NOT NULL,
    "productWeight" DECIMAL(15,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."TradeIn" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "rateId" UUID NOT NULL,
    "purity" INTEGER NOT NULL,
    "weight" DECIMAL(15,3) NOT NULL,
    "appliedRate" DECIMAL(18,4) NOT NULL,
    "calculatedValue" DECIMAL(32,15) NOT NULL,
    "acceptedValue" DECIMAL(32,15) NOT NULL,
    "overridden" BOOLEAN NOT NULL,

    CONSTRAINT "TradeIn_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateTable
CREATE TABLE "mizan"."ReceivedOldGold" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tradeInId" UUID NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivedOldGold_pkey" PRIMARY KEY ("organizationId","storeId","tradeInId")
);

-- CreateTable
CREATE TABLE "mizan"."InventoryMovement" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "kind" "mizan"."MovementKind" NOT NULL,
    "productId" UUID,
    "saleId" UUID,
    "tradeInId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("organizationId","storeId","id")
);

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "mizan"."OrganizationMembership"("userId");

-- CreateIndex
CREATE INDEX "StoreAssignment_organizationId_userId_idx" ON "mizan"."StoreAssignment"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenDigest_key" ON "mizan"."Invitation"("tokenDigest");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_storeId_idx" ON "mizan"."Invitation"("organizationId", "storeId");

-- CreateIndex
CREATE INDEX "OldGoldRate_organizationId_purity_currency_effectiveAt_idx" ON "mizan"."OldGoldRate"("organizationId", "purity", "currency", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_code_key" ON "mizan"."Product"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_organizationId_storeId_productId_key" ON "mizan"."Sale"("organizationId", "storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_organizationId_storeId_actorId_idempotencyKey_key" ON "mizan"."Sale"("organizationId", "storeId", "actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TradeIn_organizationId_storeId_saleId_idx" ON "mizan"."TradeIn"("organizationId", "storeId", "saleId");

-- CreateIndex
CREATE INDEX "InventoryMovement_organizationId_storeId_productId_idx" ON "mizan"."InventoryMovement"("organizationId", "storeId", "productId");

-- AddForeignKey
ALTER TABLE "mizan"."Store" ADD CONSTRAINT "Store_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "mizan"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "mizan"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "mizan"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."StoreAssignment" ADD CONSTRAINT "StoreAssignment_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."StoreAssignment" ADD CONSTRAINT "StoreAssignment_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "mizan"."OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Invitation" ADD CONSTRAINT "Invitation_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Invitation" ADD CONSTRAINT "Invitation_organizationId_invitedById_fkey" FOREIGN KEY ("organizationId", "invitedById") REFERENCES "mizan"."OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."PurityGrade" ADD CONSTRAINT "PurityGrade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "mizan"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."OldGoldRate" ADD CONSTRAINT "OldGoldRate_organizationId_purity_fkey" FOREIGN KEY ("organizationId", "purity") REFERENCES "mizan"."PurityGrade"("organizationId", "value") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."OldGoldRate" ADD CONSTRAINT "OldGoldRate_organizationId_actorId_fkey" FOREIGN KEY ("organizationId", "actorId") REFERENCES "mizan"."OrganizationMembership"("organizationId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Product" ADD CONSTRAINT "Product_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Product" ADD CONSTRAINT "Product_organizationId_purity_fkey" FOREIGN KEY ("organizationId", "purity") REFERENCES "mizan"."PurityGrade"("organizationId", "value") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Sale" ADD CONSTRAINT "Sale_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."Sale" ADD CONSTRAINT "Sale_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."TradeIn" ADD CONSTRAINT "TradeIn_organizationId_storeId_saleId_fkey" FOREIGN KEY ("organizationId", "storeId", "saleId") REFERENCES "mizan"."Sale"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."TradeIn" ADD CONSTRAINT "TradeIn_organizationId_purity_rateId_fkey" FOREIGN KEY ("organizationId", "purity", "rateId") REFERENCES "mizan"."OldGoldRate"("organizationId", "purity", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."ReceivedOldGold" ADD CONSTRAINT "ReceivedOldGold_organizationId_storeId_tradeInId_fkey" FOREIGN KEY ("organizationId", "storeId", "tradeInId") REFERENCES "mizan"."TradeIn"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_saleId_fkey" FOREIGN KEY ("organizationId", "storeId", "saleId") REFERENCES "mizan"."Sale"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_storeId_tradeInId_fkey" FOREIGN KEY ("organizationId", "storeId", "tradeInId") REFERENCES "mizan"."TradeIn"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
