CREATE TABLE "mizan"."JewelrySet" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JewelrySet_pkey" PRIMARY KEY ("organizationId", "storeId", "id"),
    CONSTRAINT "JewelrySet_organizationId_storeId_fkey"
        FOREIGN KEY ("organizationId", "storeId")
        REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "mizan"."JewelrySetMember" (
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "setId" UUID NOT NULL,

    CONSTRAINT "JewelrySetMember_pkey" PRIMARY KEY ("organizationId", "storeId", "productId"),
    CONSTRAINT "JewelrySetMember_organizationId_storeId_setId_fkey"
        FOREIGN KEY ("organizationId", "storeId", "setId")
        REFERENCES "mizan"."JewelrySet"("organizationId", "storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JewelrySetMember_organizationId_storeId_productId_fkey"
        FOREIGN KEY ("organizationId", "storeId", "productId")
        REFERENCES "mizan"."Product"("organizationId", "storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "JewelrySetMember_organizationId_storeId_setId_idx"
    ON "mizan"."JewelrySetMember"("organizationId", "storeId", "setId");
