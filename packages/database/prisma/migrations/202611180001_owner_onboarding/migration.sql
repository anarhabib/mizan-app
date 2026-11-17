CREATE TABLE "mizan"."OwnerOnboarding" (
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    CONSTRAINT "OwnerOnboarding_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "OwnerOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "mizan"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OwnerOnboarding_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "mizan"."Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
