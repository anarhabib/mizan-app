CREATE TABLE "mizan"."Customer" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneDigits" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("organizationId", "storeId", "id"),
    CONSTRAINT "Customer_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId")
        REFERENCES "mizan"."Store" ("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Customer_organizationId_storeId_createdAt_id_idx"
    ON "mizan"."Customer" ("organizationId", "storeId", "createdAt", "id");

ALTER TABLE "mizan"."Sale"
    ADD COLUMN "customerId" UUID,
    ADD COLUMN "customerReportingRate" DECIMAL(20,8),
    ADD CONSTRAINT "Sale_organizationId_storeId_customerId_fkey" FOREIGN KEY ("organizationId", "storeId", "customerId")
        REFERENCES "mizan"."Customer" ("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Sale_customer_reporting_check" CHECK (
        ("customerId" IS NULL AND "customerReportingRate" IS NULL)
        OR ("customerId" IS NOT NULL AND "customerReportingRate" IS NOT NULL AND "customerReportingRate" > 0)
    );

CREATE INDEX "Sale_customer_history_idx"
    ON "mizan"."Sale" ("organizationId", "storeId", "customerId", "createdAt", "id");
