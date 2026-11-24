CREATE TYPE "mizan"."ProductRegistrationSource" AS ENUM ('OPENING_STOCK', 'SUPPLIER_PURCHASE', 'OTHER');

ALTER TABLE "mizan"."InventoryMovement" ADD COLUMN "registrationSource" "mizan"."ProductRegistrationSource";
ALTER TABLE "mizan"."Product" ADD COLUMN "historicalSupplierId" UUID, ADD COLUMN "historicalSupplierName" TEXT;
ALTER TABLE "mizan"."Purchase" ADD COLUMN "supplierName" TEXT;
ALTER TABLE "mizan"."SupplierPayment" ADD COLUMN "isInitial" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "mizan"."SupplierActivityKind" ADD VALUE 'HISTORICAL_PRODUCT_LINKED';
ALTER TABLE "mizan"."SupplierActivity" ADD COLUMN "productId" UUID;

CREATE TABLE "mizan"."ProductRegistration" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestDigest" TEXT NOT NULL,
    "productIds" UUID[],
    "purchaseId" UUID,
    CONSTRAINT "ProductRegistration_pkey" PRIMARY KEY ("organizationId", "storeId", "actorId", "idempotencyKey")
);

ALTER TABLE "mizan"."Product" ADD CONSTRAINT "Product_organizationId_storeId_historicalSupplierId_fkey" FOREIGN KEY ("organizationId", "storeId", "historicalSupplierId") REFERENCES "mizan"."Supplier"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mizan"."SupplierActivity" ADD CONSTRAINT "SupplierActivity_organizationId_storeId_productId_fkey" FOREIGN KEY ("organizationId", "storeId", "productId") REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mizan"."ProductRegistration" ADD CONSTRAINT "ProductRegistration_organizationId_storeId_actorId_fkey" FOREIGN KEY ("organizationId", "storeId", "actorId") REFERENCES "mizan"."StoreAssignment"("organizationId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mizan"."ProductRegistration" ADD CONSTRAINT "ProductRegistration_organizationId_storeId_purchaseId_fkey" FOREIGN KEY ("organizationId", "storeId", "purchaseId") REFERENCES "mizan"."Purchase"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mizan"."Product" ADD CONSTRAINT "Product_historical_supplier_pair" CHECK (("historicalSupplierId" IS NULL) = ("historicalSupplierName" IS NULL));
ALTER TABLE "mizan"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_registration_source" CHECK ("registrationSource" IS NULL OR (kind = 'PRODUCT_ADDED' AND "productId" IS NOT NULL));
CREATE UNIQUE INDEX "SupplierPayment_initial_per_purchase" ON "mizan"."SupplierPayment"("organizationId", "storeId", "purchaseId") WHERE "isInitial";
